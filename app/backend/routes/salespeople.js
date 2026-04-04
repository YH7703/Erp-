const express = require('express');
const router = express.Router();
const db = require('../db');
// const { requirePermission } = require('../middleware/rbac'); // 인증 비활성화

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM salesperson ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { name, email, department } = req.body;
  try {
    const [r] = await db.query(
      'INSERT INTO salesperson (name, email, department) VALUES (?,?,?)',
      [name, email || null, department || null]
    );
    await req.audit('CREATE', 'salesperson', r.insertId, null, req.body);
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { name, email, department } = req.body;
  try {
    const [before] = await db.query('SELECT * FROM salesperson WHERE id = ?', [req.params.id]);
    await db.query(
      'UPDATE salesperson SET name=?, email=?, department=? WHERE id=?',
      [name, email || null, department || null, req.params.id]
    );
    await req.audit('UPDATE', 'salesperson', parseInt(req.params.id), before[0], req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const [[{ cnt }]] = await db.query(
      'SELECT COUNT(*) AS cnt FROM sales_contract WHERE salesperson_id=?', [req.params.id]
    );
    if (cnt > 0) return res.status(400).json({ error: '담당 계약이 있어 삭제할 수 없습니다.' });
    const [before] = await db.query('SELECT * FROM salesperson WHERE id = ?', [req.params.id]);
    await db.query('DELETE FROM salesperson WHERE id=?', [req.params.id]);
    await req.audit('DELETE', 'salesperson', parseInt(req.params.id), before[0], null);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
