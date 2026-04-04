const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate, generateToken } = require('../middleware/auth');

const router = express.Router();

// 회원가입
router.post('/register', async (req, res) => {
  try {
    const { username, password, name, email } = req.body;

    if (!username || !password || !name) {
      return res.status(400).json({ error: '아이디, 비밀번호, 이름은 필수입니다' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO user (username, password_hash, name, email, role) VALUES (?, ?, ?, ?, ?)',
      [username, hash, name, email || null, 'viewer']
    );

    res.status(201).json({
      id: result.insertId,
      username,
      name,
      email: email || null,
      role: 'viewer',
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: '이미 사용 중인 아이디입니다' });
    }
    console.error('회원가입 오류:', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요' });
    }

    const [rows] = await db.query('SELECT * FROM user WHERE username = ?', [username]);
    if (!rows.length) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다' });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: '비활성화된 계정입니다. 관리자에게 문의하세요' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다' });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('로그인 오류:', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 내 정보 조회
router.get('/me', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, username, name, email, role, is_active, created_at FROM user WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('내 정보 조회 오류:', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 비밀번호 변경
router.put('/password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: '새 비밀번호는 6자 이상이어야 합니다' });
    }

    const [rows] = await db.query('SELECT password_hash FROM user WHERE id = ?', [req.user.id]);
    if (!rows.length) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
    }

    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE user SET password_hash = ? WHERE id = ?', [hash, req.user.id]);

    res.json({ message: '비밀번호가 변경되었습니다' });
  } catch (err) {
    console.error('비밀번호 변경 오류:', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
