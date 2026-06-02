"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Save, CheckCircle, AlertTriangle, Package,
  User, ChevronRight, Truck, RefreshCw, XCircle, RotateCcw,
  MapPin, ArrowRightLeft, Clock, ArrowRight,
} from "lucide-react";
import {
  getNextWorkflowAction,
  parcelDisplayColor,
  parcelDisplayLabel,
  PARCEL_STATUS_LABEL,
  workflowStepIndex,
  WORKFLOW_STEPS,
  INBOUND_SOURCE_LABEL,
} from "@/lib/parcel-status";
import { resolveInboundSource } from "@/lib/parcels/inbound-sync";

interface Parcel {
  id: string;
  tracking_no: string | null;
  pickup_tracking_no: string | null;
  pickup_date: string | null;
  epost_req_no: string | null;
  status: string;
  sender_name: string | null;
  sender_address: string | null;
  sender_phone: string | null;
  weight_actual: number | null;
  vol_length: number | null;
  vol_width: number | null;
  vol_height: number | null;
  is_shippable: boolean | null;
  hold_reason: string | null;
  notes: string | null;
  inbound_at: string | null;
  created_at: string;
  epost_order_no: string | null;
  inbound_source: string | null;
  courier: string | null;
  tracking_status: string | null;
  tracking_last_event: { statusLabel?: string; description?: string; location?: string; time?: string } | null;
  tracking_events: Array<{ statusLabel?: string; description?: string; location?: string; time?: string }> | null;
  tracking_synced_at: string | null;
  customers: { name: string; email: string; customer_code: string; id: string } | null;
  storage_location_id: string | null;
  storage_locations: { id: string; code: string; zone: string; slot: string } | null;
}

const STATUS_OPTIONS = [
  "PRE_REGISTERED", "PENDING_PICKUP", "PICKED_UP", "INBOUND",
  "SHIPPABLE", "HOLD", "PACKING", "PAYMENT_WAIT", "SHIPPING", "DONE",
];

export default function ParcelDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [status, setStatus] = useState("");
  const [weight, setWeight] = useState("");
  const [volL, setVolL] = useState("");
  const [volW, setVolW] = useState("");
  const [volH, setVolH] = useState("");
  const [isShippable, setIsShippable] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [notes, setNotes] = useState("");
  const [inboundAt, setInboundAt] = useState("");
  const [trackingNo, setTrackingNo] = useState("");

  const [syncing, setSyncing] = useState(false);

  // 로케이션 배정
  const [availableLocations, setAvailableLocations] = useState<{ id: string; code: string; zone: string; is_temp: boolean }[]>([]);
  const [locationsLoaded, setLocationsLoaded] = useState(false);
  const [showLocPicker, setShowLocPicker] = useState(false);
  const [assigningLoc, setAssigningLoc] = useState(false);

  // 위치 이동 이력 (최근 3단계)
  type LocationEvent = {
    id: string;
    reason: string;
    notes: string | null;
    created_by: string | null;
    created_at: string;
    from_location: { id: string; code: string; zone: string; is_temp: boolean } | null;
    to_location: { id: string; code: string; zone: string; is_temp: boolean } | null;
  };
  const [locationHistory, setLocationHistory] = useState<LocationEvent[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => { loadParcel(); loadLocationHistory(); }, [id]);

  async function loadLocationHistory() {
    const res = await fetch(`/api/admin/parcels/${id}/location-history`);
    if (res.ok) {
      const json = await res.json();
      setLocationHistory(json.history ?? []);
    }
    setHistoryLoaded(true);
  }

  async function loadParcel() {
    const res = await fetch(`/api/admin/parcels/${id}`);
    if (!res.ok) { router.push("/parcels"); return; }
    const json = await res.json();
    const p = json.parcel as Parcel;
    setParcel(p);
    setStatus(p.status);
    setWeight(p.weight_actual?.toString() ?? "");
    setVolL(p.vol_length?.toString() ?? "");
    setVolW(p.vol_width?.toString() ?? "");
    setVolH(p.vol_height?.toString() ?? "");
    setIsShippable(p.is_shippable === true);
    setHoldReason(p.hold_reason ?? "");
    setNotes(p.notes ?? "");
    setInboundAt(p.inbound_at ? p.inbound_at.slice(0, 10) : "");
    setTrackingNo(p.tracking_no ?? "");
    setLoading(false);
  }

  async function patchParcel(body: Record<string, unknown>) {
    setActioning(true);
    const res = await fetch(`/api/parcels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setActioning(false);
    if (res.ok) {
      setSaveMsg("처리되었습니다");
      setTimeout(() => setSaveMsg(""), 3000);
      loadParcel();
    } else {
      const json = await res.json().catch(() => ({}));
      setSaveMsg(json.error ?? "저장에 실패했습니다");
    }
    return res.ok;
  }

  async function handleSave() {
    setSaving(true);
    setSaveMsg("");
    const payload: Record<string, unknown> = {
      status,
      weight_actual: weight ? parseInt(weight) : null,
      vol_length: volL ? parseFloat(volL) : null,
      vol_width: volW ? parseFloat(volW) : null,
      vol_height: volH ? parseFloat(volH) : null,
      is_shippable: isShippable,
      hold_reason: holdReason || null,
      notes: notes || null,
      inbound_at: inboundAt || null,
      tracking_no: trackingNo || null,
    };
    // SHIPPABLE = 보관중·출고가능
    if (status === "SHIPPABLE") {
      payload.is_shippable = true;
    }
    if (status === "INBOUND") {
      payload.is_shippable = false;
    }
    const ok = await patchParcel(payload);
    if (!ok) setSaveMsg("저장에 실패했습니다. 다시 시도해 주세요.");
    setSaving(false);
  }

  function handleStatusChange(next: string) {
    setStatus(next);
    if (next === "SHIPPABLE") {
      setIsShippable(true);
    } else if (next === "INBOUND") {
      setIsShippable(false);
    }
  }

  async function handleWorkflowAction() {
    if (!parcel) return;
    const action = getNextWorkflowAction(parcel.status, parcel.is_shippable);
    if (!action) return;
    if (!confirm(`${action.label} 하시겠습니까?\n${action.description}`)) return;
    await patchParcel(action.patch);
  }

  async function handleCancel() {
    if (!parcel) return;
    const reason = prompt("취소/보류 사유를 입력하세요 (선택)") ?? "";
    if (reason === null) return; // 취소 누름
    const isPickupPending = parcel.status === "PENDING_PICKUP";
    const newStatus = isPickupPending ? "PICKUP_CANCELLED" : "HOLD";
    const holdReason = reason.trim() || (isPickupPending ? "관리자 취소" : "관리자 보류 처리");
    await patchParcel({ status: newStatus, hold_reason: holdReason, is_shippable: false });
  }

  async function handleReopen() {
    if (!parcel) return;
    if (!confirm("재접수 처리하시겠습니까? 상태를 '보관중'으로 되돌립니다.")) return;
    await patchParcel({ status: "SHIPPABLE", is_shippable: true, hold_reason: null });
  }

  async function loadAvailableLocations(customerId?: string) {
    const res = await fetch("/api/admin/storage/list");
    const json = await res.json();
    const all = (json.locations ?? []) as { id: string; code: string; zone: string; status: string; customer_id: string | null; is_temp: boolean }[];

    // 고객의 기존 로케이션 먼저, 그 다음 빈 로케이션, 임시보관 마지막
    const customerLoc = customerId ? all.filter((l) => l.customer_id === customerId && !l.is_temp) : [];
    const available   = all.filter((l) => l.status === "AVAILABLE" && !l.is_temp);
    const tempLocs    = all.filter((l) => l.is_temp && l.status !== "DISABLED");
    const combined = [
      ...customerLoc,
      ...available.filter((l) => !customerLoc.find((cl) => cl.id === l.id)),
      ...tempLocs,
    ];
    setAvailableLocations(combined.map(({ id, code, zone, is_temp }) => ({ id, code, zone, is_temp: !!is_temp })));
    setLocationsLoaded(true);
  }

  async function handleAssignLocation(locationId: string, isTemp = false) {
    setAssigningLoc(true);
    const hasCurrentLoc = !!parcel?.storage_location_id;
    const reason = isTemp ? "TEMP_OUT" : hasCurrentLoc ? "TRANSFER" : "MANUAL";

    if (hasCurrentLoc) {
      // 이동 이력 기록 포함 이동
      const res = await fetch(`/api/admin/parcels/${id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_location_id: locationId, reason }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setSaveMsg(json.error ?? "이동 실패");
      }
    } else {
      // 최초 배정: 기존 방식 유지
      await patchParcel({ storage_location_id: locationId });
      if (parcel?.customers?.id) {
        await fetch(`/api/admin/storage/${locationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "assign", customer_id: parcel.customers.id }),
        });
      }
    }

    setAssigningLoc(false);
    setShowLocPicker(false);
    await loadParcel();
    await loadLocationHistory();
  }

  async function handleApiSync() {
    setSyncing(true);
    const res = await fetch("/api/admin/parcels/sync-inbound", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parcel_id: id }),
    });
    setSyncing(false);
    if (res.ok) {
      setSaveMsg("API 동기화 완료");
      setTimeout(() => setSaveMsg(""), 3000);
      loadParcel();
    }
  }

  if (loading || !parcel) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const nextAction = getNextWorkflowAction(parcel.status, parcel.is_shippable);
  const stepIdx = workflowStepIndex(parcel.status, parcel.is_shippable);
  const statusLabel = parcelDisplayLabel(parcel.status, parcel.is_shippable);
  const statusColor = parcelDisplayColor(parcel.status, parcel.is_shippable);
  const inboundSrc = resolveInboundSource(parcel);
  const events = parcel.tracking_events ?? [];

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/parcels" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft size={18} className="text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">
            {parcel.tracking_no ?? parcel.pickup_tracking_no ?? "미등록 송장"}
          </h1>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusColor}`}>
            {statusLabel}
          </span>
          <span className={`ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            inboundSrc === "PICKUP" ? "bg-yellow-100 text-yellow-800" : "bg-indigo-100 text-indigo-800"
          }`}>
            {INBOUND_SOURCE_LABEL[inboundSrc]}
          </span>
        </div>
        <button
          type="button"
          onClick={handleApiSync}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg disabled:opacity-60"
        >
          {syncing ? <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /> : <RefreshCw size={14} />}
          API 동기화
        </button>
      </div>

      {saveMsg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
          <CheckCircle size={16} /> {saveMsg}
        </div>
      )}

      {parcel.customers && (
        <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <User size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{parcel.customers.name}</p>
              <p className="text-xs text-gray-400">{parcel.customers.email} · {parcel.customers.customer_code}</p>
            </div>
          </div>
          <Link
            href={`/customers/${encodeURIComponent(parcel.customers.customer_code)}`}
            className="text-xs text-blue-600 flex items-center gap-0.5"
          >
            고객 보기 <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* 보관 로케이션 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-indigo-500" />
            <span className="font-semibold text-gray-800 text-sm">보관 위치</span>
          </div>
          <button
            onClick={() => {
              setShowLocPicker(!showLocPicker);
              if (!locationsLoaded) loadAvailableLocations(parcel.customers?.id);
            }}
            className="text-xs text-indigo-600 hover:underline"
          >
            {parcel.storage_locations ? "이동/변경" : "배정"}
          </button>
        </div>

        {parcel.storage_locations ? (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-indigo-100 rounded-xl px-4 py-2 text-center">
              <p className="text-lg font-bold text-indigo-700">{parcel.storage_locations.code}</p>
              <p className="text-[10px] text-indigo-400">구역 {parcel.storage_locations.zone} · {parcel.storage_locations.slot}</p>
            </div>
            <Link href={`/storage/${parcel.storage_locations.id}`} className="text-xs text-indigo-600 hover:underline">
              로케이션 상세 →
            </Link>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">배정된 로케이션 없음</p>
        )}

        {showLocPicker && (
          <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
            <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
              이동할 로케이션 선택 (이력 자동 기록)
            </div>
            {!locationsLoaded ? (
              <div className="p-3 text-xs text-gray-400">로딩 중…</div>
            ) : availableLocations.length === 0 ? (
              <div className="p-3 text-xs text-gray-400">사용 가능한 로케이션이 없습니다</div>
            ) : (
              availableLocations.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => handleAssignLocation(loc.id, loc.is_temp)}
                  disabled={assigningLoc}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-indigo-50 text-sm text-left border-b last:border-b-0 border-gray-50 disabled:opacity-50"
                >
                  <span className="font-mono font-bold text-gray-800">{loc.code}</span>
                  {loc.is_temp ? (
                    <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">임시보관</span>
                  ) : (
                    <span className="text-xs text-gray-400">구역 {loc.zone}</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}

        {/* 위치 이동 이력 (최근 3단계) */}
        {historyLoaded && locationHistory.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock size={12} className="text-gray-400" />
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">이동 이력 (최근 {locationHistory.length}단계)</span>
            </div>
            <div className="space-y-1.5">
              {locationHistory.map((ev, i) => {
                const reasonLabel: Record<string, string> = {
                  INBOUND: "입고 배정",
                  TRANSFER: "이동",
                  TEMP_OUT: "임시 반출",
                  RETURN: "복귀",
                  FORCE_CLEAR: "강제 비우기",
                  MANUAL: "수동 이동",
                };
                return (
                  <div key={ev.id} className={`flex items-center gap-2 text-xs ${i === 0 ? "text-gray-700" : "text-gray-400"}`}>
                    <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      ev.reason === "FORCE_CLEAR" ? "bg-red-100 text-red-700" :
                      ev.reason === "TEMP_OUT"    ? "bg-orange-100 text-orange-700" :
                      ev.reason === "RETURN"      ? "bg-green-100 text-green-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {reasonLabel[ev.reason] ?? ev.reason}
                    </span>
                    <span className="font-mono">{ev.from_location?.code ?? "—"}</span>
                    <ArrowRight size={11} className="shrink-0 text-gray-300" />
                    <span className="font-mono font-semibold">{ev.to_location?.code ?? "—"}</span>
                    <span className="text-gray-300 ml-auto shrink-0">
                      {new Date(ev.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 진행 단계 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-4">처리 단계</h2>
        <div className="flex items-center gap-1 mb-4">
          {WORKFLOW_STEPS.map((step, i) => (
            <div key={step.key} className="flex items-center flex-1 min-w-0">
              <div className={`flex flex-col items-center flex-1 ${i <= stepIdx ? "opacity-100" : "opacity-40"}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  i < stepIdx ? "bg-green-500 text-white" :
                  i === stepIdx ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
                }`}>
                  {i < stepIdx ? "✓" : i + 1}
                </div>
                <p className="text-[10px] text-gray-500 mt-1 text-center leading-tight">{step.label}</p>
              </div>
              {i < WORKFLOW_STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-0.5 ${i < stepIdx ? "bg-green-400" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        {parcel.status === "PENDING_PICKUP" && (
          <div className="text-xs text-gray-500 bg-yellow-50 border border-yellow-100 rounded-lg p-3 mb-3">
            <Truck size={14} className="inline mr-1" />
            수거 희망일: {parcel.pickup_date ? new Date(parcel.pickup_date).toLocaleDateString("ko-KR") : "-"}
            {parcel.epost_req_no && ` · 우체국 접수: ${parcel.epost_req_no}`}
            {parcel.epost_order_no && ` · 주문번호: ${parcel.epost_order_no}`}
          </div>
        )}

        {parcel.courier && inboundSrc === "DIRECT" && (
          <div className="text-xs text-gray-500 bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-3">
            {parcel.courier} · 운송장 {parcel.tracking_no}
            {parcel.tracking_synced_at && (
              <span className="text-gray-400"> · 동기화 {new Date(parcel.tracking_synced_at).toLocaleString("ko-KR")}</span>
            )}
          </div>
        )}

        {nextAction && (
          <button
            onClick={handleWorkflowAction}
            disabled={actioning}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {actioning ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              nextAction.label
            )}
          </button>
        )}

        {parcel.status === "SHIPPABLE" && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800">
            <CheckCircle size={16} />
            보관중 · 출고 신청 가능합니다
          </div>
        )}

        {/* 취소 / 재접수 버튼 */}
        {!["PICKUP_CANCELLED", "DONE", "SHIPPING"].includes(parcel.status) && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCancel}
              disabled={actioning}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <XCircle size={14} />
              {parcel.status === "PENDING_PICKUP" ? "수거 취소" : "보류/취소 처리"}
            </button>
          </div>
        )}
        {["PICKUP_CANCELLED", "HOLD"].includes(parcel.status) && (
          <button
            onClick={handleReopen}
            disabled={actioning}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-indigo-200 text-indigo-700 text-sm font-semibold bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-50"
          >
            <RotateCcw size={14} />
            재접수 처리 (보관중으로 되돌리기)
          </button>
        )}
      </div>

      {events.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-3">배송 추적 (API)</h2>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {events.slice(0, 10).map((ev, i) => (
              <div key={i} className="text-xs border-l-2 border-gray-200 pl-3 py-1">
                <p className="font-medium text-gray-800">{ev.statusLabel ?? ev.description}</p>
                <p className="text-gray-400">{ev.location} · {ev.time ? new Date(ev.time).toLocaleString("ko-KR") : ""}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 고급 편집 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-5 py-3 flex items-center justify-between text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          고급 편집 (상태·메모 직접 수정)
          <ChevronRight size={16} className={`transition-transform ${showAdvanced ? "rotate-90" : ""}`} />
        </button>
        {showAdvanced && (
          <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">상태</label>
              <select value={status} onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full px-3 py-2.5 border rounded-xl text-sm bg-white">
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{PARCEL_STATUS_LABEL[s] ?? s}</option>
                ))}
              </select>
              {status === "INBOUND" && (
                <p className="text-[11px] text-gray-400 mt-1">
                  「센터 입고」는 검수 전 단계입니다. 출고 가능은 아래 체크박스 또는 검수 완료로 설정하세요.
                </p>
              )}
            </div>
            {status === "HOLD" && (
              <input value={holdReason} onChange={(e) => setHoldReason(e.target.value)}
                placeholder="보류 사유" className="w-full px-3 py-2.5 border rounded-xl text-sm" />
            )}
            <input value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)}
              placeholder="운송장 번호" className="w-full px-3 py-2.5 border rounded-xl text-sm" />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="내부 메모" className="w-full px-3 py-2.5 border rounded-xl text-sm resize-none" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isShippable} onChange={(e) => setIsShippable(e.target.checked)} className="w-4 h-4" />
              입고 완료 · 출고 가능 (검수 완료 후)
            </label>
            <button onClick={handleSave} disabled={saving}
              className="w-full bg-gray-800 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60">
              <Save size={15} /> 저장
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
