export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  order_id: string | null;
  parcel_id: string | null;
  created_at: string;
}

export function notificationHref(n: Pick<AppNotification, "order_id" | "parcel_id">): string | null {
  if (n.order_id) return `/orders/${n.order_id}`;
  if (n.parcel_id) return "/storage";
  return null;
}

export function formatNotificationTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}일 전`;
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}
