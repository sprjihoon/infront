"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ActionDashboard from "@/components/ActionDashboard";

interface UserInfo {
  name: string;
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
          {!isLoggedIn && (
            <p className="text-sm text-gray-500 mt-0.5">
              수거하고, 보관하고, 출고합니다.
            </p>
          )}
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
    </div>
  );
}
