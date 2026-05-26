"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import SubPageHeader from "@/components/layout/SubPageHeader";
import {
  formatNotificationTime,
  notificationHref,
  type AppNotification,
} from "@/lib/notification-utils";

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, is_read, order_id, parcel_id, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error) setItems(data ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleTap(n: AppNotification) {
    if (!n.is_read) {
      const supabase = createClient();
      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
      setItems((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
      );
    }

    const href = notificationHref(n);
    if (href) router.push(href);
  }

  async function markAllRead() {
    const unreadIds = items.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    const supabase = createClient();
    await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  const unreadCount = items.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <SubPageHeader title="알림" subtitle={unreadCount > 0 ? `${unreadCount}개 읽지 않음` : undefined} />

      <div className="px-4 py-4 space-y-3">
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="text-xs text-brand-600 font-medium ml-auto block"
          >
            모두 읽음 처리
          </button>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-brand-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
            <Bell size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">아직 알림이 없어요</p>
            <p className="text-gray-400 text-xs mt-1">수거·입고·견적·배송 소식이 여기에 표시됩니다</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleTap(n)}
                className={`w-full text-left px-4 py-4 active:bg-gray-50 transition-colors ${
                  !n.is_read ? "bg-brand-50/50" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  {!n.is_read && (
                    <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0 mt-1.5" />
                  )}
                  <div className={!n.is_read ? "" : "pl-5"}>
                    <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                    {n.body && (
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">
                        {n.body}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-300 mt-1.5">
                      {formatNotificationTime(n.created_at)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
