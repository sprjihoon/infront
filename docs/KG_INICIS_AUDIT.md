# KG이니시스 해외카드/글로벌결제 심사 대응

## 보증보험 (내부 관리)

| 항목 | 상태 | 메모 |
|------|------|------|
| 보증보험 가입 | ☐ 미완료 / ☐ 진행중 / ☐ 완료 | KG이니시스 해외카드 오픈 요건 |
| 담당자 | | |
| 가입일 | | |
| 증권번호 | | |

> 해외카드 심사 제출 전 **보증보험 가입 여부**를 KG 담당자에게 확인·회신하세요.

---

## 심사용 테스트 계정

스크립트로 생성/갱신:

```bash
cd apps/web
node scripts/create-audit-test-users.mjs
```

| 구분 | 이메일 | 비밀번호 | customer_type | 이메일 인증 |
|------|--------|----------|---------------|-------------|
| 내국인 (심사) | `audit-domestic@infront.kr` | `AuditDomestic2026!` | domestic | ✅ 완료 |
| 외국인/해외고객 (심사) | `audit-foreigner@infront.kr` | `AuditForeign2026!` | foreigner | ✅ 완료 |

> 운영 DB에 계정이 없으면 위 스크립트를 **production Supabase** 키로 1회 실행하세요.

---

## 심사 전 체크리스트 (PPT 캡처)

### A. 계정·화면 캡처

| # | 항목 | URL / 방법 | 계정 | 확인 포인트 |
|---|------|------------|------|-------------|
| 1 | 회원가입 고객 구분 | https://infront.kr/signup | (신규 가입 화면만) | 내국인 / 외국인·해외고객 드롭다운 |
| 2 | 마이페이지 고객 구분 | https://infront.kr/mypage | 아무 회원 | 「고객 구분 (결제)」 카드 |
| 3 | checkout — 내국인 | https://infront.kr/shop/checkout?product=PICKUP_FEE | `audit-domestic@...` | 고객 유형=내국인, **해외 결제수단 미노출** |
| 4 | checkout — 외국인 | 동일 URL | `audit-foreigner@...` | 고객 유형=외국인, **해외카드·글로벌 결제 노출** |
| 5 | KG이니시스 결제창 | checkout에서 결제 진행 | `audit-foreigner@...` | 해외카드 선택 → 결제창 캡처 |
| 6 | 결제 완료 | https://infront.kr/shop/payment/success | 외국인 계정 | (실결제 또는 테스트 MID 1건) |
| 7 | 주문 목록 | https://infront.kr/shop/orders | 외국인 계정 | 주문·고객 유형 표시 |
| 8 | admin 샵 주문 | https://admin.infront.kr/shop-orders | 관리자 | **고객구분**, **해외카드** 컬럼 |
| 9 | admin 주문 상세 | 목록 → 주문 클릭 | 관리자 | 고객 유형, 해외카드 사용=예 |
| 10 | 배송·환불 정책 | `/shop/shipping-policy`, `/shop/refund-policy` | — | 정책 페이지 |
| 11 | 상품·안내 | https://infront.kr/shop | — | 해외카드 안내 문구 |

### B. KG 회신·운영 확인

| # | 항목 | 상태 |
|---|------|------|
| 1 | KG에 **이메일 인증 기반** 회원 확인 명시 (NICE/KCB 미연동) | ☐ |
| 2 | 보증보험 가입 여부 KG 담당자 확인 | ☐ |
| 3 | production 배포 (`/mypage` 고객 구분 카드 노출) | ☐ |
| 4 | `INICIS_TEST_MODE` / 테스트 MID 실결제 1건 검증 | ☐ |
| 5 | 외국인 계정 이메일 인증 완료 상태 확인 | ☐ |

### C. production 배포 확인

```text
https://infront.kr/mypage  → 로그인 후 「고객 구분 (결제)」 카드 보임
https://infront.kr/shop/checkout?product=PICKUP_FEE → 「회원 정보 기준」 고객 유형 표시
```

---

## KG이니시스 추가 확인사항 회신 (템플릿)

### (1) 내국인/외국인 회원정보 분리 — 해외카드 사용 확인 가능 여부

**회신: 가능**

- 회원가입 시 `customer_type` 필드로 **내국인(domestic)** / **외국인/해외고객(foreigner)** 구분
- `customers.customer_type`, `shop_orders.customer_type`에 저장
- checkout 화면 및 관리자(admin) 샵 주문 목록·상세에서 고객 유형·해외카드 사용 여부 확인 가능
- checkout에서는 회원 정보에 저장된 고객 유형을 **표시·적용**하며, 결제 화면에서 변경 불가 (마이페이지에서 변경)
- 해외카드·Alipay·WeChat Pay는 **외국인/해외고객 회원**의 **단건 서비스 결제**에서만 노출·결제 가능

**확인 URL**

- 회원가입: https://infront.kr/signup
- 마이페이지 (고객 구분 변경): https://infront.kr/mypage
- checkout (로그인 후): https://infront.kr/shop/checkout?product=PICKUP_FEE
- 관리자: https://admin.infront.kr/shop-orders

**심사용 테스트 계정 (요청 시 제공 가능)**

- 내국인: audit-domestic@infront.kr
- 외국인/해외고객: audit-foreigner@infront.kr

---

### (2) 해외카드 비회원 주문 불가 — 회원가입 인증

**회신: 가능 (비회원 차단 적용 / 인증은 이메일 인증)**

- `/shop/checkout` 비로그인 접근 시 로그인 안내 화면 표시 → **비회원 해외카드 결제 불가**
- 해외카드·글로벌 결제수단은 **로그인 회원 + customer_type=foreigner + 이메일 인증 완료** 조건에서만 API 승인
- 회원가입 시 **이메일 인증**으로 계정 확인 (Supabase Auth 이메일 확인 링크)
- **휴대폰 본인인증(NICE/KCB) 및 포털 인증은 현재 미연동**이며, 회원 확인은 **이메일 인증 기반**으로 운영합니다. (향후 연동 검토)

**KG 회신용 한 줄 (인증 방식)**

> 회원가입 시 이메일 인증을 통해 계정을 확인하며, 해외카드 결제는 이메일 인증이 완료된 외국인/해외고객 회원의 회원 주문에서만 가능합니다. 휴대폰/포털 본인인증(NICE/KCB)은 현재 미연동입니다.

**안내 문구 (사이트 표기)**

> 해외카드 결제는 회원 주문에서만 이용 가능합니다. 로그인 또는 회원가입 후 이용해주세요.  
> 회원가입 시 이메일 인증을 통해 계정 확인 후 결제 서비스를 이용할 수 있습니다.

---

### (3) 해외발송 배송추적 가능 여부

**회신: 가능**

- 해외배송: **EMS, EMS Premium, K-Packet** (우정사업본부) 사용
- 발송 후 **운송장번호(ems_regino)** 제공
- 고객 배송조회: **https://infront.kr/shop/orders** → **배송조회**  
  또는 **https://infront.kr/shop/tracking/{주문번호}**
- 추적 데이터: 우체국 EMS 행방조회 API + tracker.delivery (통관·현지 구간 보조)
- 통관 이후 현지 배송 추적 범위는 **국가·현지 배송사**에 따라 일부 차이 있을 수 있음 (사이트에 고지)

**안내 문구**

> 해외배송은 EMS, EMS Premium, K-Packet 등 추적 가능한 배송수단을 사용합니다. 발송 후 운송장번호를 제공하며, 고객은 배송조회 페이지에서 배송 상태를 확인할 수 있습니다. 다만 통관 이후 현지 배송 추적 범위는 국가 및 현지 배송사 사정에 따라 일부 차이가 있을 수 있습니다.

---

## 결제 구조 요약

| 구분 | 결제수단 | 대상 |
|------|----------|------|
| 단건 (one_time) | CARD, BANK_TRANSFER, VIRTUAL_ACCOUNT, EASY_PAY | 모든 회원 |
| 단건 (one_time) | FOREIGN_CARD, ALIPAY, WECHAT_PAY | 외국인/해외고객 + 이메일 인증 |
| 정기 (recurring) | 신용카드 자동결제(빌링) | 장기보관 월 이용료 |

## PPT 슬라이드 순서 (권장)

1. `/shop` — 서비스 목록·해외카드 안내
2. `/signup` — 고객 구분 선택
3. `/mypage` — 고객 구분 (결제) 카드
4. `/shop/checkout?product=PICKUP_FEE` — **내국인** (해외 결제 미노출)
5. `/shop/checkout?product=PICKUP_FEE` — **외국인** (해외카드 노출)
6. KG이니시스 결제창 (외국인 + 해외카드)
7. `/shop/payment/success`
8. `admin.infront.kr/shop-orders` — 고객구분·해외카드 컬럼
9. admin 주문 상세 — customer_type, is_foreign_card
10. `/shop/orders` · `/shop/tracking/{oid}`
11. `/shop/shipping-policy` · `/shop/refund-policy`
