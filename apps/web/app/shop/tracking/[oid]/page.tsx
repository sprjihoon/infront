"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Package, Truck } from "lucide-react";
import { INTL_TRACKING_NOTE_KO } from "@/lib/shop/products";
import { CUSTOMER_TYPE_LABEL } from "@/lib/shop/products";
import { formatKrw, getShopProduct } from "@/lib/shop/products";

interface TrackingEvent {
  time: string;
  status: string;
  location: string;
  detail: string;
}

interface TrackingData {
  order: {
    oid: string;
    productId: string;
    amount: number;
    status: string;
    customerType: string;
    shippingType: string;
    trackingAvailable: boolean;
  };
  tracking: {
    waybillNo: string | null;
    carrier: string | null;
    events: TrackingEvent[];
    hasEvents: boolean;
    note: string;
  };
}

function TrackingContent() {
  const params = useParams<{ oid: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<TrackingData | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/shop/orders/${params.oid}/tracking`);
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "조회 실패");
          return;
        }
        setData(json as TrackingData);
      } catch {
        setError("네트워크 오류");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.oid]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4">
        <p className="text-sm text-red-500">{error || "주문을 찾을 수 없습니다."}</p>
        <button
          onClick={() => router.push("/shop/orders")}
          className="text-sm text-gray-500 underline"
        >
          주문 목록으로
        </button>
      </div>
    );
  }

  const product = getShopProduct(data.order.productId);
  const productName = product?.name ?? data.order.productId;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1 -ml-1">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="text-base font-bold text-gray-900">배송조회</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        <section className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#de2910]/10 rounded-xl flex items-center justify-center">
              <Package size={20} className="text-[#de2910]" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{productName}</p>
              <p className="text-xs text-gray-400 font-mono">{data.order.oid}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-gray-400">결제금액</dt>
              <dd className="font-semibold text-gray-800">{formatKrw(data.order.amount)}</dd>
            </div>
            <div>
              <dt className="text-gray-400">고객 유형</dt>
              <dd className="font-semibold text-gray-800">
                {CUSTOMER_TYPE_LABEL[data.order.customerType as keyof typeof CUSTOMER_TYPE_LABEL] ??
                  data.order.customerType}
              </dd>
            </div>
            <div>
              <dt className="text-gray-400">배송유형</dt>
              <dd className="font-semibold text-gray-800">
                {data.order.shippingType === "intl"
                  ? "해외배송"
                  : data.order.shippingType === "domestic"
                    ? "국내배송"
                    : "해당없음"}
              </dd>
            </div>
            <div>
              <dt className="text-gray-400">배송추적</dt>
              <dd className="font-semibold text-gray-800">
                {data.order.trackingAvailable ? "가능" : "해당없음"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Truck size={16} className="text-[#de2910]" />
            <h2 className="text-sm font-bold text-gray-900">운송장 정보</h2>
          </div>
          {data.tracking.waybillNo ? (
            <div className="space-y-2">
              <p className="text-sm">
                <span className="text-gray-500">운송장번호: </span>
                <span className="font-mono font-semibold">{data.tracking.waybillNo}</span>
              </p>
              {data.tracking.carrier && (
                <p className="text-xs text-gray-500">배송수단: {data.tracking.carrier}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              발송 접수 후 운송장번호가 등록되면 배송조회가 가능합니다.
            </p>
          )}
        </section>

        <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3">
          <p className="text-xs text-purple-800 leading-relaxed">{INTL_TRACKING_NOTE_KO}</p>
        </div>

        {data.tracking.hasEvents && (
          <section className="bg-white rounded-2xl border border-gray-100 p-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3">배송 이력</h2>
            <ol className="space-y-3">
              {data.tracking.events.map((ev, i) => (
                <li key={`${ev.time}-${i}`} className="border-l-2 border-[#de2910]/30 pl-3">
                  <p className="text-xs text-gray-400">{ev.time}</p>
                  <p className="text-sm font-semibold text-gray-900">{ev.status}</p>
                  {ev.location && <p className="text-xs text-gray-600">{ev.location}</p>}
                  {ev.detail && <p className="text-xs text-gray-500 mt-0.5">{ev.detail}</p>}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}

export default function ShopTrackingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-gray-300" />
        </div>
      }
    >
      <TrackingContent />
    </Suspense>
  );
}
