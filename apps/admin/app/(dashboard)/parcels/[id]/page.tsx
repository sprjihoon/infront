"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Save, CheckCircle, AlertTriangle, Package,
  Weight, Ruler, User, Clock, ShoppingBag,
} from "lucide-react";

interface Parcel {
  id: string;
  tracking_no: string | null;
  pickup_tracking_no: string | null;
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
  "PENDING_PICKUP", "PICKED_UP", "INBOUND", "INSPECTION",
  "PACKING", "HOLD", "PAYMENT_WAIT", "SHIPPING", "DONE",
];

const STATUS_LABEL: Record<string, string> = {
  PENDING_PICKUP: "수거 신청",
  PICKED_UP:      "수거 완료",
  INBOUND:        "입고 완료",
  INSPECTION:     "검품 중",
  PACKING:        "포장 중",
  HOLD:           "보류",
  PAYMENT_WAIT:   "결제 대기",
  SHIPPING:       "발송 중",
  DONE:           "완료",
};

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
  const [saveMsg, setSaveMsg] = useState("");

  // 편집 폼 state
  const [status, setStatus] = useState("");
  const [weight, setWeight] = useState("");
  const [volL, setVolL] = useState("");
  const [volW, setVolW] = useState("");
  const [volH, setVolH] = useState("");
  const [isShippable, setIsShippable] = useState(true);
  const [holdReason, setHoldReason] = useState("");
  const [notes, setNotes] = useState("");
  const [inboundAt, setInboundAt] = useState("");
  const [trackingNo, setTrackingNo] = useState("");

  // 검수 폼
  const [showInspection, setShowInspection] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    condition_ok: true, size_match: true, color_match: true, defect: true, authenticity_ok: true,
  });
  const [grade, setGrade] = useState("OK");
  const [inspNotes, setInspNotes] = useState("");
  const [inspecting, setInspecting] = useState(false);

  useEffect(() => {
    loadParcel();
  }, [id]);

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
    setIsShippable(p.is_shippable ?? true);
    setHoldReason(p.hold_reason ?? "");
    setNotes(p.notes ?? "");
    setInboundAt(p.inbound_at ? p.inbound_at.slice(0, 10) : "");
    setTrackingNo(p.tracking_no ?? "");
    setInspections(json.inspections ?? []);
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/parcels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaveMsg("저장되었습니다");
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

  return (
    <div className="max-w-3xl space-y-5">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link href="/parcels" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft size={18} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            물품 상세: {parcel.tracking_no ?? "미등록"}
          </h1>
          <p className="text-xs text-gray-400">{parcel.id.slice(0, 8)}…</p>
        </div>
      </div>

      {/* 고객 정보 */}
      {parcel.customers && (
        <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <User size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{parcel.customers.name}</p>
            <p className="text-xs text-gray-400">{parcel.customers.email} · {parcel.customers.customer_code}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* 편집 폼 */}
        <div className="col-span-2 lg:col-span-1 bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900">물품 정보 수정</h2>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">상태</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>
              ))}
            </select>
          </div>

          {status === "HOLD" && (
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">보류 사유</label>
              <input
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: 파손, 검수 불량"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">운송장 번호</label>
            <input
              value={trackingNo}
              onChange={(e) => setTrackingNo(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="123456789"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">실측 무게 (g)</label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 1500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">실측 크기 (cm)</label>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" value={volL} onChange={(e) => setVolL(e.target.value)} placeholder="길이" className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="number" value={volW} onChange={(e) => setVolW(e.target.value)} placeholder="너비" className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="number" value={volH} onChange={(e) => setVolH(e.target.value)} placeholder="높이" className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">입고 일자</label>
            <input
              type="date"
              value={inboundAt}
              onChange={(e) => setInboundAt(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="shippable"
              checked={isShippable}
              onChange={(e) => setIsShippable(e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            <label htmlFor="shippable" className="text-sm text-gray-700">배송 가능 물품</label>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">메모</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="내부 메모"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Save size={15} /> 저장</>
            )}
          </button>
          {saveMsg && <p className="text-sm text-green-600 text-center">{saveMsg}</p>}
        </div>

        {/* 검수 */}
        <div className="col-span-2 lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">검수 결과</h2>
              <button
                onClick={() => setShowInspection(!showInspection)}
                className="text-xs text-blue-600 font-medium px-3 py-1.5 bg-blue-50 rounded-lg"
              >
                + 검수 입력
              </button>
            </div>

            {inspections.length === 0 && !showInspection && (
              <p className="text-sm text-gray-400">아직 검수 결과가 없습니다</p>
            )}

            {inspections.map((ins) => (
              <div key={ins.id} className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    ins.grade === "OK" ? "bg-green-100 text-green-700" :
                    ins.grade === "HOLD" ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-700"
                  }`}>
                    {ins.grade === "OK" ? "정상" : ins.grade === "HOLD" ? "보류" : "반품 권장"}
                  </span>
                  <span className="text-xs text-gray-400">{new Date(ins.inspected_at).toLocaleDateString("ko-KR")}</span>
                </div>
                <div className="space-y-1">
                  {CHECKLIST_ITEMS.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-1.5 text-xs">
                      {ins.checklist[key] ? (
                        <CheckCircle size={12} className="text-green-500" />
                      ) : (
                        <AlertTriangle size={12} className="text-red-400" />
                      )}
                      <span className="text-gray-600">{label}</span>
                    </div>
                  ))}
                </div>
                {ins.notes && <p className="text-xs text-gray-500 mt-2 border-t pt-2">{ins.notes}</p>}
              </div>
            ))}

            {showInspection && (
              <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/50 space-y-3">
                <p className="text-sm font-medium text-gray-800">검수 체크리스트</p>
                {CHECKLIST_ITEMS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={key}
                      checked={checklist[key]}
                      onChange={(e) => setChecklist((prev) => ({ ...prev, [key]: e.target.checked }))}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <label htmlFor={key} className="text-sm text-gray-700">{label}</label>
                  </div>
                ))}

                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">종합 등급</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="OK">정상</option>
                    <option value="HOLD">보류</option>
                    <option value="RETURN_RECOMMENDED">반품 권장</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">검수 메모</label>
                  <textarea
                    value={inspNotes}
                    onChange={(e) => setInspNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
                    placeholder="특이사항 기입"
                  />
                </div>

                <button
                  onClick={handleInspection}
                  disabled={inspecting}
                  className="w-full bg-green-600 text-white font-semibold py-2.5 rounded-lg text-sm flex items-center justify-center gap-1.5"
                >
                  {inspecting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><CheckCircle size={14} /> 검수 완료 처리</>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
