const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const BLOCKED_EXTS = ['.exe', '.bat', '.cmd', '.sh', '.ps1'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTS.includes(ext)) {
      return cb(new Error('허용되지 않는 파일 형식입니다'));
    }
    cb(null, true);
  }
});

// GET /:entityType/:entityId — List attachments
router.get('/:entityType/:entityId', async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const [rows] = await db.query(
      `SELECT a.*, u.name AS uploader_name
       FROM attachment a
       LEFT JOIN user u ON a.uploaded_by = u.id
       WHERE a.entity_type = ? AND a.entity_id = ?
       ORDER BY a.created_at DESC`,
      [entityType, entityId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /:entityType/:entityId — Upload file
router.post('/:entityType/:entityId', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: '파일 크기는 10MB 이하여야 합니다' });
      }
      return res.status(400).json({ error: err.message || '업로드 실패' });
    }
    (async () => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: '파일이 없습니다' });
        }
        const { entityType, entityId } = req.params;
        const { originalname, filename, size, mimetype } = req.file;
        const [result] = await db.query(
          `INSERT INTO attachment (entity_type, entity_id, file_name, stored_name, file_size, mime_type, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [entityType, entityId, originalname, filename, size, mimetype, req.user?.id]
        );
        res.json({ id: result.insertId, file_name: originalname, file_size: size, mime_type: mimetype });
      } catch (err) { next(err); }
    })();
  });
});

// GET /download/:id — Download file
router.get('/download/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM attachment WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: '파일을 찾을 수 없습니다' });
    const file = rows[0];
    const filePath = path.join(UPLOADS_DIR, file.stored_name);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '파일이 서버에 존재하지 않습니다' });
    }
    res.download(filePath, file.file_name);
  } catch (err) { next(err); }
});

// DELETE /:id — Delete file
router.delete('/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM attachment WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: '파일을 찾을 수 없습니다' });
    const file = rows[0];
    const filePath = path.join(UPLOADS_DIR, file.stored_name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    await db.query('DELETE FROM attachment WHERE id = ?', [req.params.id]);
    res.json({ message: '삭제되었습니다' });
  } catch (err) { next(err); }
});

module.exports = router;
