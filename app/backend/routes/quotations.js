const express = require('express');
const router = express.Router();
const db = require('../db');
// const { requirePermission } = require('../middleware/rbac'); // 인증 비활성화

// 목록 조회
router.get('/', async (req, res) => {
  const { status, search, salesperson_id, amount_min, amount_max, client_id, valid_from, valid_to } = req.query;
  try {
    const where = ['1=1'];
    const params = [];
    if (status && status !== 'all') { where.push('q.status = ?'); params.push(status); }
    if (search) {
      where.push('(q.title LIKE ? OR q.quotation_no LIKE ? OR c.name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (salesperson_id) { where.push('q.salesperson_id = ?'); params.push(salesperson_id); }
    if (amount_min) { where.push('q.amount >= ?'); params.push(parseFloat(amount_min)); }
    if (amount_max) { where.push('q.amount <= ?'); params.push(parseFloat(amount_max)); }
    if (client_id)  { where.push('q.client_id = ?'); params.push(client_id); }
    if (valid_from) { where.push('q.valid_until >= ?'); params.push(valid_from); }
    if (valid_to)   { where.push('q.valid_until <= ?'); params.push(valid_to); }

    const [rows] = await db.query(`
      SELECT q.*, c.name AS client_name, s.name AS salesperson_name,
        (SELECT COUNT(*) FROM quotation_item qi WHERE qi.quotation_id = q.id) AS item_count
      FROM quotation q
      LEFT JOIN client c ON c.id = q.client_id
      LEFT JOIN salesperson s ON s.id = q.salesperson_id
      WHERE ${where.join(' AND ')}
      ORDER BY q.created_at DESC
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
      SELECT q.*, c.name AS client_name, s.name AS salesperson_name
      FROM quotation q
      LEFT JOIN client c ON c.id = q.client_id
      LEFT JOIN salesperson s ON s.id = q.salesperson_id
      WHERE q.id = ?
    `, [req.params.id]);
    if (!row) return res.status(404).json({ error: '견적서를 찾을 수 없습니다' });

    const [items] = await db.query(
      'SELECT * FROM quotation_item WHERE quotation_id = ? ORDER BY sort_order',
      [req.params.id]
    );
    row.items = items;
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 등록
router.post('/', async (req, res) => {
  const { quotation_no, title, client_id, salesperson_id, status, valid_until, currency, notes, items } = req.body;
  try {
    const amount = (items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);

    const [result] = await db.query(
      `INSERT INTO quotation
        (quotation_no, title, client_id, amount, currency, original_amount, status, valid_until, salesperson_id, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [quotation_no, title, client_id, amount, currency || 'KRW', amount, status || '작성', valid_until || null, salesperson_id, notes || null]
    );
    const quotationId = result.insertId;

    if (items && items.length > 0) {
      const values = items.map((it, i) => [
        quotationId, it.description, Number(it.quantity) || 0, Number(it.unit_price) || 0,
        (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), i + 1
      ]);
      await db.query(
        'INSERT INTO quotation_item (quotation_id, description, quantity, unit_price, amount, sort_order) VALUES ?',
        [values]
      );
    }

    await req.audit('CREATE', 'quotation', quotationId, null, req.body);
    res.status(201).json({ id: quotationId, message: '견적서가 등록되었습니다' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '이미 존재하는 견적번호입니다' });
    res.status(500).json({ error: err.message });
  }
});

// 수정
router.put('/:id', async (req, res) => {
  const { quotation_no, title, client_id, salesperson_id, status, valid_until, currency, notes, items } = req.body;
  try {
    const [before] = await db.query('SELECT * FROM quotation WHERE id = ?', [req.params.id]);
    if (!before.length) return res.status(404).json({ error: '견적서를 찾을 수 없습니다' });

    const amount = (items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);

    await db.query(
      `UPDATE quotation
       SET quotation_no=?, title=?, client_id=?, amount=?, currency=?, original_amount=?,
           status=?, valid_until=?, salesperson_id=?, notes=?
       WHERE id=?`,
      [quotation_no, title, client_id, amount, currency || 'KRW', amount, status, valid_until || null, salesperson_id, notes || null, req.params.id]
    );

    // 항목 교체: 기존 삭제 후 재삽입
    await db.query('DELETE FROM quotation_item WHERE quotation_id = ?', [req.params.id]);
    if (items && items.length > 0) {
      const values = items.map((it, i) => [
        parseInt(req.params.id), it.description, Number(it.quantity) || 0, Number(it.unit_price) || 0,
        (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), i + 1
      ]);
      await db.query(
        'INSERT INTO quotation_item (quotation_id, description, quantity, unit_price, amount, sort_order) VALUES ?',
        [values]
      );
    }

    await req.audit('UPDATE', 'quotation', parseInt(req.params.id), before[0], req.body);
    res.json({ message: '견적서가 수정되었습니다' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '이미 존재하는 견적번호입니다' });
    res.status(500).json({ error: err.message });
  }
});

// 삭제
router.delete('/:id', async (req, res) => {
  try {
    const [before] = await db.query('SELECT * FROM quotation WHERE id = ?', [req.params.id]);
    if (!before.length) return res.status(404).json({ error: '견적서를 찾을 수 없습니다' });
    if (before[0].status === '계약전환') return res.status(400).json({ error: '계약전환된 견적서는 삭제할 수 없습니다' });

    await db.query('DELETE FROM quotation WHERE id = ?', [req.params.id]);
    await req.audit('DELETE', 'quotation', parseInt(req.params.id), before[0], null);
    res.json({ message: '견적서가 삭제되었습니다' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 계약 전환
router.post('/:id/convert', async (req, res) => {
  const { contract_no, start_date, end_date, project_type } = req.body;
  try {
    const [[quotation]] = await db.query(`
      SELECT q.*, c.name AS client_name
      FROM quotation q
      LEFT JOIN client c ON c.id = q.client_id
      WHERE q.id = ?
    `, [req.params.id]);
    if (!quotation) return res.status(404).json({ error: '견적서를 찾을 수 없습니다' });
    if (quotation.status !== '승인') return res.status(400).json({ error: '승인 상태의 견적서만 계약으로 전환할 수 있습니다' });

    const [contractResult] = await db.query(
      `INSERT INTO sales_contract
        (contract_no, contract_name, client_name, amount, currency, original_amount, start_date, end_date, status, project_type, salesperson_id, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [contract_no, quotation.title, quotation.client_name, quotation.amount, quotation.currency || 'KRW', quotation.original_amount || quotation.amount, start_date, end_date, '등록', project_type, quotation.salesperson_id, quotation.notes || null]
    );

    await db.query(
      'UPDATE quotation SET status = ?, converted_contract_id = ? WHERE id = ?',
      ['계약전환', contractResult.insertId, req.params.id]
    );

    await req.audit('CREATE', 'sales_contract', contractResult.insertId, null, { from_quotation: req.params.id, ...req.body });
    await req.audit('UPDATE', 'quotation', parseInt(req.params.id), quotation, { status: '계약전환', converted_contract_id: contractResult.insertId });

    res.status(201).json({ id: contractResult.insertId, message: '견적서가 매출계약으로 전환되었습니다' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '이미 존재하는 계약번호입니다' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
