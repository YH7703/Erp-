const express = require('express');
const router = express.Router();
const db = require('../db');

// KPI 통계
router.get('/stats', async (req, res) => {
  try {
    const [[sales]] = await db.query(`
      SELECT
        COUNT(*) as total,
        COALESCE(SUM(amount), 0) as total_amount,
        SUM(status = '등록') as cnt_registered,
        SUM(status = '진행') as cnt_active,
        SUM(status = '종료') as cnt_closed
      FROM sales_contract
    `);
    const [[purchase]] = await db.query(`
      SELECT COUNT(*) as total, COALESCE(SUM(amount), 0) as total_amount
      FROM purchase_contract
    `);

    const salesAmt   = Number(sales.total_amount);
    const purchaseAmt = Number(purchase.total_amount);
    const netProfit  = salesAmt - purchaseAmt;
    const roi        = salesAmt > 0 ? +((netProfit / salesAmt) * 100).toFixed(1) : 0;

    res.json({
      sales:    { ...sales,    total_amount: salesAmt },
      purchase: { ...purchase, total_amount: purchaseAmt },
      net_profit: netProfit,
      roi,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 프로젝트별 ROI 현황
router.get('/roi', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        sc.id, sc.contract_no, sc.contract_name, sc.client_name,
        sc.amount AS sales_amount, sc.status, sc.start_date, sc.end_date,
        sc.project_type, s.name AS salesperson_name,
        COALESCE(SUM(pc.amount), 0)                                         AS total_purchase,
        sc.amount - COALESCE(SUM(pc.amount), 0)                             AS net_profit,
        CASE WHEN sc.amount > 0
          THEN ROUND((sc.amount - COALESCE(SUM(pc.amount),0)) / sc.amount * 100, 1)
          ELSE 0 END                                                         AS roi,
        COUNT(pc.id)                                                         AS purchase_count
      FROM sales_contract sc
      LEFT JOIN salesperson        s  ON s.id  = sc.salesperson_id
      LEFT JOIN purchase_contract  pc ON pc.sales_contract_id = sc.id
      GROUP BY sc.id
      ORDER BY sc.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
