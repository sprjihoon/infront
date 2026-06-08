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
    formatPrice: (n: number) => `${n.toLocaleString()}원`,
    buyBtn: "구매하기",
    includesTitle: "서비스 포함 내용",
    includesItems: [
      "박스 규격에 맞는 안전 포장",
      "에어캡·완충재 보강",
      "포장 완료 사진 제공",
      "해외 배송 준비 완료",
    ],
    refundTitle: "📋 배송기간 · 교환 · 환불 정책",
    refundItems: [
      "배송기간: 결제 완료 후 수거 1~2 영업일, 포장·발송까지 총 2~5 영업일 소요",
      "교환: 서비스 특성상 포장 완료 후 교환은 불가합니다. 단, 포장 불량 발생 시 재작업을 무상 제공합니다.",
      "환불 — 포장 작업 시작 전: 전액 환불 가능",
      "환불 — 포장 작업 시작 후: 취소 불가",
      "환불 — 회사 귀책 사유(불량 포장, 의뢰 내용 상이 등): 전액 환불 또는 재작업",
      "환불 처리 기간: 결제 취소 후 카드사 기준 3~5 영업일",
    ],

    /* 이용 절차 */
    howTitle: "📋 이용 절차 및 처리 기간",
    howSteps: [
      { step: "1", label: "서비스 신청", desc: "박스 규격 선택 후 결제 (즉시)" },
      { step: "2", label: "물품 수거", desc: "결제 후 1~2 영업일 내 수거" },
      { step: "3", label: "검품·포장", desc: "수거 후 당일~1 영업일 내 완료" },
      { step: "4", label: "배송 발송", desc: "포장 완료 후 즉시 발송" },
    ],
    processingNotice: "📦 주문 완료 후 평균 2~5 영업일 내 발송됩니다.",

    /* 배송비 안내 */
    shippingTitle: "🚚 배송비 안내",
    shippingItems: [
      "기본 배송비 3,000원이 포장대행 요금과 별도로 청구됩니다.",
      "결제 완료 후 담당자가 수거 일정 및 배송 확인 연락을 드립니다.",
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
    searchAddress: "주소 검색",
    placeholderName: "홍길동",
    placeholderPhone: "010-1234-5678",
    placeholderZip: "12345",
    placeholderAddress: "예) 서울특별시 강남구 테헤란로 123",
    placeholderAddressDetail: "101동 202호",
    placeholderEmail: "example@email.com",
    paymentSummary: "결제 금액",
    totalAmount: "최종 결제금액",
    shippingFeeLabel: "기본 배송비",
    payBtn: (price: string) => `${price}원 결제하기`,
    paymentNotice: "결제는 KG이니시스를 통해 안전하게 처리됩니다",
    payFail: "결제 준비에 실패했습니다.",
    payError: "결제 초기화에 실패했습니다.",
    termsAgree: "이용약관 및 개인정보처리방침에 동의합니다.",

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
    formatPrice: (n: number) => `₩${n.toLocaleString()}`,
    buyBtn: "Order Now",
    includesTitle: "Service Includes",
    includesItems: [
      "Safe packaging suited to box dimensions",
      "Bubble wrap & cushioning materials",
      "Photo of completed packaging provided",
      "Ready for international shipping",
    ],
    refundTitle: "📋 Delivery Period · Exchange · Refund Policy",
    refundItems: [
      "Delivery period: Pickup within 1–2 business days after payment; packaging and dispatch within 2–5 business days total.",
      "Exchange: Due to the nature of the service, exchanges after packaging is complete are not accepted. However, a free redo will be provided in the event of a packaging defect.",
      "Refund — Before packaging begins: Full refund available",
      "Refund — After packaging begins: Cancellation not available",
      "Refund — Company fault (poor packaging, discrepancy, etc.): Full refund or redo",
      "Refund processing: 3–5 business days after cancellation",
    ],

    /* How it works */
    howTitle: "📋 How It Works & Processing Time",
    howSteps: [
      { step: "1", label: "Place Order", desc: "Select box size and pay (instant)" },
      { step: "2", label: "Pickup", desc: "Pickup within 1–2 business days" },
      { step: "3", label: "Inspect & Pack", desc: "Packed same day or within 1 business day" },
      { step: "4", label: "Ship", desc: "Dispatched immediately after packing" },
    ],
    processingNotice: "📦 Orders are typically dispatched within 2–5 business days.",

    /* Shipping notice */
    shippingTitle: "🚚 Shipping Fee Notice",
    shippingItems: [
      "A basic shipping fee of ₩3,000 is charged separately from the packaging service price.",
      "After payment, our team will contact you to confirm the pickup schedule and delivery details.",
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
    searchAddress: "Search",
    placeholderName: "John Doe",
    placeholderPhone: "010-1234-5678",
    placeholderZip: "12345",
    placeholderAddress: "ex) 123 Teheran-ro, Gangnam-gu, Seoul",
    placeholderAddressDetail: "Unit 202",
    placeholderEmail: "example@email.com",
    paymentSummary: "Payment Summary",
    totalAmount: "Total",
    shippingFeeLabel: "Basic Shipping Fee",
    payBtn: (price: string) => `Pay ₩${price}`,
    paymentNotice: "Payment is securely processed via KG Inicis.",
    payFail: "Failed to prepare payment.",
    payError: "Failed to initialize payment.",
    termsAgree: "I agree to the Terms of Service and Privacy Policy.",

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
