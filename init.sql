-- SI 계약 관리 ERP - 데이터베이스 초기화 스크립트
USE llmtest;

-- 영업사원 테이블
CREATE TABLE IF NOT EXISTS salesperson (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(200),
  department VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 매출계약 테이블 (고객사와의 계약)
CREATE TABLE IF NOT EXISTS sales_contract (
  id INT PRIMARY KEY AUTO_INCREMENT,
  contract_no VARCHAR(50) UNIQUE NOT NULL,
  contract_name VARCHAR(200) NOT NULL,
  client_name VARCHAR(200) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('등록','진행','종료') DEFAULT '등록',
  project_type ENUM('신규개발','유지보수','컨설팅') NOT NULL,
  salesperson_id INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (salesperson_id) REFERENCES salesperson(id)
);

-- 매입계약 테이블 (외주업체/인력과의 계약)
CREATE TABLE IF NOT EXISTS purchase_contract (
  id INT PRIMARY KEY AUTO_INCREMENT,
  contract_no VARCHAR(50) UNIQUE NOT NULL,
  contract_name VARCHAR(200) NOT NULL,
  vendor_name VARCHAR(200) NOT NULL,
  worker_name VARCHAR(100),
  monthly_rate DECIMAL(12,2) NOT NULL,
  months INT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('등록','진행','종료') DEFAULT '등록',
  sales_contract_id INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (sales_contract_id) REFERENCES sales_contract(id)
);

-- 샘플 데이터
INSERT INTO salesperson (name, email, department) VALUES
('김민준', 'minjun@company.com', '영업1팀'),
('이서연', 'seoyeon@company.com', '영업1팀'),
('박준혁', 'junhyuk@company.com', '영업2팀'),
('최유진', 'yujin@company.com', '영업2팀');

INSERT INTO sales_contract (contract_no, contract_name, client_name, amount, start_date, end_date, status, project_type, salesperson_id) VALUES
('SC-2024-001', '금융시스템 고도화 프로젝트', '한국은행', 500000000, '2024-01-15', '2024-12-31', '진행', '신규개발', 1),
('SC-2024-002', 'ERP 유지보수 계약', '삼성전자', 120000000, '2024-03-01', '2024-08-31', '종료', '유지보수', 2),
('SC-2024-003', 'AI 컨설팅 프로젝트', '현대자동차', 80000000, '2024-06-01', '2024-09-30', '종료', '컨설팅', 3),
('SC-2024-004', '물류시스템 개발', 'CJ대한통운', 350000000, '2024-09-01', '2025-03-31', '진행', '신규개발', 1),
('SC-2025-001', '보험업무 자동화', '삼성생명', 200000000, '2025-01-01', '2025-06-30', '등록', '신규개발', 4);

INSERT INTO purchase_contract (contract_no, contract_name, vendor_name, worker_name, monthly_rate, months, amount, start_date, end_date, status, sales_contract_id) VALUES
('PC-2024-001', '금융시스템 개발인력 홍길동', '(주)테크솔루션', '홍길동', 7000000, 6, 42000000, '2024-01-15', '2024-07-14', '종료', 1),
('PC-2024-002', '금융시스템 개발인력 이철수', '(주)소프트뱅크', '이철수', 8000000, 6, 48000000, '2024-01-15', '2024-07-14', '종료', 1),
('PC-2024-003', '금융시스템 QA 인력', '(주)QA파트너스', '박영희', 5000000, 6, 30000000, '2024-03-01', '2024-08-31', '진행', 1),
('PC-2024-004', 'ERP 유지보수 인력', '(주)유지보수전문', '김정수', 6000000, 6, 36000000, '2024-03-01', '2024-08-31', '종료', 2),
('PC-2024-005', '물류시스템 개발인력 최민수', '(주)테크솔루션', '최민수', 7500000, 7, 52500000, '2024-09-01', '2025-03-31', '진행', 4),
('PC-2024-006', '물류시스템 개발인력 정수현', '(주)IT인력뱅크', '정수현', 8500000, 7, 59500000, '2024-09-01', '2025-03-31', '진행', 4);
