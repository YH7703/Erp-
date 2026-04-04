# SI 계약 관리 ERP

SI(System Integration) 프로젝트의 매출/매입 계약을 관리하는 사내 ERP 시스템.

## 프로젝트 구조

```
app/
├── backend/          # Express.js REST API (포트 3001)
│   ├── server.js     # 엔트리포인트, 라우트 등록
│   ├── db.js         # MySQL2 커넥션 풀
│   └── routes/       # API 라우트
│       ├── dashboard.js
│       ├── salesContracts.js      # 매출계약 CRUD
│       ├── purchaseContracts.js   # 매입계약 CRUD
│       ├── salespeople.js         # 영업사원
│       └── performance.js         # 실적 조회
├── frontend/         # React + Vite (포트 5173)
│   ├── src/
│   │   ├── App.jsx               # 라우팅 (react-router-dom)
│   │   ├── api.js                # API 호출 래퍼
│   │   ├── pages/                # 페이지 컴포넌트
│   │   ├── components/           # 공통 컴포넌트
│   │   │   └── ui/               # shadcn/ui 스타일 기본 UI
│   │   ├── contexts/             # CurrencyContext 등
│   │   ├── hooks/                # useDebounce 등
│   │   └── lib/utils.js          # cn() 유틸
│   └── vite.config.js            # /api → localhost:3001 프록시
├── init.sql           # DB 스키마 + 샘플 데이터
├── migrate_currency.sql  # 통화 컬럼 마이그레이션
└── start.cmd          # 원클릭 실행 (MySQL → 백엔드 → 프론트엔드)
```

## 기술 스택

- **백엔드**: Node.js, Express 4, mysql2/promise
- **프론트엔드**: React 18, Vite 5, Tailwind CSS 4, react-router-dom 6, lucide-react
- **UI**: shadcn/ui 패턴 (components/ui/), class-variance-authority, clsx, tailwind-merge
- **DB**: MySQL 8 (서비스명 MySQL84), 데이터베이스명 `llmtest`
- **언어**: 한국어 UI, 코드 주석도 한국어

## 개발 서버 실행

```bash
# 백엔드
cd app/backend && npm run dev    # node --watch server.js

# 프론트엔드
cd app/frontend && npm run dev   # vite, 포트 5173

# 또는 start.cmd 실행 (MySQL 시작 포함)
```

## DB 접속 설정

`.env` 파일 (app/backend/.env):
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=...
DB_PASSWORD=...
DB_NAME=llmtest
```

## 핵심 데이터 모델

- **salesperson**: 영업사원 (name, email, department)
- **sales_contract**: 매출계약 - 고객사와의 계약 (contract_no, client_name, amount, currency, status, project_type, salesperson_id)
- **purchase_contract**: 매입계약 - 외주/인력 계약 (vendor_name, worker_name, monthly_rate, months, sales_contract_id FK)
- status: '등록' | '진행' | '종료'
- project_type: '신규개발' | '유지보수' | '컨설팅'
- 다중 통화 지원 (KRW 기본, original_amount/original_monthly_rate로 원본 보존)

## API 엔드포인트 패턴

모든 API는 `/api/` 프리픽스. 라우트 파일 내에서 Express Router 사용.
- `/api/sales-contracts` — 매출계약
- `/api/purchase-contracts` — 매입계약
- `/api/salespeople` — 영업사원
- `/api/performance` — 실적
- `/api/dashboard` — 대시보드 집계

## 코드 컨벤션

- 백엔드: CommonJS (`require`/`module.exports`)
- 프론트엔드: ES Modules, JSX (TypeScript 미사용)
- 경로 alias: `@` → `src/`
- 에러 메시지, UI 텍스트: 한국어
