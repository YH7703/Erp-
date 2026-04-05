const express = require('express');
const router = express.Router();
const db = require('../db');
// const { requirePermission } = require('../middleware/rbac'); // 인증 비활성화

// DB ENUM 값을 동적으로 가져오는 헬퍼 함수
async function getSalesContractStatusEnum() {
  const [[col]] = await db.query(`
    SELECT COLUMN_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'sales_contract'
      AND COLUMN_NAME  = 'status'
  `);
  if (!col) return [];
  // COLUMN_TYPE 예시: "enum('등록','진행중','완료','취소')"
  const match = col.COLUMN_TYPE.match(/^enum\((.+)\)$/i);
  if (!match) return [];
  return match[1].split(',').map(v => v.replace(/'/g, '').trim());
}

// 목록 조회
router.get('/', async (req, res) => {
  const { status, search, salesperson_id, start_from, start_to, end_from, end_to, amount_min, amount_max, project_type, client_id } = req.query;
  try {
    const where = ['1=1'];
    const params = [];
    if (status && status !== 'all') { where.push('sc.status = ?'); params.push(status); }
    if (search)        { where.push('(sc.contract_name LIKE ? OR sc.client_name LIKE ? OR sc.contract_no LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (salesperson_id){ where.push('sc.salesperson_id = ?'); params.push(salesperson_id); }
    if (start_from) { where.push('sc.start_date >= ?'); params.push(start_from); }
    if (start_to) { where.push('sc.start_date <= ?'); params.push(start_to); }
    if (end_from) { where.push('sc.end_date >= ?'); params.push(end_from); }
    if (end_to) { where.push('sc.end_date <= ?'); params.push(end_to); }
    if (amount_min) { where.push('sc.amount >= ?'); params.push(parseFloat(amount_min)); }
    if (amount_max) { where.push('sc.amount <= ?'); params.push(parseFloat(amount_max)); }
    if (project_type) { where.push('sc.project_type = ?'); params.push(project_type); }
    if (client_id) { where.push('sc.client_id = ?'); params.push(client_id); }

    const [rows] = await db.query(`
      SELECT sc.*, s.name AS salesperson_name,
        COALESCE(SUM(pc.amount), 0) AS total_purchase,
        sc.amount - COALESCE(SUM(pc.amount), 0) AS net_profit,
        CASE WHEN sc.amount > 0
          THEN ROUND((sc.amount - COALESCE(SUM(pc.amount),0)) / sc.amount * 100, 1)
          ELSE 0 END AS roi,
        COUNT(pc.id) AS purchase_count
      FROM sales_contract sc
      LEFT JOIN salesperson       s  ON s.id = sc.salesperson_id
      LEFT JOIN purchase_contract pc ON pc.sales_contract_id = sc.id
      WHERE ${where.join(' AND ')}
      GROUP BY sc.id
      ORDER BY sc.contract_no ASC
    `, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 단건 조회 (연결된 매입계약 포함)
router.get('/:id', async (req, res) => {
  try {
    const [[row]] = await db.query(`
      SELECT sc.*, s.name AS salesperson_name
      FROM sales_contract sc
      LEFT JOIN salesperson s ON s.id = sc.salesperson_id
      WHERE sc.id = ?
    `, [req.params.id]);
    if (!row) return res.status(404).json({ error: '계약을 찾을 수 없습니다' });

    const [purchases] = await db.query(
      'SELECT * FROM purchase_contract WHERE sales_contract_id = ? ORDER BY created_at',
      [req.params.id]
    );
    row.purchase_contracts = purchases;
    row.total_purchase = purchases.reduce((s, p) => s + Number(p.amount), 0);
    row.net_profit     = Number(row.amount) - row.total_purchase;
    row.roi            = row.amount > 0 ? +((row.net_profit / Number(row.amount)) * 100).toFixed(1) : 0;
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 다음 순번 계약번호 생성
async function generateContractNo() {
  const [[{ maxNo }]] = await db.query(
    `SELECT MAX(CAST(SUBSTRING(contract_no, 4) AS UNSIGNED)) AS maxNo
     FROM sales_contract
     WHERE contract_no REGEXP '^SC-[0-9]+$'`
  );
  const next = (maxNo || 0) + 1;
  return `SC-${String(next).padStart(4, '0')}`;
}

// 등록
router.post('/', async (req, res) => {
  const { contract_name, client_id, client_name, amount, currency, original_amount, start_date, end_date, status, project_type, salesperson_id, notes } = req.body;

  // DB ENUM에서 허용값을 동적으로 가져와 검증
  const VALID_STATUS = await getSalesContractStatusEnum();
  const resolvedStatus = (status && status.trim() !== '') ? status.trim() : (VALID_STATUS[0] || '등록');
  if (VALID_STATUS.length > 0 && !VALID_STATUS.includes(resolvedStatus)) {
    return res.status(400).json({ error: `status 값이 유효하지 않습니다. 허용값: ${VALID_STATUS.join(', ')}` });
  }

  try {
    const contract_no = await generateContractNo();
    const [result] = await db.query(
      `INSERT INTO sales_contract
        (contract_no, contract_name, client_id, client_name, amount, currency, original_amount, start_date, end_date, status, project_type, salesperson_id, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [contract_no, contract_name, client_id || null, client_name, amount, currency || 'KRW', original_amount || amount, start_date, end_date, resolvedStatus, project_type, salesperson_id, notes || null]
    );
    await req.audit('CREATE', 'sales_contract', result.insertId, null, { ...req.body, contract_no });
    res.status(201).json({ id: result.insertId, contract_no, message: '매출계약이 등록되었습니다' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '이미 존재하는 계약번호입니다' });
    res.status(500).json({ error: err.message });
  }
});

// 수정 (계약번호는 변경 불가)
router.put('/:id', async (req, res) => {
  const { contract_name, client_id, client_name, amount, currency, original_amount, start_date, end_date, status, project_type, salesperson_id, notes } = req.body;
  try {
    const [before] = await db.query('SELECT * FROM sales_contract WHERE id = ?', [req.params.id]);
    if (!before.length) return res.status(404).json({ error: '계약을 찾을 수 없습니다' });
    await db.query(
      `UPDATE sales_contract
       SET contract_name=?, client_id=?, client_name=?, amount=?,
           currency=?, original_amount=?,
           start_date=?, end_date=?, status=?, project_type=?, salesperson_id=?, notes=?
       WHERE id=?`,
      [contract_name, client_id || null, client_name, amount, currency || 'KRW', original_amount || amount, start_date, end_date, status, project_type, salesperson_id, notes || null, req.params.id]
    );
    await req.audit('UPDATE', 'sales_contract', parseInt(req.params.id), before[0], req.body);
    res.json({ message: '매출계약이 수정되었습니다' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 삭제
router.delete('/:id', async (req, res) => {
  try {
    const [[{ cnt }]] = await db.query(
      'SELECT COUNT(*) AS cnt FROM purchase_contract WHERE sales_contract_id = ?', [req.params.id]
    );
    if (cnt > 0) return res.status(400).json({ error: `연결된 매입계약 ${cnt}건이 있어 삭제할 수 없습니다` });
    const [before] = await db.query('SELECT * FROM sales_contract WHERE id = ?', [req.params.id]);
    await db.query('DELETE FROM sales_contract WHERE id = ?', [req.params.id]);
    await req.audit('DELETE', 'sales_contract', parseInt(req.params.id), before[0], null);
    res.json({ message: '매출계약이 삭제되었습니다' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
