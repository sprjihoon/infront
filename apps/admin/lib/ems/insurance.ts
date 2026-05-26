/** EMS 보험가입금액(boprc) 상한 — EMS 기준 700만원 */
export const MAX_BOPRC_KRW = 7_000_000;

const DEFAULT_USD_KRW = 1400;

/** 인보이스 USD 합계 → EMS API boprc (원화) */
export function usdToBoprcKrw(usd: number): number {
  const rate = Number(process.env.EMS_USD_KRW_RATE ?? DEFAULT_USD_KRW);
  return Math.min(Math.max(0, Math.round(usd * rate)), MAX_BOPRC_KRW);
}

export function getOrderInsuranceParams(order: {
  insurance_enabled?: boolean | null;
  insurance_amount?: number | null;
  customs_value?: number | null;
}): { boyn: 'Y' | 'N'; boprc: number } {
  if (!order.insurance_enabled) return { boyn: 'N', boprc: 0 };
  const usd = Number(order.insurance_amount ?? order.customs_value ?? 0);
  if (usd <= 0) return { boyn: 'N', boprc: 0 };
  return { boyn: 'Y', boprc: usdToBoprcKrw(usd) };
}
