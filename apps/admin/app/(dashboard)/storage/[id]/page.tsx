"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  User,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
} from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING_PICKUP: { label: "수거신청", color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  INBOUND:        { label: "입고",     color: "text-blue-700 bg-blue-50 border-blue-200" },
  INSPECTION:     { label: "검수중",   color: "text-purple-700 bg-purple-50 border-purple-200" },
  STORAGE:        { label: "보관중",   color: "text-indigo-700 bg-indigo-50 border-indigo-200" },
  HOLD:           { label: "보류",     color: "text-orange-700 bg-orange-50 border-orange-200" },
  SHIPPABLE:      { label: "출고가능", color: "text-green-700 bg-green-50 border-green-200" },
  DONE:           { label: "완료",     color: "text-gray-500 bg-gray-50 border-gray-200" },
  SHIPPING:       { label: "배송중",   color: "text-cyan-700 bg-cyan-50 border-cyan-200" },
};

type Parcel = {
  id: string;
  tracking_no: string;
  status: string;
  inbound_at: string | null;
  weight_actual: number | null;
  pre_invoice_items: { name: string }[] | null;
  sender_name: string | null;
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
        <div className="px-5 py-3 border-b border-gray-100 font-semibold text-gray-700 flex items-center gap-2">
          <Package size={16} className="text-blue-500" />
          보관 중인 소포 ({parcels.length}개)
        </div>
        {parcels.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">보관 중인 소포가 없습니다</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {parcels.map((p) => {
              const sc = STATUS_LABELS[p.status] ?? { label: p.status, color: "text-gray-500 bg-gray-50 border-gray-200" };
              const itemName = p.pre_invoice_items?.[0]?.name ?? p.sender_name ?? "-";
              return (
                <li key={p.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sc.color}`}>
                        {sc.label}
                      </span>
                      <span className="text-xs font-mono text-gray-500 truncate">{p.tracking_no}</span>
                    </div>
                    <p className="text-sm text-gray-700 truncate">{itemName}</p>
                    {p.inbound_at && (
                      <p className="text-[10px] text-gray-400">
                        입고 {new Date(p.inbound_at).toLocaleDateString("ko-KR")}
                        {p.weight_actual ? ` · ${p.weight_actual}kg` : ""}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/parcels/${p.id}`}
                    className="text-xs text-indigo-600 hover:underline shrink-0"
                  >
                    상세 보기
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
