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

// 월별 매출/매입 추이 (최근 12개월)
router.get('/monthly', async (req, res) => {
  try {
    const [sales] = await db.query(`
      SELECT DATE_FORMAT(start_date, '%Y-%m') AS month,
             COALESCE(SUM(amount), 0)         AS sales_amount
      FROM sales_contract
      WHERE start_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY month ORDER BY month
    `);
    const [purchase] = await db.query(`
      SELECT DATE_FORMAT(start_date, '%Y-%m') AS month,
             COALESCE(SUM(amount), 0)         AS purchase_amount
      FROM purchase_contract
      WHERE start_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY month ORDER BY month
    `);
    // 월 목록 합치기
    const months = [...new Set([...sales.map(r=>r.month), ...purchase.map(r=>r.month)])].sort();
    const salesMap = Object.fromEntries(sales.map(r=>[r.month, Number(r.sales_amount)]));
    const purchaseMap = Object.fromEntries(purchase.map(r=>[r.month, Number(r.purchase_amount)]));
    res.json(months.map(m => ({
      month: m,
      sales_amount:    salesMap[m]    || 0,
      purchase_amount: purchaseMap[m] || 0,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 만료 임박 계약 (30일 이내)
router.get('/expiring', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT sc.id, sc.contract_no, sc.contract_name, sc.client_name,
             sc.end_date, sc.status, s.name AS salesperson_name,
             DATEDIFF(sc.end_date, CURDATE()) AS days_left
      FROM sales_contract sc
      LEFT JOIN salesperson s ON s.id = sc.salesperson_id
      WHERE sc.status != '종료'
        AND sc.end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
      ORDER BY sc.end_date ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 프로젝트 유형별 통계
router.get('/by-type', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT project_type,
             COUNT(*) AS count,
             COALESCE(SUM(amount), 0) AS total_amount
      FROM sales_contract
      GROUP BY project_type
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
