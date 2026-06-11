/** 출고 신청 가능 여부 — is_shippable=true 이면 status 무관하게 출고 가능 */

const EXCLUDED_STATUSES = new Set([
  "SHIPPED", "RETURNED", "PICKUP_CANCELLED", "DISPOSED",
]);

export function isParcelShippable(parcel: {
  status: string;
  is_shippable?: boolean | null;
}): boolean {
  return parcel.is_shippable === true && !EXCLUDED_STATUSES.has(parcel.status);
}

export const SHIPPABLE_STATUS_FILTER = "is_shippable";
