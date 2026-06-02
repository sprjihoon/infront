/** 물품(parcel) 상태 라벨·필터·워크플로우 */

export const PARCEL_STATUS_LABEL: Record<string, string> = {
  PRE_REGISTERED:   "등록 완료",
  PENDING_PICKUP:   "수거 신청",
  PICKUP_CANCELLED: "수거 취소",
  PICKED_UP:        "수거 완료",
  INBOUND:          "센터 입고",
  SHIPPABLE:        "보관중 · 출고가능",
  HOLD:             "보류",
  PACKING:          "포장 중",
  PAYMENT_WAIT:     "결제 대기",
  SHIPPING:         "발송 중",
  DONE:             "완료",
};

export const PARCEL_STATUS_COLOR: Record<string, string> = {
  PRE_REGISTERED:   "text-indigo-700 bg-indigo-50 border-indigo-200",
  PENDING_PICKUP:   "text-yellow-700 bg-yellow-50 border-yellow-200",
  PICKUP_CANCELLED: "text-red-600 bg-red-50 border-red-200",
  PICKED_UP:        "text-blue-700 bg-blue-50 border-blue-200",
  INBOUND:          "text-green-700 bg-green-50 border-green-200",
  SHIPPABLE:        "text-emerald-700 bg-emerald-50 border-emerald-200",
  HOLD:             "text-red-700 bg-red-50 border-red-200",
  PACKING:          "text-orange-700 bg-orange-50 border-orange-200",
  PAYMENT_WAIT:     "text-amber-700 bg-amber-50 border-amber-200",
  SHIPPING:         "text-blue-800 bg-blue-100 border-blue-300",
  DONE:             "text-gray-600 bg-gray-50 border-gray-200",
};

/** 목록 필터 탭 — key는 URL status 파라미터 */
export const PARCEL_FILTER_TABS = [
  { key: "",                 label: "전체" },
  { key: "PRE_REGISTERED",   label: "등록완료" },
  { key: "PENDING_PICKUP",   label: "수거신청" },
  { key: "PICKED_UP",        label: "수거완료" },
  { key: "INBOUND",          label: "센터입고" },
  { key: "SHIPPABLE",        label: "보관중" },
  { key: "HOLD",             label: "보류" },
  { key: "PICKUP_CANCELLED", label: "수거취소" },
] as const;

export const INBOUND_SOURCE_TABS = [
  { key: "", label: "전체" },
  { key: "PICKUP", label: "수거신청 (우체국)" },
  { key: "DIRECT", label: "물품등록 (타택배)" },
] as const;

export const INBOUND_SOURCE_LABEL: Record<string, string> = {
  PICKUP: "수거신청",
  DIRECT: "물품등록",
};

export function parcelDisplayLabel(status: string, _isShippable?: boolean | null): string {
  return PARCEL_STATUS_LABEL[status] ?? status;
}

export function parcelDisplayColor(status: string, _isShippable?: boolean | null): string {
  return PARCEL_STATUS_COLOR[status] ?? PARCEL_STATUS_COLOR.DONE;
}

export interface ParcelWorkflowAction {
  label: string;
  description: string;
  patch: Record<string, unknown>;
}

/** 현재 상태에서 권장 다음 액션 */
export function getNextWorkflowAction(
  status: string,
  _isShippable?: boolean | null,
): ParcelWorkflowAction | null {
  const today = new Date().toISOString().slice(0, 10);

  if (status === "PENDING_PICKUP") {
    return {
      label: "수거 완료 처리",
      description: "우체국 수거가 완료되었습니다. 센터로 이동 중입니다.",
      patch: { status: "PICKED_UP" },
    };
  }
  if (status === "PICKED_UP") {
    return {
      label: "센터 입고 처리",
      description: "물품이 센터에 도착했습니다. 고객에게 입고 알림이 발송됩니다.",
      patch: { status: "INBOUND", is_shippable: false, inbound_at: today },
    };
  }
  if (status === "INBOUND") {
    return {
      label: "보관 완료 처리",
      description: "로케이션 배정 완료. 출고가능 상태로 변경합니다.",
      patch: { status: "SHIPPABLE", is_shippable: true },
    };
  }
  return null;
}

export const WORKFLOW_STEPS = [
  { key: "register",  label: "등록·수거",   statuses: ["PRE_REGISTERED", "PENDING_PICKUP", "PICKED_UP"] },
  { key: "inbound",   label: "센터 입고",   statuses: ["INBOUND"] },
  { key: "storage",   label: "보관중",      statuses: ["SHIPPABLE"] },
] as const;

export function workflowStepIndex(
  status: string,
  _isShippable?: boolean | null,
): number {
  if (["SHIPPABLE", "SHIPPING", "DONE"].includes(status)) return 2;
  if (status === "INBOUND") return 1;
  if (["PRE_REGISTERED", "PENDING_PICKUP", "PICKED_UP"].includes(status)) return 0;
  if (status === "HOLD") return 1;
  return 0;
}
