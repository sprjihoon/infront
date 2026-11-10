"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Archive, Check, Package, X } from "lucide-react";

type Parcel = {
  id: string;
  tracking_no: string | null;
  status: string;
  is_shippable: boolean;
  inbound_at: string | null;
  sender_name: string | null;
};

const PHASE: Record<string, { label: string; color: string }> = {
  coming: { label: "오는 중", color: "bg-indigo-50 text-indigo-700" },
  arrived: { label: "센터 도착", color: "bg-amber-50 text-amber-800" },
  ready: { label: "보낼 준비", color: "bg-green-50 text-green-700" },
  gone: { label: "발송됨", color: "bg-gray-100 text-gray-500" },
};

function phaseOf(p: Parcel): keyof typeof PHASE {
  if (p.status === "SHIPPED" || p.status === "RETURNED") return "gone";
  if (p.is_shippable || p.status === "SHIPPABLE" || p.status === "READY") return "ready";
  if (p.status === "INBOUND" || p.inbound_at) return "arrived";
  return "coming";
}

type BlockType = {
  id: string;
  code: string;
  name: string;
  price_per_month: number | null;
  price_per_week: number;
  volume_liter: number | null;
};

export default function ShippingStorageView({
  storageId,
  name,
  parcels,
}: {
  storageId: string;
  name: string;
  parcels: Parcel[];
}) {
  const router = useRouter();
  const [showConvert, setShowConvert] = useState(false);
  const ready = parcels.filter((p) => phaseOf(p) === "ready");

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.push("/storage")} className="p-1 -ml-1 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-900">{name}</h1>
          <p className="text-xs text-gray-400">배송 · 입고 후 7일은 크기와 관계없이 무료</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        <button
          type="button"
          onClick={() => setShowConvert(true)}
          className="w-full bg-white border-2 border-brand-200 text-brand-700 rounded-2xl px-4 py-3.5 flex items-center justify-center gap-2 text-sm font-bold"
        >
          <Archive size={16} />
          장기보관으로 전환하기
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={ready.length === 0}
            onClick={() => router.push("/domestic-shipping")}
            className="bg-white border border-gray-100 rounded-2xl px-4 py-4 text-left disabled:opacity-40"
          >
            <p className="text-sm font-bold text-gray-900">국내 출고</p>
            <p className="text-xs text-gray-400 mt-1">우체국 소포</p>
          </button>
          <button
            type="button"
            disabled={ready.length === 0}
            onClick={() => router.push("/shipping-request")}
            className="bg-white border border-gray-100 rounded-2xl px-4 py-4 text-left disabled:opacity-40"
          >
            <p className="text-sm font-bold text-gray-900">해외 출고</p>
            <p className="text-xs text-gray-400 mt-1">EMS · K-Packet · EMS 프리미엄</p>
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-sm font-bold text-gray-900">물건</p>
          </div>
          {parcels.length === 0 ? (
            <p className="px-4 py-8 text-sm text-gray-400 text-center">아직 들어온 물건이 없습니다</p>
          ) : (
            <ul>
              {parcels.map((p) => {
                const phase = PHASE[phaseOf(p)];
                return (
                  <li key={p.id} className="px-4 py-3 flex items-center gap-3 border-b border-gray-50 last:border-0">
                    <Package size={16} className="text-gray-300 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{p.tracking_no ?? "운송장 미확인"}</p>
                      {p.sender_name && <p className="text-[11px] text-gray-400 truncate">{p.sender_name}</p>}
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${phase.color}`}>{phase.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {showConvert && (
        <ConvertSheet
          storageId={storageId}
          onClose={() => setShowConvert(false)}
        />
      )}
    </div>
  );
}

function ConvertSheet({ storageId, onClose }: { storageId: string; onClose: () => void }) {
  const [types, setTypes] = useState<BlockType[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/storage/types")
      .then((r) => r.json())
      .then((j) => setTypes((j.types ?? []).filter((t: BlockType) => t.code !== "SHIPPING")))
      .finally(() => setLoading(false));
  }, []);

  async function submit() {
    const type = types.find((t) => t.id === selected);
    if (!type) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/storage/${storageId}/change-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_type: "CONVERT_TO_LONG_TERM",
          requested_type_id: type.id,
          requested_type_code: type.code,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "요청 접수에 실패했습니다.");
        return;
      }
      setDone(true);
    } catch {
      setError("오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-[520px] bg-white rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col">
        <div className="px-4 pt-5 pb-3 flex items-center justify-between border-b border-gray-100">
          <div>
            <p className="text-base font-bold text-gray-900">장기보관으로 전환</p>
            <p className="text-xs text-gray-400 mt-0.5">사이즈를 고르면 그 블록으로 보관이 시작됩니다</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>
        {done ? (
          <div className="px-4 py-10 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <Check size={24} className="text-green-600" />
            </div>
            <p className="text-sm font-bold text-gray-900">전환 요청이 접수되었습니다</p>
            <p className="text-xs text-gray-500 text-center">관리자가 확인한 뒤 장기보관 블록으로 바꿉니다.</p>
            <button type="button" onClick={onClose} className="mt-2 px-8 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-2xl">
              확인
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-y-auto flex-1 px-4 py-4 space-y-2">
              {loading ? (
                <p className="py-8 text-center text-sm text-gray-400">사이즈를 불러오는 중...</p>
              ) : (
                types.map((type) => {
                  const on = selected === type.id;
                  const monthly = type.price_per_month ?? type.price_per_week * 4;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setSelected(type.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 text-left ${
                        on ? "border-brand-500 bg-brand-50" : "border-gray-100 bg-white"
                      }`}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900">{type.name}</p>
                        {type.volume_liter != null && (
                          <p className="text-xs text-gray-400 mt-0.5">{type.volume_liter}L</p>
                        )}
                      </div>
                      <p className="text-sm font-bold text-gray-800">{monthly.toLocaleString()}원/월</p>
                    </button>
                  );
                })
              )}
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
            <div className="px-4 pt-3 pb-5 border-t border-gray-100">
              <button
                type="button"
                onClick={submit}
                disabled={!selected || submitting}
                className="w-full bg-brand-600 text-white text-sm font-bold py-4 rounded-2xl disabled:opacity-40"
              >
                {submitting ? "처리 중..." : "전환 요청하기"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
