const express = require('express');
const router = express.Router();
const db = require('../db');
// const { requirePermission } = require('../middleware/rbac'); // 인증 비활성화

// 목록 조회
router.get('/', async (req, res) => {
  const { status, search, sales_contract_id, amount_min, amount_max, client_id, issue_from, issue_to, due_from, due_to } = req.query;
  try {
    const where = ['1=1'];
    const params = [];
    if (status && status !== 'all') { where.push('i.status = ?'); params.push(status); }
    if (search) {
      where.push('(i.invoice_no LIKE ? OR c.client_name LIKE ? OR sc.contract_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (sales_contract_id) { where.push('i.sales_contract_id = ?'); params.push(sales_contract_id); }
    if (amount_min)  { where.push('i.amount >= ?'); params.push(parseFloat(amount_min)); }
    if (amount_max)  { where.push('i.amount <= ?'); params.push(parseFloat(amount_max)); }
    if (client_id)   { where.push('i.client_id = ?'); params.push(client_id); }
    if (issue_from)  { where.push('i.issue_date >= ?'); params.push(issue_from); }
    if (issue_to)    { where.push('i.issue_date <= ?'); params.push(issue_to); }
    if (due_from)    { where.push('i.due_date >= ?'); params.push(due_from); }
    if (due_to)      { where.push('i.due_date <= ?'); params.push(due_to); }

    const [rows] = await db.query(`
      SELECT i.*, c.client_name, sc.contract_name AS sales_contract_name
      FROM invoice i
      LEFT JOIN client c ON c.id = i.client_id
      LEFT JOIN sales_contract sc ON sc.id = i.sales_contract_id
      WHERE ${where.join(' AND ')}
      ORDER BY i.created_at DESC
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
      SELECT i.*, c.client_name, sc.contract_name AS sales_contract_name
      FROM invoice i
      LEFT JOIN client c ON c.id = i.client_id
      LEFT JOIN sales_contract sc ON sc.id = i.sales_contract_id
      WHERE i.id = ?
    `, [req.params.id]);
    if (!row) return res.status(404).json({ error: '인보이스를 찾을 수 없습니다' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 등록
router.post('/', async (req, res) => {
  const { invoice_no, sales_contract_id, client_id, amount, currency, original_amount, issue_date, due_date, status, notes } = req.body;
  try {
    const [result] = await db.query(
      `INSERT INTO invoice
        (invoice_no, sales_contract_id, client_id, amount, currency, original_amount, issue_date, due_date, status, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [invoice_no, sales_contract_id, client_id, amount, currency || 'KRW', original_amount || amount, issue_date, due_date, status || '발행', notes || null]
    );
    await req.audit('CREATE', 'invoice', result.insertId, null, req.body);
    res.status(201).json({ id: result.insertId, message: '인보이스가 등록되었습니다' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '이미 존재하는 인보이스 번호입니다' });
    res.status(500).json({ error: err.message });
  }
});

// 수정
router.put('/:id', async (req, res) => {
  const { invoice_no, sales_contract_id, client_id, amount, currency, original_amount, issue_date, due_date, status, paid_amount, paid_date, notes } = req.body;
  try {
    const [before] = await db.query('SELECT * FROM invoice WHERE id = ?', [req.params.id]);
    if (!before.length) return res.status(404).json({ error: '인보이스를 찾을 수 없습니다' });
    await db.query(
      `UPDATE invoice
       SET invoice_no=?, sales_contract_id=?, client_id=?, amount=?,
           currency=?, original_amount=?,
           issue_date=?, due_date=?, status=?, paid_amount=?, paid_date=?, notes=?
       WHERE id=?`,
      [invoice_no, sales_contract_id, client_id, amount, currency || 'KRW', original_amount || amount, issue_date, due_date, status, paid_amount || 0, paid_date || null, notes || null, req.params.id]
    );
    await req.audit('UPDATE', 'invoice', parseInt(req.params.id), before[0], req.body);
    res.json({ message: '인보이스가 수정되었습니다' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '이미 존재하는 인보이스 번호입니다' });
    res.status(500).json({ error: err.message });
  }
});

// 삭제
router.delete('/:id', async (req, res) => {
  try {
    const [before] = await db.query('SELECT * FROM invoice WHERE id = ?', [req.params.id]);
    if (!before.length) return res.status(404).json({ error: '인보이스를 찾을 수 없습니다' });
    await db.query('DELETE FROM invoice WHERE id = ?', [req.params.id]);
    await req.audit('DELETE', 'invoice', parseInt(req.params.id), before[0], null);
    res.json({ message: '인보이스가 삭제되었습니다' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 수금 처리
router.post('/:id/pay', async (req, res) => {
  const { paid_amount, paid_date } = req.body;
  if (!paid_amount || !paid_date) {
    return res.status(400).json({ error: '수금액과 수금일을 입력해주세요' });
  }
  try {
    const [[invoice]] = await db.query('SELECT * FROM invoice WHERE id = ?', [req.params.id]);
    if (!invoice) return res.status(404).json({ error: '인보이스를 찾을 수 없습니다' });

    const newPaidAmount = Number(invoice.paid_amount || 0) + Number(paid_amount);
    const newStatus = newPaidAmount >= Number(invoice.amount) ? '수금완료' : invoice.status;

    await db.query(
      'UPDATE invoice SET paid_amount = ?, paid_date = ?, status = ? WHERE id = ?',
      [newPaidAmount, paid_date, newStatus, req.params.id]
    );
    await req.audit('UPDATE', 'invoice', parseInt(req.params.id), invoice, { paid_amount: newPaidAmount, paid_date, status: newStatus });
    res.json({ message: '수금 처리가 완료되었습니다', paid_amount: newPaidAmount, status: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
