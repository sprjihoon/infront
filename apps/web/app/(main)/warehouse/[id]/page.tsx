"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Package, Truck, MapPin, Weight, Ruler,
  AlertTriangle, CheckCircle, Clock, Play, Image as ImageIcon,
  RotateCcw, Send, Navigation, RefreshCw,
  Edit3, X, Check, Plus, Trash2, Lock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TRACKING_STATUS } from "@/lib/tracking/client";
import ItemCategoryPicker from "@/components/ui/ItemCategoryPicker";
import type { ItemCategory } from "@/lib/item-categories";

interface Parcel {
  id: string;
  tracking_no: string | null;
  pickup_tracking_no: string | null;
  courier: string | null;
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
  // 추적
  tracking_status: string | null;
  tracking_last_event: TrackingEvent | null;
  tracking_events: TrackingEvent[] | null;
  tracking_synced_at: string | null;
  // 인보이스
  item_condition: string | null;
  pre_invoice_items: InvoiceItem[] | null;
}

interface TrackingEvent {
  time: string;
  statusCode: string;
  statusLabel: string;
  description: string;
  location: string;
}

interface InvoiceItem {
  product_name?: string;
  name_en: string;
  quantity: number;
  unit_price_usd: number;
  origin_country: string;
  hs_code?: string;
  _isCustom?: boolean;
}

function newInvoiceItem(): InvoiceItem {
  return { name_en: "", quantity: 1, unit_price_usd: 0, origin_country: "KR", hs_code: "" };
}



interface ParcelMedia {
  id: string;
  stage: string;
  type: string;
  storage_url: string;
  cf_thumbnail_url: string | null;
  cf_hls_url: string | null;
  caption: string | null;
  created_at: string;
}

interface InspectionResult {
  id: string;
  grade: string;
  checklist: Record<string, unknown>;
  notes: string | null;
  inspected_at: string;
}

interface LinkedOrder {
  order_id: string;
  orders: { order_no: string; status: string; created_at: string } | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; step: number }> = {
  PRE_REGISTERED:    { label: "등록 완료",    color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200",   step: 0 },
  PENDING_PICKUP:    { label: "수거 신청 완료", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200", step: 1 },
  PICKUP_CANCELLED:  { label: "수거 취소",    color: "text-red-600",    bg: "bg-red-50 border-red-200",         step: 0 },
  PICKED_UP:         { label: "수거 완료",    color: "text-blue-700",   bg: "bg-blue-50 border-blue-200",       step: 2 },
  INBOUND:         { label: "창고 입고",       color: "text-green-700",  bg: "bg-green-50 border-green-200",   step: 3 },
  INSPECTION:      { label: "검품 진행 중",    color: "text-purple-700", bg: "bg-purple-50 border-purple-200", step: 4 },
  PACKING:         { label: "포장 작업 중",    color: "text-orange-700", bg: "bg-orange-50 border-orange-200", step: 5 },
  HOLD:            { label: "보류",            color: "text-red-700",    bg: "bg-red-50 border-red-200",       step: 3 },
  PAYMENT_WAIT:    { label: "결제 대기",       color: "text-amber-700",  bg: "bg-amber-50 border-amber-200",   step: 5 },
  SHIPPING:        { label: "국제 발송 중",    color: "text-blue-800",   bg: "bg-blue-100 border-blue-300",    step: 6 },
  DONE:            { label: "배송 완료",       color: "text-gray-700",   bg: "bg-gray-50 border-gray-200",     step: 7 },
};

const STAGE_LABEL: Record<string, string> = {
  INBOUND_VIDEO:    "입고 영상",
  INSPECTION_PHOTO: "검수 사진",
  PACKAGING_PHOTO:  "포장 사진",
  OUTBOUND_VIDEO:   "발송 영상",
};

const GRADE_CONFIG: Record<string, { label: string; color: string }> = {
  OK:                   { label: "정상", color: "text-green-700 bg-green-100" },
  HOLD:                 { label: "보류", color: "text-yellow-700 bg-yellow-100" },
  RETURN_RECOMMENDED:   { label: "반품 권장", color: "text-red-700 bg-red-100" },
};

const SHIPPABLE_STATUSES = new Set(["INBOUND", "INSPECTION"]);
const RETURNABLE_STATUSES = new Set(["INBOUND", "INSPECTION", "HOLD"]);

export default function ParcelDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const parcelId = params.id;

  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [media, setMedia] = useState<ParcelMedia[]>([]);
  const [inspection, setInspection] = useState<InspectionResult | null>(null);
  const [linkedOrders, setLinkedOrders] = useState<LinkedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<ParcelMedia | null>(null);

  // 편집 모드
  const [editingItems, setEditingItems] = useState(false);
  const [editingTracking, setEditingTracking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // 물품 편집 임시 상태
  const [editCondition, setEditCondition] = useState<"NEW" | "USED">("NEW");
  const [editItems, setEditItems] = useState<InvoiceItem[]>([]);

  // 송장번호 편집 임시 상태
  const [editTracking, setEditTracking] = useState("");
  const [editCourier, setEditCourier] = useState("");

  // 수거 취소 확인 모달
  const [showCancelPickup, setShowCancelPickup] = useState(false);
  const [cancellingPickup, setCancellingPickup] = useState(false);


  const loadData = useCallback(async () => {
    if (!parcelId) return;
    const supabase = createClient();

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const [
      { data: parcelData },
      { data: mediaData },
      { data: inspData },
      { data: orderData },
    ] = await Promise.all([
      supabase.from("parcels").select("*").eq("id", parcelId).eq("customer_id", user.id).maybeSingle(),
      supabase.from("parcel_media").select("*").eq("parcel_id", parcelId).order("created_at"),
      supabase.from("inspection_results").select("*").eq("parcel_id", parcelId).order("inspected_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("order_parcels").select("order_id, orders(order_no, status, created_at)").eq("parcel_id", parcelId),
    ]);

    if (!parcelData) { router.push("/warehouse"); return; }
    setParcel(parcelData);
    setMedia(mediaData ?? []);
    setInspection(inspData ?? null);
    setLinkedOrders(orderData as unknown as LinkedOrder[] ?? []);
    setLoading(false);
  }, [parcelId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function cancelPickup() {
    if (!parcel) return;
    setCancellingPickup(true);
    const res = await fetch(`/api/pickup/${parcel.id}`, { method: "DELETE" });
    setCancellingPickup(false);
    if (res.ok) {
      setShowCancelPickup(false);
      loadData();
    } else {
      const j = await res.json().catch(() => ({})) as { error?: string };
      alert(j.error ?? "취소에 실패했습니다. 다시 시도해주세요.");
    }
  }

  async function refreshTracking() {
    if (syncing) return;
    setSyncing(true);
    try {
      await fetch("/api/parcels/sync-tracking", { method: "POST" });
    } catch {}
    await loadData();
    setSyncing(false);
  }

  function openEditItems(p: Parcel) {
    setEditCondition((p.item_condition as "NEW" | "USED") ?? "NEW");
    setEditItems(
      (p.pre_invoice_items ?? []).length > 0
        ? p.pre_invoice_items!.map(i => ({ ...i }))
        : [newInvoiceItem()]
    );
    setEditError("");
    setEditingItems(true);
  }

  function openEditTracking(p: Parcel) {
    setEditTracking(p.tracking_no ?? "");
    setEditCourier(p.courier ?? "");
    setEditError("");
    setEditingTracking(true);
  }

  async function saveItems() {
    if (!parcel) return;
    const items = editItems.filter(i => i.name_en.trim());
    if (items.length === 0) { setEditError("품목명을 입력해주세요"); return; }
    setSaving(true); setEditError("");
    const res = await fetch(`/api/parcels/${parcel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_condition: editCondition,
        pre_invoice_items: items.map(({ _isCustom: _, ...rest }) => rest),
      }),
    });
    setSaving(false);
    if (!res.ok) { const j = await res.json(); setEditError(j.error ?? "오류가 발생했습니다"); return; }
    setEditingItems(false);
    loadData();
  }

  async function saveTracking() {
    if (!parcel) return;
    if (!editTracking.trim()) { setEditError("송장번호를 입력해주세요"); return; }
    setSaving(true); setEditError("");
    const res = await fetch(`/api/parcels/${parcel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tracking_no: editTracking.trim(),
        courier: editCourier.trim() || null,
      }),
    });
    setSaving(false);
    if (!res.ok) { const j = await res.json(); setEditError(j.error ?? "오류가 발생했습니다"); return; }
    setEditingTracking(false);
    loadData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!parcel) return null;

  const statusCfg = STATUS_CONFIG[parcel.status] ?? { label: parcel.status, color: "text-gray-700", bg: "bg-gray-50 border-gray-200", step: 0 };
  const linkedActiveOrder = (linkedOrders ?? []).find(
    (lo) => lo.orders && !["CANCELLED", "DELIVERED"].includes(lo.orders.status)
  );
  const canShip =
    SHIPPABLE_STATUSES.has(parcel.status) &&
    parcel.is_shippable !== false &&
    !linkedActiveOrder;
  const canReturn = RETURNABLE_STATUSES.has(parcel.status);
  const canEdit = ["PRE_REGISTERED", "PENDING_PICKUP", "PICKED_UP"].includes(parcel.status);
  // 제품명·가격은 SHIPPING·DONE 전 단계까지 고객이 수정 가능
  const canEditItems = !["SHIPPING", "DONE"].includes(parcel.status);

  const mediaByStage = media.reduce<Record<string, ParcelMedia[]>>((acc, m) => {
    (acc[m.stage] = acc[m.stage] ?? []).push(m);
    return acc;
  }, {});

  return (
    <div className="px-4 py-5 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 -ml-2 active:scale-90 transition-transform">
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">물품 상세</h1>
      </div>

      {/* 상태 카드 */}
      <div className={`border rounded-2xl p-4 ${statusCfg.bg}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-lg font-bold ${statusCfg.color}`}>{statusCfg.label}</p>
            {parcel.hold_reason && (
              <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                <AlertTriangle size={14} /> {parcel.hold_reason}
              </p>
            )}
          </div>
          {parcel.is_shippable === false && parcel.status !== "HOLD" && (
            <span className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-medium">
              배송 불가
            </span>
          )}
        </div>
      </div>

      {/* 국내 배송 추적 (PRE_REGISTERED / PENDING_PICKUP 단계) */}
      {parcel.status === "PRE_REGISTERED" && (
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Navigation size={15} className="text-blue-500" />
              국내 배송 추적
            </h2>
            <div className="flex items-center gap-2">
              {parcel.tracking_synced_at && (
                <span className="text-xs text-gray-400">
                  {new Date(parcel.tracking_synced_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준
                </span>
              )}
              <button
                onClick={refreshTracking}
                disabled={syncing}
                className="p-1 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                title="추적 정보 새로고침"
              >
                <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* 진행 단계 바 */}
          <TrackingProgressBar statusCode={parcel.tracking_status} />

          {parcel.tracking_last_event ? (
            <>
              {/* 최신 이벤트 강조 */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold ${TRACKING_STATUS[parcel.tracking_last_event.statusCode]?.color ?? "text-gray-600"}`}>
                    {parcel.tracking_last_event.statusLabel || TRACKING_STATUS[parcel.tracking_last_event.statusCode]?.label || parcel.tracking_last_event.statusCode}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(parcel.tracking_last_event.time).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{parcel.tracking_last_event.description}</p>
                {parcel.tracking_last_event.location && (
                  <p className="text-xs text-gray-400 mt-0.5">📍 {parcel.tracking_last_event.location}</p>
                )}
              </div>

              {/* 전체 이벤트 (접기/펼치기는 생략, 최근 5개) */}
              {parcel.tracking_events && parcel.tracking_events.length > 1 && (
                <div className="space-y-0">
                  {parcel.tracking_events.slice(0, 6).map((ev, idx) => (
                    <div key={idx} className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
                      <div className="flex flex-col items-center mt-1 shrink-0">
                        <div className={`w-2 h-2 rounded-full ${idx === 0 ? "bg-blue-500" : "bg-gray-200"}`} />
                        {idx < (parcel.tracking_events?.length ?? 0) - 1 && (
                          <div className="w-px flex-1 bg-gray-100 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700">{ev.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {ev.location && <span className="text-xs text-gray-400">{ev.location}</span>}
                          <span className="text-xs text-gray-300">
                            {new Date(ev.time).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4 space-y-2">
              {parcel.courier ? (
                <>
                  <p className="text-sm text-gray-400">추적 정보를 불러오는 중이에요</p>
                  <button
                    onClick={refreshTracking}
                    disabled={syncing}
                    className="inline-flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
                    {syncing ? "갱신 중..." : "지금 새로고침"}
                  </button>
                </>
              ) : (
                <p className="text-sm text-gray-400">택배사 정보가 없어 추적할 수 없어요</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 등록 물품 내역 (PRE_REGISTERED) */}
      {(parcel.pre_invoice_items && parcel.pre_invoice_items.length > 0 || canEditItems) && (
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">등록 물품 내역</h2>
            {canEditItems && !editingItems && (
              <button
                onClick={() => openEditItems(parcel)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                <Edit3 size={12} /> 수정
              </button>
            )}
          </div>

          {/* ─── 읽기 모드 ─── */}
          {!editingItems && (
            <>
              {parcel.pre_invoice_items && parcel.pre_invoice_items.length > 0 ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${parcel.item_condition === "USED" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                      {parcel.item_condition === "USED" ? "중고품" : "새 제품"}
                    </span>
                    <span className="text-xs text-gray-400">총 {parcel.pre_invoice_items.length}종</span>
                  </div>
                  <div className="space-y-2">
                    {parcel.pre_invoice_items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div>
                          <p className="text-sm text-gray-800 font-medium">
                            {item.product_name || item.name_en}
                          </p>
                          <p className="text-xs text-gray-400">
                            {item.product_name && <span className="text-gray-400">{item.name_en} · </span>}
                            수량 {item.quantity} · 원산지 {item.origin_country}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-gray-700">$ {item.unit_price_usd}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-sm pt-1">
                    <span className="text-gray-500">총 신고금액</span>
                    <span className="font-bold text-gray-900">
                      USD {parcel.pre_invoice_items.reduce((s, i) => s + i.unit_price_usd * i.quantity, 0).toFixed(2)}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400 text-center py-3">등록된 물품 내역이 없습니다.</p>
              )}
            </>
          )}

          {/* ─── 편집 모드 ─── */}
          {editingItems && (
            <div className="space-y-3">
              {/* 신품/중고 */}
              <div className="grid grid-cols-2 gap-2">
                {([["NEW", "새 제품", "신품·미사용"], ["USED", "중고품", "사용품·유학생 짐"]] as const).map(([v, l, s]) => (
                  <button key={v} type="button" onClick={() => setEditCondition(v)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 transition-all text-left ${editCondition === v ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"}`}>
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${editCondition === v ? "border-blue-500 bg-blue-500" : "border-gray-300"}`}>
                      {editCondition === v && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <p className={`text-xs font-semibold ${editCondition === v ? "text-blue-700" : "text-gray-800"}`}>{l}</p>
                      <p className="text-[10px] text-gray-400">{s}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* 품목 목록 */}
              <div className="space-y-3">
                {editItems.map((item, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500">품목 {idx + 1}</span>
                      {editItems.length > 1 && (
                        <button type="button" onClick={() => setEditItems(p => p.filter((_, i) => i !== idx))}
                          className="p-1 text-gray-300 hover:text-red-400"><Trash2 size={13} /></button>
                      )}
                    </div>
                    <input
                      value={item.product_name ?? ""}
                      onChange={e => setEditItems(p => p.map((it, i) => i === idx ? { ...it, product_name: e.target.value } : it))}
                      placeholder="제품명 (예: 나이키 운동화)"
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                    <ItemCategoryPicker
                      value={item._isCustom ? "Other Goods" : item.name_en}
                      onChange={(cat: ItemCategory) => setEditItems(p => p.map((it, i) =>
                        i === idx ? { ...it, name_en: cat.id === "other" ? "" : cat.name_en, hs_code: cat.hs_code ?? "", _isCustom: cat.id === "other" } : it
                      ))}
                    />
                    {item._isCustom && (
                      <input value={item.name_en}
                        onChange={e => setEditItems(p => p.map((it, i) => i === idx ? { ...it, name_en: e.target.value } : it))}
                        placeholder="품목명 직접 입력 (영문)"
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400 font-semibold flex items-center gap-1">
                          수량 <Lock size={9} className="text-gray-300" />
                        </label>
                        <div className="flex items-center bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 gap-2">
                          <span className="flex-1 text-center text-sm font-semibold text-gray-500">{item.quantity}</span>
                        </div>
                        <p className="text-[9px] text-gray-300 mt-0.5 text-center">검수 후 관리자 확정</p>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 font-semibold">단가 (USD)</label>
                        <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-2">
                          <span className="text-gray-400 text-xs mr-1">$</span>
                          <input type="number" min={0} step={0.01} value={item.unit_price_usd || ""}
                            onChange={e => setEditItems(p => p.map((it, i) => i === idx ? { ...it, unit_price_usd: parseFloat(e.target.value) || 0 } : it))}
                            placeholder="0.00"
                            className="flex-1 bg-transparent text-sm focus:outline-none min-w-0" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button type="button"
                onClick={() => setEditItems(p => [...p, newInvoiceItem()])}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 border-dashed border-gray-200 text-xs text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
                <Plus size={12} /> 품목 추가
              </button>

              {editError && <p className="text-xs text-red-500">{editError}</p>}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setEditingItems(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium flex items-center justify-center gap-1">
                  <X size={14} /> 취소
                </button>
                <button type="button" onClick={saveItems} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold flex items-center justify-center gap-1 disabled:opacity-50">
                  {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check size={14} /> 저장</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 기본 정보 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">기본 정보</h2>
          {canEdit && !editingTracking && !parcel.pickup_tracking_no && (
            <button
              onClick={() => openEditTracking(parcel)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              <Edit3 size={12} /> 송장 수정
            </button>
          )}
        </div>

        {/* 읽기 모드 */}
        {!editingTracking && (
          <div className="space-y-2">
            <InfoRow icon={<Package size={15} className="text-gray-400" />} label="운송장" value={parcel.tracking_no ?? "미등록"} />
            {parcel.courier && (
              <InfoRow icon={<Truck size={15} className="text-gray-400" />} label="택배사" value={parcel.courier} />
            )}
            {parcel.pickup_tracking_no && (
              <InfoRow icon={<Truck size={15} className="text-gray-400" />} label="수거 운송장" value={parcel.pickup_tracking_no} />
            )}
            {parcel.sender_name && (
              <InfoRow icon={<MapPin size={15} className="text-gray-400" />} label="발송인" value={parcel.sender_name} />
            )}
            {parcel.sender_address && (
              <InfoRow icon={<MapPin size={15} className="text-gray-400" />} label="발송지" value={parcel.sender_address} />
            )}
            {parcel.inbound_at && (
              <InfoRow icon={<Clock size={15} className="text-gray-400" />} label="입고일" value={new Date(parcel.inbound_at).toLocaleDateString("ko-KR")} />
            )}
            <InfoRow icon={<Clock size={15} className="text-gray-400" />} label="접수일" value={new Date(parcel.created_at).toLocaleDateString("ko-KR")} />
          </div>
        )}

        {/* 송장번호 편집 모드 */}
        {editingTracking && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                국내 운송장 번호 <span className="text-red-400">*</span>
              </label>
              <input
                value={editTracking}
                onChange={e => setEditTracking(e.target.value)}
                placeholder="운송장 번호 입력"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                택배사 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <select
                value={editCourier}
                onChange={e => setEditCourier(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
              >
                <option value="">택배사 선택</option>
                <option value="kr.cjlogistics">CJ대한통운</option>
                <option value="kr.lotte">롯데택배</option>
                <option value="kr.logen">로젠택배</option>
                <option value="kr.hanjin">한진택배</option>
                <option value="kr.epost">우체국택배</option>
                <option value="kr.cupost">CU편의점택배</option>
                <option value="kr.gs25">GS25편의점택배</option>
                <option value="kr.kdexp">경동택배</option>
              </select>
            </div>

            {editError && <p className="text-xs text-red-500">{editError}</p>}

            <div className="flex gap-2">
              <button type="button" onClick={() => setEditingTracking(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium flex items-center justify-center gap-1">
                <X size={14} /> 취소
              </button>
              <button type="button" onClick={saveTracking} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold flex items-center justify-center gap-1 disabled:opacity-50">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check size={14} /> 저장</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 실측 정보 */}
      {(parcel.weight_actual || parcel.vol_length) && (
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">측정 정보</h2>
          <div className="grid grid-cols-2 gap-3">
            {parcel.weight_actual && (
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <Weight size={20} className="text-blue-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-gray-900">{parcel.weight_actual}g</p>
                <p className="text-xs text-gray-500">실측 무게</p>
              </div>
            )}
            {parcel.vol_length && parcel.vol_width && parcel.vol_height && (
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <Ruler size={20} className="text-violet-500 mx-auto mb-1" />
                <p className="text-base font-bold text-gray-900">
                  {parcel.vol_length}×{parcel.vol_width}×{parcel.vol_height}
                </p>
                <p className="text-xs text-gray-500">cm (L×W×H)</p>
              </div>
            )}
          </div>
          {parcel.notes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
              <p className="font-medium mb-0.5">메모</p>
              <p>{parcel.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* 검수 결과 */}
      {inspection && (
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">검수 결과</h2>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${GRADE_CONFIG[inspection.grade]?.color ?? "text-gray-700 bg-gray-100"}`}>
              {GRADE_CONFIG[inspection.grade]?.label ?? inspection.grade}
            </span>
          </div>
          <div className="space-y-1.5">
            {(Object.entries(inspection.checklist) as [string, unknown][]).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2 text-sm">
                {val ? (
                  <CheckCircle size={15} className="text-green-500 shrink-0" />
                ) : (
                  <AlertTriangle size={15} className="text-red-400 shrink-0" />
                )}
                <span className="text-gray-700">{CHECKLIST_LABEL[key] ?? key}</span>
              </div>
            ))}
          </div>
          {inspection.notes && (
            <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3">{inspection.notes}</p>
          )}
          <p className="text-xs text-gray-400">
            검수일: {new Date(inspection.inspected_at).toLocaleDateString("ko-KR")}
          </p>
        </div>
      )}

      {/* 미디어 타임라인 */}
      {media.length > 0 ? (
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">미디어 타임라인</h2>
          {Object.entries(mediaByStage).map(([stage, items]) => (
            <div key={stage} className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {STAGE_LABEL[stage] ?? stage}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {items.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMedia(m)}
                    className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 active:scale-95 transition-transform"
                  >
                    {m.cf_thumbnail_url ? (
                      <img src={m.cf_thumbnail_url} alt={m.caption ?? ""} className="w-full h-full object-cover" />
                    ) : m.type === "VIDEO" ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play size={24} className="text-gray-400" />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon size={24} className="text-gray-400" />
                      </div>
                    )}
                    {m.type === "VIDEO" && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-black/40 rounded-full p-1.5">
                          <Play size={16} className="text-white fill-white" />
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-4 shadow-sm text-center py-8">
          <ImageIcon size={36} className="text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">아직 업로드된 사진·영상이 없습니다</p>
          <p className="text-xs text-gray-300 mt-0.5">입고 후 오픈박스 영상이 등록됩니다</p>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="space-y-2 pb-2">
        {parcel.status === "PENDING_PICKUP" && (
          <button
            type="button"
            onClick={() => setShowCancelPickup(true)}
            className="flex items-center justify-center gap-2 w-full bg-white border border-red-200 text-red-500 font-semibold py-4 rounded-2xl active:scale-[0.98] transition-transform shadow-sm"
          >
            <X size={18} />
            수거 신청 취소
          </button>
        )}
        {parcel.status === "PICKUP_CANCELLED" && (
          <Link
            href="/pickup"
            className="flex items-center justify-center gap-2 w-full bg-yellow-500 text-white font-semibold py-4 rounded-2xl active:scale-[0.98] transition-transform shadow"
          >
            <Package size={18} />
            수거 재신청
          </Link>
        )}
        {canShip && (
          <Link
            href={`/shipping-request?parcels=${parcel.id}`}
            className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white font-semibold py-4 rounded-2xl active:scale-[0.98] transition-transform shadow"
          >
            <Send size={18} />
            출고신청
          </Link>
        )}
        {canReturn && (
          <Link
            href={`/return-request?parcel_id=${parcel.id}`}
            className="flex items-center justify-center gap-2 w-full bg-white border border-gray-200 text-gray-700 font-semibold py-4 rounded-2xl active:scale-[0.98] transition-transform shadow-sm"
          >
            <RotateCcw size={18} />
            반품 신청
          </Link>
        )}
      </div>

      {/* 수거 신청 취소 확인 모달 */}
      {showCancelPickup && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-8 sm:items-center">
          <div className="w-full max-w-[380px] bg-white rounded-2xl p-5 shadow-xl">
            <p className="text-base font-bold text-gray-900 mb-1">수거 신청을 취소할까요?</p>
            <p className="text-sm text-gray-500 mb-5">취소 후 다시 수거 신청을 하실 수 있습니다.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelPickup(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl"
              >
                닫기
              </button>
              <button
                onClick={cancelPickup}
                disabled={cancellingPickup}
                className="flex-1 py-3 bg-red-500 text-white text-sm font-semibold rounded-xl disabled:opacity-60 flex items-center justify-center gap-1"
              >
                {cancellingPickup
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : "수거 취소"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 미디어 뷰어 모달 */}
      {selectedMedia && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedMedia(null)}
        >
          <div className="max-w-[400px] w-full" onClick={(e) => e.stopPropagation()}>
            {selectedMedia.type === "VIDEO" && selectedMedia.cf_hls_url ? (
              <video
                src={selectedMedia.cf_hls_url}
                controls
                className="w-full rounded-xl"
                autoPlay
              />
            ) : (
              <img
                src={selectedMedia.storage_url}
                alt={selectedMedia.caption ?? ""}
                className="w-full rounded-xl"
              />
            )}
            {selectedMedia.caption && (
              <p className="text-white text-sm text-center mt-3">{selectedMedia.caption}</p>
            )}
            <button
              onClick={() => setSelectedMedia(null)}
              className="w-full mt-4 text-white/70 text-sm py-2"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 flex-1 break-all">{value}</span>
    </div>
  );
}

const TRACK_STEPS = [
  { code: "INFORMATION_RECEIVED", label: "접수" },
  { code: "AT_PICKUP",            label: "집하" },
  { code: "IN_TRANSIT",           label: "이동 중" },
  { code: "OUT_FOR_DELIVERY",     label: "배달 출발" },
  { code: "DELIVERED",            label: "배달 완료" },
];

function TrackingProgressBar({ statusCode }: { statusCode: string | null }) {
  const currentStep = TRACKING_STATUS[statusCode ?? ""]?.step ?? 0;
  const maxStep = 5;

  return (
    <div className="flex items-start gap-0">
      {TRACK_STEPS.map((step, idx) => {
        const stepNum = idx + 1;
        const done = currentStep >= stepNum;
        const active = currentStep === stepNum;
        return (
          <div key={step.code} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex items-center">
              <div className={`w-full h-1 ${idx === 0 ? "invisible" : done ? "bg-blue-500" : "bg-gray-100"}`} />
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                done ? (active ? "bg-blue-600 text-white ring-2 ring-blue-200" : "bg-blue-500 text-white") : "bg-gray-100 text-gray-400"
              }`}>
                {done && !active ? <CheckCircle size={12} className="text-white" /> : stepNum}
              </div>
              <div className={`w-full h-1 ${idx === TRACK_STEPS.length - 1 ? "invisible" : done && currentStep > stepNum ? "bg-blue-500" : "bg-gray-100"}`} />
            </div>
            <span className={`text-[10px] text-center leading-tight ${done ? (active ? "text-blue-600 font-bold" : "text-blue-500") : "text-gray-400"}`}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
  void maxStep;
}

const CHECKLIST_LABEL: Record<string, string> = {
  condition_ok:    "전반적 상태 양호",
  size_match:      "사이즈 일치",
  color_match:     "색상 일치",
  defect:          "결함 없음",
  authenticity_ok: "정품 확인",
};
