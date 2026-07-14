# KG이니시스 심사 PPT 캡처 (2026-07-14)

production(https://infront.kr) 기준 브라우저 캡처 결과입니다.

## 캡처 파일 목록

| 파일 | 화면 | 계정 | 확인 포인트 |
|------|------|------|-------------|
| `01-signup-customer-type.png` | `/signup` | (비로그인) | 고객 구분 드롭다운, 이메일 인증 안내 |
| `02-shop-main.png` | `/shop` | (비로그인) | 해외카드 안내, 결제수단 목록 |
| `03-checkout-domestic-no-global.png` | `/shop/checkout?product=INSPECTION_PACK_S` | audit-domestic@infront.kr | 고객 유형=내국인, **해외 결제 미노출** |
| `04-mypage-domestic.png` | `/mypage` | audit-domestic@infront.kr | **고객 구분 (결제)** 카드 |
| `05-checkout-foreigner-global-pay.png` | checkout | audit-foreigner@infront.kr | 고객 유형=외국인, **해외카드·Alipay 노출** |
| `06-mypage-foreigner.png` | `/mypage` | audit-foreigner@infront.kr | 외국인/해외고객 배지·카드 |
| `07-shop-orders.png` | `/shop/orders` | audit-foreigner@infront.kr | 주문 목록 (빈 상태) |
| `08-refund-policy.png` | `/shop/refund-policy` | — | 취소/환불 정책 |
| `09-shipping-policy.png` | `/shop/shipping-policy` | — | 배송/추적 정책 |
| `10-login-email-auth-notice.png` | `/login` | — | 이메일 인증 안내 문구 |

> 스크린샷 원본: Cursor 브라우저 캡처 (`%LOCALAPPDATA%\Temp\cursor\screenshots\`)  
> PPT용으로 위 파일명으로 복사해 사용하세요.

## 심사용 테스트 계정

| 구분 | 이메일 | 비밀번호 |
|------|--------|----------|
| 내국인 | audit-domestic@infront.kr | AuditDomestic2026! |
| 외국인/해외고객 | audit-foreigner@infront.kr | AuditForeign2026! |

## production 배포 확인 ✅

- `/mypage` — **「고객 구분 (결제)」** 카드 노출 확인 (2026-07-14)
- `/shop/checkout` — **「회원 정보 기준」** 고객 유형 표시 확인

## 수동 캡처 필요 (BC카드 / 하나카드 결제창, 4장)

audit-domestic 계정으로 `/shop/checkout?product=INSPECTION_PACK_S&audit=1` 진입 → **신용카드(국내)** 선택 → 결제 진행.
해외카드·Alipay 등 다른 결제창은 캡처하지 않음. 상세 절차: `docs/audit-captures/KG_CAPTURE_GUIDE.md` 4장.

| # | 항목 | 방법 |
|---|------|------|
| 1 | **전체 카드사 목록** | KG 결제창 → 신용카드 → 카드사 선택 그리드 전체 |
| 2 | **BC카드 페이북** | 목록에서 BC카드 선택 |
| 3 | **BC 페이북 앱 결제** | 페이북 QR/앱 결제 화면까지 진행 |
| 4 | **하나카드 안심클릭** | 뒤로 → 하나카드 선택 → 안심클릭 인증 화면 |
| 5 | **보증보험** | KG 담당자 확인 후 `docs/KG_INICIS_AUDIT.md` 표 기록 |

> admin(관리자) 화면 캡처는 필요하지 않음 — 이번 심사 캡처 요건에서 제외.

## KG 회신 (인증 방식)

> 회원가입 시 이메일 인증을 통해 계정을 확인하며, 해외카드 결제는 이메일 인증이 완료된 외국인/해외고객 회원의 회원 주문에서만 가능합니다. 휴대폰/포털 본인인증(NICE/KCB)은 현재 미연동입니다.
