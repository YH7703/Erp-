const express = require('express');
const router = express.Router();
const db = require('../db');

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
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { name, email, department } = req.body;
  try {
    await db.query(
      'UPDATE salesperson SET name=?, email=?, department=? WHERE id=?',
      [name, email || null, department || null, req.params.id]
    );
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
    await db.query('DELETE FROM salesperson WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
