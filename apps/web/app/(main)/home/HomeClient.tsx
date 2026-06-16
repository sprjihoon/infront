"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Bell, Truck, Calculator, Send, BookOpen, List, Receipt, Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ActionDashboard from "@/components/ActionDashboard";
import {
  formatParcelItemTitle,
  normalizeParcelItems,
} from "@/lib/parcel-item-display";
import { getParcelDisplaySummary } from "@/lib/parcel-display";
import { isParcelVisibleToCustomer } from "@/lib/parcel-lifecycle";

interface UserInfo {
  name: string;
}

interface InvoiceItem {
  name_en: string;
  product_name?: string;
  quantity: number;
}

interface Order {
  id: string;
  order_no: string;
  status: string;
  shipping_method: string;
  recipient_name: string | null;
  recipient_country: string | null;
  created_at: string;
}

const ORDER_STATUS: Record<string, { label: string; color: string; dot: string }> = {
  DRAFT:               { label: "신청 완료",   color: "text-brand-700 bg-brand-50 border-brand-200",     dot: "bg-brand-400" },
  PACKAGING_REQUESTED: { label: "포장 요청",   color: "text-orange-700 bg-orange-50 border-orange-200", dot: "bg-orange-400" },
  PACKAGING_DONE:      { label: "포장 완료",   color: "text-teal-700 bg-teal-50 border-teal-200",       dot: "bg-teal-400" },
  QUOTE_SENT:          { label: "견적 발송",   color: "text-amber-700 bg-amber-50 border-amber-200",    dot: "bg-amber-400" },
  PENDING_PAYMENT:     { label: "결제 대기",   color: "text-red-700 bg-red-50 border-red-200",          dot: "bg-red-400" },
  PAID:                { label: "결제 완료",   color: "text-green-700 bg-green-50 border-green-200",    dot: "bg-green-400" },
  IN_TRANSIT:          { label: "배송 중",     color: "text-sky-700 bg-sky-50 border-sky-200",          dot: "bg-sky-400" },
  DELIVERED:           { label: "배송 완료",   color: "text-gray-600 bg-gray-50 border-gray-200",       dot: "bg-gray-400" },
  CANCELLED:           { label: "취소됨",      color: "text-gray-400 bg-gray-50 border-gray-200",       dot: "bg-gray-300" },
};

const COUNTRY_FLAG: Record<string, string> = {
  JP: "🇯🇵", CN: "🇨🇳", US: "🇺🇸", AU: "🇦🇺", CA: "🇨🇦",
  GB: "🇬🇧", SG: "🇸🇬", HK: "🇭🇰", TW: "🇹🇼", TH: "🇹🇭",
  VN: "🇻🇳", PH: "🇵🇭", MY: "🇲🇾", ID: "🇮🇩", DE: "🇩🇪", FR: "🇫🇷",
};

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
  is_shippable: boolean | null;
  tracking_last_event: { statusLabel: string; description: string; location: string; time: string } | null;
  pre_invoice_items: InvoiceItem[] | null;
}

const QUICK_ACTIONS = [
  {
    href: "/pickup",
    icon: <Truck size={24} className="text-white" />,
    label: "수거 신청",
    sub: "우체국 방문수거",
    className: "bg-brand-600",
    labelClass: "text-white",
    subClass: "text-brand-200",
  },
  {
    href: "/shipping-calc",
    icon: <Calculator size={24} className="text-brand-600" />,
    label: "해외배송 계산기",
    sub: "EMS · K-Packet",
    className: "bg-white",
    labelClass: "text-gray-900",
    subClass: "text-gray-500",
  },
  {
    href: "/pricing",
    icon: <List size={24} className="text-orange-500" />,
    label: "해외배송 가격표",
    sub: "우체국 요금표",
    className: "bg-white",
    labelClass: "text-gray-900",
    subClass: "text-gray-500",
  },
  {
    href: "/domestic-rates",
    icon: <Receipt size={24} className="text-amber-500" />,
    label: "국내배송 가격표",
    sub: "규격·크기·무게 안내",
    className: "bg-white",
    labelClass: "text-gray-900",
    subClass: "text-gray-500",
  },
  {
    href: "/guide",
    icon: <BookOpen size={24} className="text-teal-600" />,
    label: "쉬운 가이드",
    sub: "이용 방법 안내",
    className: "bg-white",
    labelClass: "text-gray-900",
    subClass: "text-gray-500",
  },
  {
    href: "/orders",
    icon: <Globe size={24} className="text-sky-500" />,
    label: "배송 현황",
    sub: "국제배송 추적",
    className: "bg-white",
    labelClass: "text-gray-900",
    subClass: "text-gray-500",
  },
];

// 로그인 세션당 1회만 추적 동기화 (세션 스토리지 — 탭/창 닫으면 초기화)
const SYNC_KEY = "tracking_synced_session";

function shouldSync(): boolean {
  try { return !sessionStorage.getItem(SYNC_KEY); } catch { return true; }
}

function markSynced() {
  try { sessionStorage.setItem(SYNC_KEY, "1"); } catch { /* ignore */ }
}

const PROTECTED_PREFIXES = [
  "/pickup",
  "/storage",
  "/shipping-request",
  "/orders",
  "/notifications",
  "/mypage",
  "/addresses",
  "/return-request",
  "/register-parcel",
];

function authHref(href: string, isLoggedIn: boolean) {
  if (isLoggedIn) return href;
  if (PROTECTED_PREFIXES.some((p) => href.startsWith(p))) {
    return `/login?redirect=${encodeURIComponent(href)}`;
  }
  return href;
}

export default function HomeClient() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [parcels,  setParcels]  = useState<Parcel[]>([]);
  const [orders,   setOrders]   = useState<Order[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setIsLoggedIn(false);
        return;
      }

      setIsLoggedIn(true);
      supabase
        .from("customers")
        .select("name")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => setUserInfo(data));

      // 미읽음 알림
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false)
        .then(({ count }) => setUnreadNotifications(count ?? 0));

      const fetchParcels = () =>
        supabase
          .from("parcels")
          .select("id, tracking_no, pickup_tracking_no, status, sender_name, created_at, inbound_at, weight_actual, is_shippable, hold_reason, notes, tracking_last_event, pre_invoice_items")
          .eq("customer_id", user.id)
          .neq("status", "DONE")
          .order("created_at", { ascending: false })
          .limit(30)
          .then(({ data }) =>
            setParcels((data ?? []).filter(isParcelVisibleToCustomer).slice(0, 1)),
          );

      // 최근 배송 현황 1건
      fetch("/api/orders", { cache: "no-store" })
        .then((r) => r.json())
        .then(({ orders: data }) => setOrders((data ?? []).slice(0, 1)))
        .catch(() => {});

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
    <div className="px-4 py-5 space-y-4">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {isLoggedIn ? `안녕하세요 ${userInfo?.name ?? ""}님 👋` : "인프론트 해외배송 👋"}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isLoggedIn ? "무엇을 도와드릴까요?" : "로그인 없이 배송비 계산기를 이용할 수 있어요"}
          </p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {isLoggedIn ? (
            <Link href="/notifications" className="relative p-2" aria-label="알림">
              <Bell size={22} className="text-gray-700" />
              {unreadNotifications > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              )}
            </Link>
          ) : (
            <Link
              href="/login"
              className="text-sm font-semibold text-brand-600 px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
            >
              로그인
            </Link>
          )}
        </div>
      </div>

      {isLoggedIn && <ActionDashboard />}

      {/* 서비스 안내 배너 */}
      <div className="bg-gradient-to-r from-brand-600 to-brand-800 rounded-2xl px-5 py-5 sm:py-6 text-white flex items-center justify-between gap-4 min-h-[108px]">
        <div className="min-w-0 flex-1">
          <p className="text-white/70 text-xs font-medium mb-1">인프론트 해외배송 대행</p>
          <p className="text-lg font-bold leading-snug">
            수거 → 검품 → 포장 → 국제발송
          </p>
          <p className="text-white/80 text-sm mt-1.5">EMS · EMS 프리미엄 · K-Packet</p>
        </div>
        <Link
          href={authHref("/pickup", isLoggedIn)}
          className="shrink-0 inline-flex items-center gap-1.5 bg-white text-brand-600 rounded-xl px-4 py-2.5 text-sm font-semibold active:scale-95 transition-transform shadow-sm"
        >
          <Truck size={15} />
          수거 신청
        </Link>
      </div>

      {/* 빠른 서비스 */}
      <div className="grid grid-cols-2 gap-3">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={authHref(a.href, isLoggedIn)}
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
          <Link href={authHref("/storage", isLoggedIn)} className="text-xs text-brand-600 font-medium flex items-center gap-0.5">
            전체보기 <ChevronRight size={14} />
          </Link>
        </div>

        {parcels.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <Truck size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">아직 접수된 물품이 없어요</p>
            <p className="text-gray-400 text-xs mt-1">
              {isLoggedIn ? "수거 신청을 해보세요" : "로그인 후 수거 신청을 시작하세요"}
            </p>
            <Link
              href={authHref("/pickup", isLoggedIn)}
              className="mt-4 inline-flex items-center gap-1 bg-brand-600 text-white rounded-xl px-4 py-2 text-sm font-medium"
            >
              <Truck size={14} /> {isLoggedIn ? "수거 신청" : "로그인하고 수거 신청"}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {parcels.map((parcel) => {
              const items = normalizeParcelItems(parcel.pre_invoice_items);
              const itemTitle = formatParcelItemTitle(items);
              const trackingNo = parcel.tracking_no || parcel.pickup_tracking_no;
              const title = itemTitle || trackingNo || "물품 미등록";
              const summary = getParcelDisplaySummary(parcel);
              return (
                <Link
                  key={parcel.id}
                  href="/storage"
                  className="block bg-white rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate" title={title}>
                        {title}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{summary.subtitle}</p>
                      {(trackingNo && itemTitle) || summary.meta ? (
                        <p className="text-xs text-gray-400 mt-1 truncate">
                          {[trackingNo && itemTitle ? trackingNo : null, summary.meta].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 ${summary.badgeClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${summary.dotClass}`} />
                      {summary.badgeLabel}
                    </span>
                  </div>
                  {summary.alert && (
                    <p className="text-xs text-red-600 mt-2">{summary.alert}</p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* 최근 배송 현황 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-bold text-gray-900">최근 배송 현황</h2>
          <Link href={authHref("/orders", isLoggedIn)} className="text-xs text-brand-600 font-medium flex items-center gap-0.5">
            전체보기 <ChevronRight size={14} />
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl px-4 py-4 shadow-sm flex items-center gap-3">
            <Send size={28} className="text-gray-200 shrink-0" />
            <div>
              <p className="text-sm text-gray-500 font-medium">진행 중인 배송이 없어요</p>
              <p className="text-xs text-gray-400">
                {isLoggedIn ? "출고 신청 후 여기서 확인하세요" : "로그인 후 배송 현황을 확인하세요"}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => {
              const cfg = ORDER_STATUS[order.status] ?? ORDER_STATUS.DRAFT;
              const flag = COUNTRY_FLAG[order.recipient_country ?? ""] ?? "🌍";
              return (
                <Link
                  key={order.id}
                  href={authHref("/orders", isLoggedIn)}
                  className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl shrink-0">{flag}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {order.recipient_name ?? order.recipient_country ?? "—"}
                      </p>
                      <p className="text-xs text-gray-400">{order.order_no}</p>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 ml-2 ${cfg.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
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
