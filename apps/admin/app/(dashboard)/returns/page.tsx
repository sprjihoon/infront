import { adminDb } from "@/lib/supabase/admin";
import Link from "next/link";
import { RotateCcw, ChevronRight } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  REQUESTED:       { label: "접수",         color: "text-blue-700 bg-blue-50 border-blue-200" },
  WAITING_INBOUND: { label: "입고 대기",    color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  INSPECTING:      { label: "검수 중",      color: "text-purple-700 bg-purple-50 border-purple-200" },
  PACKED:          { label: "포장 완료",    color: "text-orange-700 bg-orange-50 border-orange-200" },
  SHIPPED:         { label: "반송 발송",    color: "text-green-700 bg-green-50 border-green-200" },
  COMPLETED:       { label: "완료",         color: "text-gray-600 bg-gray-50 border-gray-200" },
  CANCELLED:       { label: "취소",         color: "text-red-700 bg-red-50 border-red-200" },
};

const REASON_LABEL: Record<string, string> = {
  SIZE_MISMATCH: "사이즈 불일치",
  DEFECT:        "불량·파손",
  WRONG_ITEM:    "오배송",
  CHANGE_MIND:   "단순 변심",
  OTHER:         "기타",
};

export default async function ReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  let query = adminDb
    .from("return_requests")
    .select(`
      id, status, reason, seller_name, created_at,
      customers(name, customer_code),
      parcels(tracking_no)
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) query = query.eq("status", status);

  const { data: returns } = await query;

  const FILTER_TABS = [
    { key: "",               label: "전체" },
    { key: "REQUESTED",      label: "접수" },
    { key: "WAITING_INBOUND",label: "입고 대기" },
    { key: "INSPECTING",     label: "검수 중" },
    { key: "SHIPPED",        label: "반송 발송" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">반품 관리</h1>
        <p className="text-sm text-gray-500 mt-0.5">총 {returns?.length ?? 0}개 요청</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {FILTER_TABS.map(({ key, label }) => (
          <Link
            key={key}
            href={key ? `/returns?status=${key}` : "/returns"}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              (status ?? "") === key
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {!returns || returns.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <RotateCcw size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm">반품 요청이 없습니다</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-3 px-4 font-medium text-gray-500">고객</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">물품 운송장</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">판매자</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">사유</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">상태</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">신청일</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((r) => {
                const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.REQUESTED;
                const customer = r.customers as { name?: string; customer_code?: string } | null;
                const parcel = r.parcels as { tracking_no?: string } | null;
                return (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{customer?.name ?? "-"}</p>
                      <p className="text-xs text-gray-400">{customer?.customer_code}</p>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">{parcel?.tracking_no ?? "미등록"}</td>
                    <td className="py-3 px-4 text-gray-600">{r.seller_name}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{REASON_LABEL[r.reason] ?? r.reason}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-xs">
                      {new Date(r.created_at).toLocaleDateString("ko-KR")}
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
