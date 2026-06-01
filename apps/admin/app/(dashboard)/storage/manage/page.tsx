"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, AlertTriangle, Warehouse, Grid3X3, RefreshCw } from "lucide-react";

type LocationRow = {
  id: string;
  code: string;
  zone: string;
  slot: string;
  status: string;
  customer_id: string | null;
  customers: { name: string | null; customer_code: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "비어있음",
  OCCUPIED:  "사용중",
  DISABLED:  "사용불가",
};

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: "text-emerald-700 bg-emerald-50 border-emerald-200",
  OCCUPIED:  "text-blue-700 bg-blue-50 border-blue-200",
  DISABLED:  "text-gray-500 bg-gray-100 border-gray-200",
};

export default function StorageManagePage() {
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);

  // 새 로케이션 추가 폼
  const [newZone, setNewZone] = useState("");
  const [newSlots, setNewSlots] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/storage/list");
    const json = await res.json();
    setLocations(json.locations ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setAddError(null);

    // 슬롯을 쉼표로 파싱: "01,02,03" 또는 "01-05" (범위 지원)
    let slots: string[] = [];
    const parts = newSlots.split(",").map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      const range = part.match(/^(\d+)-(\d+)$/);
      if (range) {
        const from = parseInt(range[1], 10);
        const to = parseInt(range[2], 10);
        for (let i = from; i <= to; i++) {
          slots.push(String(i).padStart(2, "0"));
        }
      } else {
        slots.push(part.padStart(2, "0"));
      }
    }
    slots = [...new Set(slots)];

    const res = await fetch("/api/admin/storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zone: newZone.toUpperCase(), slots }),
    });
    const json = await res.json();
    if (!res.ok) {
      setAddError(json.error ?? "오류 발생");
    } else {
      setNewZone("");
      setNewSlots("");
      await load();
    }
    setAdding(false);
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`${code} 로케이션을 삭제하시겠습니까?`)) return;
    setDeleting(id);
    setDeleteError(null);
    const res = await fetch(`/api/admin/storage/${id}`, { method: "DELETE" });
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

  return (
    <div className="max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/storage" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Warehouse size={20} className="text-indigo-600" />
            로케이션 관리
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
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                슬롯 번호 <span className="text-gray-400 font-normal">(예: 01, 01-10, 01,03,05)</span>
              </label>
              <input
                value={newSlots}
                onChange={(e) => setNewSlots(e.target.value)}
                placeholder="01-10"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                required
              />
            </div>
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
              범위 입력 예: <code className="bg-gray-100 px-1 rounded">01-10</code>으로 01~10번 슬롯 한 번에 생성
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
        <div className="space-y-4">
          {zones.map((zone) => (
            <div key={zone} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
                <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <span className="text-xs font-bold text-indigo-700">{zone}</span>
                </div>
                <span className="font-semibold text-gray-800">구역 {zone}</span>
                <span className="text-xs text-gray-400 ml-auto">
                  {grouped[zone].length}개 슬롯
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50/50 text-xs text-gray-400">
                    <th className="px-5 py-2 text-left font-medium">코드</th>
                    <th className="px-5 py-2 text-left font-medium">상태</th>
                    <th className="px-5 py-2 text-left font-medium">고객</th>
                    <th className="px-5 py-2 text-right font-medium">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[zone].map((loc) => (
                    <tr key={loc.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3 font-mono font-bold text-gray-900">
                        <Link href={`/storage/${loc.id}`} className="hover:text-indigo-600">
                          {loc.code}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLOR[loc.status]}`}>
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
                          title={loc.status === "OCCUPIED" ? "사용중 — 먼저 고객을 해제하세요" : "삭제"}
                          className="text-gray-300 hover:text-red-500 disabled:opacity-30 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
