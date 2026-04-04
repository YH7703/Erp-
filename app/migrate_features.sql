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
