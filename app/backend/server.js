const express = require('express');
const cors = require('cors');
require('dotenv').config();

// 서버가 죽지 않도록 전역 에러 핸들링
process.on('uncaughtException', (err) => {
  console.error('[치명적 오류] uncaughtException:', err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('[치명적 오류] unhandledRejection:', reason);
});

const app = express();
const bcrypt = require('bcryptjs');
const db = require('./db');
const { authenticate } = require('./middleware/auth');

app.use(cors());
app.use(express.json());

app.use('/api/auth',               require('./routes/auth'));
app.use('/api/dashboard',          authenticate, require('./routes/dashboard'));
app.use('/api/sales-contracts',    authenticate, require('./routes/salesContracts'));
app.use('/api/purchase-contracts', authenticate, require('./routes/purchaseContracts'));
app.use('/api/salespeople',        authenticate, require('./routes/salespeople'));
app.use('/api/performance',        authenticate, require('./routes/performance'));
app.use('/api/clients',            authenticate, require('./routes/clients'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '서버 오류가 발생했습니다' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ 서버 시작: http://localhost:${PORT}`));

// 기본 관리자 계정 시드
async function seedAdmin() {
  try {
    const [rows] = await db.query("SELECT id FROM user WHERE username = 'admin'");
    if (!rows.length) {
      const hash = await bcrypt.hash('admin123', 10);
      await db.query(
        "INSERT INTO user (username, password_hash, name, email, role) VALUES ('admin', ?, '관리자', 'admin@erp.com', 'admin')",
        [hash]
      );
      console.log('기본 관리자 계정 생성: admin / admin123');
    }
  } catch (err) {
    console.error('Admin seed 실패:', err.message);
  }
}
seedAdmin();
