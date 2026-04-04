# SI 계약 관리 ERP

## 프로젝트 구조

```
erp-contract/
├── init.sql                    ← DB 스키마 + 샘플데이터
├── start.cmd                   ← 전체 실행 스크립트
├── backend/
│   ├── .env                    ← DB 접속 정보
│   ├── server.js               ← Express 서버
│   ├── db.js                   ← MySQL 연결풀
│   └── routes/
│       ├── dashboard.js        ← 계약현황 API
│       ├── salesContracts.js   ← 매출계약 CRUD API
│       ├── purchaseContracts.js← 매입계약 CRUD API
│       ├── salespeople.js      ← 영업사원 API
│       └── performance.js      ← 성과측정 API
└── frontend/
    ├── vite.config.js
    └── src/
        ├── api.js              ← API 클라이언트
        ├── App.jsx             ← 레이아웃 + 라우터
        └── pages/
            ├── Dashboard.jsx   ← 계약현황 대시보드
            ├── SalesContracts.jsx  ← 매출계약 CRUD
            ├── PurchaseContracts.jsx← 매입계약 CRUD
            └── Performance.jsx ← 영업사원 성과
```

## 실행 방법

### 1단계: DB 초기화

MySQL 클라이언트(DBeaver, MySQL Workbench 등)로 DB에 접속 후:

```sql
source init.sql
```

또는 MySQL CLI:
```bash
mysql -h 34.22.109.120 -P 3306 -u llmadmin -pTest12341! llmtest < init.sql
```

### 2단계: 서버 실행

```bash
# 백엔드 (포트 3001)
cd backend
node server.js

# 프론트엔드 (포트 5173) - 새 터미널
cd frontend
npm run dev
```

또는 `start.cmd` 더블클릭

### 3단계: 브라우저 접속

```
http://localhost:5173
```

## API 목록

| Method | URL | 설명 |
|--------|-----|------|
| GET | /api/dashboard/stats | KPI 통계 |
| GET | /api/dashboard/roi | 프로젝트별 ROI |
| GET | /api/sales-contracts | 매출계약 목록 |
| POST | /api/sales-contracts | 매출계약 등록 |
| PUT | /api/sales-contracts/:id | 매출계약 수정 |
| DELETE | /api/sales-contracts/:id | 매출계약 삭제 |
| GET | /api/purchase-contracts | 매입계약 목록 |
| POST | /api/purchase-contracts | 매입계약 등록 |
| PUT | /api/purchase-contracts/:id | 매입계약 수정 |
| DELETE | /api/purchase-contracts/:id | 매입계약 삭제 |
| GET | /api/performance | 영업사원 성과 |
| GET | /api/performance/:id | 개인 성과 상세 |

## DB 스키마

```
salesperson       (영업사원)
sales_contract    (매출계약) → salesperson FK
purchase_contract (매입계약) → sales_contract FK
```
