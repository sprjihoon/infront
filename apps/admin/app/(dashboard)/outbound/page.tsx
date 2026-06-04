import { adminDb } from "@/lib/supabase/admin";
import Link from "next/link";
import { Send, Globe, Truck, ChevronRight, CheckCircle2, Clock } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PICKING_DONE:  { label: "출고처리 대기", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  OUTBOUND_WAIT: { label: "출하 대기",    color: "text-amber-700 bg-amber-50 border-amber-200" },
  IN_TRANSIT:    { label: "배송 중",      color: "text-blue-700 bg-blue-50 border-blue-200" },
};

export default async function OutboundListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const INTL_STATUSES  = ["PICKING_DONE", "OUTBOUND_WAIT"];
  const DOM_STATUSES   = ["PICKING_DONE", "BOOKED"];

  let intlQ = adminDb
    .from("orders")
    .select(`
      id, order_no, status, shipping_method,
      recipient_name, recipient_country, created_at,
      customers(name, customer_code)
    `)
    .in("status", INTL_STATUSES)
    .order("created_at", { ascending: true })
    .limit(100);

  let domQ = adminDb
    .from("domestic_orders")
    .select(`
      id, status, recipient_name, recipient_addr1, created_at,
      customers(name, customer_code)
    `)
    .in("status", DOM_STATUSES)
    .order("created_at", { ascending: true })
    .limit(100);

  if (q) {
    intlQ = intlQ.or(`order_no.ilike.%${q}%,recipient_name.ilike.%${q}%`);
    domQ  = domQ.ilike("recipient_name", `%${q}%`);
  }

  const [{ data: intlOrders }, { data: domOrders }] = await Promise.all([intlQ, domQ]);

  const totalReady =
    (intlOrders?.filter((o) => o.status === "PICKING_DONE").length ?? 0) +
    (domOrders?.filter((o) => o.status === "PICKING_DONE").length ?? 0);

  type Row = {
    kind: "intl" | "domestic";
    id: string;
    status: string;
    label: string;
    sub: string;
    recipient: string;
    country?: string;
    method?: string;
    created_at: string;
    customer_name?: string;
    customer_code?: string;
  };

  const rows: Row[] = [
    ...(intlOrders ?? []).map((o) => ({
      kind: "intl" as const,
      id: o.id,
      status: o.status,
      label: o.order_no,
      sub: `${o.shipping_method} · ${o.recipient_country}`,
      recipient: o.recipient_name,
      country: o.recipient_country,
      method: o.shipping_method,
      created_at: o.created_at,
      customer_name: (o.customers as { name?: string } | null)?.name,
      customer_code: (o.customers as { customer_code?: string } | null)?.customer_code,
    })),
    ...(domOrders ?? []).map((o) => ({
      kind: "domestic" as const,
      id: o.id,
      status: o.status,
      label: "국내배송",
      sub: (o.recipient_addr1 ?? "").slice(0, 22),
      recipient: o.recipient_name,
      created_at: o.created_at,
      customer_name: (o.customers as { name?: string } | null)?.name,
      customer_code: (o.customers as { customer_code?: string } | null)?.customer_code,
    })),
  ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-emerald-600 text-white p-2.5 rounded-xl">
          <Send size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">출고처리</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            처리 대기 <span className="font-bold text-emerald-700">{totalReady}건</span>
            {" "}· 전체 {rows.length}건
          </p>
        </div>
      </div>

      {/* 검색 */}
      <form className="mb-5">
        <div className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="주문번호, 수취인 검색"
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button type="submit" className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium">
            검색
          </button>
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm text-center py-16 text-gray-400">
          <CheckCircle2 size={40} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm">출고처리할 주문이 없습니다</p>
          <Link href="/picking" className="mt-3 inline-block text-sm text-emerald-600 hover:underline">
            피킹 지시서 확인 →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-3 px-4 font-medium text-gray-500">주문</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">고객</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">수취인</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">배송</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">상태</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">신청일</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const cfg = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.PICKING_DONE;
                const href = `/outbound/${row.kind === "intl" ? "intl" : "dom"}-${row.id}`;
                const isReady = row.status === "PICKING_DONE";
                return (
                  <tr key={`${row.kind}-${row.id}`} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {row.kind === "intl"
                          ? <Globe size={13} className="text-indigo-500 shrink-0" />
                          : <Truck size={13} className="text-emerald-500 shrink-0" />
                        }
                        <div>
                          <p className="font-mono text-xs text-gray-700">{row.label}</p>
                          <p className="text-[11px] text-gray-400">{row.sub}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{row.customer_name ?? "-"}</p>
                      <p className="text-xs text-gray-400">{row.customer_code}</p>
                    </td>
                    <td className="py-3 px-4 text-gray-700">{row.recipient}</td>
                    <td className="py-3 px-4 text-xs text-gray-500">
                      {row.kind === "intl" ? `${row.country} / ${row.method}` : "국내"}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-400">
                      {new Date(row.created_at).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href={href}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          isReady
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {isReady ? (
                          <><Send size={11} /> 출고처리</>
                        ) : (
                          <><Clock size={11} /> 상세보기</>
                        )}
                        <ChevronRight size={11} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
