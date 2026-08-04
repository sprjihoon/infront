# 정기결제(카드사) 심사 캡처 가이드 — MID `infrontbil`

샘플: `카드사 심사자료_샘플(카드_정기결제).ppt`  
제출용 PPT: [`card-billing-audit-infrontbil.pptx`](./card-billing-audit-infrontbil.pptx)

## 심사용 계정

| 항목 | 값 |
|------|-----|
| 이메일 | `audit-domestic@infront.kr` |
| 비밀번호 | `AuditDomestic2026!` |
| 빌링 MID | `infrontbil` |
| 상품 | 베이직 멤버십 `MEMBERSHIP_BASIC` / **9,900원/월** |

> 계정 없으면: `cd apps/web && node scripts/create-audit-test-users.mjs`

## 캡처 규칙 (샘플 PPT와 동일)

1. **브라우저 주소창이 보이게** 전체 창 캡처 (가짜 URL 바 없음)
2. **하단 사업자정보 5항목 + 통신판매신고** 스크롤 후 캡처
3. **금액 = 결제창 금액** (원화, 9,900원)
4. **빌링 결제창** — 카드번호/유효기간/주민·생년월일 입력창까지
5. **취소/환불 규정** 페이지 캡처 필수

## 결제 경로 (순서대로 캡처)

| # | 화면 | URL |
|---|------|-----|
| 1 | 샵 메인 · 멤버십 섹션 | https://infront.kr/shop |
| 2 | 상품 상세 (이용기간·환불) | https://infront.kr/shop/products/MEMBERSHIP_BASIC |
| 3 | 주문/결제 (구독주기·정기결제일 표시) | https://infront.kr/shop/checkout?product=MEMBERSHIP_BASIC |
| 4 | KG 빌링 결제창 | 3번에서「주문하기」 |
| 5 | 주문 완료 · 1회차 결제 | `/shop/billing/complete?id=...` |
| 6 | 취소/환불 정책 | https://infront.kr/shop/refund-policy |

## PPT에 붙이는 방법

1. `card-billing-audit-infrontbil.pptx` 열기
2. `[ 화면 캡처 영역 ]` 자리에 위 순서 캡처 붙여넣기
3. 결제창(카드번호 입력) 슬라이드에 **9,900원**이 사이트와 동일한지 확인
4. KG 담당자에게 PPT + 테스트 계정 회신

## 사업자정보 (Footer)

| 항목 | 표기 |
|------|------|
| 상호명 | 틸리언 |
| 대표자 | 장지훈 |
| 사업자등록번호 | 766-55-00323 |
| 연락처 | 010-2723-9490 |
| 주소 | 대구시 동구 안심로188 2층, 3층 |
| 통신판매업신고 | 제 2022-대구동구-1034 호 |

## 배포 확인

정기결제 UI가 production에 있어야 심사가 가능합니다.

- `/shop` → **멤버십 구독 (월 정기결제)** 섹션 보임
- `/shop/checkout?product=MEMBERSHIP_BASIC` → 주문정보에 구독주기·정기결제일 표시 후「주문하기」
