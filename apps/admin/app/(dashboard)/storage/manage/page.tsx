"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, AlertTriangle, Warehouse, Grid3X3, RefreshCw, ChevronDown, Check } from "lucide-react";

type StorageTypeOption = {
  id: string;
  code: string;
  name: string;
  dim_l_mm: number;
  dim_w_mm: number;
  dim_h_mm: number;
  volume_liter: number;
  price_per_week: number;
  price_max: number | null;
};

type LocationRow = {
  id: string;
  code: string;
  zone: string;
  slot: string;
  status: string;
  customer_id: string | null;
  customers: { name: string | null; customer_code: string } | null;
  storage_types: { id: string; code: string; name: string; volume_liter: number; price_per_week: number } | null;
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
  const [typePopover,  setTypePopover]  = useState<string | null>(null); // location id
  const [typeSaving,   setTypeSaving]   = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const ZONES_PER_BLOCK = 10;

  const toggleBlock = (idx: number) =>
    setOpenBlocks((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });

  const getActiveZone = (idx: number, chunk: string[]) =>
    (activeZones[idx] && chunk.includes(activeZones[idx])) ? activeZones[idx] : chunk[0];

  const load = useCallback(async () => {
    setLoading(true);
    const [locRes, typeRes] = await Promise.all([
      fetch("/api/admin/storage/list"),
      fetch("/api/admin/storage"),
    ]);
    const locJson  = await locRes.json();
    const typeJson = await typeRes.json();
    setLocations(locJson.locations ?? []);
    setTypes(typeJson.types ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // 팝오버 바깥 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setTypePopover(null);
      }
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

      {/* 추가 폼 */}
      <div className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 font-semibold text-gray-700 flex items-center gap-2">
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
                      {t.price_per_week.toLocaleString()}원
                      {t.price_max ? `~${t.price_max.toLocaleString()}원` : ""}
                      /주
                    </p>
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
                          <th className="px-5 py-2 text-left font-medium">코드</th>
                          <th className="px-5 py-2 text-left font-medium">타입</th>
                          <th className="px-5 py-2 text-left font-medium">상태</th>
                          <th className="px-5 py-2 text-left font-medium">고객</th>
                          <th className="px-5 py-2 text-right font-medium">액션</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentLocs.map((loc) => (
                          <tr key={loc.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="px-5 py-3 font-mono font-bold text-gray-900">
                              <Link href={`/storage/${loc.id}`} className="hover:text-indigo-600">
                                {loc.code}
                              </Link>
                            </td>
                            <td className="px-5 py-3 relative">
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
                            <td className="px-5 py-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLOR[loc.status] ?? STATUS_COLOR.AVAILABLE}`}>
                                {STATUS_LABEL[loc.status] ?? loc.status}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-gray-600 text-xs">
                              {loc.customers ? (
                                <span>
                                  {loc.customers.name ?? ""}{" "}
                                  <span className="font-mono text-gray-400">{loc.customers.customer_code}</span>
                                </span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3 text-right">
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
    </div>
  );
}
