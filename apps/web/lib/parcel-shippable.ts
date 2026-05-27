/** 출고 신청 가능 여부 — 검수 완료 후 INBOUND + is_shippable=true 만 허용 */

export function isParcelShippable(parcel: {
  status: string;
  is_shippable?: boolean | null;
}): boolean {
  return parcel.status === "INBOUND" && parcel.is_shippable === true;
}

export const SHIPPABLE_STATUS_FILTER = "INBOUND";
