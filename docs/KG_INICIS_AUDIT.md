# KG이니시스 해외카드/글로벌결제 심사 대응 메모

## 보증보험 (내부 관리용)

해외카드 오픈을 위해 KG이니시스 요청 시 **보증보험 가입**을 진행한다.

## 결제 구조 요약

| 구분 | 결제수단 | 대상 |
|------|----------|------|
| 단건 (one_time) | 국내: CARD, BANK_TRANSFER, VIRTUAL_ACCOUNT, EASY_PAY | 모든 회원 |
| 단건 (one_time) | 글로벌: FOREIGN_CARD, ALIPAY, WECHAT_PAY | 외국인/해외고객 회원만 |
| 정기 (recurring) | 신용카드 자동결제(빌링) | 장기보관 월 이용료 |

## 해외카드 사용 조건

- 로그인 회원
- `customer_type = foreigner`
- 비회원 주문 불가
- `payment_item_type = one_time` (단건 서비스만)

## PPT 캡처 경로

1. `/shop`
2. `/shop/products/{id}`
3. `/shop/checkout?product={id}` (로그인 후)
4. KG이니시스 결제창
5. `/shop/payment/success` 또는 `/shop/payment/fail`
6. `/shop/shipping-policy`
7. `/shop/refund-policy`
8. Footer 사업자정보
