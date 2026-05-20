"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, ChevronRight, Bell, Truck, Calculator, Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface UserInfo {
  name: string;
}

interface Parcel {
  id: string;
  tracking_no: string | null;
  status: string;
  created_at: string;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PRE_REGISTERED: { label: "등록 완료",       color: "text-indigo-600 bg-indigo-50" },
  PENDING_PICKUP: { label: "수거 신청 완료", color: "text-yellow-600 bg-yellow-50" },
  PICKED_UP:      { label: "수거 완료",      color: "text-blue-600 bg-blue-50"   },
  INBOUND:        { label: "창고 입고",       color: "text-green-600 bg-green-50" },
  INSPECTION:     { label: "검품 중",         color: "text-purple-600 bg-purple-50" },
  PACKING:        { label: "포장 작업",       color: "text-orange-600 bg-orange-50" },
  HOLD:           { label: "보류",            color: "text-red-600 bg-red-50"     },
  PAYMENT_WAIT:   { label: "결제 대기",       color: "text-amber-600 bg-amber-50" },
  SHIPPING:       { label: "국제 발송",       color: "text-blue-700 bg-blue-100"  },
  DONE:           { label: "배송 완료",       color: "text-gray-600 bg-gray-100"  },
};

const QUICK_ACTIONS = [
  {
    href: "/pickup",
    icon: <Truck size={24} className="text-white" />,
    label: "수거 신청",
    sub: "우체국 방문수거",
    className: "bg-blue-600",
    labelClass: "text-white",
    subClass: "text-blue-200",
  },
  {
    href: "/warehouse",
    icon: <Package size={24} className="text-blue-600" />,
    label: "내 물품",
    sub: "창고 입고 현황",
    className: "bg-white",
    labelClass: "text-gray-900",
    subClass: "text-gray-500",
  },
  {
    href: "/orders",
    icon: <Globe size={24} className="text-green-600" />,
    label: "배송 현황",
    sub: "해외 배송 추적",
    className: "bg-white",
    labelClass: "text-gray-900",
    subClass: "text-gray-500",
  },
  {
    href: "/shipping-calc",
    icon: <Calculator size={24} className="text-violet-600" />,
    label: "요금 계산",
    sub: "EMS · K-Packet",
    className: "bg-white",
    labelClass: "text-gray-900",
    subClass: "text-gray-500",
  },
];

// 세션당 1회만 추적 동기화 (30분 쿨다운)
const SYNC_COOLDOWN_MS = 30 * 60 * 1000;
const SYNC_KEY = "tracking_synced_at";

function shouldSync(): boolean {
  try {
    const last = sessionStorage.getItem(SYNC_KEY);
    if (!last) return true;
    return Date.now() - parseInt(last, 10) > SYNC_COOLDOWN_MS;
  } catch { return true; }
}

function markSynced() {
  try { sessionStorage.setItem(SYNC_KEY, String(Date.now())); } catch { /* ignore */ }
}

export default function HomeClient() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [parcels,  setParcels]  = useState<Parcel[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      supabase
        .from("customers")
        .select("name")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => setUserInfo(data));

      const fetchParcels = () =>
        supabase
          .from("parcels")
          .select("id, tracking_no, status, created_at")
          .eq("customer_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5)
          .then(({ data }) => setParcels(data ?? []));

      // 추적 동기화 (세션당 1회)
      if (shouldSync()) {
        fetch("/api/parcels/sync-tracking", { method: "POST" })
          .then(() => { markSynced(); fetchParcels(); })
          .catch(() => fetchParcels());
      } else {
        fetchParcels();
      }
    });
  }, []);

  return (
    <div className="px-4 py-6 space-y-5">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            안녕하세요 {userInfo?.name ?? ""}님 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            무엇을 도와드릴까요?
          </p>
        </div>
        <button className="relative p-2">
          <Bell size={22} className="text-gray-700" />
        </button>
      </div>

      {/* 서비스 안내 배너 */}
      <div className="bg-gradient-to-r from-blue-600 to-violet-600 rounded-2xl p-5 text-white">
        <p className="text-white/70 text-xs font-medium mb-1">인프론트 해외배송 대행</p>
        <p className="text-base font-bold leading-snug">
          수거 → 검품 → 포장 → 국제발송<br />
          <span className="text-white/80 text-sm font-normal">EMS · EMS 프리미엄 · K-Packet</span>
        </p>
        <Link
          href="/pickup"
          className="mt-4 inline-flex items-center gap-1.5 bg-white text-blue-600 rounded-xl px-4 py-2 text-sm font-semibold active:scale-95 transition-transform"
        >
          <Truck size={15} />
          수거 신청하기
        </Link>
      </div>

      {/* 빠른 서비스 */}
      <div className="grid grid-cols-2 gap-3">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={`${a.className} rounded-2xl p-4 flex flex-col gap-2 shadow-sm active:scale-[0.97] transition-transform`}
          >
            {a.icon}
            <div>
              <p className={`text-sm font-semibold ${a.labelClass}`}>{a.label}</p>
              <p className={`text-xs ${a.subClass}`}>{a.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* 최근 물품 현황 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900">최근 물품 현황</h2>
          <Link href="/warehouse" className="text-xs text-blue-600 font-medium flex items-center gap-0.5">
            전체보기 <ChevronRight size={14} />
          </Link>
        </div>

        {parcels.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <Truck size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">아직 접수된 물품이 없어요</p>
            <p className="text-gray-400 text-xs mt-1">
              수거 신청을 해보세요
            </p>
            <Link
              href="/pickup"
              className="mt-4 inline-flex items-center gap-1 bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-medium"
            >
              <Truck size={14} /> 수거 신청
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {parcels.map((parcel) => {
              const s = STATUS_LABEL[parcel.status] ?? {
                label: parcel.status,
                color: "text-gray-600 bg-gray-100",
              };
              return (
                <Link
                  key={parcel.id}
                  href={`/warehouse/${parcel.id}`}
                  className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between active:scale-[0.98] transition-transform"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {parcel.tracking_no ?? "운송장 미등록"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(parcel.created_at).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${s.color}`}>
                    {s.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
