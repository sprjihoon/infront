# KG이니시스 해외카드/글로벌결제 심사 대응 메모

## 보증보험 (내부 관리용)

해외카드 오픈을 위해 KG이니시스 요청 시 **보증보험 가입**을 진행한다.

---

## KG이니시스 추가 확인사항 회신 (템플릿)

### (1) 내국인/외국인 회원정보 분리 — 해외카드 사용 확인 가능 여부

**회신: 가능**

- 회원가입 시 `customer_type` 필드로 **내국인(domestic)** / **외국인/해외고객(foreigner)** 구분
- `customers.customer_type`, `shop_orders.customer_type`에 저장
- checkout 화면 및 관리자(admin) 샵 주문 목록·상세에서 고객 유형 확인 가능
- 해외카드·Alipay·WeChat Pay는 **외국인/해외고객 회원**의 **단건 서비스 결제**에서만 노출·결제 가능

**확인 URL**

- 회원가입: https://infront.kr/signup
- checkout (로그인 후): https://infront.kr/shop/checkout?product=PICKUP_FEE
- 관리자: admin.infront.kr → 샵 주문

---

### (2) 해외카드 비회원 주문 불가 — 회원가입 인증

**회신: 가능 (비회원 차단 적용 / 인증은 이메일 인증)**

- `/shop/checkout` 비로그인 접근 시 로그인 안내 화면 표시 → **비회원 해외카드 결제 불가**
- 해외카드·글로벌 결제수단은 **로그인 회원 + customer_type=foreigner + 이메일 인증 완료** 조건에서만 API 승인
- 회원가입 시 **이메일 인증**으로 계정 확인 (Supabase Auth 이메일 확인)
- 휴대폰/포털 본인인증(NICE/KCB 등)은 향후 연동 예정이며, 현재는 **이메일 인증 기반 회원 확인**으로 운영

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

## PPT 캡처 경로

1. `/shop`
2. `/shop/products/INTL_SHIPPING`
3. `/shop/checkout?product=PICKUP_FEE` (외국인 회원 로그인)
4. KG이니시스 결제창
5. `/shop/payment/success`
6. `/shop/orders` · `/shop/tracking/{oid}`
7. `/shop/shipping-policy` · `/shop/refund-policy`
