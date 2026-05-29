import { adminDb } from "@/lib/supabase/admin";
import Link from "next/link";
import { Package, ChevronRight, Printer } from "lucide-react";

type DomesticOrderRow = {
  id: string;
  status: string;
  recipient_name: string;
  recipient_zip: string;
  recipient_addr1: string;
  items_desc: string | null;
  weight_g: number | null;
  epost_regi_no: string | null;
  epost_price: number | null;
  created_at: string;
  customers: { name?: string; customer_code?: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING:    "접수 대기",
  BOOKED:     "우체국 접수",
  IN_TRANSIT: "배송 중",
  DELIVERED:  "배달 완료",
  CANCELLED:  "취소됨",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING:    "bg-yellow-100 text-yellow-800 border-yellow-200",
  BOOKED:     "bg-blue-100 text-blue-800 border-blue-200",
  IN_TRANSIT: "bg-indigo-100 text-indigo-800 border-indigo-200",
  DELIVERED:  "bg-green-100 text-green-800 border-green-200",
  CANCELLED:  "bg-gray-100 text-gray-500 border-gray-200",
};

const STATUS_TABS = [
  { key: "", label: "전체" },
  { key: "PENDING",    label: "접수 대기" },
  { key: "BOOKED",     label: "우체국 접수" },
  { key: "IN_TRANSIT", label: "배송 중" },
  { key: "DELIVERED",  label: "배달 완료" },
  { key: "CANCELLED",  label: "취소됨" },
];

export default async function DomesticOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;

  let query = adminDb
    .from("domestic_orders")
    .select(`
      id, status, recipient_name, recipient_zip, recipient_addr1,
      items_desc, weight_g, epost_regi_no, epost_price, created_at,
      customers(name, customer_code)
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) query = query.eq("status", status);
  if (q) {
    query = query.or(`recipient_name.ilike.%${q}%,epost_regi_no.ilike.%${q}%`);
  }

  const [{ data: orders }, { data: countRows }] = await Promise.all([
    query,
    adminDb.from("domestic_orders").select("status"),
  ]);

  const countForStatus = (key: string) => {
    if (!key) return (countRows ?? []).length;
    return (countRows ?? []).filter((r) => r.status === key).length;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">국내 배송 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            고객 국내 배송 신청 · 우체국 소포 접수 · 총 {(countRows ?? []).length}건
          </p>
        </div>
      </div>

      <form className="mb-4">
        <div className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="수령인, 운송장번호 검색"
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {status && <input type="hidden" name="status" value={status} />}
          <button type="submit" className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium">
            검색
          </button>
        </div>
      </form>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {STATUS_TABS.map(({ key, label }) => {
          const params = new URLSearchParams();
          if (key) params.set("status", key);
          if (q)   params.set("q", q);
          const href = params.toString() ? `/domestic-orders?${params}` : "/domestic-orders";
          const cnt = countForStatus(key);
          return (
            <Link
              key={key || "all"}
              href={href}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                (status ?? "") === key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
              }`}
            >
              {label}{cnt > 0 ? ` (${cnt})` : ""}
            </Link>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {!orders || orders.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Package size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm">해당하는 국내 배송 신청이 없습니다</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-3 px-4 font-medium text-gray-500">고객</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">수령인</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">주소</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">상태</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">운송장</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">요금</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">신청일</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {(orders as DomesticOrderRow[]).map((o) => (
                <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">
                    {o.customers ? (
                      <div>
                        <p className="font-medium text-gray-900">{o.customers.name ?? "-"}</p>
                        <p className="text-xs text-gray-400">{o.customers.customer_code}</p>
                      </div>
                    ) : "-"}
                  </td>
                  <td className="py-3 px-4 font-medium">{o.recipient_name}</td>
                  <td className="py-3 px-4 text-gray-500 max-w-[140px] truncate text-xs">
                    [{o.recipient_zip}] {o.recipient_addr1}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLOR[o.status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-xs">{o.epost_regi_no ?? "-"}</span>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-600">
                    {o.epost_price != null ? `${o.epost_price.toLocaleString()}원` : "-"}
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500">
                    {new Date(o.created_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      {o.epost_regi_no && (
                        <Link
                          href={`/domestic-orders/${o.id}/label`}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                          title="라벨 출력"
                        >
                          <Printer size={14} />
                        </Link>
                      )}
                      <Link href={`/domestic-orders/${o.id}`} className="text-blue-600 hover:text-blue-800">
                        <ChevronRight size={16} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
