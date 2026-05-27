"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Save, CheckCircle, AlertTriangle, Package,
  User, ChevronRight, Truck, RefreshCw,
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
  customers: { name: string; email: string; customer_code: string } | null;
}

interface InspectionResult {
  id: string;
  grade: string;
  checklist: Record<string, boolean>;
  notes: string | null;
  inspected_at: string;
}

const STATUS_OPTIONS = [
  "PRE_REGISTERED", "PENDING_PICKUP", "PICKED_UP", "INBOUND", "INSPECTION",
  "PACKING", "HOLD", "PAYMENT_WAIT", "SHIPPING", "DONE",
];

const CHECKLIST_ITEMS = [
  { key: "condition_ok",    label: "전반적 상태 양호" },
  { key: "size_match",      label: "사이즈 일치" },
  { key: "color_match",     label: "색상 일치" },
  { key: "defect",          label: "결함 없음" },
  { key: "authenticity_ok", label: "정품 확인" },
];

export default function ParcelDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [inspections, setInspections] = useState<InspectionResult[]>([]);
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

  const [showInspection, setShowInspection] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    condition_ok: true, size_match: true, color_match: true, defect: true, authenticity_ok: true,
  });
  const [grade, setGrade] = useState("OK");
  const [inspNotes, setInspNotes] = useState("");
  const [inspecting, setInspecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { loadParcel(); }, [id]);

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
    setInspections(json.inspections ?? []);
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
    // 센터 입고(INBOUND)는 기본 검수 전 — 출고가능은 체크박스로만
    if (status === "INBOUND" && !isShippable) {
      payload.is_shippable = false;
    }
    if (status === "INSPECTION") {
      payload.is_shippable = false;
    }
    const ok = await patchParcel(payload);
    if (!ok) setSaveMsg("저장에 실패했습니다. 다시 시도해 주세요.");
    setSaving(false);
  }

  function handleStatusChange(next: string) {
    setStatus(next);
    if (next === "INBOUND" || next === "INSPECTION") {
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

  async function handleInspection() {
    setInspecting(true);
    const res = await fetch(`/api/parcels/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "inspection", checklist, grade, notes: inspNotes }),
    });
    setInspecting(false);
    if (res.ok) {
      setShowInspection(false);
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

        {parcel.status === "INSPECTION" && !showInspection && (
          <button
            onClick={() => setShowInspection(true)}
            className="w-full mt-2 bg-purple-600 text-white font-semibold py-3 rounded-xl"
          >
            검수 결과 입력
          </button>
        )}

        {parcel.status === "INBOUND" && parcel.is_shippable === true && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800">
            <CheckCircle size={16} />
            입고 완료 — 고객이 출고 신청할 수 있습니다
          </div>
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

      {/* 검수 폼 */}
      {showInspection && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-purple-200 space-y-3">
          <h2 className="font-semibold text-gray-900">검수 입력</h2>
          <p className="text-xs text-gray-500">무게·크기를 먼저 입력한 뒤 검수를 완료하세요.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">실측 무게 (g)</label>
              <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="grid grid-cols-3 gap-1 col-span-2">
              <input type="number" value={volL} onChange={(e) => setVolL(e.target.value)} placeholder="L" className="px-2 py-2 border rounded-lg text-sm" />
              <input type="number" value={volW} onChange={(e) => setVolW(e.target.value)} placeholder="W" className="px-2 py-2 border rounded-lg text-sm" />
              <input type="number" value={volH} onChange={(e) => setVolH(e.target.value)} placeholder="H" className="px-2 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          {CHECKLIST_ITEMS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <input type="checkbox" id={key} checked={checklist[key]}
                onChange={(e) => setChecklist((p) => ({ ...p, [key]: e.target.checked }))}
                className="w-4 h-4 accent-blue-600" />
              <label htmlFor={key} className="text-sm text-gray-700">{label}</label>
            </div>
          ))}
          <select value={grade} onChange={(e) => setGrade(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
            <option value="OK">정상 — 입고 완료 (출고 가능)</option>
            <option value="HOLD">보류</option>
            <option value="RETURN_RECOMMENDED">반품 권장</option>
          </select>
          <textarea value={inspNotes} onChange={(e) => setInspNotes(e.target.value)} rows={2}
            className="w-full px-3 py-2 border rounded-lg text-sm resize-none" placeholder="검수 메모" />
          <div className="flex gap-2">
            <button onClick={() => setShowInspection(false)} className="flex-1 py-2.5 border rounded-lg text-sm">취소</button>
            <button onClick={handleInspection} disabled={inspecting}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold disabled:opacity-60">
              {inspecting ? "처리 중…" : "검수 완료"}
            </button>
          </div>
        </div>
      )}

      {/* 검수 이력 */}
      {inspections.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <h2 className="font-semibold text-gray-900">검수 이력</h2>
          {inspections.map((ins) => (
            <div key={ins.id} className="border border-gray-100 rounded-xl p-3">
              <div className="flex justify-between mb-1">
                <span className="text-xs font-medium">{ins.grade === "OK" ? "정상" : ins.grade}</span>
                <span className="text-xs text-gray-400">{new Date(ins.inspected_at).toLocaleDateString("ko-KR")}</span>
              </div>
              {ins.notes && <p className="text-xs text-gray-500">{ins.notes}</p>}
            </div>
          ))}
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
