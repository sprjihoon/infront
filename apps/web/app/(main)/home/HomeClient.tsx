"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight, Package, Send, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ActionDashboard from "@/components/ActionDashboard";

interface UserInfo {
  name: string;
}

const JOURNEY = [
  {
    href: "/inbound",
    icon: Truck,
    iconWrap: "bg-brand-50 text-brand-600",
    label: "입고신청",
    sub: "수거하거나 직접 보냅니다",
  },
  {
    href: "/storage",
    icon: Package,
    iconWrap: "bg-violet-50 text-violet-600",
    label: "스토리지",
    sub: "맡긴 물건을 보고 관리합니다",
  },
  {
    href: "/shipping",
    icon: Send,
    iconWrap: "bg-sky-50 text-sky-600",
    label: "출고신청",
    sub: "국내·해외로 보냅니다",
  },
] as const;

const GUIDES = [
  { href: "/shipping-calc", label: "해외배송 계산기" },
  { href: "/pricing", label: "해외배송 가격표" },
  { href: "/domestic-rates", label: "국내배송 가격표" },
  { href: "/guide", label: "이용 가이드" },
] as const;

const LOGIN_PREFIXES = ["/storage", "/shipping", "/pickup", "/mypage", "/orders"];

function hrefFor(href: string, isLoggedIn: boolean) {
  if (isLoggedIn) return href;
  if (LOGIN_PREFIXES.some((p) => href.startsWith(p))) {
    return `/login?redirect=${encodeURIComponent(href)}`;
  }
  return href;
}

export default function HomeClient() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
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

      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false)
        .then(({ count }) => setUnreadNotifications(count ?? 0));
    });
  }, []);

  return (
    <div className="px-4 py-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {isLoggedIn ? `안녕하세요 ${userInfo?.name ?? ""}님` : "인프론트"}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            수거하고, 보관하고, 출고합니다.
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

      <div className="space-y-2.5">
        <h2 className="text-sm font-bold text-gray-700 tracking-tight">이용 순서</h2>
        {JOURNEY.map((step) => {
          const Icon = step.icon;
          return (
            <Link
              key={step.href}
              href={hrefFor(step.href, isLoggedIn)}
              className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 shadow-sm active:scale-[0.98] transition-transform"
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${step.iconWrap}`}
              >
                <Icon size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{step.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{step.sub}</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 shrink-0" />
            </Link>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {GUIDES.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center justify-between px-4 py-3.5 border-b border-gray-50 last:border-0 active:bg-gray-50"
          >
            <span className="text-sm text-gray-700">{item.label}</span>
            <ChevronRight size={16} className="text-gray-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}
