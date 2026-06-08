export type Lang = "ko" | "en";

export const t = {
  ko: {
    /* 공통 */
    home: "홈으로",
    langLabel: "EN",

    /* shop/page */
    headerTitle: "인프론트 물류대행",
    headerSub: "박스 사이즈별 포장 서비스",
    serviceTitle: "📦 인프론트 물류대행 서비스",
    serviceDesc:
      "고객이 국내에서 구매하거나 보유한 물품을 센터에서 수령한 후, 고객 요청에 따라 검품·포장·재포장 및 국내·해외 배송 준비를 제공하는 물류대행 서비스입니다. 유학생 짐 발송도 지원합니다.",
    serviceNote:
      "※ 본 서비스는 상품 판매 또는 구매대행이 아닙니다. 고객이 소유한 물품의 포장 및 배송 준비만을 대행하며, 제3자 간 거래를 중개하지 않습니다.",
    prohibitedTitle: "🚫 취급 금지 물품",
    prohibitedDesc: "아래 물품은 접수 및 포장이 불가합니다.",
    prohibitedItems: [
      "리튬배터리 단품, 인화성·폭발성 물질",
      "마약류, 총기류 및 관련 부품",
      "목적국 반입 금지 물품",
      "위조품·지적재산권 침해 물품",
      "동식물, 의약품 (처방전 필요 품목)",
    ],
    buyBtn: "구매하기",
    includesTitle: "서비스 포함 내용",
    includesItems: [
      "박스 규격에 맞는 안전 포장",
      "에어캡·완충재 보강",
      "포장 완료 사진 제공",
      "해외 배송 준비 완료",
    ],
    refundTitle: "📋 취소 및 환불 정책",
    refundItems: [
      "포장 작업 시작 전: 전액 환불 가능",
      "포장 작업 시작 후: 취소 불가",
      "회사 귀책 사유(불량 포장, 의뢰 내용 상이 등): 전액 환불 또는 재작업",
      "환불 처리 기간: 결제 취소 후 카드사 기준 3~5 영업일",
    ],

    /* checkout/page */
    checkoutTitle: "주문 / 결제",
    orderProduct: "주문 상품",
    senderSection: "보내는 분 (수거 주소)",
    recipientSection: "받는 분",
    sameAsSender: "보내는 분과 동일",
    labelName: "이름",
    labelPhone: "연락처",
    labelZip: "우편번호",
    labelAddress: "주소",
    labelAddressDetail: "상세주소",
    labelEmail: "이메일",
    placeholderName: "홍길동",
    placeholderPhone: "010-1234-5678",
    placeholderZip: "12345",
    placeholderAddress: "서울특별시 강남구 테헤란로 123",
    placeholderAddressDetail: "101동 202호",
    placeholderEmail: "example@email.com",
    paymentSummary: "결제 금액",
    totalAmount: "최종 결제금액",
    payBtn: (price: string) => `${price}원 결제하기`,
    paymentNotice: "결제는 KG이니시스(포트원)를 통해 안전하게 처리됩니다",
    payFail: "결제 준비에 실패했습니다.",
    payError: "결제 초기화에 실패했습니다.",

    /* success/fail */
    paySuccess: "결제 완료!",
    verifying: "결제 확인 중...",
    successMsg: "포장대행 서비스 결제가 완료되었습니다.\n빠른 시일 내에 처리해 드리겠습니다.",
    goBack: "쇼핑으로 돌아가기",
    orderNo: "주문번호",
    paidAmount: "결제금액",
    invalidPayment: "결제 정보가 올바르지 않습니다.",
  },

  en: {
    /* common */
    home: "Home",
    langLabel: "KO",

    /* shop/page */
    headerTitle: "Infront Logistics",
    headerSub: "Packaging service by box size",
    serviceTitle: "📦 Infront Logistics Service",
    serviceDesc:
      "We receive your items purchased or owned in Korea at our center, then provide inspection, packaging, repackaging, and domestic/international shipping preparation on your behalf. International student luggage shipping is also supported.",
    serviceNote:
      "※ This service is not a product sales or purchasing agency. We only handle packing and shipping preparation for items you already own. We do not broker transactions between third parties.",
    prohibitedTitle: "🚫 Prohibited Items",
    prohibitedDesc: "The following items cannot be accepted or packaged.",
    prohibitedItems: [
      "Standalone lithium batteries, flammable/explosive materials",
      "Narcotics, firearms and related parts",
      "Items prohibited from import in the destination country",
      "Counterfeit goods or items infringing intellectual property rights",
      "Live animals/plants, prescription medications",
    ],
    buyBtn: "Order Now",
    includesTitle: "Service Includes",
    includesItems: [
      "Safe packaging suited to box dimensions",
      "Bubble wrap & cushioning materials",
      "Photo of completed packaging provided",
      "Ready for international shipping",
    ],
    refundTitle: "📋 Cancellation & Refund Policy",
    refundItems: [
      "Before packaging begins: Full refund available",
      "After packaging begins: Cancellation not available",
      "Company fault (poor packaging, discrepancy, etc.): Full refund or redo",
      "Refund processing: 3–5 business days after cancellation",
    ],

    /* checkout/page */
    checkoutTitle: "Order / Payment",
    orderProduct: "Ordered Item",
    senderSection: "Sender (Pickup Address)",
    recipientSection: "Recipient",
    sameAsSender: "Same as sender",
    labelName: "Name",
    labelPhone: "Phone",
    labelZip: "Postal Code",
    labelAddress: "Address",
    labelAddressDetail: "Address Detail",
    labelEmail: "Email",
    placeholderName: "John Doe",
    placeholderPhone: "010-1234-5678",
    placeholderZip: "12345",
    placeholderAddress: "123 Teheran-ro, Gangnam-gu, Seoul",
    placeholderAddressDetail: "Unit 202",
    placeholderEmail: "example@email.com",
    paymentSummary: "Payment Summary",
    totalAmount: "Total",
    payBtn: (price: string) => `Pay ₩${price}`,
    paymentNotice: "Payment is securely processed via KG Inicis (PortOne).",
    payFail: "Failed to prepare payment.",
    payError: "Failed to initialize payment.",

    /* success/fail */
    paySuccess: "Payment Complete!",
    verifying: "Verifying payment...",
    successMsg: "Your packaging service payment is confirmed.\nWe will process your order as soon as possible.",
    goBack: "Back to Shop",
    orderNo: "Order No.",
    paidAmount: "Amount Paid",
    invalidPayment: "Invalid payment information.",
  },
} as const satisfies Record<Lang, object>;
