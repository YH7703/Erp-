const express = require('express');
const router = express.Router();
const db = require('../db');
// const { requirePermission } = require('../middleware/rbac'); // 인증 비활성화

// 목록 조회
router.get('/', async (req, res) => {
  const { status, search, sales_contract_id, start_from, start_to, end_from, end_to, amount_min, amount_max, vendor_id } = req.query;
  try {
    const where = ['1=1'];
    const params = [];
    if (status && status !== 'all') { where.push('pc.status = ?'); params.push(status); }
    if (search)           { where.push('(pc.contract_name LIKE ? OR pc.vendor_name LIKE ? OR pc.worker_name LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (sales_contract_id){ where.push('pc.sales_contract_id = ?'); params.push(sales_contract_id); }
    if (start_from) { where.push('pc.start_date >= ?'); params.push(start_from); }
    if (start_to)   { where.push('pc.start_date <= ?'); params.push(start_to); }
    if (end_from)   { where.push('pc.end_date >= ?'); params.push(end_from); }
    if (end_to)     { where.push('pc.end_date <= ?'); params.push(end_to); }
    if (amount_min) { where.push('pc.amount >= ?'); params.push(parseFloat(amount_min)); }
    if (amount_max) { where.push('pc.amount <= ?'); params.push(parseFloat(amount_max)); }
    if (vendor_id)  { where.push('pc.vendor_id = ?'); params.push(vendor_id); }

    const [rows] = await db.query(`
      SELECT pc.*, sc.contract_name AS linked_sales_name, sc.client_name, s.name AS salesperson_name
      FROM purchase_contract pc
      LEFT JOIN sales_contract sc ON sc.id = pc.sales_contract_id
      LEFT JOIN salesperson    s  ON s.id  = sc.salesperson_id
      WHERE ${where.join(' AND ')}
      ORDER BY pc.contract_no ASC
    `, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 단건 조회
router.get('/:id', async (req, res) => {
  try {
    const [[row]] = await db.query(`
      SELECT pc.*, sc.contract_name AS linked_sales_name, sc.client_name, s.name AS salesperson_name
      FROM purchase_contract pc
      LEFT JOIN sales_contract sc ON sc.id = pc.sales_contract_id
      LEFT JOIN salesperson    s  ON s.id  = sc.salesperson_id
      WHERE pc.id = ?
    `, [req.params.id]);
    if (!row) return res.status(404).json({ error: '계약을 찾을 수 없습니다' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 다음 순번 계약번호 생성
async function generateContractNo() {
  const [[{ maxNo }]] = await db.query(
    `SELECT MAX(CAST(SUBSTRING(contract_no, 4) AS UNSIGNED)) AS maxNo
     FROM purchase_contract
     WHERE contract_no REGEXP '^PC-[0-9]+$'`
  );
  const next = (maxNo || 0) + 1;
  return `PC-${String(next).padStart(4, '0')}`;
}

// 등록
router.post('/', async (req, res) => {
  const { contract_name, vendor_id, vendor_name, worker_name, monthly_rate, months, currency, original_monthly_rate, start_date, end_date, status, sales_contract_id, notes } = req.body;
  const amount = Number(monthly_rate) * Number(months);
  try {
    const contract_no = await generateContractNo();
    const [result] = await db.query(
      `INSERT INTO purchase_contract
        (contract_no, contract_name, vendor_id, vendor_name, worker_name, monthly_rate, months, amount, currency, original_monthly_rate, start_date, end_date, status, sales_contract_id, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [contract_no, contract_name, vendor_id || null, vendor_name, worker_name || null, monthly_rate, months, amount, currency || 'KRW', original_monthly_rate || monthly_rate, start_date, end_date, status || '등록', sales_contract_id, notes || null]
    );
    await req.audit('CREATE', 'purchase_contract', result.insertId, null, { ...req.body, contract_no });
    res.status(201).json({ id: result.insertId, contract_no, message: '매입계약이 등록되었습니다' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '이미 존재하는 계약번호입니다' });
    res.status(500).json({ error: err.message });
  }
});

// 수정 (계약번호는 변경 불가)
router.put('/:id', async (req, res) => {
  const { contract_name, vendor_id, vendor_name, worker_name, monthly_rate, months, currency, original_monthly_rate, start_date, end_date, status, sales_contract_id, notes } = req.body;
  const amount = Number(monthly_rate) * Number(months);
  try {
    const [before] = await db.query('SELECT * FROM purchase_contract WHERE id = ?', [req.params.id]);
    if (!before.length) return res.status(404).json({ error: '계약을 찾을 수 없습니다' });
    await db.query(
      `UPDATE purchase_contract
       SET contract_name=?, vendor_id=?, vendor_name=?, worker_name=?,
           monthly_rate=?, months=?, amount=?, currency=?, original_monthly_rate=?,
           start_date=?, end_date=?, status=?, sales_contract_id=?, notes=?
       WHERE id=?`,
      [contract_name, vendor_id || null, vendor_name, worker_name || null, monthly_rate, months, amount, currency || 'KRW', original_monthly_rate || monthly_rate, start_date, end_date, status, sales_contract_id, notes || null, req.params.id]
    );
    await req.audit('UPDATE', 'purchase_contract', parseInt(req.params.id), before[0], req.body);
    res.json({ message: '매입계약이 수정되었습니다' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 삭제
router.delete('/:id', async (req, res) => {
  try {
    const [before] = await db.query('SELECT * FROM purchase_contract WHERE id = ?', [req.params.id]);
    await db.query('DELETE FROM purchase_contract WHERE id = ?', [req.params.id]);
    await req.audit('DELETE', 'purchase_contract', parseInt(req.params.id), before[0], null);
    res.json({ message: '매입계약이 삭제되었습니다' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
