/**
 * 우체국 EMS / EMS 프리미엄(FedEx) / K-Packet 박스 크기 검증.
 * 3변은 최장·중간·최단으로 정렬 후 규격을 적용한다.
 */

export interface SortedBoxDimensions {
  longest: number;
  middle: number;
  shortest: number;
}

export interface BoxDimensionRules {
  /** 최장변 상한 (cm) */
  maxLongestCm: number;
  /** 길이+둘레 상한 (cm). null이면 검사 생략 */
  maxLengthPlusGirthCm: number | null;
  /** 3변 합 상한 (cm). K-Packet 등 */
  maxSumCm?: number;
  /** 2번째 긴 변 상한 (cm). FedEx 등 */
  maxMiddleCm?: number;
  /** 최단변 상한 (cm) */
  maxShortestCm?: number;
  label: string;
}

export const EMS_PREMIUM_DIMENSION_RULES: BoxDimensionRules = {
  label: "EMS 프리미엄",
  maxLongestCm: 274,
  maxMiddleCm: 105,
  maxShortestCm: 76,
  maxLengthPlusGirthCm: 330,
};

/** EMS 비서류 기본 (대부분 국가) */
export const EMS_PARCEL_DEFAULT_RULES: BoxDimensionRules = {
  label: "EMS",
  maxLongestCm: 150,
  maxLengthPlusGirthCm: 300,
};

/** 국가별 EMS 비서류 크기 예외 */
export const EMS_PARCEL_COUNTRY_OVERRIDES: Record<string, BoxDimensionRules> = {
  US: {
    label: "EMS (미국)",
    maxLongestCm: 152,
    maxLengthPlusGirthCm: 275,
  },
  AU: {
    label: "EMS (호주)",
    maxLongestCm: 105,
    maxLengthPlusGirthCm: 245,
  },
  BR: {
    label: "EMS (브라질)",
    maxLongestCm: 105,
    maxLengthPlusGirthCm: 200,
  },
};

export const KPACKET_DIMENSION_RULES: BoxDimensionRules = {
  label: "K-Packet",
  maxLongestCm: 60,
  maxSumCm: 90,
  maxLengthPlusGirthCm: null,
};

export function sortBoxDimensions(
  a: number,
  b: number,
  c: number,
): SortedBoxDimensions {
  const [longest, middle, shortest] = [a, b, c].sort((x, y) => y - x);
  return { longest, middle, shortest };
}

/** 길이+둘레 = 최장변 + 2×(중간+최단) — 우체국·FedEx 관례 */
export function calcLengthPlusGirthCm(
  lengthCm: number,
  widthCm: number,
  heightCm: number,
): number {
  const { longest, middle, shortest } = sortBoxDimensions(
    lengthCm,
    widthCm,
    heightCm,
  );
  return longest + 2 * (middle + shortest);
}

export function calcLengthPlusGirthFromSorted(
  sorted: SortedBoxDimensions,
): number {
  return sorted.longest + 2 * (sorted.middle + sorted.shortest);
}

/** 부피중량 (g) = 가로×세로×높이 ÷ 6 */
export function calcVolumetricWeightG(
  lengthCm: number,
  widthCm: number,
  heightCm: number,
): number {
  return Math.round((lengthCm * widthCm * heightCm) / 6);
}

export function getEmsParcelDimensionRules(
  countryCode?: string,
): BoxDimensionRules {
  const cc = countryCode?.toUpperCase();
  if (cc && EMS_PARCEL_COUNTRY_OVERRIDES[cc]) {
    return EMS_PARCEL_COUNTRY_OVERRIDES[cc];
  }
  return EMS_PARCEL_DEFAULT_RULES;
}

export function getDimensionRulesForService(
  premiumcd: string,
  emEe?: string,
  countryCode?: string,
): BoxDimensionRules | null {
  if (emEe === "ee") return null;
  if (premiumcd === "32") return EMS_PREMIUM_DIMENSION_RULES;
  if (premiumcd === "14") return KPACKET_DIMENSION_RULES;
  if (premiumcd === "31") return getEmsParcelDimensionRules(countryCode);
  return null;
}

export function validateBoxDimensions(
  rules: BoxDimensionRules,
  lengthCm: number,
  widthCm: number,
  heightCm: number,
): string | null {
  const dims = [lengthCm, widthCm, heightCm];
  if (dims.some((d) => !Number.isFinite(d) || d <= 0)) {
    return `${rules.label}: 박스 크기(가로·세로·높이)를 올바르게 입력해주세요.`;
  }

  const sorted = sortBoxDimensions(lengthCm, widthCm, heightCm);
  const sum = lengthCm + widthCm + heightCm;
  const lengthPlusGirth = calcLengthPlusGirthFromSorted(sorted);

  if (sorted.longest > rules.maxLongestCm) {
    return `${rules.label} 크기 초과: 최장변 ${sorted.longest.toFixed(0)}cm (최대 ${rules.maxLongestCm}cm)`;
  }
  if (rules.maxMiddleCm != null && sorted.middle > rules.maxMiddleCm) {
    return `${rules.label} 크기 초과: 2번째 긴 변 ${sorted.middle.toFixed(0)}cm (최대 ${rules.maxMiddleCm}cm)`;
  }
  if (rules.maxShortestCm != null && sorted.shortest > rules.maxShortestCm) {
    return `${rules.label} 크기 초과: 최단변 ${sorted.shortest.toFixed(0)}cm (최대 ${rules.maxShortestCm}cm)`;
  }
  if (rules.maxSumCm != null && sum > rules.maxSumCm) {
    return `${rules.label} 크기 초과: 가로+세로+높이 ${sum.toFixed(0)}cm (최대 ${rules.maxSumCm}cm)`;
  }
  if (
    rules.maxLengthPlusGirthCm != null &&
    lengthPlusGirth > rules.maxLengthPlusGirthCm
  ) {
    return `${rules.label} 크기 초과: 길이+둘레 ${lengthPlusGirth.toFixed(0)}cm (최대 ${rules.maxLengthPlusGirthCm}cm)`;
  }

  return null;
}

export interface ShippingDimensionInput {
  premiumcd: string;
  em_ee?: string;
  countrycd?: string;
  boxlength?: number;
  boxwidth?: number;
  boxheight?: number;
}

/** 크기 3변 모두 있을 때만 검증 */
export function validateShippingDimensions(
  input: ShippingDimensionInput,
): string | null {
  const { premiumcd, em_ee, countrycd, boxlength, boxwidth, boxheight } =
    input;
  if (boxlength == null || boxwidth == null || boxheight == null) {
    return null;
  }

  const rules = getDimensionRulesForService(premiumcd, em_ee, countrycd);
  if (!rules) return null;

  return validateBoxDimensions(rules, boxlength, boxwidth, boxheight);
}
