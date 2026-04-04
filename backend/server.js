const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/dashboard',          require('./routes/dashboard'));
app.use('/api/sales-contracts',    require('./routes/salesContracts'));
app.use('/api/purchase-contracts', require('./routes/purchaseContracts'));
app.use('/api/salespeople',        require('./routes/salespeople'));
app.use('/api/performance',        require('./routes/performance'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '서버 오류가 발생했습니다' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ 서버 시작: http://localhost:${PORT}`));
