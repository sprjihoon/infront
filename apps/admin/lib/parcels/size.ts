/**
 * 스토리지 타입 코드 = 소포 크기 코드 (storage_types.code와 일치)
 *
 * volume_l(리터) = 포인트: storage_locations.volume_liter 와 직접 비교 가능
 *
 * 픽업 무게 → size code 자동 배정:
 *   DEFAULT / 2kg  → MINI     (16L)
 *   SMALL   / 5kg  → STANDARD (40.5L)
 *   MEDIUM  / 10kg → LONG     (96L)
 *   LARGE   / 20kg → XL       (108.2L)
 *   XL      / 30kg → OVERSIZE (480L)
 */
export const PARCEL_SIZE_OPTIONS = [
  {
    code: "MINI",
    label: "Mini",
    desc: "극소형 · 2kg 이하 · 16L",
    volume_l: 16,
    max_weight_kg: 2,
  },
  {
    code: "STANDARD",
    label: "Standard",
    desc: "소형 · 5kg 이하 · 40.5L",
    volume_l: 40.5,
    max_weight_kg: 5,
  },
  {
    code: "LONG",
    label: "Long",
    desc: "중형 · 10kg 이하 · 96L",
    volume_l: 96,
    max_weight_kg: 10,
  },
  {
    code: "XL",
    label: "XL",
    desc: "대형 · 20kg 이하 · 108.2L",
    volume_l: 108.2,
    max_weight_kg: 20,
  },
  {
    code: "OVERSIZE",
    label: "Oversize",
    desc: "특대형 · 30kg 이하 · 480L",
    volume_l: 480,
    max_weight_kg: 30,
  },
] as const;

export type ParcelSizeCode = (typeof PARCEL_SIZE_OPTIONS)[number]["code"];

export const SIZE_VOLUME_L: Record<string, number> = Object.fromEntries(
  PARCEL_SIZE_OPTIONS.map((s) => [s.code, s.volume_l])
);

/**
 * 픽업 무게(kg) → parcel_size_code 자동 결정
 * 딱 맞는 용량(무게 ≤ max_weight_kg) 중 가장 작은 사이즈
 */
export function weightKgToSizeCode(weightKg: number): ParcelSizeCode {
  for (const opt of PARCEL_SIZE_OPTIONS) {
    if (weightKg <= opt.max_weight_kg) return opt.code;
  }
  return "OVERSIZE";
}
