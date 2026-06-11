"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, AlertTriangle, Warehouse, Grid3X3, RefreshCw, ChevronDown, Check, X, Layers, Bell, ArrowRight } from "lucide-react";

type StorageTypeOption = {
  id: string;
  code: string;
  name: string;
  dim_l_mm: number;
  dim_w_mm: number;
  dim_h_mm: number;
  volume_liter: number;
  max_parcels: number | null;
  price_per_week: number;
  price_max: number | null;
  price_per_month: number | null;
};

type ChangeRequest = {
  id: string;
  request_type: string;
  status: string;
  customer_note: string | null;
  admin_note: string | null;
  requested_type_code: string | null;
  requested_plan_type: string | null;
  source_storage_ids: string[] | null;
  created_at: string;
  processed_at: string | null;
  customers: { id: string; name: string | null; customer_code: string; email: string | null } | null;
  customer_storages: { id: string; storage_name: string; storage_mode: string; plan_type: string | null } | null;
  storage_types: { code: string; name: string; price_per_week: number; price_per_month: number | null; max_parcels: number | null; volume_liter: number | null } | null;
};

type LocationRow = {
  id: string;
  code: string;
  zone: string;
  slot: string;
  status: string;
  customer_id: string | null;
  customers: { name: string | null; customer_code: string } | null;
  storage_types: { id: string; code: string; name: string; volume_liter: number; price_per_week: number; price_per_month: number | null } | null;
};

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE:   "비어있음",
  RESERVED:    "배정완료",
  OCCUPIED:    "보관중",
  PENDING_OUT: "반출예정",
  DISABLED:    "사용불가",
};

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE:   "text-emerald-700 bg-emerald-50 border-emerald-200",
  RESERVED:    "text-yellow-700 bg-yellow-50 border-yellow-200",
  OCCUPIED:    "text-blue-700 bg-blue-50 border-blue-200",
  PENDING_OUT: "text-orange-700 bg-orange-50 border-orange-200",
  DISABLED:    "text-gray-500 bg-gray-100 border-gray-200",
};

const TYPE_BADGE: Record<string, string> = {
  MINI:     "bg-slate-100 text-slate-600",
  STANDARD: "bg-indigo-100 text-indigo-700",
  LONG:     "bg-purple-100 text-purple-700",
  XL:       "bg-orange-100 text-orange-700",
  OVERSIZE: "bg-red-100 text-red-700",
};

export default function StorageManagePage() {
  const [locations, setLocations]   = useState<LocationRow[]>([]);
  const [types, setTypes]           = useState<StorageTypeOption[]>([]);
  const [loading, setLoading]       = useState(true);

  // 변경 요청
  const [changeRequests, setChangeRequests]       = useState<ChangeRequest[]>([]);
  const [reqStatusFilter, setReqStatusFilter]     = useState<"PENDING" | "ALL">("PENDING");
  const [processingReqId, setProcessingReqId]     = useState<string | null>(null);
  const [adminNoteInput, setAdminNoteInput]        = useState<Record<string, string>>({});

  // 추가 폼
  const [newZone,   setNewZone]   = useState("");
  const [newSlots,  setNewSlots]  = useState("");
  const [newTypeId, setNewTypeId] = useState("");
  const [adding,    setAdding]    = useState(false);
  const [addError,  setAddError]  = useState<string | null>(null);

  const [deleting,     setDeleting]     = useState<string | null>(null);
  const [deleteError,  setDeleteError]  = useState<string | null>(null);
  const [activeZones,  setActiveZones]  = useState<Record<number, string>>({}); // blockIdx → zone
  const [openBlocks,   setOpenBlocks]   = useState<Set<number>>(new Set([0]));  // 첫 블록 기본 열림
  const [typePopover,  setTypePopover]  = useState<string | null>(null);
  const [typeSaving,   setTypeSaving]   = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // 선택 / 일괄 변경
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());
  const [bulkSaving,     setBulkSaving]     = useState(false);
  const [bulkTypeOpen,   setBulkTypeOpen]   = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const bulkTypeRef   = useRef<HTMLDivElement>(null);
  const bulkStatusRef = useRef<HTMLDivElement>(null);

  // 타입별 용량·가격 편집
  const [editingTypeId,      setEditingTypeId]      = useState<string | null>(null);
  const [editingField,       setEditingField]       = useState<"capacity" | "price" | "monthly" | null>(null);
  const [typeCapacityInput,  setTypeCapacityInput]  = useState<string>("");
  const [typePriceInput,     setTypePriceInput]     = useState<string>("");
  const [typePriceMaxInput,  setTypePriceMaxInput]  = useState<string>("");
  const [typePriceMonthInput, setTypePriceMonthInput] = useState<string>("");

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleSelectAll = (ids: string[]) =>
    setSelectedIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });

  const clearSelection = () => setSelectedIds(new Set());

  const bulkAction = async (action: string, extra?: Record<string, unknown>) => {
    if (!selectedIds.size) return;
    setBulkSaving(true);
    setBulkTypeOpen(false);
    setBulkStatusOpen(false);
    const res = await fetch("/api/admin/storage/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selectedIds], action, ...extra }),
    });
    const json = await res.json();
    if (!res.ok) { alert(json.error ?? "오류 발생"); }
    else { clearSelection(); await load(); }
    setBulkSaving(false);
  };

  const ZONES_PER_BLOCK = 10;

  const toggleBlock = (idx: number) =>
    setOpenBlocks((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });

  const handleProcessRequest = async (reqId: string, status: "APPROVED" | "REJECTED") => {
    setProcessingReqId(reqId);
    const note = adminNoteInput[reqId] ?? "";
    const res = await fetch("/api/admin/storage/change-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: reqId, status, admin_note: note || undefined }),
    });
    const json = await res.json();
    if (!res.ok) { alert(json.error ?? "처리 실패"); }
    else { await load(); }
    setProcessingReqId(null);
  };

  const getActiveZone = (idx: number, chunk: string[]) =>
    (activeZones[idx] && chunk.includes(activeZones[idx])) ? activeZones[idx] : chunk[0];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [locRes, typeRes, reqRes] = await Promise.all([
        fetch("/api/admin/storage/list"),
        fetch("/api/admin/storage"),
        fetch(`/api/admin/storage/change-requests?status=${reqStatusFilter}`),
      ]);
      const locJson  = locRes.ok  ? await locRes.json()  : { locations: [] };
      const typeJson = typeRes.ok ? await typeRes.json() : { types: [] };
      const reqJson  = reqRes.ok  ? await reqRes.json()  : { requests: [] };
      setLocations(locJson.locations ?? []);
      setTypes(typeJson.types ?? []);
      setChangeRequests(reqJson.requests ?? []);
    } catch (e) {
      console.error("[manage] load error:", e);
    } finally {
      setLoading(false);
    }
  }, [reqStatusFilter]);

  useEffect(() => { load(); }, [load]);

  // 팝오버 바깥 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setTypePopover(null);
      if (bulkTypeRef.current && !bulkTypeRef.current.contains(e.target as Node)) setBulkTypeOpen(false);
      if (bulkStatusRef.current && !bulkStatusRef.current.contains(e.target as Node)) setBulkStatusOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSetType = async (locId: string, typeId: string | null) => {
    setTypeSaving(locId);
    const res = await fetch(`/api/admin/storage/${locId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_type", type_id: typeId }),
    });
    if (res.ok) {
      setLocations((prev) =>
        prev.map((l) =>
          l.id === locId
            ? { ...l, storage_types: typeId ? (types.find((t) => t.id === typeId) as LocationRow["storage_types"] ?? null) : null }
            : l
        )
      );
    }
    setTypeSaving(null);
    setTypePopover(null);
  };

  const handleSaveTypeCapacity = async (typeId: string) => {
    const val = typeCapacityInput.trim();
    const max_parcels = val === "" ? null : parseInt(val, 10);
    if (val !== "" && (isNaN(max_parcels!) || max_parcels! < 1)) {
      alert("1 이상의 숫자 또는 빈칸(무제한)으로 입력하세요.");
      return;
    }
    const res = await fetch("/api/admin/storage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type_id: typeId, max_parcels }),
    });
    if (res.ok) {
      setTypes((prev) => prev.map((t) => t.id === typeId ? { ...t, max_parcels } : t));
    } else {
      const json = await res.json();
      alert(json.error ?? "저장 실패");
    }
    setEditingTypeId(null);
    setEditingField(null);
  };

  const handleSaveTypePrice = async (typeId: string) => {
    const priceVal = typePriceInput.trim();
    const price_per_week = priceVal === "" ? null : parseInt(priceVal, 10);

    if (!price_per_week || isNaN(price_per_week) || price_per_week < 0) {
      alert("기본 주간 요금을 0 이상 정수로 입력하세요.");
      return;
    }
    const res = await fetch("/api/admin/storage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type_id: typeId, price_per_week, price_max: null }),
    });
    if (res.ok) {
      setTypes((prev) =>
        prev.map((t) =>
          t.id === typeId
            ? { ...t, price_per_week: price_per_week!, price_max: null }
            : t
        )
      );
    } else {
      const json = await res.json();
      alert(json.error ?? "저장 실패");
    }
    setEditingTypeId(null);
    setEditingField(null);
  };

  const handleSaveTypeMonthly = async (typeId: string) => {
    const val = typePriceMonthInput.trim();
    const price_per_month = val === "" ? null : parseInt(val, 10);
    if (val !== "" && (isNaN(price_per_month!) || price_per_month! < 0)) {
      alert("월 요금은 0 이상 정수로 입력하세요.");
      return;
    }
    const res = await fetch("/api/admin/storage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type_id: typeId, price_per_month: price_per_month ?? null }),
    });
    if (res.ok) {
      setTypes((prev) =>
        prev.map((t) => t.id === typeId ? { ...t, price_per_month: price_per_month ?? null } : t)
      );
    } else {
      const json = await res.json();
      alert(json.error ?? "저장 실패");
    }
    setEditingTypeId(null);
    setEditingField(null);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setAddError(null);

    // 슬롯 파싱: "01,02,03" 또는 "01-10" (범위)
    let slots: string[] = [];
    const parts = newSlots.split(",").map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      const range = part.match(/^(\d+)-(\d+)$/);
      if (range) {
        const from = parseInt(range[1], 10);
        const to   = parseInt(range[2], 10);
        for (let i = from; i <= to; i++) slots.push(String(i).padStart(3, "0"));
      } else {
        slots.push(part.padStart(3, "0"));
      }
    }
    slots = [...new Set(slots)];

    const res = await fetch("/api/admin/storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        zone:   newZone.toUpperCase(),
        slots,
        typeId: newTypeId || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setAddError(json.error ?? "오류 발생");
    } else {
      setNewZone("");
      setNewSlots("");
      setNewTypeId("");
      await load();
    }
    setAdding(false);
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`${code} 로케이션을 삭제하시겠습니까?`)) return;
    setDeleting(id);
    setDeleteError(null);
    const res  = await fetch(`/api/admin/storage/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setDeleteError(`${code}: ${json.error}`);
    } else {
      await load();
    }
    setDeleting(null);
  };

  // 구역별 그룹
  const zones = [...new Set(locations.map((l) => l.zone))].sort();
  const grouped: Record<string, LocationRow[]> = {};
  for (const loc of locations) {
    if (!grouped[loc.zone]) grouped[loc.zone] = [];
    grouped[loc.zone].push(loc);
  }

  // Zone을 ZONES_PER_BLOCK 단위로 청크 분할
  const zoneChunks: string[][] = [];
  for (let i = 0; i < zones.length; i += ZONES_PER_BLOCK) {
    zoneChunks.push(zones.slice(i, i + ZONES_PER_BLOCK));
  }

  // 선택된 타입 정보
  const selectedType = types.find((t) => t.id === newTypeId);

  return (
    <div className="max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/storage" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Warehouse size={20} className="text-indigo-600" />
            Zone·슬롯 관리
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">구역·슬롯 추가, 삭제, 비활성화</p>
        </div>
        <button onClick={load} className="text-gray-400 hover:text-gray-700">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* 스토리지 타입별 용량 설정 */}
      <div className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 font-semibold text-gray-700 flex items-center gap-2">
          <Layers size={16} className="text-indigo-500" />
          스토리지 타입 용량 설정
          <span className="text-xs font-normal text-gray-400 ml-1">— 로케이션 타입 지정 시 자동 적용됩니다</span>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {types.map((t) => (
            <div key={t.id} className="border border-gray-200 rounded-xl p-3 flex flex-col gap-1.5">
              {/* 코드 뱃지 + 이름 */}
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${TYPE_BADGE[t.code] ?? "bg-gray-100 text-gray-600"}`}>
                  {t.code}
                </span>
              </div>
              <p className="text-xs font-semibold text-gray-800 leading-tight">
                {t.name.replace(" Storage", "").replace(" Rack", "")}
              </p>
              <p className="text-[11px] text-gray-400">{t.volume_liter}L</p>

              <div className="mt-0.5 border-t border-gray-100 pt-1.5 flex flex-col gap-1">
                {/* ── 용량(최대 건수) ── */}
                {editingTypeId === t.id && editingField === "capacity" ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min={1}
                      value={typeCapacityInput}
                      onChange={(e) => setTypeCapacityInput(e.target.value)}
                      placeholder="무제한"
                      className="w-14 border border-gray-300 rounded text-[11px] px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                      autoFocus
                    />
                    <span className="text-[10px] text-gray-400">건</span>
                    <button onClick={() => handleSaveTypeCapacity(t.id)} className="text-[10px] text-indigo-600 font-bold hover:underline">저장</button>
                    <button onClick={() => { setEditingTypeId(null); setEditingField(null); }} className="text-[10px] text-gray-400 hover:underline">취소</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingTypeId(t.id); setEditingField("capacity"); setTypeCapacityInput(t.max_parcels != null ? String(t.max_parcels) : ""); }}
                    className="text-[11px] font-semibold text-left hover:underline flex items-center gap-1"
                    title="최대 건수 편집"
                  >
                    <span className="text-gray-400">📦</span>
                    {t.max_parcels != null
                      ? <span className="text-indigo-700">최대 {t.max_parcels}건</span>
                      : <span className="text-gray-400">무제한</span>}
                    <span className="text-gray-300 text-[10px]">편집</span>
                  </button>
                )}

                {/* ── 가격 (주간) ── */}
                {editingTypeId === t.id && editingField === "price" ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-500 w-8 shrink-0">주</span>
                      <input
                        type="number" min={0}
                        value={typePriceInput}
                        onChange={(e) => setTypePriceInput(e.target.value)}
                        placeholder="0"
                        className="flex-1 border border-gray-300 rounded text-[11px] px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                        autoFocus
                      />
                      <span className="text-[10px] text-gray-400">원</span>
                    </div>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => handleSaveTypePrice(t.id)} className="text-[10px] text-indigo-600 font-bold hover:underline">저장</button>
                      <button onClick={() => { setEditingTypeId(null); setEditingField(null); }} className="text-[10px] text-gray-400 hover:underline">취소</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingTypeId(t.id);
                      setEditingField("price");
                      setTypePriceInput(String(t.price_per_week));
                    }}
                    className="text-[11px] font-semibold text-left hover:underline flex items-center gap-1"
                    title="주간 요금 편집"
                  >
                    <span className="text-gray-400">💰</span>
                    <span className="text-emerald-700">
                      {t.price_per_week.toLocaleString()}원/주
                    </span>
                    <span className="text-gray-300 text-[10px]">편집</span>
                  </button>
                )}

                {/* ── 가격 (월간) ── */}
                {editingTypeId === t.id && editingField === "monthly" ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-blue-500 w-8 shrink-0">월</span>
                      <input
                        type="number" min={0}
                        value={typePriceMonthInput}
                        onChange={(e) => setTypePriceMonthInput(e.target.value)}
                        placeholder="없음"
                        className="flex-1 border border-blue-200 rounded text-[11px] px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300"
                        autoFocus
                      />
                      <span className="text-[10px] text-gray-400">원</span>
                    </div>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => handleSaveTypeMonthly(t.id)} className="text-[10px] text-blue-600 font-bold hover:underline">저장</button>
                      <button onClick={() => { setEditingTypeId(null); setEditingField(null); }} className="text-[10px] text-gray-400 hover:underline">취소</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingTypeId(t.id);
                      setEditingField("monthly");
                      setTypePriceMonthInput(t.price_per_month != null ? String(t.price_per_month) : "");
                    }}
                    className="text-[11px] font-semibold text-left hover:underline flex items-center gap-1"
                    title="월 요금 편집"
                  >
                    <span className="text-blue-400">📅</span>
                    {t.price_per_month != null
                      ? <span className="text-blue-600">{t.price_per_month.toLocaleString()}원/월</span>
                      : <span className="text-gray-400">월 요금 없음</span>}
                    <span className="text-gray-300 text-[10px]">편집</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 변경 요청 섹션 */}
      <div className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-gray-700">
            <Bell size={16} className="text-orange-500" />
            고객 변경 요청
            {changeRequests.filter(r => r.status === "PENDING").length > 0 && (
              <span className="text-xs bg-orange-500 text-white font-bold px-2 py-0.5 rounded-full">
                {changeRequests.filter(r => r.status === "PENDING").length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={reqStatusFilter}
              onChange={(e) => setReqStatusFilter(e.target.value as "PENDING" | "ALL")}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
            >
              <option value="PENDING">대기 중</option>
              <option value="ALL">전체</option>
            </select>
          </div>
        </div>

        {changeRequests.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            {reqStatusFilter === "PENDING" ? "대기 중인 요청이 없습니다" : "요청 내역이 없습니다"}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {changeRequests.map((req) => {
              const REQ_TYPE_LABEL: Record<string, string> = {
                CAPACITY_CHANGE:      "용량 변경",
                CONVERT_TO_LONG_TERM: "장기 전환",
                ADD_SLOT:             "슬롯 추가",
                TRANSFER_ITEMS:       "물품 이동",
                MERGE_SLOTS:          "슬롯 합치기",
              };
              // 즉시 적용 타입 (DB 자동 반영 → 관리자 물리 작업만 남음)
              const AUTO_APPLY_TYPES = ["CAPACITY_CHANGE", "MERGE_SLOTS"];
              const isAutoApply = AUTO_APPLY_TYPES.includes(req.request_type);

              const STATUS_STYLE: Record<string, string> = {
                PENDING:  "bg-orange-100 text-orange-700",
                APPROVED: "bg-green-100 text-green-700",
                REJECTED: "bg-gray-100 text-gray-500",
                CANCELLED:"bg-gray-100 text-gray-400",
              };
              const isPending = req.status === "PENDING";
              return (
                <div key={req.id} className={`p-4 space-y-2 ${isAutoApply && isPending ? "bg-amber-50/60" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isAutoApply && isPending ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            📋 작업지시
                          </span>
                        ) : (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[req.status] ?? "bg-gray-100 text-gray-500"}`}>
                            {req.status === "PENDING" ? "대기" : req.status === "APPROVED" ? "완료" : req.status === "REJECTED" ? "반려" : "취소"}
                          </span>
                        )}
                        <span className="text-xs font-semibold text-gray-700">{REQ_TYPE_LABEL[req.request_type] ?? req.request_type}</span>
                        {isAutoApply && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full font-semibold">DB 자동적용</span>
                        )}
                        <span className="text-xs text-gray-400">
                          {new Date(req.created_at).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-800 mt-1">
                        {req.customers?.name ?? "-"}
                        <span className="ml-1.5 text-xs text-gray-400 font-mono">{req.customers?.customer_code}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        스토리지: <span className="font-medium">{req.customer_storages?.storage_name ?? "-"}</span>
                        <span className="ml-1 text-gray-400">
                          ({req.customer_storages?.storage_mode === "short_term" ? "단기" : "장기"})
                        </span>
                      </p>
                      {req.request_type === "CAPACITY_CHANGE" && req.requested_type_code && (
                        <p className="text-xs text-indigo-600 mt-0.5">
                          변경 완료 타입: <span className="font-bold">{req.requested_type_code}</span>
                          {req.storage_types && (
                            <span className="text-gray-400 ml-1">
                              {req.storage_types.volume_liter}L · {req.storage_types.price_per_week.toLocaleString()}원/주
                              {req.storage_types.price_per_month != null && ` · ${req.storage_types.price_per_month.toLocaleString()}원/월`}
                            </span>
                          )}
                        </p>
                      )}
                      {req.request_type === "MERGE_SLOTS" && (
                        <p className="text-xs text-orange-600 mt-0.5 font-semibold">
                          {req.source_storage_ids?.length ?? 0}개 슬롯 합치기 —
                          물품을 대표 슬롯으로 물리적 이전 필요
                        </p>
                      )}
                      {req.request_type === "CONVERT_TO_LONG_TERM" && req.requested_plan_type && (
                        <p className="text-xs text-blue-600 mt-0.5">
                          요청 플랜: <span className="font-bold">{req.requested_plan_type}</span>
                        </p>
                      )}
                      {req.customer_note && (
                        <p className="text-xs text-gray-500 mt-1 italic">"{req.customer_note}"</p>
                      )}
                    </div>
                    {isPending && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleProcessRequest(req.id, "APPROVED")}
                          disabled={processingReqId === req.id}
                          className={`flex items-center gap-1 px-2.5 py-1.5 text-white text-xs font-semibold rounded-lg disabled:opacity-50 ${
                            isAutoApply ? "bg-amber-500 hover:bg-amber-600" : "bg-green-600 hover:bg-green-700"
                          }`}
                        >
                          <Check size={12} /> {isAutoApply ? "작업완료" : "승인"}
                        </button>
                        {!isAutoApply && (
                          <button
                            onClick={() => handleProcessRequest(req.id, "REJECTED")}
                            disabled={processingReqId === req.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-300 disabled:opacity-50"
                          >
                            <X size={12} /> 반려
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {/* 관리자 메모 입력 (대기 중일 때만) */}
                  {isPending && (
                    <input
                      type="text"
                      placeholder="처리 메모 (선택)"
                      value={adminNoteInput[req.id] ?? ""}
                      onChange={(e) => setAdminNoteInput(prev => ({ ...prev, [req.id]: e.target.value }))}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    />
                  )}
                  {req.admin_note && !isPending && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-2.5 py-1.5">
                      처리 메모: {req.admin_note}
                    </p>
                  )}
                  {!isPending && req.customer_storages && (
                    <a
                      href={`/storage/${req.customer_storages.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                    >
                      스토리지 바로가기 <ArrowRight size={11} />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 추가 폼 */}
      <div className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden">        <div className="px-5 py-3 border-b border-gray-100 font-semibold text-gray-700 flex items-center gap-2">
          <Plus size={16} className="text-indigo-500" />
          로케이션 추가
        </div>
        <form onSubmit={handleAdd} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* 구역 코드 */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                구역 코드 <span className="text-gray-400 font-normal">(예: A, B, C)</span>
              </label>
              <input
                value={newZone}
                onChange={(e) => setNewZone(e.target.value)}
                placeholder="A"
                maxLength={5}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 uppercase"
                required
              />
            </div>
            {/* 슬롯 번호 */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                슬롯 번호 <span className="text-gray-400 font-normal">(예: 001, 001-100)</span>
              </label>
              <input
                value={newSlots}
                onChange={(e) => setNewSlots(e.target.value)}
                placeholder="001-100"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                required
              />
            </div>
          </div>

          {/* 스토리지 타입 선택 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">
              스토리지 타입 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            {types.length === 0 ? (
              <p className="text-xs text-gray-400">타입 로딩 중…</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {/* 타입 없음 선택지 */}
                <button
                  type="button"
                  onClick={() => setNewTypeId("")}
                  className={`px-3 py-2 rounded-xl border-2 text-xs font-medium text-left transition-all ${
                    newTypeId === ""
                      ? "border-gray-400 bg-gray-50 text-gray-700"
                      : "border-gray-200 text-gray-400 hover:border-gray-300"
                  }`}
                >
                  <p className="font-semibold">미지정</p>
                  <p className="text-gray-400 mt-0.5">—</p>
                </button>

                {types.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setNewTypeId(t.id)}
                    className={`px-3 py-2 rounded-xl border-2 text-xs font-medium text-left transition-all ${
                      newTypeId === t.id
                        ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                        : "border-gray-200 text-gray-600 hover:border-indigo-300 hover:bg-indigo-50/30"
                    }`}
                  >
                    <p className="font-bold">{t.name.replace(" Storage", "").replace(" Rack", "")}</p>
                    <p className="text-gray-500 mt-0.5">{t.volume_liter}L</p>
                    <p className="text-gray-500">
                      {t.price_per_week.toLocaleString()}원/주
                    </p>
                    {t.price_per_month != null && (
                      <p className="text-blue-500 font-semibold">
                        {t.price_per_month.toLocaleString()}원/월
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* 선택된 타입 상세 */}
            {selectedType && (
              <div className="mt-2 p-3 bg-indigo-50 rounded-xl text-xs text-indigo-700 flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${TYPE_BADGE[selectedType.code] ?? "bg-gray-100 text-gray-600"}`}>
                  {selectedType.code}
                </span>
                <span>{selectedType.dim_l_mm} × {selectedType.dim_w_mm} × {selectedType.dim_h_mm} mm</span>
                <span>{selectedType.volume_liter}L</span>
                <span className="font-semibold">{selectedType.price_per_week.toLocaleString()}원/주</span>
                {selectedType.price_per_month != null && (
                  <span className="font-semibold text-blue-600">{selectedType.price_per_month.toLocaleString()}원/월</span>
                )}
              </div>
            )}
          </div>

          {addError && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle size={13} /> {addError}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={adding}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus size={14} /> {adding ? "추가 중…" : "추가"}
            </button>
            <p className="text-xs text-gray-400">
              범위 예: <code className="bg-gray-100 px-1 rounded">001-100</code> → 001~100번 슬롯 100개 생성
            </p>
          </div>
        </form>
      </div>

      {/* 오류 */}
      {deleteError && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertTriangle size={16} /> {deleteError}
        </div>
      )}

      {/* 로케이션 목록 */}
      {loading ? (
        <div className="text-center text-gray-400 py-8">로딩 중…</div>
      ) : zones.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
          <Grid3X3 size={44} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500">등록된 로케이션이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {zoneChunks.map((chunk, blockIdx) => {
            const isOpen      = openBlocks.has(blockIdx);
            const activeZone  = getActiveZone(blockIdx, chunk);
            const currentLocs = grouped[activeZone] ?? [];
            const blockStart  = blockIdx * ZONES_PER_BLOCK + 1;
            const blockEnd    = blockIdx * ZONES_PER_BLOCK + chunk.length;
            const totalSlots  = chunk.reduce((s, z) => s + (grouped[z]?.length ?? 0), 0);
            const totalOccupied = chunk.reduce((s, z) => s + (grouped[z]?.filter(l => l.status === "OCCUPIED").length ?? 0), 0);

            return (
              <div key={blockIdx} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {/* ── 아코디언 헤더 ── */}
                <button
                  type="button"
                  onClick={() => toggleBlock(blockIdx)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-1.5">
                    {chunk.map((z) => (
                      <span key={z} className="w-6 h-6 bg-indigo-100 rounded-md flex items-center justify-center text-xs font-bold text-indigo-700">
                        {z}
                      </span>
                    ))}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">
                      구역 {chunk[0]}{chunk.length > 1 ? ` ~ ${chunk[chunk.length - 1]}` : ""}
                      <span className="text-gray-400 font-normal ml-1.5">({blockStart}~{blockEnd}번 구역)</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {chunk.length}개 Zone · {totalSlots}개 슬롯 · 보관중 {totalOccupied}개
                    </p>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {/* ── 아코디언 콘텐츠 ── */}
                {isOpen && (
                  <>
                    {/* Zone 탭 */}
                    <div className="flex border-t border-b border-gray-100 overflow-x-auto">
                      {chunk.map((zone) => {
                        const isActive = zone === activeZone;
                        const locs     = grouped[zone] ?? [];
                        const occupied = locs.filter((l) => l.status === "OCCUPIED").length;
                        return (
                          <button
                            key={zone}
                            type="button"
                            onClick={() => setActiveZones((prev) => ({ ...prev, [blockIdx]: zone }))}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                              isActive
                                ? "border-indigo-600 text-indigo-700 bg-indigo-50/40"
                                : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                            }`}
                          >
                            <span className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold ${
                              isActive ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"
                            }`}>
                              {zone}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                              isActive ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-500"
                            }`}>
                              {locs.length}
                            </span>
                            {occupied > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">
                                {occupied}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* 슬롯 요약 */}
                    <div className="px-5 py-2 bg-gray-50/50 border-b border-gray-100">
                      <p className="text-xs text-gray-500">
                        <span className="font-semibold text-gray-700">{activeZone} 구역</span> ·{" "}
                        총 <span className="font-semibold">{currentLocs.length}</span>개 ·{" "}
                        보관중 <span className="font-semibold text-blue-600">{currentLocs.filter(l => l.status === "OCCUPIED").length}</span>개 ·{" "}
                        비어있음 <span className="font-semibold text-emerald-600">{currentLocs.filter(l => l.status === "AVAILABLE").length}</span>개
                      </p>
                    </div>

                    {/* 슬롯 테이블 */}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-xs text-gray-400 bg-gray-50/30">
                          <th className="pl-4 pr-2 py-2 w-8">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300 accent-indigo-600"
                              checked={currentLocs.length > 0 && currentLocs.every((l) => selectedIds.has(l.id))}
                              onChange={() => toggleSelectAll(currentLocs.map((l) => l.id))}
                            />
                          </th>
                          <th className="px-3 py-2 text-left font-medium">코드</th>
                          <th className="px-3 py-2 text-left font-medium">타입</th>
                          <th className="px-3 py-2 text-left font-medium">상태</th>
                          <th className="px-3 py-2 text-left font-medium">고객</th>
                          <th className="px-3 py-2 text-right font-medium">액션</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentLocs.map((loc) => (
                          <tr key={loc.id} className={`border-b border-gray-50 hover:bg-gray-50 ${selectedIds.has(loc.id) ? "bg-indigo-50/40" : ""}`}>
                            <td className="pl-4 pr-2 py-3">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 accent-indigo-600"
                                checked={selectedIds.has(loc.id)}
                                onChange={() => toggleSelect(loc.id)}
                              />
                            </td>
                            <td className="px-3 py-3 font-mono font-bold text-gray-900">
                              <Link href={`/storage/${loc.id}`} className="hover:text-indigo-600">
                                {loc.code}
                              </Link>
                            </td>
                            <td className="px-3 py-3 relative">
                              <button
                                type="button"
                                onClick={() => setTypePopover(typePopover === loc.id ? null : loc.id)}
                                className="flex items-center gap-1 group"
                                title="타입 변경"
                              >
                                {loc.storage_types ? (
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TYPE_BADGE[loc.storage_types.code] ?? "bg-gray-100 text-gray-600"}`}>
                                    {loc.storage_types.name.replace(" Storage", "").replace(" Rack", "")}
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-300 group-hover:text-gray-500">미지정</span>
                                )}
                                <ChevronDown size={11} className="text-gray-300 group-hover:text-gray-500 shrink-0" />
                              </button>

                              {typePopover === loc.id && (
                                <div
                                  ref={popoverRef}
                                  className="absolute z-50 left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-2 w-48"
                                >
                                  <p className="text-[10px] text-gray-400 font-semibold px-2 pb-1.5">타입 선택</p>
                                  <button
                                    type="button"
                                    onClick={() => handleSetType(loc.id, null)}
                                    disabled={typeSaving === loc.id}
                                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-50 text-xs text-gray-500"
                                  >
                                    <span>미지정</span>
                                    {!loc.storage_types && <Check size={12} className="text-indigo-500" />}
                                  </button>
                                  {types.map((t) => (
                                    <button
                                      key={t.id}
                                      type="button"
                                      onClick={() => handleSetType(loc.id, t.id)}
                                      disabled={typeSaving === loc.id}
                                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-50 text-xs"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${TYPE_BADGE[t.code] ?? "bg-gray-100 text-gray-600"}`}>
                                          {t.name.replace(" Storage", "").replace(" Rack", "")}
                                        </span>
                                        <span className="text-gray-400">{t.volume_liter}L</span>
                                      </div>
                                      {loc.storage_types?.id === t.id && <Check size={12} className="text-indigo-500 shrink-0" />}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLOR[loc.status] ?? STATUS_COLOR.AVAILABLE}`}>
                                {STATUS_LABEL[loc.status] ?? loc.status}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-gray-600 text-xs">
                              {loc.customers ? (
                                <span>
                                  {loc.customers.name ?? ""}{" "}
                                  <span className="font-mono text-gray-400">{loc.customers.customer_code}</span>
                                </span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <button
                                onClick={() => handleDelete(loc.id, loc.code)}
                                disabled={deleting === loc.id || loc.status === "OCCUPIED"}
                                title={loc.status === "OCCUPIED" ? "보관중 — 먼저 고객을 해제하세요" : "삭제"}
                                className="text-gray-300 hover:text-red-500 disabled:opacity-30 transition-colors"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── 일괄 변경 바 (선택 시 하단 sticky) ── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl">
          <Layers size={16} className="text-indigo-400 shrink-0" />
          <span className="text-sm font-semibold text-indigo-300">{selectedIds.size}개 선택됨</span>

          <div className="w-px h-5 bg-gray-600" />

          {/* 타입 일괄 변경 */}
          <div className="relative" ref={bulkTypeRef}>
            <button
              type="button"
              onClick={() => { setBulkTypeOpen((v) => !v); setBulkStatusOpen(false); }}
              disabled={bulkSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 rounded-xl text-sm hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              타입 변경 <ChevronDown size={12} />
            </button>
            {bulkTypeOpen && (
              <div className="absolute bottom-full mb-2 left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-2 w-48 text-gray-800">
                <p className="text-[10px] text-gray-400 font-semibold px-2 pb-1.5">일괄 적용할 타입</p>
                <button
                  type="button"
                  onClick={() => bulkAction("set_type", { type_id: null })}
                  className="w-full px-2 py-1.5 rounded-lg hover:bg-gray-50 text-xs text-gray-500 text-left"
                >
                  미지정 (초기화)
                </button>
                {types.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => bulkAction("set_type", { type_id: t.id })}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-xs"
                  >
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${TYPE_BADGE[t.code] ?? "bg-gray-100 text-gray-600"}`}>
                      {t.name.replace(" Storage", "").replace(" Rack", "")}
                    </span>
                    <span className="text-gray-400">{t.volume_liter}L</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 상태 일괄 변경 */}
          <div className="relative" ref={bulkStatusRef}>
            <button
              type="button"
              onClick={() => { setBulkStatusOpen((v) => !v); setBulkTypeOpen(false); }}
              disabled={bulkSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 rounded-xl text-sm hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              상태 변경 <ChevronDown size={12} />
            </button>
            {bulkStatusOpen && (
              <div className="absolute bottom-full mb-2 left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-2 w-40 text-gray-800">
                <p className="text-[10px] text-gray-400 font-semibold px-2 pb-1.5">상태 일괄 변경</p>
                <p className="text-[9px] text-gray-400 px-2 pb-1">보관중/배정중 슬롯은 자동 제외</p>
                {[
                  { key: "AVAILABLE", label: "비어있음", cls: "text-emerald-700" },
                  { key: "DISABLED",  label: "사용불가", cls: "text-gray-500"    },
                ].map(({ key, label, cls }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => bulkAction("set_status", { status: key })}
                    className={`w-full px-2 py-1.5 rounded-lg hover:bg-gray-50 text-xs font-semibold text-left ${cls}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 일괄 삭제 */}
          <button
            type="button"
            onClick={() => {
              if (confirm(`${selectedIds.size}개 슬롯을 삭제하시겠습니까?\n보관중/배정중 슬롯은 자동 제외됩니다.`))
                bulkAction("delete");
            }}
            disabled={bulkSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 rounded-xl text-sm hover:bg-red-500 transition-colors disabled:opacity-50"
          >
            <Trash2 size={13} /> 삭제
          </button>

          <div className="w-px h-5 bg-gray-600" />

          <button
            type="button"
            onClick={clearSelection}
            className="text-gray-400 hover:text-white transition-colors"
            title="선택 해제"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
