"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  User,
  CheckCircle2,
  AlertTriangle,
  Search,
  Truck,
  Weight,
  Ruler,
  Calendar,
  ExternalLink,
  MapPin,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { SIZE_VOLUME_L, PARCEL_SIZE_OPTIONS } from "@/lib/parcels/size";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING_PICKUP: { label: "수거신청", color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  INBOUND:        { label: "입고",     color: "text-blue-700 bg-blue-50 border-blue-200" },
  SHIPPABLE:      { label: "보관중",   color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  HOLD:           { label: "보류",     color: "text-orange-700 bg-orange-50 border-orange-200" },
  SHIPPING:       { label: "배송중",   color: "text-cyan-700 bg-cyan-50 border-cyan-200" },
  DONE:           { label: "완료",     color: "text-gray-500 bg-gray-50 border-gray-200" },
};

type InvoiceItem = {
  product_name?: string;
  name_en: string;
  quantity: number;
  unit_price_usd: number;
  origin_country: string;
};

type Parcel = {
  id: string;
  tracking_no: string | null;
  status: string;
  inbound_at: string | null;
  created_at: string;
  weight_actual: number | null;
  volume_l: number | null;
  volume_w: number | null;
  volume_h: number | null;
  parcel_size_code: string | null;
  pre_invoice_items: InvoiceItem[] | null;
  sender_name: string | null;
  sender_address: string | null;
  courier: string | null;
  item_condition: string | null;
  hold_reason: string | null;
  notes: string | null;
  is_shippable: boolean | null;
};

type LocationDetail = {
  id: string;
  code: string;
  zone: string;
  slot: string;
  label: string | null;
  status: string;
  customer_id: string | null;
  assigned_at: string | null;
  notes: string | null;
  max_parcels: number | null;
  volume_liter: number | null;
  storage_types: { volume_liter: number | null } | null;
  customers: { id: string; name: string | null; customer_code: string; email: string } | null;
};

type CustomerResult = { id: string; name: string | null; customer_code: string };

export default function StorageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [locationId, setLocationId] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationDetail | null>(null);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 고객 검색
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<CustomerResult[]>([]);
  const [searching, setSearching] = useState(false);

  // 노트 편집
  const [notes, setNotes] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);

  // 최대 소포 수 편집
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [maxParcelsInput, setMaxParcelsInput] = useState<string>("");

  // 소포 카드 확장
  const [expandedParcels, setExpandedParcels] = useState<Set<string>>(new Set());
  const toggleParcel = (id: string) =>
    setExpandedParcels((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  useEffect(() => {
    params.then(({ id }) => setLocationId(id));
  }, [params]);

  const load = useCallback(async () => {
    if (!locationId) return;
    const res = await fetch(`/api/admin/storage/${locationId}`);
    const json = await res.json();
    setLocation(json.location);
    setParcels(json.parcels ?? []);
    setNotes(json.location?.notes ?? "");
    setMaxParcelsInput(json.location?.max_parcels != null ? String(json.location.max_parcels) : "");
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    load();
  }, [load]);

  // 고객 검색
  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/admin/customers/search?q=${encodeURIComponent(searchQ)}`);
      const json = await res.json();
      setSearchResults(json.customers ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  const patch = async (action: string, extra: Record<string, unknown> = {}) => {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/storage/${locationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "오류 발생");
    } else {
      await load();
    }
    setSaving(false);
  };

  const handleAssign = async (customer_id: string) => {
    setSearchQ("");
    setSearchResults([]);
    await patch("assign", { customer_id });
  };

  const handleRelease = async () => {
    if (!confirm("로케이션을 비워서 다른 고객이 사용할 수 있게 하시겠습니까?")) return;
    await patch("release");
  };

  const handleDisable = async () => {
    const note = prompt("비활성 사유 (선택)", location?.notes ?? "");
    if (note === null) return;
    await patch("set_status", { status: "DISABLED", notes: note });
  };

  const handleEnable = async () => {
    await patch("set_status", { status: "AVAILABLE" });
  };

  const handleSaveNotes = async () => {
    await patch("update_notes", { notes });
    setEditingNotes(false);
  };

  const handleSaveCapacity = async () => {
    const val = maxParcelsInput.trim();
    const max_parcels = val === "" ? null : parseInt(val, 10);
    if (val !== "" && (isNaN(max_parcels!) || max_parcels! < 1)) {
      alert("1 이상의 숫자 또는 빈칸(무제한)으로 입력하세요.");
      return;
    }
    await patch("set_capacity", { max_parcels });
    setEditingCapacity(false);
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-400">로딩 중…</div>;
  }
  if (!location) {
    return <div className="p-8 text-center text-red-500">로케이션을 찾을 수 없습니다.</div>;
  }

  const statusCfg =
    location.status === "OCCUPIED"
      ? { label: "사용중",   dot: "bg-blue-500",    badge: "bg-blue-50 text-blue-700 border-blue-200" }
      : location.status === "DISABLED"
      ? { label: "사용불가", dot: "bg-gray-400",    badge: "bg-gray-100 text-gray-500 border-gray-200" }
      : { label: "비어있음", dot: "bg-emerald-400", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" };

  return (
    <div className="max-w-2xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/storage"
          className="text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{location.code}</h1>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusCfg.badge} flex items-center gap-1.5`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
              {statusCfg.label}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">구역 {location.zone} · 슬롯 {location.slot}</p>
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-2">
          {location.status === "OCCUPIED" && (
            <button
              onClick={handleRelease}
              disabled={saving}
              className="text-xs px-3 py-1.5 rounded-lg border border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100 font-semibold"
            >
              고객 해제
            </button>
          )}
          {location.status !== "DISABLED" ? (
            <button
              onClick={handleDisable}
              disabled={saving}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 font-semibold"
            >
              비활성화
            </button>
          ) : (
            <button
              onClick={handleEnable}
              disabled={saving}
              className="text-xs px-3 py-1.5 rounded-lg border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 font-semibold"
            >
              활성화
            </button>
          )}
        </div>
      </div>

      {/* 오류 */}
      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* 고객 섹션 */}
      <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 font-semibold text-gray-700 flex items-center gap-2">
          <User size={16} className="text-indigo-500" />
          할당 고객
        </div>

        {location.customers ? (
          <div className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold text-indigo-700">
                {(location.customers.name ?? location.customers.customer_code)[0]?.toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">
                {location.customers.name ?? "(이름 없음)"}
              </p>
              <p className="text-xs text-gray-400 font-mono">{location.customers.customer_code}</p>
              <p className="text-xs text-gray-400">{location.customers.email}</p>
            </div>
            {location.assigned_at && (
              <div className="text-right">
                <p className="text-xs text-gray-400">할당일</p>
                <p className="text-xs font-medium text-gray-700">
                  {new Date(location.assigned_at).toLocaleDateString("ko-KR")}
                </p>
              </div>
            )}
          </div>
        ) : location.status === "DISABLED" ? (
          <div className="p-5 text-sm text-gray-400 italic">비활성화된 로케이션</div>
        ) : (
          <div className="p-5">
            <p className="text-sm text-gray-500 mb-3">고객을 검색하여 이 로케이션에 할당하세요</p>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="고객명 또는 고객 코드로 검색…"
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            {searching && <p className="text-xs text-gray-400 mt-2">검색 중…</p>}
            {searchResults.length > 0 && (
              <ul className="mt-2 border border-gray-200 rounded-xl overflow-hidden">
                {searchResults.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-indigo-50 cursor-pointer border-b last:border-b-0 border-gray-100"
                    onClick={() => handleAssign(c.id)}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{c.name ?? "(이름 없음)"}</p>
                      <p className="text-xs text-gray-400 font-mono">{c.customer_code}</p>
                    </div>
                    <CheckCircle2 size={16} className="text-indigo-400" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* 메모 */}
      <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 font-semibold text-gray-700 flex items-center justify-between">
          <span>메모</span>
          {!editingNotes ? (
            <button onClick={() => setEditingNotes(true)} className="text-xs text-indigo-600 hover:underline">편집</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={handleSaveNotes} className="text-xs text-indigo-600 font-bold hover:underline">저장</button>
              <button onClick={() => { setEditingNotes(false); setNotes(location.notes ?? ""); }} className="text-xs text-gray-400 hover:underline">취소</button>
            </div>
          )}
        </div>
        <div className="p-4">
          {editingNotes ? (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              placeholder="메모 입력…"
            />
          ) : (
            <p className="text-sm text-gray-600">{location.notes ?? <span className="text-gray-300 italic">없음</span>}</p>
          )}
        </div>
      </div>

      {/* 보관 소포 목록 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 font-semibold text-gray-700 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Package size={16} className="text-blue-500" />
            보관 중인 소포
            {(() => {
              // 리터 기반 표시 우선
              if (location.storage_types?.volume_liter != null) {
                const usedL = parcels.reduce((sum, p) => {
                  return sum + (p.parcel_size_code ? (SIZE_VOLUME_L[p.parcel_size_code] ?? 0) : 0);
                }, 0);
                const pct = Math.min(100, Math.round((usedL / location.storage_types.volume_liter) * 100));
                const color = pct >= 100 ? "bg-red-100 text-red-700" : pct >= 80 ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700";
                return (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
                    {usedL}L / {location.storage_types.volume_liter}L
                  </span>
                );
              }
              // fallback: 건수
              if (location.max_parcels != null) {
                const color = parcels.length >= location.max_parcels ? "bg-red-100 text-red-700"
                  : parcels.length >= location.max_parcels * 0.8 ? "bg-yellow-100 text-yellow-700"
                  : "bg-blue-100 text-blue-700";
                return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>{parcels.length}/{location.max_parcels}건</span>;
              }
              return <span className="text-xs text-gray-400">({parcels.length}개)</span>;
            })()}
          </span>
          {/* 용량 편집 */}
          {!editingCapacity ? (
            <button
              onClick={() => setEditingCapacity(true)}
              className="text-xs text-indigo-600 hover:underline"
            >
              {location.max_parcels != null ? `최대 ${location.max_parcels}건` : "용량 무제한"} · 편집
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={maxParcelsInput}
                onChange={(e) => setMaxParcelsInput(e.target.value)}
                placeholder="무제한"
                className="w-20 border border-gray-300 rounded-lg text-xs px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <span className="text-xs text-gray-400">건</span>
              <button onClick={handleSaveCapacity} className="text-xs text-indigo-600 font-bold hover:underline">저장</button>
              <button
                onClick={() => {
                  setEditingCapacity(false);
                  setMaxParcelsInput(location.max_parcels != null ? String(location.max_parcels) : "");
                }}
                className="text-xs text-gray-400 hover:underline"
              >취소</button>
            </div>
          )}
        </div>

        {/* 리터 용량 바 */}
        {location.storage_types?.volume_liter != null && (() => {
          const volLiter = location.storage_types!.volume_liter!;
          const usedL = parcels.reduce((sum, p) => {
            return sum + (p.parcel_size_code ? (SIZE_VOLUME_L[p.parcel_size_code] ?? 0) : 0);
          }, 0);
          const pct = Math.min(100, Math.round((usedL / volLiter) * 100));
          const hasSized = parcels.some((p) => p.parcel_size_code);
          if (!hasSized) return null;
          return (
            <div className="px-5 py-2 border-b border-gray-50">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>용량 사용률 ({pct}%)</span>
                <span className="font-mono">{usedL}L / {volLiter}L</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-yellow-400" : "bg-blue-500"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex gap-3 mt-1.5 flex-wrap">
                {parcels.filter((p) => p.parcel_size_code).map((p) => {
                  const opt = PARCEL_SIZE_OPTIONS.find((o) => o.code === p.parcel_size_code);
                  return opt ? (
                    <span key={p.id} className="text-[10px] bg-orange-50 text-orange-700 border border-orange-200 rounded px-1.5 py-0.5">
                      {opt.label} {opt.volume_l}L
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          );
        })()}
        {parcels.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">보관 중인 소포가 없습니다</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {parcels.map((p) => {
              const sc = STATUS_LABELS[p.status] ?? { label: p.status, color: "text-gray-500 bg-gray-50 border-gray-200" };
              const items = p.pre_invoice_items ?? [];
              const mainTitle = items.length > 0
                ? (items[0].product_name || items[0].name_en)
                : (p.sender_name ?? p.tracking_no ?? "물품 미등록");
              const isExpanded = expandedParcels.has(p.id);
              const totalUsd = items.reduce((s, i) => s + i.unit_price_usd * i.quantity, 0);

              return (
                <div key={p.id} className="overflow-hidden">
                  {/* ── 카드 헤더 (항상 표시) ── */}
                  <button
                    type="button"
                    onClick={() => toggleParcel(p.id)}
                    className="w-full px-5 py-4 flex items-start gap-3 hover:bg-gray-50 text-left"
                  >
                    {/* 상태 점 */}
                    <div className="mt-1 shrink-0">
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        p.status === "SHIPPABLE" ? "bg-emerald-500" :
                        p.status === "INBOUND"   ? "bg-green-500" :
                        p.status === "HOLD"      ? "bg-red-500" :
                        "bg-gray-400"}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* 제품 타이틀 + 상태 뱃지 */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-gray-900 truncate">{mainTitle}</span>
                        {items.length > 1 && (
                          <span className="text-[10px] text-gray-400">외 {items.length - 1}종</span>
                        )}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sc.color}`}>
                          {sc.label}
                        </span>
                        {p.status === "INBOUND" && (
                          <span className="text-[10px] bg-yellow-50 text-yellow-700 border border-yellow-200 px-1.5 py-0.5 rounded-full font-semibold">처리중</span>
                        )}
                        {p.item_condition === "USED" && (
                          <span className="text-[10px] bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-full font-semibold">중고품</span>
                        )}
                      </div>

                      {/* 운송장 + 입고일 */}
                      <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                        {p.tracking_no && (
                          <span className="font-mono">{p.tracking_no}</span>
                        )}
                        {p.courier && (
                          <span className="flex items-center gap-1">
                            <Truck size={11} /> {p.courier}
                          </span>
                        )}
                        {p.inbound_at && (
                          <span className="flex items-center gap-1">
                            <Calendar size={11} />
                            입고 {new Date(p.inbound_at).toLocaleDateString("ko-KR")}
                          </span>
                        )}
                        {p.weight_actual && (
                          <span className="flex items-center gap-1">
                            <Weight size={11} /> {p.weight_actual}g
                          </span>
                        )}
                        {p.volume_l && p.volume_w && p.volume_h && (
                          <span className="flex items-center gap-1">
                            <Ruler size={11} />
                            {p.volume_l}×{p.volume_w}×{p.volume_h}cm
                          </span>
                        )}
                      </div>

                      {/* 보류 사유 */}
                      {p.hold_reason && (
                        <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                          <AlertTriangle size={11} /> {p.hold_reason}
                        </p>
                      )}
                    </div>

                    {/* 우측: 펼치기 + 상세 링크 */}
                    <div className="flex items-center gap-2 shrink-0 mt-0.5">
                      <Link
                        href={`/parcels/${p.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 text-indigo-400 hover:text-indigo-600"
                        title="소포 상세"
                      >
                        <ExternalLink size={14} />
                      </Link>
                      {isExpanded
                        ? <ChevronDown size={15} className="text-gray-400" />
                        : <ChevronRight size={15} className="text-gray-400" />}
                    </div>
                  </button>

                  {/* ── 펼쳐진 상세 ── */}
                  {isExpanded && (
                    <div className="px-5 pb-4 bg-gray-50/60 border-t border-gray-100">

                      {/* 품목 목록 */}
                      {items.length > 0 ? (
                        <div className="mt-3 bg-white rounded-xl border border-gray-100 overflow-hidden">
                          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-500 uppercase tracking-wide flex items-center justify-between">
                            <span>내품 목록 ({items.length}종)</span>
                            {totalUsd > 0 && (
                              <span className="font-semibold text-gray-700">총 USD {totalUsd.toFixed(2)}</span>
                            )}
                          </div>
                          <div className="divide-y divide-gray-50">
                            {items.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between px-3 py-2.5">
                                <div className="min-w-0">
                                  <p className="text-sm text-gray-800 font-medium truncate">
                                    {item.product_name || item.name_en}
                                  </p>
                                  <p className="text-[11px] text-gray-400">
                                    {item.product_name && <>{item.name_en} · </>}
                                    수량 {item.quantity}
                                    {item.origin_country ? ` · 원산지 ${item.origin_country}` : ""}
                                  </p>
                                </div>
                                {item.unit_price_usd > 0 && (
                                  <span className="text-sm font-semibold text-gray-700 shrink-0 ml-2">
                                    $ {item.unit_price_usd}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-gray-400 italic">등록된 내품 정보 없음</p>
                      )}

                      {/* 발송인 / 주소 */}
                      {(p.sender_name || p.sender_address) && (
                        <div className="mt-3 flex flex-col gap-1 text-xs text-gray-500">
                          {p.sender_name && (
                            <span className="flex items-center gap-1.5">
                              <MapPin size={12} className="text-gray-400 shrink-0" />
                              발송인: {p.sender_name}
                            </span>
                          )}
                          {p.sender_address && (
                            <span className="flex items-center gap-1.5 pl-4 text-gray-400">{p.sender_address}</span>
                          )}
                        </div>
                      )}

                      {/* 메모 */}
                      {p.notes && (
                        <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800">
                          <p className="font-semibold mb-0.5">메모</p>
                          <p>{p.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
