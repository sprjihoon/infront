"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";

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

export default function ShippingStorageView({
  name,
  parcels,
}: {
  name: string;
  parcels: Parcel[];
}) {
  const router = useRouter();
  const ready = parcels.filter((p) => phaseOf(p) === "ready");

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.push("/storage")} className="p-1 -ml-1 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-900">{name}</h1>
          <p className="text-xs text-gray-400">배송 · 보관료는 출고할 때 계산됩니다</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
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
    </div>
  );
}
