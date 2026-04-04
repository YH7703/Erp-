const express = require('express');
const router = express.Router();
const db = require('../db');

// 목록 조회
router.get('/', async (req, res) => {
  const { status, search, sales_contract_id } = req.query;
  try {
    const where = ['1=1'];
    const params = [];
    if (status && status !== 'all') { where.push('pc.status = ?'); params.push(status); }
    if (search)           { where.push('(pc.contract_name LIKE ? OR pc.vendor_name LIKE ? OR pc.worker_name LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (sales_contract_id){ where.push('pc.sales_contract_id = ?'); params.push(sales_contract_id); }

    const [rows] = await db.query(`
      SELECT pc.*, sc.contract_name AS linked_sales_name, sc.client_name, s.name AS salesperson_name
      FROM purchase_contract pc
      LEFT JOIN sales_contract sc ON sc.id = pc.sales_contract_id
      LEFT JOIN salesperson    s  ON s.id  = sc.salesperson_id
      WHERE ${where.join(' AND ')}
      ORDER BY pc.created_at DESC
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

// 등록
router.post('/', async (req, res) => {
  const { contract_no, contract_name, vendor_name, worker_name, monthly_rate, months, start_date, end_date, status, sales_contract_id, notes } = req.body;
  const amount = Number(monthly_rate) * Number(months);
  try {
    const [result] = await db.query(
      `INSERT INTO purchase_contract
        (contract_no, contract_name, vendor_name, worker_name, monthly_rate, months, amount, start_date, end_date, status, sales_contract_id, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [contract_no, contract_name, vendor_name, worker_name || null, monthly_rate, months, amount, start_date, end_date, status || '등록', sales_contract_id, notes || null]
    );
    res.status(201).json({ id: result.insertId, message: '매입계약이 등록되었습니다' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '이미 존재하는 계약번호입니다' });
    res.status(500).json({ error: err.message });
  }
});

// 수정
router.put('/:id', async (req, res) => {
  const { contract_no, contract_name, vendor_name, worker_name, monthly_rate, months, start_date, end_date, status, sales_contract_id, notes } = req.body;
  const amount = Number(monthly_rate) * Number(months);
  try {
    await db.query(
      `UPDATE purchase_contract
       SET contract_no=?, contract_name=?, vendor_name=?, worker_name=?,
           monthly_rate=?, months=?, amount=?, start_date=?, end_date=?,
           status=?, sales_contract_id=?, notes=?
       WHERE id=?`,
      [contract_no, contract_name, vendor_name, worker_name || null, monthly_rate, months, amount, start_date, end_date, status, sales_contract_id, notes || null, req.params.id]
    );
    res.json({ message: '매입계약이 수정되었습니다' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 삭제
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM purchase_contract WHERE id = ?', [req.params.id]);
    res.json({ message: '매입계약이 삭제되었습니다' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
