const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const db = require('../db');
const { requirePermission } = require('../middleware/rbac');

// Helper: format date value from MySQL
function fmtDate(v) {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

// ── Excel: Sales Contracts ──────────────────────────────────────────
router.get('/sales-contracts/excel', requirePermission('export'), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT sc.contract_no, sc.contract_name, sc.client_name, sc.amount,
             sc.currency, sc.start_date, sc.end_date, sc.status,
             sc.project_type, sp.name AS salesperson_name
      FROM sales_contract sc
      LEFT JOIN salesperson sp ON sp.id = sc.salesperson_id
      ORDER BY sc.created_at DESC
    `);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('매출계약');

    ws.columns = [
      { header: '계약번호',   key: 'contract_no',     width: 16 },
      { header: '계약명',     key: 'contract_name',   width: 30 },
      { header: '고객사',     key: 'client_name',     width: 20 },
      { header: '금액',       key: 'amount',          width: 15, style: { numFmt: '#,##0' } },
      { header: '통화',       key: 'currency',        width: 8 },
      { header: '시작일',     key: 'start_date',      width: 12 },
      { header: '종료일',     key: 'end_date',        width: 12 },
      { header: '상태',       key: 'status',          width: 10 },
      { header: '프로젝트유형', key: 'project_type',  width: 14 },
      { header: '영업담당',   key: 'salesperson_name', width: 12 },
    ];

    rows.forEach(r => {
      ws.addRow({
        ...r,
        start_date: fmtDate(r.start_date),
        end_date: fmtDate(r.end_date),
      });
    });

    styleHeader(ws);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=sales_contracts.xlsx');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: '내보내기 실패' });
  }
});

// ── Excel: Purchase Contracts ───────────────────────────────────────
router.get('/purchase-contracts/excel', requirePermission('export'), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT pc.contract_no, pc.contract_name, pc.vendor_name, pc.worker_name,
             pc.monthly_rate, pc.months, pc.amount, pc.start_date, pc.end_date,
             pc.status, sc.contract_name AS sales_contract_name
      FROM purchase_contract pc
      LEFT JOIN sales_contract sc ON sc.id = pc.sales_contract_id
      ORDER BY pc.created_at DESC
    `);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('매입계약');

    ws.columns = [
      { header: '계약번호',     key: 'contract_no',          width: 16 },
      { header: '계약명',       key: 'contract_name',        width: 30 },
      { header: '협력사',       key: 'vendor_name',          width: 20 },
      { header: '투입인력',     key: 'worker_name',          width: 14 },
      { header: '월단가',       key: 'monthly_rate',         width: 14, style: { numFmt: '#,##0' } },
      { header: '개월수',       key: 'months',               width: 8 },
      { header: '금액',         key: 'amount',               width: 15, style: { numFmt: '#,##0' } },
      { header: '시작일',       key: 'start_date',           width: 12 },
      { header: '종료일',       key: 'end_date',             width: 12 },
      { header: '상태',         key: 'status',               width: 10 },
      { header: '매출계약',     key: 'sales_contract_name',  width: 24 },
    ];

    rows.forEach(r => {
      ws.addRow({
        ...r,
        start_date: fmtDate(r.start_date),
        end_date: fmtDate(r.end_date),
      });
    });

    styleHeader(ws);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=purchase_contracts.xlsx');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: '내보내기 실패' });
  }
});

// ── Excel: Quotations ───────────────────────────────────────────────
router.get('/quotations/excel', requirePermission('export'), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT q.quotation_no, q.title, c.name AS client_name,
             q.amount, q.status, q.valid_until, sp.name AS salesperson_name
      FROM quotation q
      LEFT JOIN client c ON c.id = q.client_id
      LEFT JOIN salesperson sp ON sp.id = q.salesperson_id
      ORDER BY q.created_at DESC
    `);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('견적서');

    ws.columns = [
      { header: '견적번호',   key: 'quotation_no',    width: 16 },
      { header: '제목',       key: 'title',           width: 30 },
      { header: '고객사',     key: 'client_name',     width: 20 },
      { header: '금액',       key: 'amount',          width: 15, style: { numFmt: '#,##0' } },
      { header: '상태',       key: 'status',          width: 10 },
      { header: '유효기간',   key: 'valid_until',     width: 12 },
      { header: '영업담당',   key: 'salesperson_name', width: 12 },
    ];

    rows.forEach(r => {
      ws.addRow({
        ...r,
        valid_until: fmtDate(r.valid_until),
      });
    });

    styleHeader(ws);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=quotations.xlsx');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: '내보내기 실패' });
  }
});

// ── Excel: Invoices ─────────────────────────────────────────────────
router.get('/invoices/excel', requirePermission('export'), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT i.invoice_no, sc.contract_name AS sales_contract_name,
             sc.client_name, i.amount, i.issue_date, i.due_date,
             i.status, i.paid_amount, i.paid_date
      FROM invoice i
      LEFT JOIN sales_contract sc ON sc.id = i.sales_contract_id
      ORDER BY i.created_at DESC
    `);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('세금계산서');

    ws.columns = [
      { header: '청구번호',     key: 'invoice_no',           width: 16 },
      { header: '매출계약',     key: 'sales_contract_name',  width: 24 },
      { header: '고객사',       key: 'client_name',          width: 20 },
      { header: '금액',         key: 'amount',               width: 15, style: { numFmt: '#,##0' } },
      { header: '발행일',       key: 'issue_date',           width: 12 },
      { header: '만기일',       key: 'due_date',             width: 12 },
      { header: '상태',         key: 'status',               width: 10 },
      { header: '수금액',       key: 'paid_amount',          width: 15, style: { numFmt: '#,##0' } },
      { header: '수금일',       key: 'paid_date',            width: 12 },
    ];

    rows.forEach(r => {
      ws.addRow({
        ...r,
        issue_date: fmtDate(r.issue_date),
        due_date: fmtDate(r.due_date),
        paid_date: fmtDate(r.paid_date),
      });
    });

    styleHeader(ws);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=invoices.xlsx');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: '내보내기 실패' });
  }
});

// ── PDF: Generic for all types ──────────────────────────────────────
const typeMap = {
  'sales-contracts': {
    title: '매출계약 목록',
    sql: `SELECT sc.contract_no, sc.contract_name, sc.client_name,
                 sc.amount, sc.currency, sc.start_date, sc.end_date,
                 sc.status, sp.name AS salesperson_name
          FROM sales_contract sc
          LEFT JOIN salesperson sp ON sp.id = sc.salesperson_id
          ORDER BY sc.created_at DESC`,
    columns: [
      { key: 'contract_no',     label: '계약번호', width: 70 },
      { key: 'contract_name',   label: '계약명',   width: 120 },
      { key: 'client_name',     label: '고객사',   width: 80 },
      { key: 'amount',          label: '금액',     width: 70, number: true },
      { key: 'currency',        label: '통화',     width: 35 },
      { key: 'start_date',      label: '시작일',   width: 65, date: true },
      { key: 'end_date',        label: '종료일',   width: 65, date: true },
      { key: 'status',          label: '상태',     width: 50 },
      { key: 'salesperson_name',label: '영업담당', width: 60 },
    ],
  },
  'purchase-contracts': {
    title: '매입계약 목록',
    sql: `SELECT pc.contract_no, pc.contract_name, pc.vendor_name,
                 pc.worker_name, pc.amount, pc.start_date, pc.end_date,
                 pc.status, sc.contract_name AS sales_contract_name
          FROM purchase_contract pc
          LEFT JOIN sales_contract sc ON sc.id = pc.sales_contract_id
          ORDER BY pc.created_at DESC`,
    columns: [
      { key: 'contract_no',         label: '계약번호', width: 70 },
      { key: 'contract_name',       label: '계약명',   width: 120 },
      { key: 'vendor_name',         label: '협력사',   width: 80 },
      { key: 'worker_name',         label: '투입인력', width: 60 },
      { key: 'amount',              label: '금액',     width: 70, number: true },
      { key: 'start_date',          label: '시작일',   width: 65, date: true },
      { key: 'end_date',            label: '종료일',   width: 65, date: true },
      { key: 'status',              label: '상태',     width: 50 },
      { key: 'sales_contract_name', label: '매출계약', width: 100 },
    ],
  },
  quotations: {
    title: '견적서 목록',
    sql: `SELECT q.quotation_no, q.title, c.name AS client_name,
                 q.amount, q.status, q.valid_until, sp.name AS salesperson_name
          FROM quotation q
          LEFT JOIN client c ON c.id = q.client_id
          LEFT JOIN salesperson sp ON sp.id = q.salesperson_id
          ORDER BY q.created_at DESC`,
    columns: [
      { key: 'quotation_no',    label: '견적번호', width: 70 },
      { key: 'title',           label: '제목',     width: 150 },
      { key: 'client_name',     label: '고객사',   width: 80 },
      { key: 'amount',          label: '금액',     width: 70, number: true },
      { key: 'status',          label: '상태',     width: 50 },
      { key: 'valid_until',     label: '유효기간', width: 65, date: true },
      { key: 'salesperson_name',label: '영업담당', width: 60 },
    ],
  },
  invoices: {
    title: '세금계산서 목록',
    sql: `SELECT i.invoice_no, sc.contract_name AS sales_contract_name,
                 sc.client_name, i.amount, i.issue_date, i.due_date,
                 i.status, i.paid_amount, i.paid_date
          FROM invoice i
          LEFT JOIN sales_contract sc ON sc.id = i.sales_contract_id
          ORDER BY i.created_at DESC`,
    columns: [
      { key: 'invoice_no',          label: '청구번호', width: 70 },
      { key: 'sales_contract_name', label: '매출계약', width: 110 },
      { key: 'client_name',         label: '고객사',   width: 80 },
      { key: 'amount',              label: '금액',     width: 70, number: true },
      { key: 'issue_date',          label: '발행일',   width: 65, date: true },
      { key: 'due_date',            label: '만기일',   width: 65, date: true },
      { key: 'status',              label: '상태',     width: 50 },
      { key: 'paid_amount',         label: '수금액',   width: 70, number: true },
      { key: 'paid_date',           label: '수금일',   width: 65, date: true },
    ],
  },
};

router.get('/:type/pdf', requirePermission('export'), async (req, res) => {
  const cfg = typeMap[req.params.type];
  if (!cfg) return res.status(400).json({ error: '지원하지 않는 유형입니다' });

  try {
    const [rows] = await db.query(cfg.sql);

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });

    // Register Korean font if available
    const fontPath = 'C:/Windows/Fonts/malgun.ttf';
    const hasKoreanFont = fs.existsSync(fontPath);
    if (hasKoreanFont) {
      doc.registerFont('Korean', fontPath);
      doc.font('Korean');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${req.params.type}.pdf`);
    doc.pipe(res);

    const pageW = doc.page.width - 60; // margins
    const pageH = doc.page.height;
    const startX = 30;
    let y = 30;

    // Title & date
    const drawHeader = () => {
      doc.fontSize(16).text(cfg.title, startX, y, { align: 'center', width: pageW });
      doc.fontSize(8).text(new Date().toISOString().slice(0, 10), startX, y, { align: 'right', width: pageW });
      y += 30;

      // Column headers
      doc.fontSize(8).fillColor('#333333');
      let x = startX;
      cfg.columns.forEach(col => {
        doc.text(col.label, x, y, { width: col.width, align: 'left' });
        x += col.width;
      });
      y += 14;
      doc.moveTo(startX, y).lineTo(startX + pageW, y).strokeColor('#cccccc').stroke();
      y += 4;
    };

    drawHeader();

    // Rows
    doc.fontSize(7).fillColor('#000000');
    rows.forEach(row => {
      if (y > pageH - 60) {
        doc.addPage();
        y = 30;
        drawHeader();
        doc.fontSize(7).fillColor('#000000');
      }

      let x = startX;
      cfg.columns.forEach(col => {
        let val = row[col.key];
        if (col.date) val = fmtDate(val);
        else if (col.number && val != null) val = Number(val).toLocaleString();
        doc.text(val != null ? String(val) : '', x, y, { width: col.width, align: 'left' });
        x += col.width;
      });
      y += 14;
    });

    doc.end();
  } catch (err) {
    console.error('PDF export error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'PDF 내보내기 실패' });
    }
  }
});

// ── Shared: style header row ────────────────────────────────────────
function styleHeader(ws) {
  const headerRow = ws.getRow(1);
  headerRow.eachCell(cell => {
    cell.font = { bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };
    cell.alignment = { vertical: 'middle' };
  });
  headerRow.height = 22;
}

module.exports = router;
