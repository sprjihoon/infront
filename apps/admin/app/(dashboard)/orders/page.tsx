import { adminDb } from "@/lib/supabase/admin";
import Link from "next/link";
import { ShoppingBag, ChevronRight } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT:          { label: "초안",         color: "text-gray-600 bg-gray-50 border-gray-200" },
  PENDING_QUOTE:  { label: "견적 대기",    color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  QUOTE_SENT:     { label: "견적 발송",    color: "text-blue-700 bg-blue-50 border-blue-200" },
  PAYMENT_WAIT:   { label: "결제 대기",    color: "text-amber-700 bg-amber-50 border-amber-200" },
  PAID:           { label: "결제 완료",    color: "text-green-700 bg-green-50 border-green-200" },
  PACKING:        { label: "포장 중",      color: "text-orange-700 bg-orange-50 border-orange-200" },
  IN_TRANSIT:     { label: "배송 중",      color: "text-blue-800 bg-blue-100 border-blue-300" },
  DELIVERED:      { label: "배송 완료",    color: "text-gray-700 bg-gray-100 border-gray-300" },
  CANCELLED:      { label: "취소",         color: "text-red-700 bg-red-50 border-red-200" },
};

const FILTER_TABS = [
  { key: "",               label: "전체" },
  { key: "PENDING_QUOTE",  label: "견적 대기" },
  { key: "QUOTE_SENT",     label: "견적 발송" },
  { key: "PAYMENT_WAIT",   label: "결제 대기" },
  { key: "PAID",           label: "결제 완료" },
  { key: "IN_TRANSIT",     label: "배송 중" },
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;

  let query = adminDb
    .from("orders")
    .select(`
      id, order_no, status, shipping_method, recipient_name, recipient_country,
      total_amount, created_at,
      customers(name, email, customer_code)
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) query = query.eq("status", status);
  if (q) {
    const { data: custMatches } = await adminDb
      .from("customers")
      .select("id")
      .or(`name.ilike.%${q}%,customer_code.ilike.%${q}%,email.ilike.%${q}%`);
    const custIds = (custMatches ?? []).map((c) => c.id);
    if (custIds.length > 0) {
      query = query.or(`order_no.ilike.%${q}%,recipient_name.ilike.%${q}%,customer_id.in.(${custIds.join(",")})`);
    } else {
      query = query.or(`order_no.ilike.%${q}%,recipient_name.ilike.%${q}%`);
    }
  }

  const { data: orders } = await query;

  const { data: counts } = await adminDb.from("orders").select("status");
  const countMap: Record<string, number> = {};
  (counts ?? []).forEach((o) => { countMap[o.status] = (countMap[o.status] ?? 0) + 1; });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">배송 주문 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">총 {counts?.length ?? 0}개 주문</p>
        </div>
      </div>

      <form className="mb-4">
        <div className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="주문번호, 수취인, 고객명·고객번호 검색"
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {status && <input type="hidden" name="status" value={status} />}
          <button type="submit" className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium">검색</button>
        </div>
      </form>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {FILTER_TABS.map(({ key, label }) => (
          <Link
            key={key}
            href={key ? `/orders?status=${key}${q ? `&q=${q}` : ""}` : `/orders${q ? `?q=${q}` : ""}`}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              (status ?? "") === key
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
            }`}
          >
            {label}{key && countMap[key] ? ` (${countMap[key]})` : ""}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {!orders || orders.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <ShoppingBag size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm">해당하는 주문이 없습니다</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-3 px-4 font-medium text-gray-500">주문번호</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">고객</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">수취인</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">배송방법</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">금액</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">상태</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">신청일</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const cfg = STATUS_CONFIG[o.status] ?? STATUS_CONFIG.DRAFT;
                const customer = o.customers as { name?: string; customer_code?: string } | null;
                return (
                  <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs">{o.order_no}</td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{customer?.name ?? "-"}</p>
                      <p className="text-xs text-gray-400">{customer?.customer_code}</p>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{o.recipient_name}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{o.shipping_method}</td>
                    <td className="py-3 px-4 font-medium">{Number(o.total_amount).toLocaleString()}원</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-xs">
                      {new Date(o.created_at).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="py-3 px-4">
                      <Link href={`/orders/${o.id}${status || q ? `?${new URLSearchParams({ ...(status && { status }), ...(q && { q }) })}` : ""}`} className="text-blue-600 hover:text-blue-800">
                        <ChevronRight size={16} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
