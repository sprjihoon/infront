import { adminDb } from "@/lib/supabase/admin";
import Link from "next/link";
import { Package, Search, ChevronRight } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING_PICKUP: { label: "수거 신청", color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  PICKED_UP:      { label: "수거 완료", color: "text-blue-700 bg-blue-50 border-blue-200" },
  INBOUND:        { label: "입고 완료", color: "text-green-700 bg-green-50 border-green-200" },
  INSPECTION:     { label: "검품 중",   color: "text-purple-700 bg-purple-50 border-purple-200" },
  PACKING:        { label: "포장 중",   color: "text-orange-700 bg-orange-50 border-orange-200" },
  HOLD:           { label: "보류",      color: "text-red-700 bg-red-50 border-red-200" },
  PAYMENT_WAIT:   { label: "결제 대기", color: "text-amber-700 bg-amber-50 border-amber-200" },
  SHIPPING:       { label: "발송 중",   color: "text-blue-800 bg-blue-100 border-blue-300" },
  DONE:           { label: "완료",      color: "text-gray-600 bg-gray-50 border-gray-200" },
};

const FILTER_TABS = [
  { key: "",           label: "전체" },
  { key: "INBOUND",    label: "입고완료" },
  { key: "INSPECTION", label: "검품중" },
  { key: "HOLD",       label: "보류" },
  { key: "PACKING",    label: "포장중" },
  { key: "DONE",       label: "완료" },
];

export default async function ParcelsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;

  let query = adminDb
    .from("parcels")
    .select(`
      id, tracking_no, status, sender_name, sender_address,
      weight_actual, inbound_at, is_shippable, hold_reason, created_at,
      customers(name, email, customer_code)
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) query = query.eq("status", status);
  if (q) query = query.or(`tracking_no.ilike.%${q}%,sender_name.ilike.%${q}%`);

  const { data: parcels } = await query;

  // 상태별 카운트
  const { data: counts } = await adminDb
    .from("parcels")
    .select("status");

  const countMap: Record<string, number> = {};
  (counts ?? []).forEach((p) => {
    countMap[p.status] = (countMap[p.status] ?? 0) + 1;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">입고 물품 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">총 {counts?.length ?? 0}개 물품</p>
        </div>
      </div>

      {/* 검색 */}
      <form className="mb-4">
        <div className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="운송장번호 또는 발송인 검색"
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {status && <input type="hidden" name="status" value={status} />}
          <button type="submit" className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium">
            검색
          </button>
        </div>
      </form>

      {/* 필터 탭 */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {FILTER_TABS.map(({ key, label }) => (
          <Link
            key={key}
            href={key ? `/parcels?status=${key}${q ? `&q=${q}` : ""}` : `/parcels${q ? `?q=${q}` : ""}`}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              (status ?? "") === key
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
            }`}
          >
            {label}
            {key && countMap[key] ? ` (${countMap[key]})` : ""}
          </Link>
        ))}
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {!parcels || parcels.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Package size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm">해당하는 물품이 없습니다</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-3 px-4 font-medium text-gray-500">운송장</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">발송인</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">고객</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">상태</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">입고일</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">무게</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {parcels.map((p) => {
                const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.DONE;
                const customer = p.customers as { name?: string; email?: string; customer_code?: string } | null;
                return (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs">{p.tracking_no ?? "미등록"}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 max-w-[120px] truncate">
                      {p.sender_name ?? "-"}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{customer?.name ?? "-"}</p>
                        <p className="text-xs text-gray-400">{customer?.customer_code}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {p.hold_reason && (
                        <p className="text-xs text-red-500 mt-0.5 max-w-[120px] truncate">{p.hold_reason}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">
                      {p.inbound_at ? new Date(p.inbound_at).toLocaleDateString("ko-KR") : "-"}
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">
                      {p.weight_actual ? `${p.weight_actual}g` : "-"}
                    </td>
                    <td className="py-3 px-4">
                      <Link href={`/parcels/${p.id}`} className="text-blue-600 hover:text-blue-800">
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
