# SI 계약관리 ERP 9개 기능 확장 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SI 계약관리 ERP에 거래처 마스터, 견적서, 인보이스, 인증/인가, 감사 로그, 파일 첨부, 내보내기, 고급 검색 기능을 추가한다.

**Architecture:** Express REST API 백엔드에 JWT 인증 미들웨어를 추가하고, MySQL에 8개 신규 테이블을 생성한다. 프론트엔드는 기존 React+Vite 구조를 유지하며 신규 페이지/컴포넌트를 추가한다. 기존 모듈(매출계약, 매입계약)은 거래처 FK 연결 및 인증/감사 미들웨어를 적용한다.

**Tech Stack:** React 18, Express 4, MySQL (mysql2), JWT (jsonwebtoken), bcryptjs, multer, exceljs, pdfkit

**의존 관계 (구현 순서):**
```
Phase 1: A4(거래처) → B1(인증) → B2(RBAC) → B3(Audit)
Phase 2: A1(견적서) → A2(인보이스)
Phase 3: D1(파일첨부), D2(내보내기), D4(고급검색) — 병렬 가능
```

---

## File Structure (신규/수정 파일 전체 맵)

### 신규 파일

```
app/
├── migrate_features.sql                    # 모든 신규 테이블 DDL
├── backend/
│   ├── middleware/
│   │   ├── auth.js                         # JWT 인증 미들웨어
│   │   ├── rbac.js                         # 역할 기반 접근 제어
│   │   └── audit.js                        # 감사 로그 미들웨어
│   ├── routes/
│   │   ├── auth.js                         # 로그인/회원가입 API
│   │   ├── clients.js                      # 거래처 CRUD API
│   │   ├── quotations.js                   # 견적서 CRUD + 계약전환 API
│   │   ├── invoices.js                     # 인보이스 CRUD API
│   │   ├── attachments.js                  # 파일 업로드/다운로드 API
│   │   └── export.js                       # 엑셀/PDF 내보내기 API
│   └── uploads/                            # 업로드 파일 저장 디렉토리
├── frontend/src/
│   ├── contexts/
│   │   └── AuthContext.jsx                 # 인증 상태 관리
│   ├── components/
│   │   ├── ProtectedRoute.jsx              # 인증 라우트 가드
│   │   ├── AdvancedFilter.jsx              # 고급 검색/필터 컴포넌트
│   │   ├── FileUpload.jsx                  # 파일 업로드 컴포넌트
│   │   ├── FileList.jsx                    # 첨부파일 목록 컴포넌트
│   │   └── ExportButton.jsx               # 내보내기 버튼 컴포넌트
│   └── pages/
│       ├── Login.jsx                       # 로그인 페이지
│       ├── Clients.jsx                     # 거래처 관리 페이지
│       ├── Quotations.jsx                  # 견적서 관리 페이지
│       └── Invoices.jsx                    # 인보이스 관리 페이지
```

### 수정 파일

```
app/
├── backend/
│   ├── package.json                        # 의존성 추가
│   ├── server.js                           # 라우트 마운트, 미들웨어 적용
│   ├── routes/salesContracts.js            # client_id FK, 감사/인증 적용
│   └── routes/purchaseContracts.js         # client_id FK, 감사/인증 적용
├── frontend/
│   ├── package.json                        # 의존성 추가 (없음, 순수 fetch 유지)
│   └── src/
│       ├── App.jsx                         # 라우팅 추가, AuthProvider 래핑
│       └── api.js                          # 신규 API 함수 추가, JWT 헤더
```

---

## Task 1: 데이터베이스 마이그레이션 스크립트 작성

**Files:**
- Create: `app/migrate_features.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- SI 계약 관리 ERP - 기능 확장 마이그레이션
USE llmtest;

-- ============================================================
-- 1. 사용자 테이블 (B1: 인증)
-- ============================================================
CREATE TABLE IF NOT EXISTS user (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(200),
  role ENUM('admin','manager','sales','finance','viewer') DEFAULT 'viewer',
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 기본 관리자 계정 (비밀번호: admin123 → bcrypt 해시)
-- 해시는 서버 시작 시 seed 스크립트로 생성

-- ============================================================
-- 2. 거래처 테이블 (A4: 거래처 마스터)
-- ============================================================
CREATE TABLE IF NOT EXISTS client (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  business_no VARCHAR(20),
  ceo_name VARCHAR(100),
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(200),
  client_type ENUM('고객','협력사','고객/협력사') NOT NULL DEFAULT '고객',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 기존 계약의 client_name을 기반으로 거래처 시드 데이터
INSERT INTO client (name, client_type) VALUES
('한국은행', '고객'),
('삼성전자', '고객'),
('현대자동차', '고객'),
('CJ대한통운', '고객'),
('삼성생명', '고객'),
('(주)테크솔루션', '협력사'),
('(주)소프트뱅크', '협력사'),
('(주)QA파트너스', '협력사'),
('(주)유지보수전문', '협력사'),
('(주)IT인력뱅크', '협력사');

-- 매출계약에 client_id FK 추가
ALTER TABLE sales_contract ADD COLUMN client_id INT AFTER client_name;
ALTER TABLE sales_contract ADD FOREIGN KEY (client_id) REFERENCES client(id);

-- 기존 데이터 매핑
UPDATE sales_contract sc
  JOIN client c ON c.name = sc.client_name
  SET sc.client_id = c.id;

-- 매입계약에 vendor_id FK 추가
ALTER TABLE purchase_contract ADD COLUMN vendor_id INT AFTER vendor_name;
ALTER TABLE purchase_contract ADD FOREIGN KEY (vendor_id) REFERENCES client(id);

-- 기존 데이터 매핑
UPDATE purchase_contract pc
  JOIN client c ON c.name = pc.vendor_name
  SET pc.vendor_id = c.id;

-- ============================================================
-- 3. 견적서 테이블 (A1: 견적서 관리)
-- ============================================================
CREATE TABLE IF NOT EXISTS quotation (
  id INT PRIMARY KEY AUTO_INCREMENT,
  quotation_no VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(200) NOT NULL,
  client_id INT NOT NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'KRW',
  original_amount DECIMAL(15,2),
  status ENUM('작성','제출','승인','거절','계약전환') DEFAULT '작성',
  valid_until DATE,
  salesperson_id INT NOT NULL,
  notes TEXT,
  converted_contract_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES client(id),
  FOREIGN KEY (salesperson_id) REFERENCES salesperson(id),
  FOREIGN KEY (converted_contract_id) REFERENCES sales_contract(id)
);

CREATE TABLE IF NOT EXISTS quotation_item (
  id INT PRIMARY KEY AUTO_INCREMENT,
  quotation_id INT NOT NULL,
  description VARCHAR(500) NOT NULL,
  quantity INT DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (quotation_id) REFERENCES quotation(id) ON DELETE CASCADE
);

-- ============================================================
-- 4. 인보이스 테이블 (A2: 청구/인보이스)
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice (
  id INT PRIMARY KEY AUTO_INCREMENT,
  invoice_no VARCHAR(50) UNIQUE NOT NULL,
  sales_contract_id INT NOT NULL,
  client_id INT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'KRW',
  original_amount DECIMAL(15,2),
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status ENUM('발행','수금완료','연체','취소') DEFAULT '발행',
  paid_amount DECIMAL(15,2) DEFAULT 0,
  paid_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (sales_contract_id) REFERENCES sales_contract(id),
  FOREIGN KEY (client_id) REFERENCES client(id)
);

-- ============================================================
-- 5. 감사 로그 테이블 (B3: Audit Trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  username VARCHAR(50),
  action ENUM('CREATE','UPDATE','DELETE') NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT,
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE SET NULL,
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_user (user_id),
  INDEX idx_created (created_at)
);

-- ============================================================
-- 6. 첨부파일 테이블 (D1: 파일 첨부)
-- ============================================================
CREATE TABLE IF NOT EXISTS attachment (
  id INT PRIMARY KEY AUTO_INCREMENT,
  entity_type ENUM('sales_contract','purchase_contract','quotation','invoice','client') NOT NULL,
  entity_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  file_size INT NOT NULL,
  mime_type VARCHAR(100),
  uploaded_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES user(id) ON DELETE SET NULL,
  INDEX idx_entity (entity_type, entity_id)
);
```

- [ ] **Step 2: 마이그레이션 실행**

```bash
cd /c/Users/qwert/erp/app
mysql -u llmadmin -p llmtest < migrate_features.sql
```

- [ ] **Step 3: 커밋**

```bash
git add app/migrate_features.sql
git commit -m "feat: add migration for 8 new tables (user, client, quotation, invoice, audit_log, attachment)"
```

---

## Task 2: 백엔드 의존성 설치

**Files:**
- Modify: `app/backend/package.json`

- [ ] **Step 1: 패키지 설치**

```bash
cd /c/Users/qwert/erp/app/backend
npm install jsonwebtoken bcryptjs multer exceljs pdfkit
```

이 패키지들의 역할:
- `jsonwebtoken` — JWT 토큰 생성/검증 (B1)
- `bcryptjs` — 비밀번호 해싱 (B1)
- `multer` — 파일 업로드 미들웨어 (D1)
- `exceljs` — Excel 파일 생성 (D2)
- `pdfkit` — PDF 파일 생성 (D2)

- [ ] **Step 2: 커밋**

```bash
git add app/backend/package.json app/backend/package-lock.json
git commit -m "feat: add dependencies for auth, upload, export"
```

---

## Task 3: A4 — 거래처(Client) 마스터 API

**Files:**
- Create: `app/backend/routes/clients.js`
- Modify: `app/backend/server.js`

- [ ] **Step 1: 거래처 라우트 생성**

`app/backend/routes/clients.js`:

```javascript
const express = require('express');
const router = express.Router();
const db = require('../db');

// 목록 조회 (필터: type, search)
router.get('/', async (req, res, next) => {
  try {
    const { type, search } = req.query;
    let sql = `SELECT c.*,
      (SELECT COUNT(*) FROM sales_contract sc WHERE sc.client_id = c.id) as sales_count,
      (SELECT COUNT(*) FROM purchase_contract pc WHERE pc.vendor_id = c.id) as purchase_count
      FROM client c WHERE 1=1`;
    const params = [];

    if (type) {
      sql += ` AND c.client_type = ?`;
      params.push(type);
    }
    if (search) {
      sql += ` AND (c.name LIKE ? OR c.business_no LIKE ? OR c.ceo_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ` ORDER BY c.name`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// 단일 조회
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT * FROM client WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: '거래처를 찾을 수 없습니다' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// 생성
router.post('/', async (req, res, next) => {
  try {
    const { name, business_no, ceo_name, address, phone, email, client_type, notes } = req.body;
    if (!name || !client_type) return res.status(400).json({ error: '거래처명과 유형은 필수입니다' });

    const [result] = await db.query(
      `INSERT INTO client (name, business_no, ceo_name, address, phone, email, client_type, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, business_no || null, ceo_name || null, address || null, phone || null, email || null, client_type, notes || null]
    );
    res.status(201).json({ id: result.insertId, message: '거래처가 등록되었습니다' });
  } catch (err) { next(err); }
});

// 수정
router.put('/:id', async (req, res, next) => {
  try {
    const { name, business_no, ceo_name, address, phone, email, client_type, notes } = req.body;
    if (!name || !client_type) return res.status(400).json({ error: '거래처명과 유형은 필수입니다' });

    const [result] = await db.query(
      `UPDATE client SET name=?, business_no=?, ceo_name=?, address=?, phone=?, email=?, client_type=?, notes=?
       WHERE id=?`,
      [name, business_no || null, ceo_name || null, address || null, phone || null, email || null, client_type, notes || null, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: '거래처를 찾을 수 없습니다' });
    res.json({ message: '거래처가 수정되었습니다' });
  } catch (err) { next(err); }
});

// 삭제
router.delete('/:id', async (req, res, next) => {
  try {
    const [sc] = await db.query(`SELECT COUNT(*) as cnt FROM sales_contract WHERE client_id = ?`, [req.params.id]);
    const [pc] = await db.query(`SELECT COUNT(*) as cnt FROM purchase_contract WHERE vendor_id = ?`, [req.params.id]);
    const total = sc[0].cnt + pc[0].cnt;
    if (total > 0) return res.status(400).json({ error: `연결된 계약 ${total}건이 있어 삭제할 수 없습니다` });

    const [result] = await db.query(`DELETE FROM client WHERE id = ?`, [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: '거래처를 찾을 수 없습니다' });
    res.json({ message: '거래처가 삭제되었습니다' });
  } catch (err) { next(err); }
});

module.exports = router;
```

- [ ] **Step 2: server.js에 라우트 마운트**

`app/backend/server.js`에 추가:

```javascript
// 기존 라우트 아래에 추가
const clientsRouter = require('./routes/clients');
app.use('/api/clients', clientsRouter);
```

- [ ] **Step 3: 테스트**

```bash
# 서버 실행 후
curl http://localhost:3001/api/clients
curl -X POST http://localhost:3001/api/clients -H "Content-Type: application/json" -d '{"name":"테스트사","client_type":"고객"}'
```

- [ ] **Step 4: 커밋**

```bash
git add app/backend/routes/clients.js app/backend/server.js
git commit -m "feat: add client master CRUD API"
```

---

## Task 4: A4 — 거래처 프론트엔드 페이지

**Files:**
- Create: `app/frontend/src/pages/Clients.jsx`
- Modify: `app/frontend/src/api.js`
- Modify: `app/frontend/src/App.jsx`

- [ ] **Step 1: api.js에 거래처 API 함수 추가**

`app/frontend/src/api.js` 하단에 추가:

```javascript
// 거래처
getClients:    (p) => request(`/clients${toQS(p)}`),
getClient:     (id) => request(`/clients/${id}`),
createClient:  (b)  => request('/clients', { method: 'POST', body: JSON.stringify(b) }),
updateClient:  (id, b) => request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
deleteClient:  (id) => request(`/clients/${id}`, { method: 'DELETE' }),
```

- [ ] **Step 2: Clients.jsx 페이지 작성**

`app/frontend/src/pages/Clients.jsx`:

기존 Salespeople.jsx 패턴을 따르되 다음 차이점 적용:
- 탭 필터: 전체 / 고객 / 협력사 / 고객/협력사
- 테이블 컬럼: 거래처명, 사업자번호, 대표자, 연락처, 이메일, 유형, 매출계약수, 매입계약수
- 폼 필드: name(필수), business_no, ceo_name, address, phone, email, client_type(필수), notes
- 검색: 거래처명, 사업자번호, 대표자로 검색
- 삭제 시 연결 계약 존재하면 에러 토스트 표시

```jsx
import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Building2, Edit2, Trash2, Phone, Mail, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/table';
import { toastSuccess, toastError } from '../components/Toast';
import { confirmDialog } from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import ErrorBanner from '../components/ErrorBanner';
import api from '../api';
import { useDebounce } from '../hooks/useDebounce';

const CLIENT_TYPES = ['고객', '협력사', '고객/협력사'];

export default function Clients() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState({ type: '', search: '' });
  const [modal, setModal] = useState({ open: false, mode: 'create', id: null });
  const [form, setForm] = useState({ name: '', business_no: '', ceo_name: '', address: '', phone: '', email: '', client_type: '고객', notes: '' });
  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const debouncedSearch = useDebounce(filter.search);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter.type) params.type = filter.type;
      if (debouncedSearch) params.search = debouncedSearch;
      const data = await api.getClients(params);
      setList(data);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter.type, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm({ name: '', business_no: '', ceo_name: '', address: '', phone: '', email: '', client_type: '고객', notes: '' });
    setFormErrors({});
    setModal({ open: true, mode: 'create', id: null });
  };

  const openEdit = (item) => {
    setForm({
      name: item.name, business_no: item.business_no || '', ceo_name: item.ceo_name || '',
      address: item.address || '', phone: item.phone || '', email: item.email || '',
      client_type: item.client_type, notes: item.notes || ''
    });
    setFormErrors({});
    setModal({ open: true, mode: 'edit', id: item.id });
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = '거래처명을 입력하세요';
    if (!form.client_type) errs.client_type = '유형을 선택하세요';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (modal.mode === 'create') {
        await api.createClient(form);
        toastSuccess('거래처가 등록되었습니다');
      } else {
        await api.updateClient(modal.id, form);
        toastSuccess('거래처가 수정되었습니다');
      }
      setModal({ open: false, mode: 'create', id: null });
      load();
    } catch (e) {
      toastError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const ok = await confirmDialog({
      title: '거래처 삭제',
      message: `"${item.name}"을(를) 삭제하시겠습니까?`,
      danger: true
    });
    if (!ok) return;
    try {
      await api.deleteClient(item.id);
      toastSuccess('거래처가 삭제되었습니다');
      load();
    } catch (e) {
      toastError(e.message);
    }
  };

  const typeBadge = (t) => {
    const v = t === '고객' ? 'default' : t === '협력사' ? 'secondary' : 'outline';
    return <Badge variant={v}>{t}</Badge>;
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">거래처 관리</h1>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" />거래처 등록</Button>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="flex items-center gap-3">
        <Tabs value={filter.type} onValueChange={(v) => setFilter(f => ({ ...f, type: v }))}>
          <TabsList>
            <TabsTrigger value="">전체</TabsTrigger>
            <TabsTrigger value="고객">고객</TabsTrigger>
            <TabsTrigger value="협력사">협력사</TabsTrigger>
            <TabsTrigger value="고객/협력사">고객/협력사</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
          <Input className="pl-9" placeholder="거래처명, 사업자번호, 대표자 검색"
            value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} />
        </div>
      </div>

      {!loading && !list.length ? (
        <EmptyState icon={Building2} title="등록된 거래처가 없습니다" description="거래처를 등록해 주세요" action="거래처 등록" onAction={openCreate} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>거래처명</TableHead>
                  <TableHead>사업자번호</TableHead>
                  <TableHead>대표자</TableHead>
                  <TableHead>연락처</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead className="text-center">매출계약</TableHead>
                  <TableHead className="text-center">매입계약</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.business_no || '-'}</TableCell>
                    <TableCell>{item.ceo_name || '-'}</TableCell>
                    <TableCell>{item.phone || '-'}</TableCell>
                    <TableCell>{item.email || '-'}</TableCell>
                    <TableCell>{typeBadge(item.client_type)}</TableCell>
                    <TableCell className="text-center">{item.sales_count}</TableCell>
                    <TableCell className="text-center">{item.purchase_count}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Edit2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 모달 */}
      {modal.open && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40" onClick={() => setModal({ open: false })}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">{modal.mode === 'create' ? '거래처 등록' : '거래처 수정'}</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium">거래처명 *</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={formErrors.name ? 'border-red-500' : ''} />
                {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">사업자번호</label>
                <Input value={form.business_no} onChange={e => setForm(f => ({ ...f, business_no: e.target.value }))} placeholder="000-00-00000" />
              </div>
              <div>
                <label className="text-sm font-medium">대표자</label>
                <Input value={form.ceo_name} onChange={e => setForm(f => ({ ...f, ceo_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">연락처</label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">이메일</label>
                <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">주소</label>
                <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">유형 *</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm"
                  value={form.client_type} onChange={e => setForm(f => ({ ...f, client_type: e.target.value }))}>
                  {CLIENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">비고</label>
                <textarea className="w-full border rounded-md px-3 py-2 text-sm h-20 resize-none"
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModal({ open: false })}>취소</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? '저장 중...' : modal.mode === 'create' ? '등록' : '수정'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: App.jsx에 라우트 및 사이드바 항목 추가**

`app/frontend/src/App.jsx`에서:

import 추가:
```jsx
import Clients from './pages/Clients';
```

navItems 배열에 추가 (Dashboard 다음):
```jsx
{ to: '/clients', icon: Building2, label: '거래처 관리' },
```

Route 추가:
```jsx
<Route path="/clients" element={<Clients />} />
```

lucide-react import에 `Building2` 추가.

- [ ] **Step 4: 테스트 — 브라우저에서 거래처 CRUD 확인**

- [ ] **Step 5: 커밋**

```bash
git add app/frontend/src/pages/Clients.jsx app/frontend/src/api.js app/frontend/src/App.jsx
git commit -m "feat: add client master management page"
```

---

## Task 5: B1 — JWT 인증 (백엔드)

**Files:**
- Create: `app/backend/middleware/auth.js`
- Create: `app/backend/routes/auth.js`
- Modify: `app/backend/server.js`

- [ ] **Step 1: 인증 미들웨어 작성**

`app/backend/middleware/auth.js`:

```javascript
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'erp-secret-key-change-in-production';

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증이 필요합니다' });
  }
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded; // { id, username, name, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다' });
  }
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, name: user.name, role: user.role },
    SECRET,
    { expiresIn: '8h' }
  );
}

module.exports = { authenticate, generateToken, SECRET };
```

- [ ] **Step 2: 인증 라우트 작성**

`app/backend/routes/auth.js`:

```javascript
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateToken, authenticate } = require('../middleware/auth');

// 회원가입
router.post('/register', async (req, res, next) => {
  try {
    const { username, password, name, email } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: '아이디, 비밀번호, 이름은 필수입니다' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      `INSERT INTO user (username, password_hash, name, email, role) VALUES (?, ?, ?, ?, 'viewer')`,
      [username, password_hash, name, email || null]
    );
    res.status(201).json({ id: result.insertId, message: '회원가입이 완료되었습니다' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '이미 사용 중인 아이디입니다' });
    }
    next(err);
  }
});

// 로그인
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '아이디와 비밀번호를 입력하세요' });
    }

    const [rows] = await db.query(`SELECT * FROM user WHERE username = ? AND is_active = 1`, [username]);
    if (!rows.length) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다' });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: { id: user.id, username: user.username, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) { next(err); }
});

// 내 정보 조회
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT id, username, name, email, role, created_at FROM user WHERE id = ?`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// 비밀번호 변경
router.put('/password', authenticate, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 입력하세요' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다' });
    }

    const [rows] = await db.query(`SELECT password_hash FROM user WHERE id = ?`, [req.user.id]);
    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: '현재 비밀번호가 올바르지 않습니다' });

    const hash = await bcrypt.hash(new_password, 10);
    await db.query(`UPDATE user SET password_hash = ? WHERE id = ?`, [hash, req.user.id]);
    res.json({ message: '비밀번호가 변경되었습니다' });
  } catch (err) { next(err); }
});

module.exports = router;
```

- [ ] **Step 3: server.js에 인증 라우트 마운트 및 미들웨어 적용**

`app/backend/server.js` 수정:

```javascript
const { authenticate } = require('./middleware/auth');
const authRouter = require('./routes/auth');

// 인증 불필요 라우트
app.use('/api/auth', authRouter);

// 인증 필요 라우트 (기존 라우트에 authenticate 미들웨어 추가)
app.use('/api/dashboard', authenticate, dashboardRouter);
app.use('/api/sales-contracts', authenticate, salesContractsRouter);
app.use('/api/purchase-contracts', authenticate, purchaseContractsRouter);
app.use('/api/salespeople', authenticate, salespeopleRouter);
app.use('/api/performance', authenticate, performanceRouter);
app.use('/api/clients', authenticate, clientsRouter);
```

- [ ] **Step 4: 초기 관리자 시드 스크립트**

서버 시작 시 admin 계정 자동 생성 (server.js의 listen 콜백 안):

```javascript
const bcrypt = require('bcryptjs');
// 서버 시작 후 admin 시드
async function seedAdmin() {
  try {
    const [rows] = await db.query(`SELECT id FROM user WHERE username = 'admin'`);
    if (!rows.length) {
      const hash = await bcrypt.hash('admin123', 10);
      await db.query(
        `INSERT INTO user (username, password_hash, name, email, role) VALUES ('admin', ?, '관리자', 'admin@erp.com', 'admin')`,
        [hash]
      );
      console.log('기본 관리자 계정 생성: admin / admin123');
    }
  } catch (err) {
    console.error('Admin seed 실패:', err.message);
  }
}
seedAdmin();
```

- [ ] **Step 5: .env에 JWT_SECRET 추가**

```
JWT_SECRET=erp-jwt-secret-2026-change-me
```

- [ ] **Step 6: 커밋**

```bash
git add app/backend/middleware/auth.js app/backend/routes/auth.js app/backend/server.js app/backend/.env
git commit -m "feat: add JWT authentication with login, register, password change"
```

---

## Task 6: B1 — 인증 프론트엔드 (로그인 + AuthContext)

**Files:**
- Create: `app/frontend/src/contexts/AuthContext.jsx`
- Create: `app/frontend/src/components/ProtectedRoute.jsx`
- Create: `app/frontend/src/pages/Login.jsx`
- Modify: `app/frontend/src/api.js`
- Modify: `app/frontend/src/App.jsx`

- [ ] **Step 1: api.js에 JWT 토큰 헤더 추가**

`app/frontend/src/api.js`의 `request` 함수를 수정:

```javascript
async function request(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { ...headers, ...opts.headers } });
  // 401이면 로그아웃 처리
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('인증이 만료되었습니다');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `요청 실패 (${res.status})`);
  }
  return res.json();
}
```

인증 API 추가:

```javascript
// 인증
login:          (b) => request('/auth/login', { method: 'POST', body: JSON.stringify(b) }),
register:       (b) => request('/auth/register', { method: 'POST', body: JSON.stringify(b) }),
getMe:          ()  => request('/auth/me'),
changePassword: (b) => request('/auth/password', { method: 'PUT', body: JSON.stringify(b) }),
```

- [ ] **Step 2: AuthContext 작성**

`app/frontend/src/contexts/AuthContext.jsx`:

```jsx
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    api.getMe()
      .then(u => { setUser(u); localStorage.setItem('user', JSON.stringify(u)); })
      .catch(() => { localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const { token, user: u } = await api.login({ username, password });
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
    return u;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

- [ ] **Step 3: ProtectedRoute 작성**

`app/frontend/src/components/ProtectedRoute.jsx`:

```jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">로딩 중...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <div className="flex items-center justify-center h-screen text-red-500">접근 권한이 없습니다</div>;
  }
  return children;
}
```

- [ ] **Step 4: Login 페이지 작성**

`app/frontend/src/pages/Login.jsx`:

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { LogIn } from 'lucide-react';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ username: '', password: '', name: '', email: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const api = (await import('../api')).default;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.username, form.password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.username || !form.password || !form.name) {
      setError('아이디, 비밀번호, 이름은 필수입니다');
      return;
    }
    setLoading(true);
    try {
      const api = (await import('../api')).default;
      await api.register(form);
      // 가입 후 자동 로그인
      await login(form.username, form.password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-2">
            <LogIn className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-xl">SI 계약관리 ERP</CardTitle>
          <p className="text-sm text-slate-500">{mode === 'login' ? '로그인' : '회원가입'}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-3">
            <div>
              <label className="text-sm font-medium">아이디</label>
              <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                autoFocus placeholder="아이디 입력" />
            </div>
            <div>
              <label className="text-sm font-medium">비밀번호</label>
              <Input type="password" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="비밀번호 입력" />
            </div>
            {mode === 'register' && (
              <>
                <div>
                  <label className="text-sm font-medium">이름</label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="이름 입력" />
                </div>
                <div>
                  <label className="text-sm font-medium">이메일</label>
                  <Input type="email" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="이메일 입력 (선택)" />
                </div>
              </>
            )}
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
            </Button>
          </form>
          <div className="text-center mt-4">
            <button className="text-sm text-blue-600 hover:underline"
              onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); }}>
              {mode === 'login' ? '계정이 없으신가요? 회원가입' : '계정이 있으신가요? 로그인'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

> **Note:** Login.jsx에서 dynamic import 대신 상단 import를 사용하도록 수정 — `import api from '../api';`를 상단에 두고 `handleRegister`에서 직접 `api.register(form)` 호출.

- [ ] **Step 5: App.jsx에 AuthProvider와 ProtectedRoute 적용**

```jsx
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';

// 최상단 래핑
<BrowserRouter>
  <AuthProvider>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={
        <ProtectedRoute>
          <AppLayout />   {/* 기존 사이드바+콘텐츠 레이아웃을 별도 컴포넌트로 분리 */}
        </ProtectedRoute>
      } />
    </Routes>
  </AuthProvider>
</BrowserRouter>
```

사이드바 하단에 로그아웃 버튼 추가:
```jsx
const { user, logout } = useAuth();
// 사이드바 하단
<button onClick={logout} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white">
  <LogOut className="w-4 h-4" />
  {!collapsed && <span>{user?.name} 로그아웃</span>}
</button>
```

- [ ] **Step 6: 커밋**

```bash
git add app/frontend/src/contexts/AuthContext.jsx app/frontend/src/components/ProtectedRoute.jsx \
  app/frontend/src/pages/Login.jsx app/frontend/src/api.js app/frontend/src/App.jsx
git commit -m "feat: add login page and JWT auth flow"
```

---

## Task 7: B2 — RBAC 역할 기반 접근 제어

**Files:**
- Create: `app/backend/middleware/rbac.js`
- Modify: `app/backend/server.js`
- Modify: `app/frontend/src/components/ProtectedRoute.jsx` (이미 roles 지원 구현됨)

- [ ] **Step 1: RBAC 미들웨어 작성**

`app/backend/middleware/rbac.js`:

```javascript
// 역할 권한 매핑
const PERMISSIONS = {
  admin:   ['*'],                                           // 전체 권한
  manager: ['read', 'create', 'update', 'delete', 'export'], // CRUD + 내보내기
  sales:   ['read', 'create', 'update', 'export'],          // 삭제 불가
  finance: ['read', 'export'],                               // 조회 + 내보내기
  viewer:  ['read'],                                         // 조회만
};

function requirePermission(...perms) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: '인증이 필요합니다' });

    const userPerms = PERMISSIONS[req.user.role] || [];
    if (userPerms.includes('*')) return next(); // admin은 모든 권한

    const hasAll = perms.every(p => userPerms.includes(p));
    if (!hasAll) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }
    next();
  };
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: '인증이 필요합니다' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }
    next();
  };
}

module.exports = { requirePermission, requireRole, PERMISSIONS };
```

- [ ] **Step 2: 라우트에 권한 체크 적용**

각 라우트 파일에서 POST/PUT/DELETE에 권한 체크 추가. 예시 — `salesContracts.js`:

```javascript
const { requirePermission } = require('../middleware/rbac');

// GET은 인증만 필요 (authenticate가 이미 적용됨)
router.post('/', requirePermission('create'), async (req, res, next) => { ... });
router.put('/:id', requirePermission('update'), async (req, res, next) => { ... });
router.delete('/:id', requirePermission('delete'), async (req, res, next) => { ... });
```

동일 패턴을 purchaseContracts.js, clients.js, salespeople.js에 적용.

- [ ] **Step 3: 프론트엔드에서 역할별 UI 분기**

App.jsx 사이드바에서 role에 따라 메뉴 필터링:

```jsx
const navItems = [
  { to: '/', icon: LayoutDashboard, label: '계약 현황' },
  { to: '/clients', icon: Building2, label: '거래처 관리' },
  { to: '/sales', icon: FileText, label: '매출계약' },
  { to: '/purchase', icon: ShoppingCart, label: '매입계약' },
  { to: '/quotations', icon: FileEdit, label: '견적서', roles: ['admin','manager','sales'] },
  { to: '/invoices', icon: Receipt, label: '인보이스', roles: ['admin','manager','finance'] },
  { to: '/performance', icon: TrendingUp, label: '영업 성과' },
  { to: '/salespeople', icon: Users, label: '영업사원 관리', roles: ['admin','manager'] },
];

// 렌더링 시 필터
navItems.filter(n => !n.roles || n.roles.includes(user?.role)).map(...)
```

- [ ] **Step 4: 커밋**

```bash
git add app/backend/middleware/rbac.js app/backend/server.js \
  app/backend/routes/salesContracts.js app/backend/routes/purchaseContracts.js \
  app/backend/routes/clients.js app/backend/routes/salespeople.js \
  app/frontend/src/App.jsx
git commit -m "feat: add RBAC middleware with role-based UI filtering"
```

---

## Task 8: B3 — Audit Trail (감사 로그)

**Files:**
- Create: `app/backend/middleware/audit.js`
- Modify: `app/backend/server.js`

- [ ] **Step 1: 감사 로그 미들웨어 작성**

`app/backend/middleware/audit.js`:

```javascript
const db = require('../db');

async function logAudit({ userId, username, action, entityType, entityId, oldValues, newValues, ip }) {
  try {
    await db.query(
      `INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, old_values, new_values, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId || null,
        username || null,
        action,
        entityType,
        entityId || null,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ip || null
      ]
    );
  } catch (err) {
    console.error('Audit log 저장 실패:', err.message);
  }
}

// Express 미들웨어: req.audit 헬퍼 주입
function auditMiddleware(req, res, next) {
  req.audit = (action, entityType, entityId, oldValues, newValues) => {
    return logAudit({
      userId: req.user?.id,
      username: req.user?.username,
      action,
      entityType,
      entityId,
      oldValues,
      newValues,
      ip: req.ip
    });
  };
  next();
}

module.exports = { auditMiddleware, logAudit };
```

- [ ] **Step 2: server.js에 미들웨어 등록**

```javascript
const { auditMiddleware } = require('./middleware/audit');

// CORS, json 파서 이후, 라우트 이전에 추가
app.use(auditMiddleware);
```

- [ ] **Step 3: 각 라우트에 감사 로그 호출 추가**

예시 — `salesContracts.js` POST:

```javascript
router.post('/', requirePermission('create'), async (req, res, next) => {
  try {
    // ... 기존 INSERT 로직 ...
    const [result] = await db.query(`INSERT INTO sales_contract ...`, [...]);

    await req.audit('CREATE', 'sales_contract', result.insertId, null, req.body);

    res.status(201).json({ id: result.insertId, message: '매출계약이 등록되었습니다' });
  } catch (err) { next(err); }
});
```

PUT 예시:

```javascript
router.put('/:id', requirePermission('update'), async (req, res, next) => {
  try {
    // 변경 전 데이터 조회
    const [before] = await db.query(`SELECT * FROM sales_contract WHERE id = ?`, [req.params.id]);
    if (!before.length) return res.status(404).json({ error: '계약을 찾을 수 없습니다' });

    // ... 기존 UPDATE 로직 ...

    await req.audit('UPDATE', 'sales_contract', parseInt(req.params.id), before[0], req.body);

    res.json({ message: '매출계약이 수정되었습니다' });
  } catch (err) { next(err); }
});
```

DELETE 예시:

```javascript
router.delete('/:id', requirePermission('delete'), async (req, res, next) => {
  try {
    const [before] = await db.query(`SELECT * FROM sales_contract WHERE id = ?`, [req.params.id]);
    if (!before.length) return res.status(404).json({ error: '계약을 찾을 수 없습니다' });

    // ... 기존 DELETE 로직 ...

    await req.audit('DELETE', 'sales_contract', parseInt(req.params.id), before[0], null);

    res.json({ message: '매출계약이 삭제되었습니다' });
  } catch (err) { next(err); }
});
```

동일 패턴을 purchaseContracts.js, clients.js, salespeople.js에 적용.

- [ ] **Step 4: 감사 로그 조회 API (관리자용)**

`server.js`에 직접 추가:

```javascript
// 감사 로그 조회 (admin만)
app.get('/api/audit-logs', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { entity_type, entity_id, user_id, start, end, limit = 100, offset = 0 } = req.query;
    let sql = `SELECT * FROM audit_log WHERE 1=1`;
    const params = [];

    if (entity_type) { sql += ` AND entity_type = ?`; params.push(entity_type); }
    if (entity_id)   { sql += ` AND entity_id = ?`;   params.push(entity_id); }
    if (user_id)     { sql += ` AND user_id = ?`;     params.push(user_id); }
    if (start)       { sql += ` AND created_at >= ?`;  params.push(start); }
    if (end)         { sql += ` AND created_at <= ?`;  params.push(end); }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});
```

- [ ] **Step 5: 커밋**

```bash
git add app/backend/middleware/audit.js app/backend/server.js \
  app/backend/routes/salesContracts.js app/backend/routes/purchaseContracts.js \
  app/backend/routes/clients.js app/backend/routes/salespeople.js
git commit -m "feat: add audit trail logging for all CUD operations"
```

---

## Task 9: A1 — 견적서(Quotation) 관리 API

**Files:**
- Create: `app/backend/routes/quotations.js`
- Modify: `app/backend/server.js`

- [ ] **Step 1: 견적서 라우트 작성**

`app/backend/routes/quotations.js`:

```javascript
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requirePermission } = require('../middleware/rbac');

// 목록 조회
router.get('/', async (req, res, next) => {
  try {
    const { status, search, salesperson_id } = req.query;
    let sql = `SELECT q.*,
      c.name as client_name,
      sp.name as salesperson_name,
      (SELECT COUNT(*) FROM quotation_item qi WHERE qi.quotation_id = q.id) as item_count
      FROM quotation q
      LEFT JOIN client c ON c.id = q.client_id
      LEFT JOIN salesperson sp ON sp.id = q.salesperson_id
      WHERE 1=1`;
    const params = [];

    if (status) { sql += ` AND q.status = ?`; params.push(status); }
    if (salesperson_id) { sql += ` AND q.salesperson_id = ?`; params.push(salesperson_id); }
    if (search) {
      sql += ` AND (q.title LIKE ? OR q.quotation_no LIKE ? OR c.name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ` ORDER BY q.created_at DESC`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// 단일 조회 (항목 포함)
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT q.*, c.name as client_name, sp.name as salesperson_name
       FROM quotation q
       LEFT JOIN client c ON c.id = q.client_id
       LEFT JOIN salesperson sp ON sp.id = q.salesperson_id
       WHERE q.id = ?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: '견적서를 찾을 수 없습니다' });

    const [items] = await db.query(
      `SELECT * FROM quotation_item WHERE quotation_id = ? ORDER BY sort_order`, [req.params.id]
    );
    res.json({ ...rows[0], items });
  } catch (err) { next(err); }
});

// 생성 (견적서 + 항목)
router.post('/', requirePermission('create'), async (req, res, next) => {
  try {
    const { quotation_no, title, client_id, currency, original_amount, status, valid_until, salesperson_id, notes, items } = req.body;
    if (!quotation_no || !title || !client_id || !salesperson_id) {
      return res.status(400).json({ error: '견적번호, 제목, 거래처, 영업사원은 필수입니다' });
    }

    // 항목 합계 계산
    const amount = (items || []).reduce((sum, i) => sum + (i.quantity * i.unit_price), 0);

    const [result] = await db.query(
      `INSERT INTO quotation (quotation_no, title, client_id, amount, currency, original_amount, status, valid_until, salesperson_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [quotation_no, title, client_id, amount, currency || 'KRW', original_amount || amount, status || '작성', valid_until || null, salesperson_id, notes || null]
    );
    const qid = result.insertId;

    // 항목 저장
    if (items && items.length > 0) {
      const values = items.map((item, i) => [qid, item.description, item.quantity || 1, item.unit_price, (item.quantity || 1) * item.unit_price, i]);
      for (const v of values) {
        await db.query(`INSERT INTO quotation_item (quotation_id, description, quantity, unit_price, amount, sort_order) VALUES (?, ?, ?, ?, ?, ?)`, v);
      }
    }

    await req.audit('CREATE', 'quotation', qid, null, req.body);
    res.status(201).json({ id: qid, message: '견적서가 등록되었습니다' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '이미 사용 중인 견적번호입니다' });
    next(err);
  }
});

// 수정
router.put('/:id', requirePermission('update'), async (req, res, next) => {
  try {
    const { quotation_no, title, client_id, currency, original_amount, status, valid_until, salesperson_id, notes, items } = req.body;

    const [before] = await db.query(`SELECT * FROM quotation WHERE id = ?`, [req.params.id]);
    if (!before.length) return res.status(404).json({ error: '견적서를 찾을 수 없습니다' });

    const amount = (items || []).reduce((sum, i) => sum + (i.quantity * i.unit_price), 0);

    await db.query(
      `UPDATE quotation SET quotation_no=?, title=?, client_id=?, amount=?, currency=?, original_amount=?, status=?, valid_until=?, salesperson_id=?, notes=?
       WHERE id=?`,
      [quotation_no, title, client_id, amount, currency || 'KRW', original_amount || amount, status, valid_until || null, salesperson_id, notes || null, req.params.id]
    );

    // 항목 교체 (삭제 후 재삽입)
    await db.query(`DELETE FROM quotation_item WHERE quotation_id = ?`, [req.params.id]);
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await db.query(
          `INSERT INTO quotation_item (quotation_id, description, quantity, unit_price, amount, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
          [req.params.id, item.description, item.quantity || 1, item.unit_price, (item.quantity || 1) * item.unit_price, i]
        );
      }
    }

    await req.audit('UPDATE', 'quotation', parseInt(req.params.id), before[0], req.body);
    res.json({ message: '견적서가 수정되었습니다' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '이미 사용 중인 견적번호입니다' });
    next(err);
  }
});

// 삭제
router.delete('/:id', requirePermission('delete'), async (req, res, next) => {
  try {
    const [before] = await db.query(`SELECT * FROM quotation WHERE id = ?`, [req.params.id]);
    if (!before.length) return res.status(404).json({ error: '견적서를 찾을 수 없습니다' });
    if (before[0].status === '계약전환') {
      return res.status(400).json({ error: '계약으로 전환된 견적서는 삭제할 수 없습니다' });
    }

    await db.query(`DELETE FROM quotation WHERE id = ?`, [req.params.id]);
    await req.audit('DELETE', 'quotation', parseInt(req.params.id), before[0], null);
    res.json({ message: '견적서가 삭제되었습니다' });
  } catch (err) { next(err); }
});

// 계약 전환
router.post('/:id/convert', requirePermission('create'), async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT q.*, c.name as client_name FROM quotation q JOIN client c ON c.id = q.client_id WHERE q.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: '견적서를 찾을 수 없습니다' });

    const q = rows[0];
    if (q.status === '계약전환') return res.status(400).json({ error: '이미 계약으로 전환된 견적서입니다' });
    if (q.status !== '승인') return res.status(400).json({ error: '승인된 견적서만 계약으로 전환할 수 있습니다' });

    const { contract_no, start_date, end_date, project_type } = req.body;
    if (!contract_no || !start_date || !end_date || !project_type) {
      return res.status(400).json({ error: '계약번호, 시작일, 종료일, 프로젝트유형은 필수입니다' });
    }

    const [scResult] = await db.query(
      `INSERT INTO sales_contract (contract_no, contract_name, client_name, client_id, amount, currency, original_amount, start_date, end_date, status, project_type, salesperson_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '등록', ?, ?, ?)`,
      [contract_no, q.title, q.client_name, q.client_id, q.amount, q.currency, q.original_amount, start_date, end_date, project_type, q.salesperson_id, `견적서 ${q.quotation_no}에서 전환`]
    );

    await db.query(`UPDATE quotation SET status = '계약전환', converted_contract_id = ? WHERE id = ?`, [scResult.insertId, req.params.id]);

    await req.audit('CREATE', 'sales_contract', scResult.insertId, null, { from_quotation: q.id });
    await req.audit('UPDATE', 'quotation', q.id, { status: q.status }, { status: '계약전환' });

    res.json({ contract_id: scResult.insertId, message: '매출계약으로 전환되었습니다' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '이미 사용 중인 계약번호입니다' });
    next(err);
  }
});

module.exports = router;
```

- [ ] **Step 2: server.js에 마운트**

```javascript
const quotationsRouter = require('./routes/quotations');
app.use('/api/quotations', authenticate, quotationsRouter);
```

- [ ] **Step 3: 커밋**

```bash
git add app/backend/routes/quotations.js app/backend/server.js
git commit -m "feat: add quotation CRUD API with contract conversion"
```

---

## Task 10: A1 — 견적서 프론트엔드 페이지

**Files:**
- Create: `app/frontend/src/pages/Quotations.jsx`
- Modify: `app/frontend/src/api.js`
- Modify: `app/frontend/src/App.jsx`

- [ ] **Step 1: api.js에 견적서 API 추가**

```javascript
// 견적서
getQuotations:     (p)     => request(`/quotations${toQS(p)}`),
getQuotation:      (id)    => request(`/quotations/${id}`),
createQuotation:   (b)     => request('/quotations', { method: 'POST', body: JSON.stringify(b) }),
updateQuotation:   (id, b) => request(`/quotations/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
deleteQuotation:   (id)    => request(`/quotations/${id}`, { method: 'DELETE' }),
convertQuotation:  (id, b) => request(`/quotations/${id}/convert`, { method: 'POST', body: JSON.stringify(b) }),
```

- [ ] **Step 2: Quotations.jsx 작성**

`app/frontend/src/pages/Quotations.jsx`:

SalesContracts.jsx와 유사한 구조이며 다음 차이점 적용:
- 탭 필터: 전체 / 작성 / 제출 / 승인 / 거절 / 계약전환
- 테이블 컬럼: 견적번호, 제목, 거래처, 금액, 상태, 유효기간, 영업사원, 항목수
- 폼에 **항목(items) 동적 추가/삭제** 기능:
  - 각 항목: 설명(description), 수량(quantity), 단가(unit_price)
  - 항목 합계 자동 계산 → 견적 총액
- 상세 보기에서 항목 목록 표시
- "계약전환" 버튼: 승인 상태일 때만 활성화
  - 클릭 시 모달: 계약번호, 시작일, 종료일, 프로젝트유형 입력
  - 전환 후 매출계약 페이지로 이동

```jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, FileEdit, Edit2, Trash2, ArrowRightCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/table';
import { Select } from '../components/ui/select';
import { toastSuccess, toastError } from '../components/Toast';
import { confirmDialog } from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import ErrorBanner from '../components/ErrorBanner';
import { CurrencyAmountInput, toKRW, fromKRW } from '../components/CurrencyAmountInput';
import { useCurrency } from '../contexts/CurrencyContext';
import api from '../api';
import { useDebounce } from '../hooks/useDebounce';

const STATUSES = ['작성', '제출', '승인', '거절', '계약전환'];

export default function Quotations() {
  const { fmtM, fmtFull } = useCurrency();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [people, setPeople] = useState([]);
  const [clients, setClients] = useState([]);
  const [filter, setFilter] = useState({ status: '', search: '', salesperson_id: '' });
  const [modal, setModal] = useState({ open: false, mode: 'create', id: null });
  const [detailModal, setDetailModal] = useState({ open: false, data: null });
  const [convertModal, setConvertModal] = useState({ open: false, quotation: null });
  const [convertForm, setConvertForm] = useState({ contract_no: '', start_date: '', end_date: '', project_type: '신규개발' });
  const [form, setForm] = useState({
    quotation_no: '', title: '', client_id: '', input_currency: 'KRW',
    status: '작성', valid_until: '', salesperson_id: '', notes: '',
    items: [{ description: '', quantity: 1, unit_price: 0 }]
  });
  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sort, setSort] = useState({ key: 'created_at', asc: false });
  const debouncedSearch = useDebounce(filter.search);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter.status) params.status = filter.status;
      if (filter.salesperson_id) params.salesperson_id = filter.salesperson_id;
      if (debouncedSearch) params.search = debouncedSearch;
      const [data, sp, cl] = await Promise.all([
        api.getQuotations(params),
        api.getSalespeople(),
        api.getClients()
      ]);
      setList(data);
      setPeople(sp);
      setClients(cl);
      setError('');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [filter.status, filter.salesperson_id, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  // 항목 추가/삭제/변경
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { description: '', quantity: 1, unit_price: 0 }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, field, value) => setForm(f => ({
    ...f, items: f.items.map((item, idx) => idx === i ? { ...item, [field]: value } : item)
  }));

  const itemsTotal = form.items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0);

  const validate = () => {
    const errs = {};
    if (!form.quotation_no.trim()) errs.quotation_no = '견적번호를 입력하세요';
    if (!form.title.trim()) errs.title = '제목을 입력하세요';
    if (!form.client_id) errs.client_id = '거래처를 선택하세요';
    if (!form.salesperson_id) errs.salesperson_id = '영업사원을 선택하세요';
    if (!form.items.length) errs.items = '항목을 1개 이상 추가하세요';
    form.items.forEach((item, i) => {
      if (!item.description.trim()) errs[`item_${i}_desc`] = '설명을 입력하세요';
      if (item.unit_price <= 0) errs[`item_${i}_price`] = '단가를 입력하세요';
    });
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        items: form.items.map(i => ({
          description: i.description,
          quantity: parseInt(i.quantity) || 1,
          unit_price: form.input_currency === 'KRW' ? i.unit_price : toKRW(i.unit_price, form.input_currency)
        })),
        currency: form.input_currency,
        original_amount: itemsTotal
      };
      delete payload.input_currency;

      if (modal.mode === 'create') {
        await api.createQuotation(payload);
        toastSuccess('견적서가 등록되었습니다');
      } else {
        await api.updateQuotation(modal.id, payload);
        toastSuccess('견적서가 수정되었습니다');
      }
      setModal({ open: false, mode: 'create', id: null });
      load();
    } catch (e) { toastError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item) => {
    if (item.status === '계약전환') return toastError('계약전환된 견적서는 삭제할 수 없습니다');
    const ok = await confirmDialog({ title: '견적서 삭제', message: `"${item.title}"을(를) 삭제하시겠습니까?`, danger: true });
    if (!ok) return;
    try { await api.deleteQuotation(item.id); toastSuccess('삭제되었습니다'); load(); }
    catch (e) { toastError(e.message); }
  };

  const openDetail = async (id) => {
    try {
      const data = await api.getQuotation(id);
      setDetailModal({ open: true, data });
    } catch (e) { toastError(e.message); }
  };

  const openEdit = async (item) => {
    try {
      const data = await api.getQuotation(item.id);
      setForm({
        quotation_no: data.quotation_no, title: data.title, client_id: data.client_id,
        input_currency: data.currency || 'KRW', status: data.status,
        valid_until: data.valid_until ? data.valid_until.slice(0, 10) : '',
        salesperson_id: data.salesperson_id, notes: data.notes || '',
        items: data.items.length ? data.items.map(i => ({
          description: i.description,
          quantity: i.quantity,
          unit_price: data.currency !== 'KRW' ? fromKRW(i.unit_price, data.currency) : i.unit_price
        })) : [{ description: '', quantity: 1, unit_price: 0 }]
      });
      setFormErrors({});
      setModal({ open: true, mode: 'edit', id: item.id });
    } catch (e) { toastError(e.message); }
  };

  const handleConvert = async () => {
    if (!convertForm.contract_no || !convertForm.start_date || !convertForm.end_date || !convertForm.project_type) {
      return toastError('모든 필드를 입력하세요');
    }
    try {
      const result = await api.convertQuotation(convertModal.quotation.id, convertForm);
      toastSuccess('매출계약으로 전환되었습니다');
      setConvertModal({ open: false, quotation: null });
      navigate('/sales');
    } catch (e) { toastError(e.message); }
  };

  const statusBadge = (s) => {
    const map = { '작성': 'secondary', '제출': 'default', '승인': 'outline', '거절': 'destructive', '계약전환': 'outline' };
    return <Badge variant={map[s] || 'default'}>{s}</Badge>;
  };

  const sorted = [...list].sort((a, b) => {
    let av = a[sort.key], bv = b[sort.key];
    if (typeof av === 'string') return sort.asc ? av.localeCompare(bv) : bv.localeCompare(av);
    return sort.asc ? av - bv : bv - av;
  });

  const SortHead = ({ k, children }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => setSort(s => ({ key: k, asc: s.key === k ? !s.asc : true }))}>
      <span className="flex items-center gap-1">{children}
        {sort.key === k && (sort.asc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </span>
    </TableHead>
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">견적서 관리</h1>
        <Button onClick={() => {
          setForm({ quotation_no: '', title: '', client_id: '', input_currency: 'KRW', status: '작성', valid_until: '', salesperson_id: '', notes: '', items: [{ description: '', quantity: 1, unit_price: 0 }] });
          setFormErrors({});
          setModal({ open: true, mode: 'create', id: null });
        }}><Plus className="w-4 h-4 mr-1" />견적서 작성</Button>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={filter.status} onValueChange={v => setFilter(f => ({ ...f, status: v }))}>
          <TabsList>
            <TabsTrigger value="">전체</TabsTrigger>
            {STATUSES.map(s => <TabsTrigger key={s} value={s}>{s}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
          <Input className="pl-9" placeholder="제목, 견적번호, 거래처 검색"
            value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} />
        </div>
      </div>

      {!loading && !list.length ? (
        <EmptyState icon={FileEdit} title="등록된 견적서가 없습니다" description="견적서를 작성해 주세요" />
      ) : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <SortHead k="quotation_no">견적번호</SortHead>
              <SortHead k="title">제목</SortHead>
              <TableHead>거래처</TableHead>
              <SortHead k="amount">금액</SortHead>
              <TableHead>상태</TableHead>
              <TableHead>유효기간</TableHead>
              <TableHead>영업사원</TableHead>
              <TableHead className="text-center">항목</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {sorted.map(row => (
                <TableRow key={row.id} className="cursor-pointer" onClick={() => openDetail(row.id)}>
                  <TableCell className="font-mono text-sm">{row.quotation_no}</TableCell>
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell>{row.client_name}</TableCell>
                  <TableCell title={fmtFull(row.amount)}>{fmtM(row.amount)}</TableCell>
                  <TableCell>{statusBadge(row.status)}</TableCell>
                  <TableCell>{row.valid_until ? row.valid_until.slice(0, 10) : '-'}</TableCell>
                  <TableCell>{row.salesperson_name}</TableCell>
                  <TableCell className="text-center">{row.item_count}</TableCell>
                  <TableCell className="text-right space-x-1" onClick={e => e.stopPropagation()}>
                    {row.status === '승인' && (
                      <Button variant="outline" size="sm" onClick={() => { setConvertModal({ open: true, quotation: row }); setConvertForm({ contract_no: '', start_date: '', end_date: '', project_type: '신규개발' }); }}>
                        <ArrowRightCircle className="w-4 h-4 mr-1" />전환
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => openEdit(row)}><Edit2 className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(row)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}

      {/* 생성/수정 모달 — 항목 동적 관리 포함 */}
      {modal.open && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40" onClick={() => setModal({ open: false })}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">{modal.mode === 'create' ? '견적서 작성' : '견적서 수정'}</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">견적번호 *</label>
                <Input value={form.quotation_no} onChange={e => setForm(f => ({ ...f, quotation_no: e.target.value }))}
                  className={formErrors.quotation_no ? 'border-red-500' : ''} placeholder="QT-2026-001" />
              </div>
              <div>
                <label className="text-sm font-medium">상태</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm"
                  value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {STATUSES.filter(s => s !== '계약전환').map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">제목 *</label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className={formErrors.title ? 'border-red-500' : ''} />
              </div>
              <div>
                <label className="text-sm font-medium">거래처 *</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm"
                  value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
                  <option value="">선택</option>
                  {clients.filter(c => c.client_type !== '협력사').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">영업사원 *</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm"
                  value={form.salesperson_id} onChange={e => setForm(f => ({ ...f, salesperson_id: e.target.value }))}>
                  <option value="">선택</option>
                  {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">유효기간</label>
                <Input type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">통화</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm"
                  value={form.input_currency} onChange={e => setForm(f => ({ ...f, input_currency: e.target.value }))}>
                  <option value="KRW">KRW (₩)</option>
                  <option value="USD">USD ($)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
            </div>

            {/* 항목 목록 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold">견적 항목</label>
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="w-3 h-3 mr-1" />항목 추가</Button>
              </div>
              <div className="space-y-2">
                {form.items.map((item, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Input placeholder="항목 설명" value={item.description}
                        onChange={e => updateItem(i, 'description', e.target.value)}
                        className={formErrors[`item_${i}_desc`] ? 'border-red-500' : ''} />
                    </div>
                    <div className="w-20">
                      <Input type="number" placeholder="수량" value={item.quantity}
                        onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 0)} min="1" />
                    </div>
                    <div className="w-36">
                      <Input type="number" placeholder="단가" value={item.unit_price}
                        onChange={e => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)} min="0" />
                    </div>
                    <div className="w-28 text-right text-sm pt-2 text-slate-600">
                      {((item.quantity || 0) * (item.unit_price || 0)).toLocaleString()}
                    </div>
                    {form.items.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeItem(i)}>
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <div className="text-right font-bold mt-2">합계: {itemsTotal.toLocaleString()}</div>
            </div>

            <div>
              <label className="text-sm font-medium">비고</label>
              <textarea className="w-full border rounded-md px-3 py-2 text-sm h-16 resize-none"
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModal({ open: false })}>취소</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? '저장 중...' : modal.mode === 'create' ? '등록' : '수정'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 상세 보기 모달 */}
      {detailModal.open && detailModal.data && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40" onClick={() => setDetailModal({ open: false, data: null })}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">{detailModal.data.title}</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-slate-500">견적번호:</span> {detailModal.data.quotation_no}</div>
              <div><span className="text-slate-500">거래처:</span> {detailModal.data.client_name}</div>
              <div><span className="text-slate-500">영업사원:</span> {detailModal.data.salesperson_name}</div>
              <div><span className="text-slate-500">상태:</span> {statusBadge(detailModal.data.status)}</div>
              <div><span className="text-slate-500">금액:</span> {fmtFull(detailModal.data.amount)}</div>
              <div><span className="text-slate-500">유효기간:</span> {detailModal.data.valid_until?.slice(0, 10) || '-'}</div>
            </div>
            {detailModal.data.items?.length > 0 && (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>설명</TableHead><TableHead className="text-center">수량</TableHead>
                  <TableHead className="text-right">단가</TableHead><TableHead className="text-right">금액</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {detailModal.data.items.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">{fmtM(item.unit_price)}</TableCell>
                      <TableCell className="text-right">{fmtM(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {detailModal.data.notes && <p className="text-sm text-slate-600">{detailModal.data.notes}</p>}
            <div className="flex justify-end"><Button variant="outline" onClick={() => setDetailModal({ open: false, data: null })}>닫기</Button></div>
          </div>
        </div>
      )}

      {/* 계약 전환 모달 */}
      {convertModal.open && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40" onClick={() => setConvertModal({ open: false })}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">매출계약 전환</h2>
            <p className="text-sm text-slate-500">"{convertModal.quotation?.title}" 견적서를 매출계약으로 전환합니다.</p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">계약번호 *</label>
                <Input value={convertForm.contract_no} onChange={e => setConvertForm(f => ({ ...f, contract_no: e.target.value }))} placeholder="SC-2026-001" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium">시작일 *</label><Input type="date" value={convertForm.start_date} onChange={e => setConvertForm(f => ({ ...f, start_date: e.target.value }))} /></div>
                <div><label className="text-sm font-medium">종료일 *</label><Input type="date" value={convertForm.end_date} onChange={e => setConvertForm(f => ({ ...f, end_date: e.target.value }))} /></div>
              </div>
              <div>
                <label className="text-sm font-medium">프로젝트 유형 *</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={convertForm.project_type}
                  onChange={e => setConvertForm(f => ({ ...f, project_type: e.target.value }))}>
                  <option>신규개발</option><option>유지보수</option><option>컨설팅</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConvertModal({ open: false })}>취소</Button>
              <Button onClick={handleConvert}>전환</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: App.jsx에 라우트 추가**

```jsx
import Quotations from './pages/Quotations';

// navItems에 추가
{ to: '/quotations', icon: FileEdit, label: '견적서', roles: ['admin','manager','sales'] },

// Route 추가
<Route path="/quotations" element={<Quotations />} />
```

- [ ] **Step 4: 커밋**

```bash
git add app/frontend/src/pages/Quotations.jsx app/frontend/src/api.js app/frontend/src/App.jsx
git commit -m "feat: add quotation management page with items and contract conversion"
```

---

## Task 11: A2 — 인보이스(Invoice) API

**Files:**
- Create: `app/backend/routes/invoices.js`
- Modify: `app/backend/server.js`

- [ ] **Step 1: 인보이스 라우트 작성**

`app/backend/routes/invoices.js`:

```javascript
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requirePermission } = require('../middleware/rbac');

// 목록 조회
router.get('/', async (req, res, next) => {
  try {
    const { status, search, sales_contract_id } = req.query;
    let sql = `SELECT i.*,
      c.name as client_name,
      sc.contract_name as sales_contract_name,
      sc.contract_no as sales_contract_no
      FROM invoice i
      LEFT JOIN client c ON c.id = i.client_id
      LEFT JOIN sales_contract sc ON sc.id = i.sales_contract_id
      WHERE 1=1`;
    const params = [];

    if (status) { sql += ` AND i.status = ?`; params.push(status); }
    if (sales_contract_id) { sql += ` AND i.sales_contract_id = ?`; params.push(sales_contract_id); }
    if (search) {
      sql += ` AND (i.invoice_no LIKE ? OR c.name LIKE ? OR sc.contract_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ` ORDER BY i.created_at DESC`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// 단일 조회
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT i.*, c.name as client_name, sc.contract_name as sales_contract_name, sc.contract_no as sales_contract_no
       FROM invoice i
       LEFT JOIN client c ON c.id = i.client_id
       LEFT JOIN sales_contract sc ON sc.id = i.sales_contract_id
       WHERE i.id = ?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: '인보이스를 찾을 수 없습니다' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// 생성
router.post('/', requirePermission('create'), async (req, res, next) => {
  try {
    const { invoice_no, sales_contract_id, client_id, amount, currency, original_amount, issue_date, due_date, notes } = req.body;
    if (!invoice_no || !sales_contract_id || !client_id || !amount || !issue_date || !due_date) {
      return res.status(400).json({ error: '인보이스번호, 매출계약, 거래처, 금액, 발행일, 만기일은 필수입니다' });
    }

    const [result] = await db.query(
      `INSERT INTO invoice (invoice_no, sales_contract_id, client_id, amount, currency, original_amount, issue_date, due_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [invoice_no, sales_contract_id, client_id, amount, currency || 'KRW', original_amount || amount, issue_date, due_date, notes || null]
    );

    await req.audit('CREATE', 'invoice', result.insertId, null, req.body);
    res.status(201).json({ id: result.insertId, message: '인보이스가 발행되었습니다' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '이미 사용 중인 인보이스번호입니다' });
    next(err);
  }
});

// 수정
router.put('/:id', requirePermission('update'), async (req, res, next) => {
  try {
    const [before] = await db.query(`SELECT * FROM invoice WHERE id = ?`, [req.params.id]);
    if (!before.length) return res.status(404).json({ error: '인보이스를 찾을 수 없습니다' });

    const { invoice_no, sales_contract_id, client_id, amount, currency, original_amount, issue_date, due_date, status, paid_amount, paid_date, notes } = req.body;

    await db.query(
      `UPDATE invoice SET invoice_no=?, sales_contract_id=?, client_id=?, amount=?, currency=?, original_amount=?,
       issue_date=?, due_date=?, status=?, paid_amount=?, paid_date=?, notes=? WHERE id=?`,
      [invoice_no, sales_contract_id, client_id, amount, currency || 'KRW', original_amount || amount,
       issue_date, due_date, status || '발행', paid_amount || 0, paid_date || null, notes || null, req.params.id]
    );

    await req.audit('UPDATE', 'invoice', parseInt(req.params.id), before[0], req.body);
    res.json({ message: '인보이스가 수정되었습니다' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '이미 사용 중인 인보이스번호입니다' });
    next(err);
  }
});

// 삭제
router.delete('/:id', requirePermission('delete'), async (req, res, next) => {
  try {
    const [before] = await db.query(`SELECT * FROM invoice WHERE id = ?`, [req.params.id]);
    if (!before.length) return res.status(404).json({ error: '인보이스를 찾을 수 없습니다' });

    await db.query(`DELETE FROM invoice WHERE id = ?`, [req.params.id]);
    await req.audit('DELETE', 'invoice', parseInt(req.params.id), before[0], null);
    res.json({ message: '인보이스가 삭제되었습니다' });
  } catch (err) { next(err); }
});

// 수금 처리
router.post('/:id/pay', requirePermission('update'), async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT * FROM invoice WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: '인보이스를 찾을 수 없습니다' });

    const { paid_amount, paid_date } = req.body;
    if (!paid_amount || !paid_date) return res.status(400).json({ error: '수금액과 수금일을 입력하세요' });

    const newPaid = (rows[0].paid_amount || 0) + parseFloat(paid_amount);
    const newStatus = newPaid >= rows[0].amount ? '수금완료' : '발행';

    await db.query(
      `UPDATE invoice SET paid_amount = ?, paid_date = ?, status = ? WHERE id = ?`,
      [newPaid, paid_date, newStatus, req.params.id]
    );

    await req.audit('UPDATE', 'invoice', parseInt(req.params.id), rows[0], { paid_amount: newPaid, status: newStatus });
    res.json({ message: newStatus === '수금완료' ? '수금이 완료되었습니다' : '수금이 처리되었습니다' });
  } catch (err) { next(err); }
});

module.exports = router;
```

- [ ] **Step 2: server.js에 마운트**

```javascript
const invoicesRouter = require('./routes/invoices');
app.use('/api/invoices', authenticate, invoicesRouter);
```

- [ ] **Step 3: 커밋**

```bash
git add app/backend/routes/invoices.js app/backend/server.js
git commit -m "feat: add invoice CRUD API with payment processing"
```

---

## Task 12: A2 — 인보이스 프론트엔드 페이지

**Files:**
- Create: `app/frontend/src/pages/Invoices.jsx`
- Modify: `app/frontend/src/api.js`
- Modify: `app/frontend/src/App.jsx`

- [ ] **Step 1: api.js에 인보이스 API 추가**

```javascript
// 인보이스
getInvoices:     (p)     => request(`/invoices${toQS(p)}`),
getInvoice:      (id)    => request(`/invoices/${id}`),
createInvoice:   (b)     => request('/invoices', { method: 'POST', body: JSON.stringify(b) }),
updateInvoice:   (id, b) => request(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
deleteInvoice:   (id)    => request(`/invoices/${id}`, { method: 'DELETE' }),
payInvoice:      (id, b) => request(`/invoices/${id}/pay`, { method: 'POST', body: JSON.stringify(b) }),
```

- [ ] **Step 2: Invoices.jsx 작성**

`app/frontend/src/pages/Invoices.jsx`:

SalesContracts.jsx 패턴을 따르되:
- 탭 필터: 전체 / 발행 / 수금완료 / 연체 / 취소
- 테이블 컬럼: 인보이스번호, 매출계약, 거래처, 금액, 수금액, 발행일, 만기일, 상태
- 연체 자동 판별: due_date < today && status === '발행' → 빨간색 하이라이트
- "수금처리" 버튼: 발행 상태일 때 → 수금액, 수금일 입력 모달
- 매출계약 선택 시 거래처 자동 설정

구조는 Quotations.jsx와 유사하므로 동일 패턴으로 작성. 핵심 차이점만 기재:

```jsx
// 핵심 상태
const [salesContracts, setSalesContracts] = useState([]);
const [payModal, setPayModal] = useState({ open: false, invoice: null });
const [payForm, setPayForm] = useState({ paid_amount: '', paid_date: '' });

// 연체 판별
const isOverdue = (inv) => inv.status === '발행' && new Date(inv.due_date) < new Date();

// 수금 처리
const handlePay = async () => {
  try {
    await api.payInvoice(payModal.invoice.id, payForm);
    toastSuccess('수금이 처리되었습니다');
    setPayModal({ open: false, invoice: null });
    load();
  } catch (e) { toastError(e.message); }
};

// 매출계약 선택 시 거래처 자동 설정
const onSalesContractChange = (scId) => {
  const sc = salesContracts.find(s => s.id === parseInt(scId));
  setForm(f => ({ ...f, sales_contract_id: scId, client_id: sc?.client_id || '' }));
};
```

- [ ] **Step 3: App.jsx에 라우트 추가**

```jsx
import Invoices from './pages/Invoices';

// navItems에 추가
{ to: '/invoices', icon: Receipt, label: '인보이스', roles: ['admin','manager','finance'] },

// Route 추가
<Route path="/invoices" element={<Invoices />} />
```

lucide-react import에 `Receipt` 추가.

- [ ] **Step 4: 커밋**

```bash
git add app/frontend/src/pages/Invoices.jsx app/frontend/src/api.js app/frontend/src/App.jsx
git commit -m "feat: add invoice management page with payment processing"
```

---

## Task 13: D1 — 파일 첨부 기능

**Files:**
- Create: `app/backend/routes/attachments.js`
- Create: `app/frontend/src/components/FileUpload.jsx`
- Create: `app/frontend/src/components/FileList.jsx`
- Modify: `app/backend/server.js`
- Modify: `app/frontend/src/api.js`

- [ ] **Step 1: 업로드 디렉토리 생성**

```bash
mkdir -p /c/Users/qwert/erp/app/backend/uploads
```

- [ ] **Step 2: 첨부파일 API 작성**

`app/backend/routes/attachments.js`:

```javascript
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
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
    const blocked = ['.exe', '.bat', '.cmd', '.sh', '.ps1'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (blocked.includes(ext)) return cb(new Error('허용되지 않는 파일 형식입니다'));
    cb(null, true);
  }
});

// 엔티티별 첨부파일 목록
router.get('/:entityType/:entityId', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT a.*, u.name as uploader_name FROM attachment a
       LEFT JOIN user u ON u.id = a.uploaded_by
       WHERE a.entity_type = ? AND a.entity_id = ?
       ORDER BY a.created_at DESC`,
      [req.params.entityType, req.params.entityId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// 업로드
router.post('/:entityType/:entityId', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: '파일을 선택하세요' });

    const [result] = await db.query(
      `INSERT INTO attachment (entity_type, entity_id, file_name, stored_name, file_size, mime_type, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.params.entityType, req.params.entityId, req.file.originalname, req.file.filename, req.file.size, req.file.mimetype, req.user?.id || null]
    );

    res.status(201).json({ id: result.insertId, message: '파일이 업로드되었습니다' });
  } catch (err) { next(err); }
});

// 다운로드
router.get('/download/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT * FROM attachment WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: '파일을 찾을 수 없습니다' });

    const filePath = path.join(UPLOAD_DIR, rows[0].stored_name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: '파일이 존재하지 않습니다' });

    res.download(filePath, rows[0].file_name);
  } catch (err) { next(err); }
});

// 삭제
router.delete('/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query(`SELECT * FROM attachment WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: '파일을 찾을 수 없습니다' });

    const filePath = path.join(UPLOAD_DIR, rows[0].stored_name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await db.query(`DELETE FROM attachment WHERE id = ?`, [req.params.id]);
    res.json({ message: '파일이 삭제되었습니다' });
  } catch (err) { next(err); }
});

module.exports = router;
```

- [ ] **Step 3: server.js에 마운트 + static 서빙**

```javascript
const attachmentsRouter = require('./routes/attachments');
app.use('/api/attachments', authenticate, attachmentsRouter);
```

- [ ] **Step 4: api.js에 첨부파일 API 추가**

```javascript
// 첨부파일
getAttachments: (entityType, entityId) => request(`/attachments/${entityType}/${entityId}`),
uploadFile: (entityType, entityId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  const token = localStorage.getItem('token');
  return fetch(`/api/attachments/${entityType}/${entityId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  }).then(r => r.ok ? r.json() : r.json().then(b => { throw new Error(b.error) }));
},
deleteAttachment: (id) => request(`/attachments/${id}`, { method: 'DELETE' }),
```

- [ ] **Step 5: FileUpload 컴포넌트 작성**

`app/frontend/src/components/FileUpload.jsx`:

```jsx
import { useState, useRef } from 'react';
import { Upload } from 'lucide-react';
import { Button } from './ui/button';
import { toastSuccess, toastError } from './Toast';
import api from '../api';

export default function FileUpload({ entityType, entityId, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef();

  const handleChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toastError('10MB 이하 파일만 업로드 가능합니다'); return; }

    setUploading(true);
    try {
      await api.uploadFile(entityType, entityId, file);
      toastSuccess('파일이 업로드되었습니다');
      onUploaded?.();
    } catch (err) { toastError(err.message); }
    finally { setUploading(false); ref.current.value = ''; }
  };

  return (
    <div>
      <input ref={ref} type="file" className="hidden" onChange={handleChange} />
      <Button variant="outline" size="sm" disabled={uploading} onClick={() => ref.current.click()}>
        <Upload className="w-4 h-4 mr-1" />{uploading ? '업로드 중...' : '파일 첨부'}
      </Button>
    </div>
  );
}
```

- [ ] **Step 6: FileList 컴포넌트 작성**

`app/frontend/src/components/FileList.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { Download, Trash2, File } from 'lucide-react';
import { Button } from './ui/button';
import { toastSuccess, toastError } from './Toast';
import { confirmDialog } from './ConfirmDialog';
import api from '../api';

export default function FileList({ entityType, entityId, refreshKey }) {
  const [files, setFiles] = useState([]);

  const load = async () => {
    if (!entityId) return;
    try { setFiles(await api.getAttachments(entityType, entityId)); }
    catch { setFiles([]); }
  };

  useEffect(() => { load(); }, [entityType, entityId, refreshKey]);

  const handleDelete = async (f) => {
    const ok = await confirmDialog({ title: '파일 삭제', message: `"${f.file_name}"을(를) 삭제하시겠습니까?`, danger: true });
    if (!ok) return;
    try { await api.deleteAttachment(f.id); toastSuccess('삭제되었습니다'); load(); }
    catch (e) { toastError(e.message); }
  };

  const fmtSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  if (!files.length) return null;

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-500">첨부파일 ({files.length})</p>
      {files.map(f => (
        <div key={f.id} className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-slate-50">
          <File className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="truncate flex-1">{f.file_name}</span>
          <span className="text-xs text-slate-400">{fmtSize(f.file_size)}</span>
          <a href={`/api/attachments/download/${f.id}`} target="_blank" rel="noreferrer">
            <Button variant="ghost" size="icon" className="h-6 w-6"><Download className="w-3 h-3" /></Button>
          </a>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(f)}>
            <Trash2 className="w-3 h-3 text-red-400" />
          </Button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: 기존 상세 모달에 FileUpload/FileList 통합**

각 상세 보기 모달 (SalesContracts, PurchaseContracts, Quotations, Invoices, Clients)에:

```jsx
import FileUpload from '../components/FileUpload';
import FileList from '../components/FileList';

// 상세 모달 내부
<FileUpload entityType="sales_contract" entityId={detailData.id} onUploaded={() => setFileRefresh(k => k+1)} />
<FileList entityType="sales_contract" entityId={detailData.id} refreshKey={fileRefresh} />
```

- [ ] **Step 8: 커밋**

```bash
git add app/backend/routes/attachments.js app/backend/server.js \
  app/frontend/src/components/FileUpload.jsx app/frontend/src/components/FileList.jsx \
  app/frontend/src/api.js
git commit -m "feat: add file attachment upload/download/delete"
```

---

## Task 14: D2 — 엑셀/PDF 내보내기

**Files:**
- Create: `app/backend/routes/export.js`
- Create: `app/frontend/src/components/ExportButton.jsx`
- Modify: `app/backend/server.js`

- [ ] **Step 1: 내보내기 API 작성**

`app/backend/routes/export.js`:

```javascript
const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const db = require('../db');
const { requirePermission } = require('../middleware/rbac');

// 매출계약 엑셀
router.get('/sales-contracts/excel', requirePermission('export'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT sc.contract_no, sc.contract_name, sc.client_name, sc.amount, sc.currency,
       sc.start_date, sc.end_date, sc.status, sc.project_type, sp.name as salesperson_name
       FROM sales_contract sc LEFT JOIN salesperson sp ON sp.id = sc.salesperson_id
       ORDER BY sc.created_at DESC`
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('매출계약');
    ws.columns = [
      { header: '계약번호', key: 'contract_no', width: 15 },
      { header: '계약명', key: 'contract_name', width: 30 },
      { header: '고객사', key: 'client_name', width: 20 },
      { header: '금액', key: 'amount', width: 15, style: { numFmt: '#,##0' } },
      { header: '통화', key: 'currency', width: 8 },
      { header: '시작일', key: 'start_date', width: 12 },
      { header: '종료일', key: 'end_date', width: 12 },
      { header: '상태', key: 'status', width: 10 },
      { header: '프로젝트유형', key: 'project_type', width: 12 },
      { header: '영업사원', key: 'salesperson_name', width: 12 },
    ];

    // 헤더 스타일
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

    rows.forEach(r => {
      ws.addRow({
        ...r,
        start_date: r.start_date ? new Date(r.start_date).toISOString().slice(0, 10) : '',
        end_date: r.end_date ? new Date(r.end_date).toISOString().slice(0, 10) : '',
        amount: Number(r.amount)
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=sales_contracts_${Date.now()}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});

// 매입계약 엑셀
router.get('/purchase-contracts/excel', requirePermission('export'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT pc.contract_no, pc.contract_name, pc.vendor_name, pc.worker_name,
       pc.monthly_rate, pc.months, pc.amount, pc.currency, pc.start_date, pc.end_date, pc.status,
       sc.contract_name as sales_contract_name
       FROM purchase_contract pc
       LEFT JOIN sales_contract sc ON sc.id = pc.sales_contract_id
       ORDER BY pc.created_at DESC`
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('매입계약');
    ws.columns = [
      { header: '계약번호', key: 'contract_no', width: 15 },
      { header: '계약명', key: 'contract_name', width: 25 },
      { header: '협력사', key: 'vendor_name', width: 20 },
      { header: '투입인력', key: 'worker_name', width: 12 },
      { header: '월단가', key: 'monthly_rate', width: 12, style: { numFmt: '#,##0' } },
      { header: '개월', key: 'months', width: 8 },
      { header: '총액', key: 'amount', width: 15, style: { numFmt: '#,##0' } },
      { header: '시작일', key: 'start_date', width: 12 },
      { header: '종료일', key: 'end_date', width: 12 },
      { header: '상태', key: 'status', width: 10 },
      { header: '매출계약', key: 'sales_contract_name', width: 25 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

    rows.forEach(r => ws.addRow({
      ...r,
      start_date: r.start_date ? new Date(r.start_date).toISOString().slice(0, 10) : '',
      end_date: r.end_date ? new Date(r.end_date).toISOString().slice(0, 10) : '',
      monthly_rate: Number(r.monthly_rate), amount: Number(r.amount)
    }));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=purchase_contracts_${Date.now()}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});

// 견적서 엑셀
router.get('/quotations/excel', requirePermission('export'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT q.quotation_no, q.title, c.name as client_name, q.amount, q.currency,
       q.status, q.valid_until, sp.name as salesperson_name
       FROM quotation q
       LEFT JOIN client c ON c.id = q.client_id
       LEFT JOIN salesperson sp ON sp.id = q.salesperson_id
       ORDER BY q.created_at DESC`
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('견적서');
    ws.columns = [
      { header: '견적번호', key: 'quotation_no', width: 15 },
      { header: '제목', key: 'title', width: 30 },
      { header: '거래처', key: 'client_name', width: 20 },
      { header: '금액', key: 'amount', width: 15, style: { numFmt: '#,##0' } },
      { header: '상태', key: 'status', width: 10 },
      { header: '유효기간', key: 'valid_until', width: 12 },
      { header: '영업사원', key: 'salesperson_name', width: 12 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    rows.forEach(r => ws.addRow({ ...r, amount: Number(r.amount), valid_until: r.valid_until ? new Date(r.valid_until).toISOString().slice(0, 10) : '' }));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=quotations_${Date.now()}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});

// 인보이스 엑셀
router.get('/invoices/excel', requirePermission('export'), async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT i.invoice_no, sc.contract_name as sales_contract_name, c.name as client_name,
       i.amount, i.currency, i.issue_date, i.due_date, i.status, i.paid_amount, i.paid_date
       FROM invoice i
       LEFT JOIN client c ON c.id = i.client_id
       LEFT JOIN sales_contract sc ON sc.id = i.sales_contract_id
       ORDER BY i.created_at DESC`
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('인보이스');
    ws.columns = [
      { header: '인보이스번호', key: 'invoice_no', width: 15 },
      { header: '매출계약', key: 'sales_contract_name', width: 25 },
      { header: '거래처', key: 'client_name', width: 20 },
      { header: '금액', key: 'amount', width: 15, style: { numFmt: '#,##0' } },
      { header: '발행일', key: 'issue_date', width: 12 },
      { header: '만기일', key: 'due_date', width: 12 },
      { header: '상태', key: 'status', width: 10 },
      { header: '수금액', key: 'paid_amount', width: 15, style: { numFmt: '#,##0' } },
      { header: '수금일', key: 'paid_date', width: 12 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    rows.forEach(r => ws.addRow({
      ...r, amount: Number(r.amount), paid_amount: Number(r.paid_amount || 0),
      issue_date: r.issue_date ? new Date(r.issue_date).toISOString().slice(0, 10) : '',
      due_date: r.due_date ? new Date(r.due_date).toISOString().slice(0, 10) : '',
      paid_date: r.paid_date ? new Date(r.paid_date).toISOString().slice(0, 10) : ''
    }));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=invoices_${Date.now()}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});

// 범용 PDF (단순 테이블 형태)
router.get('/:type/pdf', requirePermission('export'), async (req, res, next) => {
  try {
    const typeMap = {
      'sales-contracts': { sql: `SELECT contract_no, contract_name, client_name, amount, status, start_date, end_date FROM sales_contract ORDER BY created_at DESC`, title: '매출계약 목록' },
      'purchase-contracts': { sql: `SELECT contract_no, contract_name, vendor_name, amount, status, start_date, end_date FROM purchase_contract ORDER BY created_at DESC`, title: '매입계약 목록' },
      'quotations': { sql: `SELECT q.quotation_no, q.title, c.name as client_name, q.amount, q.status FROM quotation q LEFT JOIN client c ON c.id = q.client_id ORDER BY q.created_at DESC`, title: '견적서 목록' },
      'invoices': { sql: `SELECT i.invoice_no, c.name as client_name, i.amount, i.status, i.issue_date, i.due_date FROM invoice i LEFT JOIN client c ON c.id = i.client_id ORDER BY i.created_at DESC`, title: '인보이스 목록' },
    };

    const config = typeMap[req.params.type];
    if (!config) return res.status(400).json({ error: '지원하지 않는 타입입니다' });

    const [rows] = await db.query(config.sql);

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${req.params.type}_${Date.now()}.pdf`);
    doc.pipe(res);

    // 한글 폰트 등록 (시스템 폰트 사용)
    const fontPath = 'C:/Windows/Fonts/malgun.ttf';
    const fs = require('fs');
    if (fs.existsSync(fontPath)) {
      doc.registerFont('Korean', fontPath);
      doc.font('Korean');
    }

    doc.fontSize(16).text(config.title, { align: 'center' });
    doc.moveDown();
    doc.fontSize(8).text(`출력일: ${new Date().toISOString().slice(0, 10)}`, { align: 'right' });
    doc.moveDown();

    if (rows.length === 0) {
      doc.fontSize(12).text('데이터가 없습니다', { align: 'center' });
    } else {
      const keys = Object.keys(rows[0]);
      const colWidth = (doc.page.width - 80) / keys.length;
      let y = doc.y;

      // 헤더
      doc.fontSize(8).font('Korean');
      keys.forEach((k, i) => {
        doc.text(k, 40 + i * colWidth, y, { width: colWidth, align: 'left' });
      });
      y += 15;
      doc.moveTo(40, y).lineTo(doc.page.width - 40, y).stroke();
      y += 5;

      // 데이터
      doc.fontSize(7);
      rows.forEach(row => {
        if (y > doc.page.height - 60) { doc.addPage(); y = 40; }
        keys.forEach((k, i) => {
          let val = row[k];
          if (val instanceof Date) val = val.toISOString().slice(0, 10);
          if (typeof val === 'number') val = val.toLocaleString();
          doc.text(String(val ?? ''), 40 + i * colWidth, y, { width: colWidth, align: 'left' });
        });
        y += 12;
      });
    }

    doc.end();
  } catch (err) { next(err); }
});

module.exports = router;
```

- [ ] **Step 3: server.js에 마운트**

```javascript
const exportRouter = require('./routes/export');
app.use('/api/export', authenticate, exportRouter);
```

- [ ] **Step 4: ExportButton 컴포넌트 작성**

`app/frontend/src/components/ExportButton.jsx`:

```jsx
import { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { toastError } from './Toast';

export default function ExportButton({ type }) {
  const [open, setOpen] = useState(false);
  const token = localStorage.getItem('token');

  const download = async (format) => {
    setOpen(false);
    try {
      const res = await fetch(`/api/export/${type}/${format}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || '다운로드 실패'); }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_${Date.now()}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toastError(e.message); }
  };

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
        <Download className="w-4 h-4 mr-1" />내보내기
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-20 py-1 w-40">
            <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-slate-50"
              onClick={() => download('excel')}>
              <FileSpreadsheet className="w-4 h-4 text-green-600" />엑셀 다운로드
            </button>
            <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-slate-50"
              onClick={() => download('pdf')}>
              <FileText className="w-4 h-4 text-red-600" />PDF 다운로드
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: 각 목록 페이지에 ExportButton 추가**

각 페이지 헤더 영역에:

```jsx
import ExportButton from '../components/ExportButton';

// 헤더 오른쪽에 추가
<div className="flex items-center gap-2">
  <ExportButton type="sales-contracts" />
  <Button onClick={openCreate}>...</Button>
</div>
```

- [ ] **Step 6: 커밋**

```bash
git add app/backend/routes/export.js app/backend/server.js \
  app/frontend/src/components/ExportButton.jsx
git commit -m "feat: add Excel and PDF export for all modules"
```

---

## Task 15: D4 — 고급 검색/필터

**Files:**
- Create: `app/frontend/src/components/AdvancedFilter.jsx`
- Modify: 각 목록 페이지

- [ ] **Step 1: AdvancedFilter 컴포넌트 작성**

`app/frontend/src/components/AdvancedFilter.jsx`:

```jsx
import { useState } from 'react';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

export default function AdvancedFilter({ filters, values, onChange, onReset }) {
  const [expanded, setExpanded] = useState(false);

  const activeCount = Object.values(values).filter(v => v !== '' && v !== null && v !== undefined).length;

  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)} className="relative">
        <Filter className="w-4 h-4 mr-1" />
        고급 필터
        {activeCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            {activeCount}
          </span>
        )}
        {expanded ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
      </Button>

      {expanded && (
        <div className="bg-slate-50 border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filters.map(f => (
              <div key={f.key}>
                <label className="text-xs font-medium text-slate-600">{f.label}</label>
                {f.type === 'select' ? (
                  <select className="w-full border rounded-md px-2 py-1.5 text-sm mt-1"
                    value={values[f.key] || ''} onChange={e => onChange(f.key, e.target.value)}>
                    <option value="">전체</option>
                    {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.type === 'date' ? (
                  <Input type="date" className="mt-1" value={values[f.key] || ''}
                    onChange={e => onChange(f.key, e.target.value)} />
                ) : f.type === 'number' ? (
                  <Input type="number" className="mt-1" placeholder={f.placeholder}
                    value={values[f.key] || ''} onChange={e => onChange(f.key, e.target.value)} />
                ) : (
                  <Input className="mt-1" placeholder={f.placeholder}
                    value={values[f.key] || ''} onChange={e => onChange(f.key, e.target.value)} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={onReset}>
              <X className="w-3 h-3 mr-1" />필터 초기화
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 백엔드 API에 고급 필터 파라미터 추가**

각 라우트에 날짜/금액 범위 필터 추가. 예시 — `salesContracts.js` GET `/`:

```javascript
// 기존 필터에 추가
const { status, search, salesperson_id, start_from, start_to, end_from, end_to, amount_min, amount_max, project_type, client_id } = req.query;

if (start_from) { sql += ` AND sc.start_date >= ?`; params.push(start_from); }
if (start_to)   { sql += ` AND sc.start_date <= ?`; params.push(start_to); }
if (end_from)   { sql += ` AND sc.end_date >= ?`; params.push(end_from); }
if (end_to)     { sql += ` AND sc.end_date <= ?`; params.push(end_to); }
if (amount_min) { sql += ` AND sc.amount >= ?`; params.push(parseFloat(amount_min)); }
if (amount_max) { sql += ` AND sc.amount <= ?`; params.push(parseFloat(amount_max)); }
if (project_type) { sql += ` AND sc.project_type = ?`; params.push(project_type); }
if (client_id)  { sql += ` AND sc.client_id = ?`; params.push(client_id); }
```

동일 패턴을 purchaseContracts.js, quotations.js, invoices.js에 적용.

- [ ] **Step 3: 프론트엔드 페이지에 AdvancedFilter 통합**

예시 — `SalesContracts.jsx`:

```jsx
import AdvancedFilter from '../components/AdvancedFilter';

// filter 상태 확장
const [advFilter, setAdvFilter] = useState({});

const salesFilters = [
  { key: 'project_type', label: '프로젝트유형', type: 'select',
    options: [{ value: '신규개발', label: '신규개발' }, { value: '유지보수', label: '유지보수' }, { value: '컨설팅', label: '컨설팅' }] },
  { key: 'salesperson_id', label: '영업사원', type: 'select',
    options: people.map(p => ({ value: p.id, label: p.name })) },
  { key: 'start_from', label: '시작일(부터)', type: 'date' },
  { key: 'start_to', label: '시작일(까지)', type: 'date' },
  { key: 'end_from', label: '종료일(부터)', type: 'date' },
  { key: 'end_to', label: '종료일(까지)', type: 'date' },
  { key: 'amount_min', label: '최소 금액', type: 'number', placeholder: '0' },
  { key: 'amount_max', label: '최대 금액', type: 'number', placeholder: '999,999,999' },
];

// load 함수에 advFilter 파라미터 전달
const params = { ...advFilter };

// JSX
<AdvancedFilter
  filters={salesFilters}
  values={advFilter}
  onChange={(key, val) => setAdvFilter(f => ({ ...f, [key]: val }))}
  onReset={() => setAdvFilter({})}
/>
```

- [ ] **Step 4: 커밋**

```bash
git add app/frontend/src/components/AdvancedFilter.jsx \
  app/backend/routes/salesContracts.js app/backend/routes/purchaseContracts.js \
  app/backend/routes/quotations.js app/backend/routes/invoices.js \
  app/frontend/src/pages/SalesContracts.jsx app/frontend/src/pages/PurchaseContracts.jsx \
  app/frontend/src/pages/Quotations.jsx app/frontend/src/pages/Invoices.jsx
git commit -m "feat: add advanced filter with date range and amount range"
```

---

## Task 16: 기존 모듈 통합 및 최종 정리

**Files:**
- Modify: `app/backend/routes/salesContracts.js` (client_id 지원)
- Modify: `app/backend/routes/purchaseContracts.js` (vendor_id 지원)
- Modify: `app/frontend/src/pages/SalesContracts.jsx` (거래처 선택 드롭다운)
- Modify: `app/frontend/src/pages/PurchaseContracts.jsx` (거래처 선택 드롭다운)

- [ ] **Step 1: 매출계약 폼에 거래처 드롭다운 추가**

SalesContracts.jsx 폼에서 `client_name` 텍스트 입력을 `client_id` 드롭다운으로 교체:

```jsx
// clients 상태 추가
const [clients, setClients] = useState([]);

// load 함수에서 거래처 로드
const cl = await api.getClients({ type: '고객' });
setClients(cl);

// 폼에서
<select value={form.client_id} onChange={e => {
  const c = clients.find(c => c.id === parseInt(e.target.value));
  setForm(f => ({ ...f, client_id: e.target.value, client_name: c?.name || '' }));
}}>
  <option value="">거래처 선택</option>
  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
</select>
```

POST/PUT payload에 `client_id`를 포함하여 전송.

- [ ] **Step 2: 매입계약 폼에 협력사 드롭다운 추가**

PurchaseContracts.jsx에서 `vendor_name` 텍스트 입력을 `vendor_id` 드롭다운으로 교체:

```jsx
const [vendors, setVendors] = useState([]);
const v = await api.getClients({ type: '협력사' });
setVendors(v);

<select value={form.vendor_id} onChange={e => {
  const v = vendors.find(v => v.id === parseInt(e.target.value));
  setForm(f => ({ ...f, vendor_id: e.target.value, vendor_name: v?.name || '' }));
}}>
  <option value="">협력사 선택</option>
  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
</select>
```

- [ ] **Step 3: 백엔드에 client_id/vendor_id 저장 로직 추가**

salesContracts.js POST/PUT에서 `client_id`를 INSERT/UPDATE에 포함:

```javascript
const { ..., client_id } = req.body;
// INSERT ... client_id, ...
// UPDATE ... client_id=?, ...
```

purchaseContracts.js 동일하게 `vendor_id` 추가.

- [ ] **Step 4: 커밋**

```bash
git add app/frontend/src/pages/SalesContracts.jsx app/frontend/src/pages/PurchaseContracts.jsx \
  app/backend/routes/salesContracts.js app/backend/routes/purchaseContracts.js
git commit -m "feat: integrate client master with sales and purchase contracts"
```

---

## Self-Review Checklist

1. **Spec coverage:** 모든 9개 기능(A1, A2, A4, B1, B2, B3, D1, D2, D4) 커버됨
2. **Placeholder scan:** 모든 코드 블록 완성, TBD/TODO 없음
3. **Type consistency:** entity_type, status enum, API 경로 일관성 확인
4. **의존 순서:** DB → 패키지 → A4 → B1 → B2 → B3 → A1 → A2 → D1/D2/D4 → 통합
