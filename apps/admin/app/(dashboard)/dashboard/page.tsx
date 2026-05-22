import Link from "next/link";
import { adminDb } from "@/lib/supabase/admin";
import {
  Package,
  ShoppingBag,
  RotateCcw,
  TrendingUp,
  Clock,
  ChevronRight,
  AlertCircle,
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
    <Link
      href={href}
      className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
    >
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
    adminDb.from("parcels").select("status"),
    adminDb.from("orders").select("status, total_amount"),
    adminDb.from("return_requests").select("status"),
    adminDb
      .from("orders")
      .select("id, order_no, status, recipient_name, total_amount, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const parcelCount = parcels?.length ?? 0;
  const inboundCount = parcels?.filter((p) => p.status === "INBOUND").length ?? 0;
  const inspectionCount = parcels?.filter((p) => ["INSPECTION", "PACKING"].includes(p.status)).length ?? 0;

  const orderCount = orders?.length ?? 0;
  const pendingQuote = orders?.filter((o) => o.status === "PENDING_QUOTE").length ?? 0;
  const paymentWait = orders?.filter((o) => o.status === "PAYMENT_WAIT").length ?? 0;
  const paidCount = orders?.filter((o) => o.status === "PAID").length ?? 0;
  const totalRevenue = (orders ?? [])
    .filter((o) => ["PAID", "PACKING", "IN_TRANSIT", "DELIVERED"].includes(o.status))
    .reduce((sum, o) => sum + (o.total_amount ?? 0), 0);

  const returnCount = returns?.length ?? 0;
  const returnPending = returns?.filter((r) =>
    ["REQUESTED", "WAITING_INBOUND", "INSPECTING"].includes(r.status),
  ).length ?? 0;

  const STATUS_LABEL: Record<string, string> = {
    PENDING_QUOTE: "견적 대기",
    QUOTE_SENT: "견적 발송",
    PAYMENT_WAIT: "결제 대기",
    PAID: "결제 완료",
    PACKING: "포장 중",
    IN_TRANSIT: "배송 중",
    DELIVERED: "배송 완료",
    CANCELLED: "취소",
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">인프론트 국제배송 운영 현황</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="입고 물품"
          value={parcelCount.toLocaleString()}
          icon={Package}
          color="text-blue-600"
          href="/parcels"
        />
        <StatCard
          title="배송 주문"
          value={orderCount.toLocaleString()}
          icon={ShoppingBag}
          color="text-violet-600"
          href="/orders"
        />
        <StatCard
          title="반품 요청"
          value={returnCount.toLocaleString()}
          icon={RotateCcw}
          color="text-orange-600"
          href="/returns"
        />
        <StatCard
          title="누적 매출"
          value={`${totalRevenue.toLocaleString()}원`}
          icon={TrendingUp}
          color="text-emerald-600"
          href="/orders?status=PAID"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-500" />
            <div>
              <h2 className="font-semibold text-gray-900">대기 중인 작업</h2>
              <p className="text-xs text-gray-500">처리가 필요한 항목</p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {[
              { label: "견적 대기 주문", count: pendingQuote, href: "/orders?status=PENDING_QUOTE" },
              { label: "결제 대기 주문", count: paymentWait, href: "/orders?status=PAYMENT_WAIT" },
              { label: "입고 완료 (미처리)", count: inboundCount, href: "/parcels?status=INBOUND" },
              { label: "검품·포장 중", count: inspectionCount, href: "/parcels?status=INSPECTION" },
              { label: "반품 처리 대기", count: returnPending, href: "/returns?status=REQUESTED", urgent: returnPending > 0 },
            ].map(({ label, count, href, urgent }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors hover:bg-gray-50 ${
                  urgent ? "border-red-200 bg-red-50/50" : "border-gray-100"
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <p className="text-xs text-gray-500">{count}건</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-gray-500" />
              <div>
                <h2 className="font-semibold text-gray-900">빠른 현황</h2>
                <p className="text-xs text-gray-500">주문·물품 요약</p>
              </div>
            </div>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
              <p className="text-xs text-blue-600">결제 완료</p>
              <p className="text-xl font-bold text-blue-900 mt-1">{paidCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
              <p className="text-xs text-amber-600">견적·결제 대기</p>
              <p className="text-xl font-bold text-amber-900 mt-1">{pendingQuote + paymentWait}</p>
            </div>
            <div className="p-3 rounded-lg bg-green-50 border border-green-100">
              <p className="text-xs text-green-600">입고 완료</p>
              <p className="text-xl font-bold text-green-900 mt-1">{inboundCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-orange-50 border border-orange-100">
              <p className="text-xs text-orange-600">반품 진행</p>
              <p className="text-xl font-bold text-orange-900 mt-1">{returnPending}</p>
            </div>
          </div>
        </section>
      </div>

      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">최근 배송 주문</h2>
            <p className="text-xs text-gray-500">최근 접수된 주문 5건</p>
          </div>
          <Link href="/orders" className="text-sm text-primary font-medium hover:underline">
            전체 보기
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {(recentOrders ?? []).length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">최근 주문이 없습니다</p>
          ) : (
            (recentOrders ?? []).map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{order.order_no}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {order.recipient_name} · {STATUS_LABEL[order.status] ?? order.status}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {(order.total_amount ?? 0).toLocaleString()}원
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(order.created_at).toLocaleDateString("ko-KR")}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
