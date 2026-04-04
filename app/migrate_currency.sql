USE llmtest;

-- 매출계약 테이블에 통화 컬럼 추가
ALTER TABLE sales_contract ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'KRW' AFTER amount;
ALTER TABLE sales_contract ADD COLUMN IF NOT EXISTS original_amount DECIMAL(15,2) AFTER currency;

-- 매입계약 테이블에 통화 컬럼 추가
ALTER TABLE purchase_contract ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'KRW' AFTER amount;
ALTER TABLE purchase_contract ADD COLUMN IF NOT EXISTS original_monthly_rate DECIMAL(12,2) AFTER currency;

-- 기존 데이터의 original_amount/original_monthly_rate를 현재 값으로 채움
UPDATE sales_contract SET original_amount = amount WHERE original_amount IS NULL;
UPDATE purchase_contract SET original_monthly_rate = monthly_rate WHERE original_monthly_rate IS NULL;
