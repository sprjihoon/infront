/**
 * KG이니시스 표준결제 수단 코드.
 * PC: gopaymethod / 모바일: P_INI_PAYMENT
 * Alipay·WeChat은 계약 승인된 글로벌 간편결제(only* 단독 호출).
 */
const GOPAYMETHOD: Record<string, string> = {
  card: "Card",
  bank: "DirectBank",
  vbank: "VBank",
  easy: "",
  alipay: "onlyalipay",
  wechat: "onlywechat",
};

const MOBILE_PAYMENT: Record<string, string> = {
  card: "Card",
  bank: "DirectBank",
  vbank: "VBank",
  easy: "Card",
  alipay: "onlyalipay",
  wechat: "onlywechat",
};

export function getInicisGopaymethod(methodId: string): string {
  return GOPAYMETHOD[methodId] ?? "";
}

export function getInicisMobilePayment(methodId: string): string {
  return MOBILE_PAYMENT[methodId] ?? "Card";
}
