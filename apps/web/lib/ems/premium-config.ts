/**
 * EMS 프리미엄 운영 상수 (우정사업본부 공지 반영)
 * @see 2026.4.1 FedEx 제휴 전환, 2026.3.31 계약고객시스템 규격 변경
 */

import {
  calcLengthPlusGirthCm,
  EMS_PREMIUM_DIMENSION_RULES,
  validateBoxDimensions,
} from "./dimension-limits";

export const EMS_PREMIUM_CARRIER = "FedEx" as const;
export const EMS_PREMIUM_CARRIER_PREVIOUS = "UPS" as const;
export const EMS_PREMIUM_CARRIER_CHANGED_AT = "2026-04-01";
/** 3.31.(화) 접수분부터 FedEx 발송 */
export const EMS_PREMIUM_FEDEX_SHIP_FROM = "2026-03-31";

export const EMS_PREMIUM_SUPPORT_TEL = "02-3700-5199";

/** 계약고객시스템 적용 (2026.3.31~) */
export const EMS_PREMIUM_LIMITS = {
  /** 비서류 최대 중량 (g) — 변경 없음 */
  nonDocMaxWeightG: 70_000,
  /** 서류 최대 중량 (g) — 2kg → 0.5kg */
  docMaxWeightG: 500,
  /** 비서류 최장변 (cm) */
  nonDocMaxLongestCm: EMS_PREMIUM_DIMENSION_RULES.maxLongestCm,
  /** 비서류 2번째 긴 변 (cm) — FedEx */
  nonDocMaxMiddleCm: EMS_PREMIUM_DIMENSION_RULES.maxMiddleCm!,
  /** 비서류 최단변 (cm) — FedEx */
  nonDocMaxShortestCm: EMS_PREMIUM_DIMENSION_RULES.maxShortestCm!,
  /** 비서류 길이+둘레 상한 (cm) — 400 → 330 */
  nonDocMaxLengthPlusGirthCm: EMS_PREMIUM_DIMENSION_RULES.maxLengthPlusGirthCm!,
} as const;

/** 보험료 개정 (2026.4.3~) — UI 안내용 */
export const EMS_PREMIUM_INSURANCE_NOTE =
  "EMS 프리미엄 서류는 보험 취급 불가. 비서류 보험료는 2026.4.3부터 115,000원 초과분 1,420원/구간 적용.";

/** 계약고객 필수입력 (2026.4.16 19시~) */
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
