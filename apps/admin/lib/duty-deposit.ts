/**
 * DDP(관세 선납) — 우체국 postal DDP + EMS 프리미엄(FedEx) DDP.
 * 보수적 관세 선납액(손해 방지 + 버퍼) 산출.
 */

/** 우체국 EMS/K-Packet 발송인 선납(DDP) 확인된 국가 */
export const DDP_COUNTRY_CODES = ["US", "GB"] as const;
export type DdpCountryCode = (typeof DDP_COUNTRY_CODES)[number];

export type DdpPath = "postal" | "premium";

const US_DDP_MAX_USD = 800;
const US_GIFT_MAX_USD = 100;

/** 우체국 postal DDP 상한 (미국) */
export const US_POSTAL_DDP_MAX_USD = US_DDP_MAX_USD;

export function requiresUsEmsPremium(
  countryCode: string,
  customsValueUsd: number,
): boolean {
  return (
    countryCode.toUpperCase() === "US" &&
    customsValueUsd > US_DDP_MAX_USD
  );
}

/** EMS/K-Packet 우체국 postal DDP (미국 $800 이하) */
export function isPostalDdpEligible(
  countryCode: string,
  customsValueUsd: number,
): boolean {
  if (!isDdpCountry(countryCode)) return false;
  if (countryCode.toUpperCase() === "US" && customsValueUsd > US_DDP_MAX_USD) {
    return false;
  }
  return true;
}

/** EMS 프리미엄(FedEx) DDP — 미국 $800 초과 등 특송 경로 */
export function isPremiumDdpEligible(
  countryCode: string,
  customsValueUsd: number,
  shippingMethod?: string,
): boolean {
  if (shippingMethod !== "EMS_PREMIUM") return false;
  if (countryCode.toUpperCase() !== "US") return false;
  return customsValueUsd > US_DDP_MAX_USD;
}

export function isDdpEligibleForShipment(
  countryCode: string,
  customsValueUsd: number,
  shippingMethod?: string,
): boolean {
  return (
    isPostalDdpEligible(countryCode, customsValueUsd) ||
    isPremiumDdpEligible(countryCode, customsValueUsd, shippingMethod)
  );
}

export function resolveDdpPath(
  countryCode: string,
  customsValueUsd: number,
  shippingMethod?: string,
): DdpPath | null {
  if (isPremiumDdpEligible(countryCode, customsValueUsd, shippingMethod)) {
    return "premium";
  }
  if (isPostalDdpEligible(countryCode, customsValueUsd)) {
    return "postal";
  }
  return null;
}

export interface DutyDepositInput {
  countryCode: string;
  customsValueUsd: number;
  dutyPrepaidRequested?: boolean;
  shippingMethod?: "EMS" | "EMS_PREMIUM" | "KPACKET";
  usdKrwRate: number;
  fxSpread?: number;
}

export interface DutyDepositBreakdown {
  dutyUsd: number;
  serviceFeeUsd: number;
  bufferUsd: number;
  totalUsd: number;
}

export interface DutyDepositResult {
  eligible: boolean;
  dutyPrepaid: boolean;
  ddpPath: DdpPath | null;
  estimateUsd: number;
  depositKrw: number;
  breakdown: DutyDepositBreakdown | null;
  ineligibleReason?: string;
}

export function isDdpCountry(countryCode: string): boolean {
  return (DDP_COUNTRY_CODES as readonly string[]).includes(countryCode.toUpperCase());
}

function roundUpTo(n: number, unit: number): number {
  return Math.ceil(n / unit) * unit;
}

function applyFx(usd: number, rate: number, spread: number): number {
  return usd * rate * (1 + spread);
}

/** 우체국 postal — 관세 ~17% + $1.04 + 10% + 15% 버퍼 */
function estimateUsPostalDuty(usd: number, isGift: boolean): DutyDepositBreakdown {
  if (isGift && usd <= US_GIFT_MAX_USD) {
    const serviceFeeUsd = 1.04;
    const bufferUsd = serviceFeeUsd * 0.15;
    return {
      dutyUsd: 0,
      serviceFeeUsd,
      bufferUsd,
      totalUsd: serviceFeeUsd + bufferUsd,
    };
  }

  const dutyUsd = usd * 0.17;
  const serviceFeeUsd = 1.04 + dutyUsd * 0.1;
  const subtotal = dutyUsd + serviceFeeUsd;
  const bufferUsd = subtotal * 0.15;
  return {
    dutyUsd,
    serviceFeeUsd,
    bufferUsd,
    totalUsd: subtotal + bufferUsd,
  };
}

/**
 * FedEx 특송 DDP (미국 $800+) — 보수적 산출
 * 상호관세·통관대행·MPF 포함, 버퍼 20%
 */
function estimateUsPremiumDuty(usd: number): DutyDepositBreakdown {
  const dutyUsd = usd * 0.2;
  const serviceFeeUsd = 2.62 + 15 + dutyUsd * 0.05;
  const subtotal = dutyUsd + serviceFeeUsd;
  const bufferUsd = subtotal * 0.2;
  return {
    dutyUsd,
    serviceFeeUsd,
    bufferUsd,
    totalUsd: subtotal + bufferUsd,
  };
}

/** GB: VAT 20% + 10% 버퍼 */
function estimateGbDuty(usd: number): DutyDepositBreakdown {
  const vatUsd = usd * 0.2;
  const bufferUsd = vatUsd * 0.1;
  return {
    dutyUsd: 0,
    serviceFeeUsd: vatUsd,
    bufferUsd,
    totalUsd: vatUsd + bufferUsd,
  };
}

export function calculateDutyDeposit(input: DutyDepositInput): DutyDepositResult {
  const country = input.countryCode.toUpperCase();
  const usd = Math.max(0, input.customsValueUsd);
  const requested = Boolean(input.dutyPrepaidRequested);
  const fxSpread = input.fxSpread ?? 0.02;
  const path = resolveDdpPath(country, usd, input.shippingMethod);

  if (!requested) {
    return {
      eligible: isDdpCountry(country),
      dutyPrepaid: false,
      ddpPath: null,
      estimateUsd: 0,
      depositKrw: 0,
      breakdown: null,
    };
  }

  if (!isDdpCountry(country)) {
    return {
      eligible: false,
      dutyPrepaid: false,
      ddpPath: null,
      estimateUsd: 0,
      depositKrw: 0,
      breakdown: null,
      ineligibleReason: "해당 국가는 관세 선납(DDP)을 지원하지 않습니다.",
    };
  }

  if (country === "US" && usd > US_DDP_MAX_USD && input.shippingMethod !== "EMS_PREMIUM") {
    return {
      eligible: false,
      dutyPrepaid: false,
      ddpPath: null,
      estimateUsd: 0,
      depositKrw: 0,
      breakdown: null,
      ineligibleReason: `미국 USD ${US_DDP_MAX_USD} 초과는 EMS 프리미엄(FedEx DDP)으로 발송해야 관세 선납이 가능합니다.`,
    };
  }

  if (!path) {
    return {
      eligible: false,
      dutyPrepaid: false,
      ddpPath: null,
      estimateUsd: 0,
      depositKrw: 0,
      breakdown: null,
      ineligibleReason: "관세 선납(DDP) 조건을 충족하지 않습니다.",
    };
  }

  if (usd <= 0) {
    return {
      eligible: true,
      dutyPrepaid: true,
      ddpPath: path,
      estimateUsd: 0,
      depositKrw: 0,
      breakdown: null,
    };
  }

  let breakdown: DutyDepositBreakdown;
  if (country === "US" && path === "premium") {
    breakdown = estimateUsPremiumDuty(usd);
  } else if (country === "US") {
    breakdown = estimateUsPostalDuty(usd, false);
  } else {
    breakdown = estimateGbDuty(usd);
  }

  const minKrw =
    path === "premium" ? 25_000 : country === "US" ? 15_000 : 10_000;
  const depositKrw = Math.max(
    minKrw,
    roundUpTo(applyFx(breakdown.totalUsd, input.usdKrwRate, fxSpread), 1_000),
  );

  return {
    eligible: true,
    dutyPrepaid: true,
    ddpPath: path,
    estimateUsd: Math.round(breakdown.totalUsd * 100) / 100,
    depositKrw,
    breakdown,
  };
}

/** 견적 합계 — packaging + shipping + 관세 선납 */
export function computeOrderTotalAmount(parts: {
  packagingFee?: number | null;
  shippingFee?: number | null;
  extraFee?: number | null;
  dutyDepositKrw?: number | null;
}): number {
  return (
    (parts.packagingFee ?? 0) +
    (parts.shippingFee ?? 0) +
    (parts.extraFee ?? 0) +
    (parts.dutyDepositKrw ?? 0)
  );
}

export function getDdpCountryLabel(countryCode: string): string | null {
  const labels: Record<DdpCountryCode, string> = {
    US: "미국",
    GB: "영국",
  };
  const c = countryCode.toUpperCase() as DdpCountryCode;
  return labels[c] ?? null;
}
