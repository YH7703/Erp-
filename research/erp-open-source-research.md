# Open Source ERP 리서치 보고서

> 조사일: 2026-04-05
> 목적: Open Source ERP 프로젝트, 업계 표준, Best Practices 종합 조사

---

## 1. 주요 Open Source ERP 프로젝트 비교

### 1-1. ERPNext (MIT License, 100% Open Source)

**핵심 모듈 (30개 이상):**
- **Accounting & Finance**: General Ledger, AP/AR, Tax Management, Multi-currency, Bank Reconciliation
- **HR & Payroll**: Employee Management, Leave, Payroll, Recruitment, Training
- **Manufacturing**: BOM (Bill of Materials), MRP, Production Planning, Quality Inspection, Subcontracting
- **Inventory & Warehouse**: Multi-warehouse, Stock Reconciliation, Serial/Batch Tracking
- **CRM & Sales**: Lead Management, Opportunity Tracking, Quotation, Sales Order
- **Purchasing**: Purchase Order, Supplier Scorecard, RFQ
- **Project Management**: Task Management, Timesheet, Gantt Chart
- **E-commerce & Website**: Built-in Website Builder, Shopping Cart
- **POS (Point of Sale)**: Offline-capable POS
- **Domain-specific**: Healthcare, Education, Agriculture, Non-profit

**장점:**
- 완전한 MIT License (모든 기능 무료)
- Frappe Framework 기반 Low-code 커스터마이징
- Manufacturing/HR 분야 강점
- Self-hosted 배포 용이

**단점:**
- UI 커스터마이징에 개발자 필요 (Python/JavaScript)
- 한국 Localization 부족 (세금계산서, 회계기준 등)

### 1-2. Odoo (Dual License: Community / Enterprise)

**Community Edition 포함 모듈:**
- 기본 Accounting (Invoicing 중심), CRM, Sales, Purchase, Inventory (기본), Manufacturing (기본), Website, E-commerce

**Enterprise Edition에만 있는 기능 (Community에 없음):**
- Full Accounting Suite (Community는 Invoicing만 가능)
- Payroll, Documents, Sign
- Helpdesk, Marketing Automation, Quality Management
- Barcode Scanning, Shipping Carrier Integration
- Multi-warehouse Routing, Inter-company Stock Flow
- Mobile Support / PWA
- Odoo Studio (No-code 커스터마이징)
- Official Support, Hosting, Version Upgrade 지원

**주의사항:**
- Community Edition은 상당히 많은 기능이 제한됨
- Enterprise는 사용자당 월 비용 발생 ($24.90+/user/month)

### 1-3. Dolibarr (GPL License)

- 소규모 비즈니스/프리랜서에 최적화
- 매우 단순한 UI, 모듈식 설계
- CRM, Invoicing, 기본 Accounting, HR, Inventory
- 대규모 확장에 제한적

### 1-4. 기타 주목할 프로젝트

| 프로젝트 | 특징 | 적합 대상 |
|-----------|------|-----------|
| **Apache OFBiz** | Java 기반, Manufacturing 강점 | 중대형 제조업 |
| **iDempiere** | 복잡한 회계 처리 | 회계 중심 기업 |
| **Tryton** | Code Quality 우수, Python 기반 | 개발자 친화적 |
| **Metasfresh** | 식품 유통 특화 | 식품/유통 산업 |
| **Axelor** | Modern UI, Low-code | UI 중시하는 기업 |
| **Flectra** | Odoo Enterprise 기능을 무료 제공 목표 | Odoo 대안 |

---

## 2. Reddit/커뮤니티 논의 요약

### 2-1. 자주 언급되는 추천 패턴

- **Self-hosted 선호 사용자**: ERPNext 또는 Dolibarr 추천이 가장 많음
- **기능 완성도 우선**: Odoo Enterprise (비용 감수)
- **소규모/스타트업**: Dolibarr로 시작 후 ERPNext로 이전

### 2-2. 사용자들이 보고하는 주요 문제점

1. **Implementation 난이도**: "설치는 쉽지만 실제 업무에 맞추는 데 몇 주~몇 달 소요"
2. **Hidden Cost**: 소프트웨어는 무료이나 커스터마이징, 호스팅, 유지보수 비용 발생
3. **Technical Expertise 필요**: In-house IT 팀 또는 외부 컨설턴트 필수
4. **Support 부재**: Community 포럼 의존, 답변 품질 불균일
5. **Upgrade 어려움**: 커스터마이징 후 버전 업그레이드 시 충돌 빈번
6. **Scalability 우려**: 대용량 사용자/데이터 처리 시 성능 문제

### 2-3. 공통적인 불만사항

- Odoo Community의 기능 제한이 너무 심함 (특히 Accounting)
- ERPNext의 한국/아시아 지역 Localization 부족
- 오픈소스 ERP의 Reporting 기능이 상용 제품 대비 약함
- Mobile 지원 미흡 (특히 Community 버전들)
- Multi-company, Multi-currency 처리가 복잡함

---

## 3. SMB용 ERP 필수 모듈 (Industry Standard Checklist)

### Tier 1: 반드시 필요 (Must-Have)

| 모듈 | 핵심 기능 |
|------|-----------|
| **Financial Management** | General Ledger, AP/AR, Bank Reconciliation, Tax Management, Financial Reporting |
| **Sales Management** | Quotation, Sales Order, Invoicing, Pricing Management |
| **Purchasing** | Purchase Order, Vendor Management, RFQ |
| **Inventory Management** | Real-time Stock Tracking, Multi-location, Barcode Support |
| **Basic CRM** | Contact Management, Lead Tracking, Sales Pipeline |

### Tier 2: 중요 (Important)

| 모듈 | 핵심 기능 |
|------|-----------|
| **HR Management** | Employee Data, Leave Management, Basic Payroll |
| **Project Management** | Task Assignment, Time Tracking, Milestone |
| **Reporting & Analytics** | Dashboard, Financial Reports, Custom Reports |
| **Document Management** | File Attachment, Version Control, Template |

### Tier 3: 업종별 선택 (Industry-specific)

| 모듈 | 적용 업종 |
|------|-----------|
| **Manufacturing (MRP)** | 제조업: BOM, Production Planning, Quality |
| **E-commerce** | 온라인 판매: Shopping Cart, Payment Gateway |
| **POS** | 소매업: Offline POS, Receipt Printing |
| **Warehouse Management** | 물류/유통: Picking, Packing, Shipping |
| **Subscription Management** | SaaS/구독: Recurring Billing, Plan Management |

### SMB ERP 선정 기준 (Selection Criteria)

1. **Total Cost of Ownership (TCO)** 계산 - 라이선스 + 구현 + 커스터마이징 + 유지보수
2. **Scalability** - 성장에 따른 사용자/데이터 확장 가능 여부
3. **Integration** - 기존 시스템(은행, 전자세금계산서 등)과 연동
4. **Customization 용이성** - 업무 프로세스에 맞는 변경 가능 범위
5. **Community/Vendor Support** - 문제 발생 시 도움받을 수 있는 채널
6. **Cloud vs On-premise** - 배포 방식 선택 유연성

---

## 4. Open Source ERP의 공통 Gap 분석

### 4-1. 기술적 Gap

| 영역 | 상세 내용 |
|------|-----------|
| **Reporting** | 상용 ERP 대비 BI/Analytics 기능 약함, 대부분 외부 도구(Metabase, Superset) 연동 필요 |
| **Mobile** | Native Mobile App 부재 또는 기능 제한적 |
| **AI/Automation** | AI 기반 예측, 자동화 기능 상용 대비 부족 |
| **Integration** | 한국 특화 서비스(전자세금계산서, 은행 연동, PG사) 연동 모듈 없음 |
| **Performance** | 대규모 데이터(수십만 건 이상) 처리 시 최적화 필요 |

### 4-2. 운영적 Gap

| 영역 | 상세 내용 |
|------|-----------|
| **Localization** | 한국 회계기준(K-IFRS), 세무 규정 반영 부족 |
| **Documentation** | 영문 중심, 한국어 문서 극히 부족 |
| **Support** | SLA 보장되는 공식 지원 없음 |
| **Training** | 사용자 교육 자료/프로그램 부족 |
| **Upgrade Path** | 커스터마이징 후 Major Version 업그레이드 난이도 높음 |

### 4-3. 한국 시장 특화 Gap

- **전자세금계산서** 발행/수신 (국세청 연동) - 별도 개발 필요
- **4대 보험** 연동 (건강보험, 국민연금, 고용보험, 산재보험)
- **급여명세서** 한국 양식 및 계산 로직
- **부가가치세 신고** 자동화
- **전자결재 (Approval Workflow)** - 한국식 품의/결재 체계
- **은행 연동** (계좌 조회, 이체) - 한국 은행 API

---

## 5. Security, Compliance, Data Standards

### 5-1. 핵심 보안 요구사항

| 항목 | Best Practice |
|------|---------------|
| **Authentication** | Multi-Factor Authentication (MFA) 필수 |
| **Authorization** | Role-Based Access Control (RBAC) + Principle of Least Privilege |
| **Encryption** | Data at Rest: AES-256 / Data in Transit: TLS 1.2+ |
| **Audit Trail** | 모든 사용자 행위 자동 로깅, 변경 이력 추적 |
| **Session Management** | Session Timeout, Concurrent Login 제한 |
| **Input Validation** | SQL Injection, XSS 등 OWASP Top 10 방어 |

### 5-2. Compliance Framework

| 표준 | 적용 대상 | 핵심 요구사항 |
|------|-----------|---------------|
| **GDPR** | EU 개인정보 처리 시 | 동의 관리, 삭제권, 데이터 이동권, DPO 지정 |
| **SOC 2** | SaaS/클라우드 서비스 | Security, Availability, Processing Integrity, Confidentiality, Privacy |
| **ISO 27001** | 정보보안 관리체계 | ISMS 수립 및 인증 |
| **개인정보보호법 (한국)** | 국내 개인정보 처리 | 개인정보 수집동의, 파기, 암호화, 접근 통제 |

### 5-3. ERP Security Best Practices Checklist

**인프라 보안:**
- [ ] 방화벽 및 IDS/IPS 구성
- [ ] 정기적 보안 패치 및 업데이트
- [ ] 백업 암호화 및 정기 복구 테스트
- [ ] Network Segmentation (DB 서버 격리)

**애플리케이션 보안:**
- [ ] RBAC 구현 및 정기 권한 리뷰
- [ ] MFA 활성화
- [ ] Audit Trail 활성화 및 모니터링
- [ ] API 인증 및 Rate Limiting
- [ ] Secure File Upload 처리

**데이터 보안:**
- [ ] AES-256 Data at Rest Encryption
- [ ] TLS 1.2+ Data in Transit Encryption
- [ ] 개인정보 Masking/Anonymization
- [ ] 정기적 데이터 백업 및 복구 테스트
- [ ] Database Access 로깅

**운영 보안:**
- [ ] 보안 정책 문서화
- [ ] 직원 보안 교육
- [ ] Incident Response Plan 수립
- [ ] 정기 보안 감사 (Penetration Testing)
- [ ] Vendor/Third-party 보안 평가

---

## 6. 종합 권장사항

### Self-hosted Open Source ERP 구축 시 권장 접근법

1. **ERPNext를 Base로 선택** - 100% 오픈소스, Manufacturing/HR 강점, Python/JS 기반
2. **한국 Localization 모듈 자체 개발** - 전자세금계산서, 4대보험, 부가세 신고
3. **Reporting은 외부 도구 연동** - Metabase 또는 Apache Superset
4. **단계적 도입** - Tier 1 모듈부터 시작, 안정화 후 Tier 2/3 확장
5. **Security First** - RBAC, MFA, Encryption, Audit Trail을 초기부터 구현
6. **Mobile은 PWA 접근** - Native App 대신 Progressive Web App으로 모바일 지원

### 주의사항

- Odoo Community는 기능 제한이 심하므로 비용 없는 Full ERP를 원하면 ERPNext 권장
- 오픈소스 ERP의 "무료"는 소프트웨어 비용만 의미 - TCO 반드시 계산
- 커스터마이징은 최소화하고, 업무 프로세스를 ERP에 맞추는 것이 유지보수에 유리
- 한국 세무/회계 규정 반영은 전문가 자문 필수

---

## Sources

- [Odoo vs ERPNext 2025 비교](https://www.appvizer.com/magazine/operations/erp/erpnext-vs-odoo)
- [Top 10 Open Source ERP 2026](https://ecosire.com/blog/open-source-erp-top-10-comparison-2026)
- [ERPNext Deep Dive 2026](https://devdiligent.com/blog/erpnext-deep-dive/)
- [15 Best Open Source ERP 2026](https://thecfoclub.com/tools/open-source-erp/)
- [ERPNext Modules 공식](https://frappe.io/erpnext/modules)
- [ERP Requirements Checklist 2026](https://www.erpresearch.com/pages/en-us/erp-requirements)
- [ERP Software Requirements Checklist](https://thecfoclub.com/operational-finance/erp-requirements/)
- [SMB ERP Key Features](https://wm-synergy.com/10-key-features-of-the-best-erp-for-small-business/)
- [Odoo Community vs Enterprise 2026](https://www.cudio.com/blog/odoo-community-vs-enterprise)
- [Open Source ERP Pros and Cons](https://blog.nbs-us.com/open-source-erp-systems-for-growing-businesses-pros-and-cons)
- [ERP Security Best Practices](https://www.top10erp.org/blog/erp-security)
- [SOC 2 Compliance 2026](https://www.venn.com/learn/soc2-compliance/)
- [SOC 2 vs GDPR](https://sprinto.com/blog/soc-2-vs-gdpr/)
- [Open Source ERP Study (Academic)](https://www.diva-portal.org/smash/get/diva2:832902/FULLTEXT01.pdf)
- [한국 전자세금계산서 오픈소스](https://github.com/open-etaxbill/open.etaxbill)
- [Dolibarr vs Odoo vs ERPNext 비교](https://dolimarketplace.com/en-us/blogs/dolibarr/2024-comparison-dolibarr-vs-odoo-vs-erpnext-which-erp-should-you-choose-for-your-business)
- [Free Open Source ERP for Manufacturing 2026](https://mdcplus.fi/blog/top-free-erp-open-source-manufacturing/)
- [NetSuite ERP Requirements Guide](https://www.netsuite.com/portal/resource/articles/erp/erp-requirements.shtml)
- [ERP Security Best Practices - Deskera](https://www.deskera.com/blog/erp-security/)
