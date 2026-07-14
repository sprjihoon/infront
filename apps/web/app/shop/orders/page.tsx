"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Package } from "lucide-react";
import Link from "next/link";
import { formatKrw, getShopProduct, CUSTOMER_TYPE_LABEL } from "@/lib/shop/products";

interface ShopOrderRow {
  oid: string;
  product_id: string;
  amount: number;
  status: string;
  customer_type: string | null;
  shipping_type: string | null;
  ems_regino: string | null;
  tracking_available: boolean | null;
  paid_at: string | null;
  payment_method: string | null;
  is_foreign_card: boolean | null;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "결제대기",
  PAID: "결제완료",
  CANCELLED: "취소됨",
};

export default function ShopOrdersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<ShopOrderRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/shop/orders");
      if (res.status === 401) {
        router.push("/login?redirect=/shop/orders");
        return;
      }
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "조회 실패");
        setLoading(false);
        return;
      }
      setOrders(json.orders ?? []);
      setLoading(false);
    })();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.push("/shop")} className="p-1 -ml-1">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="text-base font-bold text-gray-900">내 주문 · 배송조회</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-3">
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-gray-300" />
          </div>
        )}
        {error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}
        {!loading && !error && orders.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-16">주문 내역이 없습니다.</p>
        )}
        {orders.map((o) => {
          const product = getShopProduct(o.product_id);
          return (
            <div key={o.oid} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-[#de2910]/10 rounded-lg flex items-center justify-center shrink-0">
                  <Package size={18} className="text-[#de2910]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {product?.name ?? o.product_id}
                  </p>
                  <p className="text-xs text-gray-400 font-mono truncate">{o.oid}</p>
                  <p className="text-sm font-semibold text-[#de2910] mt-1">{formatKrw(o.amount)}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-gray-500">
                    <span>{STATUS_LABEL[o.status] ?? o.status}</span>
                    <span>
                      {CUSTOMER_TYPE_LABEL[o.customer_type as keyof typeof CUSTOMER_TYPE_LABEL] ??
                        "—"}
                    </span>
                    {o.payment_method && <span>{o.payment_method}</span>}
                    {o.is_foreign_card && <span>해외카드</span>}
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-50 flex gap-2">
                <Link
                  href={`/shop/tracking/${o.oid}`}
                  className="flex-1 text-center text-xs font-bold py-2 rounded-xl bg-[#de2910] text-white"
                >
                  배송조회
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
