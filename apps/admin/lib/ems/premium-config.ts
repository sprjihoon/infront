/**
 * EMS 프리미엄 운영 상수 (우정사업본부 공지 반영)
 */

import {
  calcLengthPlusGirthCm,
  EMS_PREMIUM_DIMENSION_RULES,
  validateBoxDimensions,
} from "./dimension-limits";

export const EMS_PREMIUM_CARRIER = "FedEx" as const;
export const EMS_PREMIUM_CARRIER_PREVIOUS = "UPS" as const;
export const EMS_PREMIUM_CARRIER_CHANGED_AT = "2026-04-01";
export const EMS_PREMIUM_FEDEX_SHIP_FROM = "2026-03-31";

export const EMS_PREMIUM_SUPPORT_TEL = "02-3700-5199";

export const EMS_PREMIUM_LIMITS = {
  nonDocMaxWeightG: 70_000,
  docMaxWeightG: 500,
  nonDocMaxLongestCm: EMS_PREMIUM_DIMENSION_RULES.maxLongestCm,
  nonDocMaxMiddleCm: EMS_PREMIUM_DIMENSION_RULES.maxMiddleCm!,
  nonDocMaxShortestCm: EMS_PREMIUM_DIMENSION_RULES.maxShortestCm!,
  nonDocMaxLengthPlusGirthCm: EMS_PREMIUM_DIMENSION_RULES.maxLengthPlusGirthCm!,
} as const;

export const EMS_PREMIUM_INSURANCE_NOTE =
  "EMS 프리미엄 서류는 보험 취급 불가. 비서류 보험료는 2026.4.3부터 115,000원 초과분 1,420원/구간 적용.";

export const EMS_PREMIUM_REQUIRED_FIELDS_FROM = "2026-04-16";

export function getEmsPremiumMaxWeightG(emEe?: string): number {
  return emEe === "ee"
    ? EMS_PREMIUM_LIMITS.docMaxWeightG
    : EMS_PREMIUM_LIMITS.nonDocMaxWeightG;
}

export { calcLengthPlusGirthCm };

export function validateEmsPremiumDimensions(
  lengthCm: number,
  widthCm: number,
  heightCm: number,
): string | null {
  return validateBoxDimensions(
    EMS_PREMIUM_DIMENSION_RULES,
    lengthCm,
    widthCm,
    heightCm,
  );
}

export function isEmsPremiumInsuranceAvailable(
  premiumcd: string,
  emEe?: string,
): boolean {
  if (premiumcd !== "32") return true;
  return emEe !== "ee";
}
