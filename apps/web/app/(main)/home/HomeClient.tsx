"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, ChevronRight, Bell, Truck, Calculator, Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface UserInfo {
  name: string;
}

interface InvoiceItem {
  name_en: string;
  product_name?: string;
  quantity: number;
}

interface Parcel {
  id: string;
  tracking_no: string | null;
  pickup_tracking_no: string | null;
  status: string;
  sender_name: string | null;
  created_at: string;
  inbound_at: string | null;
  weight_actual: number | null;
  hold_reason: string | null;
  notes: string | null;
  tracking_last_event: { statusLabel: string; description: string; location: string } | null;
  pre_invoice_items: InvoiceItem[] | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  PRE_REGISTERED: { label: "등록 완료",  color: "text-indigo-700 bg-indigo-50 border-indigo-200", dot: "bg-indigo-400" },
  PENDING_PICKUP: { label: "수거 신청", color: "text-yellow-700 bg-yellow-50 border-yellow-200", dot: "bg-yellow-400" },
  PICKED_UP:      { label: "수거 완료", color: "text-blue-700 bg-blue-50 border-blue-200",       dot: "bg-blue-400" },
  INBOUND:        { label: "입고 완료", color: "text-green-700 bg-green-50 border-green-200",    dot: "bg-green-400" },
  INSPECTION:     { label: "검품 중",   color: "text-purple-700 bg-purple-50 border-purple-200", dot: "bg-purple-400" },
  PACKING:        { label: "포장 작업", color: "text-orange-700 bg-orange-50 border-orange-200", dot: "bg-orange-400" },
  HOLD:           { label: "보류",      color: "text-red-700 bg-red-50 border-red-200",           dot: "bg-red-400" },
  PAYMENT_WAIT:   { label: "결제 대기", color: "text-amber-700 bg-amber-50 border-amber-200",     dot: "bg-amber-400" },
  SHIPPING:       { label: "국제 발송", color: "text-blue-800 bg-blue-100 border-blue-300",       dot: "bg-blue-600" },
  DONE:           { label: "배송 완료", color: "text-gray-600 bg-gray-50 border-gray-200",        dot: "bg-gray-400" },
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
          .select("id, tracking_no, pickup_tracking_no, status, sender_name, created_at, inbound_at, weight_actual, hold_reason, notes, tracking_last_event, pre_invoice_items")
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
          <div className="space-y-3">
            {parcels.map((parcel) => {
              const cfg = STATUS_CONFIG[parcel.status] ?? STATUS_CONFIG.DONE;
              const items = parcel.pre_invoice_items ?? [];
              const trackingNo = parcel.tracking_no || parcel.pickup_tracking_no;
              return (
                <Link
                  key={parcel.id}
                  href={`/warehouse/${parcel.id}`}
                  className="block bg-white rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0 pr-2">
                      {/* 내품 제목 */}
                      {items.length > 0 ? (
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {items[0].product_name || items[0].name_en}
                          {items.length > 1 && <span className="text-gray-400 font-normal"> 외 {items.length - 1}종</span>}
                        </p>
                      ) : (
                        <p className="text-sm font-semibold text-gray-400">물품 미등록</p>
                      )}
                      {/* 발송인 · 메모 */}
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {parcel.sender_name ?? "발송인 미확인"}
                        {parcel.notes ? ` · ${parcel.notes}` : ""}
                      </p>
                      {/* 내품 수량 */}
                      {items.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          총 {items.reduce((s, i) => s + i.quantity, 0)}개
                          {trackingNo && <span className="text-gray-300 font-mono ml-2 tracking-tight">{trackingNo}</span>}
                        </p>
                      )}
                    </div>
                    <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 ${cfg.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>입고: {parcel.inbound_at ? new Date(parcel.inbound_at).toLocaleDateString("ko-KR") : "대기중"}</span>
                    {parcel.weight_actual && <span>무게: {(parcel.weight_actual / 1000).toFixed(2)}kg</span>}
                  </div>

                  {parcel.status === "HOLD" && parcel.hold_reason && (
                    <div className="mt-2 bg-red-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-red-600">⚠️ {parcel.hold_reason}</p>
                    </div>
                  )}
                  {parcel.status === "PRE_REGISTERED" && (
                    <div className="mt-2 bg-indigo-50 rounded-lg px-3 py-2">
                      {parcel.tracking_last_event ? (
                        <p className="text-xs text-indigo-700">
                          🚚 {parcel.tracking_last_event.statusLabel || parcel.tracking_last_event.description}
                          {parcel.tracking_last_event.location ? ` · ${parcel.tracking_last_event.location}` : ""}
                        </p>
                      ) : (
                        <p className="text-xs text-indigo-600">📬 센터 도착 대기 중 · 도착 후 입고 처리됩니다</p>
                      )}
                    </div>
                  )}
                  {parcel.status === "PENDING_PICKUP" && (
                    <div className="mt-2 bg-yellow-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-yellow-700">📦 우체국 수거 예약 완료 · 집배원 방문 예정</p>
                    </div>
                  )}
                  {parcel.status === "PICKED_UP" && (
                    <div className="mt-2 bg-blue-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-blue-700">🚛 수거 완료 · 센터로 이동 중</p>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
