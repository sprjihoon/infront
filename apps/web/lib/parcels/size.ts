/**
 * 픽업 무게(kg) → parcel_size_code 자동 결정
 * storage_types.code 와 동일한 코드값 사용
 *
 *   DEFAULT / 2kg  → MINI     (16L)
 *   SMALL   / 5kg  → STANDARD (40.5L)
 *   MEDIUM  / 10kg → LONG     (96L)
 *   LARGE   / 20kg → XL       (108.2L)
 *   XL      / 30kg → OVERSIZE (480L)
 */
export type ParcelSizeCode =
  | "MINI"
  | "STANDARD"
  | "LONG"
  | "XL"
  | "OVERSIZE";

const SIZE_THRESHOLDS: { max_weight_kg: number; code: ParcelSizeCode }[] = [
  { max_weight_kg: 2,  code: "MINI"     },
  { max_weight_kg: 5,  code: "STANDARD" },
  { max_weight_kg: 10, code: "LONG"     },
  { max_weight_kg: 20, code: "XL"       },
  { max_weight_kg: 30, code: "OVERSIZE" },
];

export function weightKgToSizeCode(weightKg: number): ParcelSizeCode {
  for (const { max_weight_kg, code } of SIZE_THRESHOLDS) {
    if (weightKg <= max_weight_kg) return code;
  }
  return "OVERSIZE";
}
