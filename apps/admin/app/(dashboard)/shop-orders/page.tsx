"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CreditCard,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Package,
} from "lucide-react";

interface ShopOrder {
  id: string;
  oid: string;
  product_id: string;
  amount: number;
  status: string;
  sender_name: string;
  sender_email: string;
  sender_phone: string;
  recipient_name: string;
  recipient_address: string | null;
  customer_type: string | null;
  payment_method: string | null;
  is_foreign_card: boolean | null;
  inicis_tid: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  ems_regino: string | null;
  created_at: string;
}

const CUSTOMER_TYPE_LABEL: Record<string, string> = {
  domestic: "내국인",
  foreigner: "외국인/해외고객",
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  PENDING_PAYMENT: { label: "결제대기", cls: "bg-yellow-100 text-yellow-800" },
  PAID:            { label: "결제완료", cls: "bg-green-100 text-green-800" },
  CANCELLED:       { label: "취소됨",  cls: "bg-red-100 text-red-700" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_LABEL[status] ?? { label: status, cls: "bg-gray-100 text-gray-700" };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

export default function ShopOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orders, setOrders]   = useState<ShopOrder[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(false);

  const status = searchParams.get("status") ?? "";
  const q      = searchParams.get("q") ?? "";
  const page   = parseInt(searchParams.get("page") ?? "1", 10);
  const limit  = 30;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (status) sp.set("status", status);
      if (q)      sp.set("q", q);
      sp.set("page", String(page));
      const res = await fetch(`/api/admin/shop-orders?${sp}`);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json() as { orders: ShopOrder[]; total: number };
      setOrders(data.orders);
      setTotal(data.total);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [status, q, page]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  function pushParams(updates: Record<string, string | null>) {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => {
      if (v) sp.set(k, v); else sp.delete(k);
    });
    sp.delete("page");
    router.push(`/shop-orders?${sp}`);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">샵 주문</h1>
            <p className="text-sm text-gray-500">KG이니시스 결제 주문 관리</p>
          </div>
        </div>
        <button
          onClick={fetchOrders}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          새로고침
        </button>
      </div>

      {/* 검색 + 필터 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3">
        {/* 검색창 */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            defaultValue={q}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                pushParams({ q: (e.target as HTMLInputElement).value || null });
            }}
            placeholder="주문번호 / 이름 검색 (Enter)"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
        {/* 상태 필터 */}
        <select
          value={status}
          onChange={(e) => pushParams({ status: e.target.value || null })}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          <option value="">전체 상태</option>
          <option value="PENDING_PAYMENT">결제대기</option>
          <option value="PAID">결제완료</option>
          <option value="CANCELLED">취소됨</option>
        </select>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            총 {total.toLocaleString()}건
          </span>
          {loading && <RefreshCw className="h-4 w-4 text-gray-400 animate-spin" />}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">주문번호</th>
                <th className="px-4 py-3 text-left">주문일시</th>
                <th className="px-4 py-3 text-left">주문자</th>
                <th className="px-4 py-3 text-center">고객구분</th>
                <th className="px-4 py-3 text-center">해외카드</th>
                <th className="px-4 py-3 text-left">결제수단</th>
                <th className="px-4 py-3 text-left">수취인</th>
                <th className="px-4 py-3 text-right">금액</th>
                <th className="px-4 py-3 text-center">상태</th>
                <th className="px-4 py-3 text-center">EMS</th>
                <th className="px-4 py-3 text-left">결제TID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.length === 0 && !loading && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-gray-400">
                    <Package className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    주문이 없습니다.
                  </td>
                </tr>
              )}
              {orders.map((o) => (
                <tr
                  key={o.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/shop-orders/${o.id}?status=${status}&q=${q}&page=${page}`)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-primary font-medium">
                    {o.oid}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {new Date(o.created_at).toLocaleDateString("ko-KR", {
                      month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{o.sender_name}</p>
                    <p className="text-xs text-gray-400">{o.sender_email}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs text-gray-600">
                      {CUSTOMER_TYPE_LABEL[o.customer_type ?? ""] ?? "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {o.is_foreign_card === true ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                        예
                      </span>
                    ) : o.is_foreign_card === false ? (
                      <span className="text-xs text-gray-400">아니오</span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-[7rem] truncate">
                    {o.payment_method ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-900">{o.recipient_name}</p>
                    {o.recipient_address && (
                      <p className="text-xs text-gray-400 truncate max-w-48">{o.recipient_address}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                    {o.amount.toLocaleString()}원
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {o.ems_regino ? (
                      <span className="font-mono text-xs text-green-700">{o.ems_regino}</span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">
                    {o.inicis_tid ? o.inicis_tid.slice(-12) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {page} / {totalPages} 페이지
            </span>
            <div className="flex gap-1">
              <button
                disabled={page <= 1}
                onClick={() => router.push(`/shop-orders?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(page - 1) })}`)}
                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => router.push(`/shop-orders?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(page + 1) })}`)}
                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
