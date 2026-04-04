const express = require('express');
const router = express.Router();
const db = require('../db');

// 전체 영업사원 성과
router.get('/', async (req, res) => {
  const { start, end } = req.query;
  try {
    const dateWhere = [];
    const params = [];
    if (start) { dateWhere.push('sc.start_date >= ?'); params.push(start); }
    if (end)   { dateWhere.push('sc.start_date <= ?'); params.push(end); }
    const scFilter = dateWhere.length ? `AND ${dateWhere.join(' AND ')}` : '';

    const [rows] = await db.query(`
      SELECT
        s.id, s.name, s.department,
        COUNT(DISTINCT sc.id)                                      AS contract_count,
        COALESCE(SUM(sc.amount), 0)                                AS total_sales,
        COALESCE(SUM(
          (SELECT SUM(pc.amount) FROM purchase_contract pc WHERE pc.sales_contract_id = sc.id)
        ), 0)                                                       AS total_purchase,
        COALESCE(SUM(sc.amount), 0) - COALESCE(SUM(
          (SELECT SUM(pc.amount) FROM purchase_contract pc WHERE pc.sales_contract_id = sc.id)
        ), 0)                                                       AS net_profit,
        CASE WHEN COALESCE(SUM(sc.amount), 0) > 0
          THEN ROUND(
            (COALESCE(SUM(sc.amount), 0) - COALESCE(SUM(
              (SELECT SUM(pc.amount) FROM purchase_contract pc WHERE pc.sales_contract_id = sc.id)
            ), 0)) / COALESCE(SUM(sc.amount), 0) * 100, 1)
          ELSE 0 END                                                AS roi
      FROM salesperson s
      LEFT JOIN sales_contract sc ON sc.salesperson_id = s.id ${scFilter}
      GROUP BY s.id
      ORDER BY total_sales DESC
    `, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 개인 성과 상세
router.get('/:id', async (req, res) => {
  const { start, end } = req.query;
  try {
    const [[person]] = await db.query('SELECT * FROM salesperson WHERE id = ?', [req.params.id]);
    if (!person) return res.status(404).json({ error: '영업사원을 찾을 수 없습니다' });

    const where = ['sc.salesperson_id = ?'];
    const params = [req.params.id];
    if (start) { where.push('sc.start_date >= ?'); params.push(start); }
    if (end)   { where.push('sc.start_date <= ?'); params.push(end); }

    const [contracts] = await db.query(`
      SELECT sc.*,
        COALESCE(SUM(pc.amount), 0) AS total_purchase,
        sc.amount - COALESCE(SUM(pc.amount), 0) AS net_profit,
        CASE WHEN sc.amount > 0
          THEN ROUND((sc.amount - COALESCE(SUM(pc.amount),0)) / sc.amount * 100, 1)
          ELSE 0 END AS roi,
        COUNT(pc.id) AS purchase_count
      FROM sales_contract sc
      LEFT JOIN purchase_contract pc ON pc.sales_contract_id = sc.id
      WHERE ${where.join(' AND ')}
      GROUP BY sc.id
      ORDER BY sc.created_at DESC
    `, params);

    res.json({ person, contracts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
