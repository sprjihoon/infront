import Link from "next/link";
import { adminDb } from "@/lib/supabase/admin";
import {
  Package,
  ShoppingBag,
  RotateCcw,
  TrendingUp,
  Clock,
  ChevronRight,
  Truck,
} from "lucide-react";

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  href,
}: {
  title: string;
  value: string;
  icon: typeof Package;
  color: string;
  href: string;
}) {
  return (
    <Link href={href} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </Link>
  );
}

export default async function DashboardPage() {
  const [
    { data: parcels },
    { data: orders },
    { data: returns },
    { data: recentOrders },
  ] = await Promise.all([
    adminDb.from("parcels").select("status, is_shippable"),
    adminDb.from("orders").select("status, total_amount"),
    adminDb.from("return_requests").select("status"),
    adminDb
      .from("orders")
      .select("id, order_no, status, recipient_name, total_amount, created_at, customers(name, customer_code)")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const p = parcels ?? [];
  const pickupPending = p.filter((x) => x.status === "PENDING_PICKUP").length;
  const pickedUp = p.filter((x) => x.status === "PICKED_UP").length;
  const arrived = p.filter((x) => x.status === "INBOUND" && x.is_shippable !== true).length;
  const inspecting = p.filter((x) => x.status === "INSPECTION").length;
  const ready = p.filter((x) => x.status === "INBOUND" && x.is_shippable === true).length;

  const pendingQuote = (orders ?? []).filter((o) => ["PENDING_QUOTE", "DRAFT"].includes(o.status)).length;
  const paymentWait = (orders ?? []).filter((o) => ["PAYMENT_WAIT", "QUOTE_SENT"].includes(o.status)).length;
  const paidShip = (orders ?? []).filter((o) => o.status === "PAID").length;
  const totalRevenue = (orders ?? [])
    .filter((o) => ["PAID", "PACKING", "IN_TRANSIT", "DELIVERED"].includes(o.status))
    .reduce((sum, o) => sum + (o.total_amount ?? 0), 0);
  const returnPending = (returns ?? []).filter((r) =>
    ["REQUESTED", "WAITING_INBOUND", "INSPECTING"].includes(r.status),
  ).length;

  const STATUS_LABEL: Record<string, string> = {
    DRAFT: "초안", PENDING_QUOTE: "견적 대기", QUOTE_SENT: "견적 발송",
    PAYMENT_WAIT: "결제 대기", PAID: "결제 완료", PACKING: "포장 중",
    IN_TRANSIT: "배송 중", DELIVERED: "배송 완료", CANCELLED: "취소",
  };

  const queueItems = [
    { label: "수거 신청 대기", count: pickupPending, href: "/parcels?status=PENDING_PICKUP", icon: Truck },
    { label: "수거 완료 · 센터 이동 중", count: pickedUp, href: "/parcels?status=PICKED_UP" },
    { label: "센터 입고 (검수 전)", count: arrived, href: "/parcels?status=INBOUND_ARRIVED" },
    { label: "검수 중", count: inspecting, href: "/parcels?status=INSPECTION" },
    { label: "입고 완료 · 출고 가능", count: ready, href: "/parcels?status=INBOUND_READY" },
    { label: "견적 대기 주문", count: pendingQuote, href: "/orders?status=PENDING_QUOTE" },
    { label: "결제 대기 주문", count: paymentWait, href: "/orders?status=QUOTE_SENT" },
    { label: "결제 완료 · 발송 대기", count: paidShip, href: "/orders?status=PAID" },
    { label: "반품 처리 대기", count: returnPending, href: "/returns?status=REQUESTED", urgent: returnPending > 0 },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">오늘 할 일</h1>
        <p className="text-sm text-gray-500 mt-1">수거 → 입고 → 검수 → 출고 → 결제 순서로 처리하세요</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="수거·입고" value={p.length.toLocaleString()} icon={Package} color="text-blue-600" href="/parcels" />
        <StatCard title="배송 주문" value={(orders?.length ?? 0).toLocaleString()} icon={ShoppingBag} color="text-violet-600" href="/orders" />
        <StatCard title="반품 요청" value={(returns?.length ?? 0).toLocaleString()} icon={RotateCcw} color="text-orange-600" href="/returns" />
        <StatCard title="누적 매출" value={`${totalRevenue.toLocaleString()}원`} icon={TrendingUp} color="text-emerald-600" href="/orders?status=PAID" />
      </div>

      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-500" />
          <div>
            <h2 className="font-semibold text-gray-900">작업 큐</h2>
            <p className="text-xs text-gray-500">단계별 처리 대기 건수</p>
          </div>
        </div>
        <div className="p-4 grid gap-2 sm:grid-cols-2">
          {queueItems.map(({ label, count, href, urgent }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors hover:bg-gray-50 ${
                urgent ? "border-red-200 bg-red-50/50" : count > 0 ? "border-blue-100 bg-blue-50/30" : "border-gray-100"
              }`}
            >
              <div>
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className={`text-lg font-bold ${count > 0 ? "text-blue-700" : "text-gray-400"}`}>{count}건</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">최근 배송 주문</h2>
            <p className="text-xs text-gray-500">최근 접수 5건</p>
          </div>
          <Link href="/orders" className="text-sm text-primary font-medium hover:underline">전체 보기</Link>
        </div>
        <div className="divide-y divide-gray-50">
          {(recentOrders ?? []).length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">최근 주문이 없습니다</p>
          ) : (
            (recentOrders ?? []).map((order) => {
              const cust = order.customers as { name?: string; customer_code?: string } | null;
              return (
                <Link key={order.id} href={`/orders/${order.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{order.order_no}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {cust?.name ?? order.recipient_name} · {cust?.customer_code} · {STATUS_LABEL[order.status] ?? order.status}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{(order.total_amount ?? 0).toLocaleString()}원</p>
                    <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString("ko-KR")}</p>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
