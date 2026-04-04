const express = require('express');
const router = express.Router();
const db = require('../db');

// 목록 조회
router.get('/', async (req, res) => {
  const { status, search, salesperson_id } = req.query;
  try {
    const where = ['1=1'];
    const params = [];
    if (status && status !== 'all') { where.push('sc.status = ?'); params.push(status); }
    if (search)        { where.push('(sc.contract_name LIKE ? OR sc.client_name LIKE ? OR sc.contract_no LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (salesperson_id){ where.push('sc.salesperson_id = ?'); params.push(salesperson_id); }

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
      ORDER BY sc.created_at DESC
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

// 등록
router.post('/', async (req, res) => {
  const { contract_no, contract_name, client_name, amount, start_date, end_date, status, project_type, salesperson_id, notes } = req.body;
  try {
    const [result] = await db.query(
      `INSERT INTO sales_contract
        (contract_no, contract_name, client_name, amount, start_date, end_date, status, project_type, salesperson_id, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [contract_no, contract_name, client_name, amount, start_date, end_date, status || '등록', project_type, salesperson_id, notes || null]
    );
    res.status(201).json({ id: result.insertId, message: '매출계약이 등록되었습니다' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '이미 존재하는 계약번호입니다' });
    res.status(500).json({ error: err.message });
  }
});

// 수정
router.put('/:id', async (req, res) => {
  const { contract_no, contract_name, client_name, amount, start_date, end_date, status, project_type, salesperson_id, notes } = req.body;
  try {
    await db.query(
      `UPDATE sales_contract
       SET contract_no=?, contract_name=?, client_name=?, amount=?,
           start_date=?, end_date=?, status=?, project_type=?, salesperson_id=?, notes=?
       WHERE id=?`,
      [contract_no, contract_name, client_name, amount, start_date, end_date, status, project_type, salesperson_id, notes || null, req.params.id]
    );
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
    await db.query('DELETE FROM sales_contract WHERE id = ?', [req.params.id]);
    res.json({ message: '매출계약이 삭제되었습니다' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
