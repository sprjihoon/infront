/**
 * 고객 스토리지·수거/반송 액션 규칙 (입고 전 취소 숨김, 입고 후 반송).
 */

export type ParcelLifecycleInput = {
  status: string;
  inbound_at?: string | null;
};

/** 홈·스토리지 등 고객 UI에 노출할 소포인지 */
export function isParcelVisibleToCustomer(parcel: ParcelLifecycleInput): boolean {
  if (parcel.status === "DONE") return false;
  // 입고·결제 전 수거 취소 — 고객에게 보여줄 실질 정보 없음
  if (parcel.status === "PICKUP_CANCELLED" && !parcel.inbound_at) return false;
  return true;
}

/** 우체국 수거 예약 취소 (집배원 방문 전) */
export function canCancelPickupRequest(status: string): boolean {
  return status === "PENDING_PICKUP";
}

/** 창고 입고 후 반품(반송) 신청 */
export function canRequestParcelReturn(status: string): boolean {
  return ["INBOUND", "INSPECTION", "HOLD"].includes(status);
}
