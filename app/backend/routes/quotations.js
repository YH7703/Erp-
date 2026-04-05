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

// ── 견적서 PDF 리포트 (개별) ──────────────────────────────────────
const PDFDocument = require('pdfkit');
const fs = require('fs');

router.get('/:id/report', async (req, res) => {
  try {
    const [[q]] = await db.query(`
      SELECT q.*, c.name AS client_name, c.business_no, c.address, c.ceo_name, c.phone AS client_phone,
             s.name AS salesperson_name, s.email AS salesperson_email, s.phone AS salesperson_phone, s.department
      FROM quotation q
      LEFT JOIN client c ON c.id = q.client_id
      LEFT JOIN salesperson s ON s.id = q.salesperson_id
      WHERE q.id = ?
    `, [req.params.id]);
    if (!q) return res.status(404).json({ error: '견적서를 찾을 수 없습니다' });

    const [items] = await db.query(
      'SELECT * FROM quotation_item WHERE quotation_id = ? ORDER BY sort_order',
      [req.params.id]
    );

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const fontPath = 'C:/Windows/Fonts/malgun.ttf';
    const fontBoldPath = 'C:/Windows/Fonts/malgunbd.ttf';
    if (fs.existsSync(fontPath)) {
      doc.registerFont('Korean', fontPath);
      doc.registerFont('KoreanBold', fs.existsSync(fontBoldPath) ? fontBoldPath : fontPath);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=quotation_${q.quotation_no}.pdf`);
    doc.pipe(res);

    const pageW = doc.page.width - 100;
    const leftX = 50;
    let y = 40;

    const colL = leftX;
    const colR = leftX + pageW / 2 + 20;
    const totalAmount = items.reduce((sum, it) => sum + Number(it.amount || 0), 0);
    const currSymbol = { KRW: '₩', USD: '$', EUR: '€', JPY: '¥', CNY: '¥' }[q.currency] || '';

    // ── 헤더: 타이틀 ──
    doc.font('KoreanBold').fontSize(22).fillColor('#1e3a5f').text('견 적 서', leftX, y, { align: 'center', width: pageW });
    y += 32;
    doc.moveTo(leftX, y).lineTo(leftX + pageW, y).lineWidth(2).strokeColor('#1e3a5f').stroke();
    y += 12;

    // ── 견적 정보 (등록 폼과 동일한 필드) ──
    const infoLabel = (label, val, x, yy) => {
      doc.font('KoreanBold').fontSize(8).fillColor('#666666').text(label, x, yy);
      doc.font('Korean').fontSize(9).fillColor('#000000').text(val || '-', x + 60, yy);
    };
    infoLabel('견적번호', q.quotation_no, colL, y);
    infoLabel('견적일자', new Date(q.created_at).toISOString().slice(0, 10), colR, y);
    y += 15;
    infoLabel('제목', q.title, colL, y);
    infoLabel('상태', q.status, colR, y);
    y += 15;
    infoLabel('거래처', q.client_name, colL, y);
    infoLabel('담당 영업사원', q.salesperson_name, colR, y);
    y += 15;
    infoLabel('유효기간', q.valid_until ? new Date(q.valid_until).toISOString().slice(0, 10) : '-', colL, y);
    infoLabel('통화', `${currSymbol} ${q.currency || 'KRW'}`, colR, y);
    y += 20;

    // ── 총 금액 표시 ──
    doc.roundedRect(colL, y, pageW, 30, 4).fill('#f0f5ff');
    doc.font('KoreanBold').fontSize(10).fillColor('#1e3a5f');
    doc.text('총 견적금액', colL + 12, y + 9);
    doc.fontSize(13).fillColor('#1e3a5f');
    doc.text(`${currSymbol}${totalAmount.toLocaleString()} ${q.currency || 'KRW'}`, colL + 12, y + 8, { align: 'right', width: pageW - 24 });
    y += 40;

    // ── 항목 테이블 ──
    const colWidths = [28, pageW - 28 - 50 - 75 - 85, 50, 75, 85];
    const headers = ['No', '항목 설명', '수량', '단가', '금액'];

    // 헤더
    doc.roundedRect(colL, y, pageW, 20, 2).fill('#1e3a5f');
    doc.font('KoreanBold').fontSize(8).fillColor('#ffffff');
    let hx = colL + 5;
    headers.forEach((h, i) => {
      const align = i >= 2 ? 'right' : 'left';
      const px = i >= 2 ? hx - 5 : hx;
      doc.text(h, px, y + 6, { width: colWidths[i], align });
      hx += colWidths[i];
    });
    y += 20;

    // 행
    doc.font('Korean').fontSize(8).fillColor('#333333');
    items.forEach((it, idx) => {
      if (y > doc.page.height - 80) {
        doc.addPage();
        y = 50;
      }
      const bgColor = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.rect(colL, y, pageW, 18).fill(bgColor);
      doc.fillColor('#333333');

      let rx = colL + 5;
      const vals = [
        String(idx + 1),
        it.description,
        Number(it.quantity).toLocaleString(),
        Number(it.unit_price).toLocaleString(),
        Number(it.amount).toLocaleString(),
      ];
      vals.forEach((v, i) => {
        const align = i >= 2 ? 'right' : 'left';
        const px = i >= 2 ? rx - 5 : rx;
        doc.text(v, px, y + 5, { width: colWidths[i], align });
        rx += colWidths[i];
      });
      y += 18;
    });

    // 합계 행
    doc.rect(colL, y, pageW, 20).fill('#e8edf5');
    doc.font('KoreanBold').fontSize(9).fillColor('#1e3a5f');
    doc.text('합 계', colL + 5, y + 5);
    doc.text(`${currSymbol}${totalAmount.toLocaleString()}`, colL + 5, y + 5, { align: 'right', width: pageW - 10 });
    y += 28;

    // ── 비고 ──
    if (q.notes) {
      doc.font('KoreanBold').fontSize(8).fillColor('#666666').text('비고', colL, y);
      y += 12;
      doc.font('Korean').fontSize(8).fillColor('#333333').text(q.notes, colL, y, { width: pageW });
      y += 20;
    }

    // ── 하단 안내문 (본문 바로 아래에 배치, 2페이지로 넘어가지 않음) ──
    y += 10;
    doc.moveTo(leftX, y).lineTo(leftX + pageW, y).lineWidth(0.5).strokeColor('#dde3ea').stroke();
    y += 8;
    doc.font('Korean').fontSize(7).fillColor('#999999');
    doc.text('본 견적서는 전자 생성된 문서이며, 유효기간 내에 한하여 효력을 가집니다.', colL, y, { align: 'center', width: pageW });
    y += 10;
    doc.text(`생성일시: ${new Date().toLocaleString('ko-KR')}`, colL, y, { align: 'center', width: pageW });

    doc.end();
  } catch (err) {
    console.error('Quotation report error:', err);
    if (!res.headersSent) res.status(500).json({ error: '견적서 리포트 생성 실패' });
  }
});

module.exports = router;
