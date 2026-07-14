# KG이니시스 심사 PPT 캡처 가이드 (URL·사업자정보·원화·BC/하나)

## 1. URL 주소 표시 캡처

모든 캡처 URL 끝에 **`&audit=1`** (또는 `?audit=1`)을 붙이면 화면 **상단에 URL 바**가 표시됩니다.

```
https://infront.kr/signup?audit=1
https://infront.kr/shop?audit=1
https://infront.kr/shop/checkout?product=INSPECTION_PACK_S&audit=1
```

### 캡처 대상 경로 (audit=1 필수)

| # | URL |
|---|-----|
| 1 | `/signup?audit=1` |
| 2 | `/login?audit=1` |
| 3 | `/mypage?audit=1` |
| 4 | `/shop?audit=1` |
| 5 | `/shop/products/INSPECTION_PACK_S?audit=1` |
| 6 | `/shop/checkout?product=INSPECTION_PACK_S&audit=1` |
| 7 | `/shop/orders?audit=1` |
| 8 | `/shop/refund-policy?audit=1` |
| 9 | `/shop/shipping-policy?audit=1` |

> `/shop/*` 하단: **ShopFooter** (사업자 5항목 + 통신판매신고)  
> `/signup`, `/login`, `/mypage`: `audit=1` 시 **하단 사업자정보** 자동 표시

---

## 2. 사이트 하단 사업자정보 (필수 5항목 + 통신판매신고)

| 항목 | 표기 |
|------|------|
| 상호명 | 틸리언 |
| 대표자 | 장지훈 |
| 사업자등록번호 | 766-55-00323 |
| **연락처** | 010-2723-9490 |
| **주소** | 대구시 동구 안심로188 2층, 3층 |
| 통신판매업신고 | 제 2022-대구동구-1034 호 |

캡처 시 **페이지 하단까지 스크롤**하여 위 항목이 모두 보이게 찍으세요.

---

## 3. 최종 결제 금액 = 결제창 금액 (원화 KRW)

| 확인 위치 | 표시 |
|-----------|------|
| checkout **최종 결제금액** | `6,000원` (예: INSPECTION_PACK_S) |
| checkout 안내 문구 | `결제 통화: 원화(KRW) · KG이니시스 결제창에 6,000원으로 동일 표시` |
| KG 결제창 | **6,000원** (달러 $ 표시 없음) |
| API 전송 | `currency=WON`, `price=6000` |

**캡처 방법:** checkout 화면(금액) + KG 결제창(금액)을 **한 PPT 슬라이드에 나란히** 배치.

---

## 4. BC카드 / 하나카드 결제창 캡처 (필수 4장)

> **신용카드(국내)** 결제만 사용. 해외카드·Alipay 캡처 **하지 않음**.

### 준비

- 계정: `audit-domestic@infront.kr` / `AuditDomestic2026!`
- URL: `https://infront.kr/shop/checkout?product=INSPECTION_PACK_S&audit=1`
- 결제수단: **신용카드** 선택
- 주소·약관 입력 후 **결제하기**

### 캡처 목록

| # | 화면 | 방법 |
|---|------|------|
| 1 | **전체 카드사 목록** | KG 결제창 → 신용카드 → 카드사 선택 그리드 전체 |
| 2 | **BC카드 페이북** | 목록에서 **BC카드** 선택 |
| 3 | **BC 페이북 앱 결제** | 페이북 QR/앱 결제 화면까지 진행 (모바일 또는 PC 연동) |
| 4 | **하나카드 안심클릭** | 뒤로 → **하나카드** 선택 → 안심클릭 인증 화면 |

### 주의

- BC·하나 **외 다른 카드사** 결제창은 캡처하지 않습니다.
- 테스트 MID에서 카드사 창이 안 뜨면 KG이니시스에 **스테이징 카드사 노출** 확인.
- 실카드 입력·승인까지는 불필요 — **인증/선택 화면** 캡처면 충분한 경우가 많습니다.

---

## 테스트 계정

| 구분 | 이메일 | 비밀번호 |
|------|--------|----------|
| 내국인 (BC/하나 결제) | audit-domestic@infront.kr | AuditDomestic2026! |
| 외국인/해외고객 | audit-foreigner@infront.kr | AuditForeign2026! |

---

## 파일명 규칙 (권장)

```
url-01-signup.png
url-02-shop.png
url-03-checkout-domestic-krw.png
pay-01-inicis-card-list.png
pay-02-bc-paybook.png
pay-03-bc-paybook-app.png
pay-04-hana-ansimclick.png
footer-shop.png
```
