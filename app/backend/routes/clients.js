const express = require('express');
const router = express.Router();
const db = require('../db');

// 거래처 목록 (필터: type, search)
router.get('/', async (req, res, next) => {
  try {
    const { type, search } = req.query;
    let where = '1=1';
    const params = [];

    if (type) {
      where += ' AND c.client_type = ?';
      params.push(type);
    }
    if (search) {
      where += ' AND (c.name LIKE ? OR c.business_no LIKE ? OR c.ceo_name LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const sql = `
      SELECT c.*,
        (SELECT COUNT(*) FROM sales_contract sc WHERE sc.client_id = c.id) AS sales_count,
        (SELECT COUNT(*) FROM purchase_contract pc WHERE pc.vendor_id = c.id) AS purchase_count
      FROM client c
      WHERE ${where}
      ORDER BY c.name
    `;
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// 거래처 상세
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM sales_contract sc WHERE sc.client_id = c.id) AS sales_count,
        (SELECT COUNT(*) FROM purchase_contract pc WHERE pc.vendor_id = c.id) AS purchase_count
       FROM client c WHERE c.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: '거래처를 찾을 수 없습니다.' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// 거래처 등록
router.post('/', async (req, res, next) => {
  try {
    const { name, business_no, ceo_name, address, phone, email, client_type, notes } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: '거래처명은 필수입니다.' });
    if (!client_type) return res.status(400).json({ error: '거래처 유형은 필수입니다.' });

    const [r] = await db.query(
      `INSERT INTO client (name, business_no, ceo_name, address, phone, email, client_type, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name.trim(), business_no || null, ceo_name || null, address || null, phone || null, email || null, client_type, notes || null]
    );
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    next(err);
  }
});

// 거래처 수정
router.put('/:id', async (req, res, next) => {
  try {
    const { name, business_no, ceo_name, address, phone, email, client_type, notes } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: '거래처명은 필수입니다.' });
    if (!client_type) return res.status(400).json({ error: '거래처 유형은 필수입니다.' });

    await db.query(
      `UPDATE client SET name=?, business_no=?, ceo_name=?, address=?, phone=?, email=?, client_type=?, notes=?
       WHERE id=?`,
      [name.trim(), business_no || null, ceo_name || null, address || null, phone || null, email || null, client_type, notes || null, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// 거래처 삭제 (연결된 계약이 있으면 거부)
router.delete('/:id', async (req, res, next) => {
  try {
    const [[{ sc }]] = await db.query(
      'SELECT COUNT(*) AS sc FROM sales_contract WHERE client_id = ?', [req.params.id]
    );
    const [[{ pc }]] = await db.query(
      'SELECT COUNT(*) AS pc FROM purchase_contract WHERE vendor_id = ?', [req.params.id]
    );
    if (sc > 0 || pc > 0) {
      return res.status(400).json({ error: `연결된 계약이 있어 삭제할 수 없습니다. (매출: ${sc}건, 매입: ${pc}건)` });
    }
    await db.query('DELETE FROM client WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
