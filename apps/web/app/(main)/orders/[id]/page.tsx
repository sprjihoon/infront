"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { OrderDetail } from "@/lib/order-display";
import OrderDetailView from "@/components/orders/OrderDetailView";
import OrderCancelModal from "@/components/orders/OrderCancelModal";

// 최신 스키마 — 일부 컬럼이 없으면 순차 폴백
const ORDER_SELECTS = [
  // FULL
  `id, order_no, status, shipping_method, packaging_type,
   packaging_fee, shipping_fee, extra_fee, total_amount, payment_status,
   recipient_name, recipient_phone, recipient_address, recipient_country,
   recipient_addr1, recipient_addr2, recipient_addr3, recipient_zip, recipient_email,
   customs_value, insurance_enabled, insurance_amount,
   duty_prepaid, duty_deposit_krw, duty_estimate_usd, duty_paid_krw,
   item_list, intl_tracking_no,
   intl_tracking_status, intl_tracking_last_event, intl_tracking_events,
   intl_tracking_synced_at, delivered_at,
   actual_weight, chargeable_weight,
   created_at, updated_at,
   order_parcels (parcel_id, parcels (id, tracking_no, sender_name, status, pre_invoice_items)),
   shipping_boxes (id, box_seq, intl_tracking_no, carrier, status, weight_kg)`,
  // MID — 최근 추가 컬럼 제외
  `id, order_no, status, shipping_method, packaging_type,
   packaging_fee, shipping_fee, total_amount, payment_status,
   recipient_name, recipient_phone, recipient_address, recipient_country,
   recipient_addr1, recipient_addr2, recipient_addr3, recipient_zip, recipient_email,
   customs_value, insurance_enabled, insurance_amount,
   duty_prepaid, duty_deposit_krw, duty_estimate_usd,
   item_list, intl_tracking_no,
   intl_tracking_status, intl_tracking_last_event, intl_tracking_events,
   intl_tracking_synced_at, delivered_at,
   created_at, updated_at,
   order_parcels (parcel_id, parcels (id, tracking_no, sender_name, status, pre_invoice_items)),
   shipping_boxes (id, box_seq, intl_tracking_no, carrier, status, weight_kg)`,
  // CORE — tracking/insurance 선택 컬럼 제외
  `id, order_no, status, shipping_method, packaging_type,
   packaging_fee, shipping_fee, total_amount, payment_status,
   recipient_name, recipient_phone, recipient_address, recipient_country,
   recipient_addr1, recipient_addr2, recipient_addr3, recipient_zip, recipient_email,
   customs_value, duty_prepaid,
   item_list, intl_tracking_no,
   intl_tracking_status, intl_tracking_last_event, delivered_at,
   created_at, updated_at,
   order_parcels (parcel_id, parcels (id, tracking_no, sender_name, status, pre_invoice_items))`,
];

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<OrderDetail | null>(null);
  const [cancelInitialRemoveIds, setCancelInitialRemoveIds] = useState<string[] | undefined>();
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  useEffect(() => {
    params.then((p) => setOrderId(p.id));
  }, [params]);

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    let found: unknown = null;
    for (const sel of ORDER_SELECTS) {
      const { data, error } = await supabase
        .from("orders")
        .select(sel)
        .eq("id", orderId)
        .eq("customer_id", user.id)
        .maybeSingle();

      if (!error) {
        found = data;
        break;
      }
      const msg = (error as { message?: string }).message ?? "";
      if (!/column|schema cache|PGRST204/i.test(msg)) {
        // 진짜 오류 (권한, 연결 등) — 목록으로 이동
        router.replace("/orders");
        return;
      }
      // 컬럼 누락 오류 → 다음 폴백 시도
    }

    if (!found) {
      router.replace("/orders");
      return;
    }

    setOrder(found as OrderDetail);
    setLoading(false);
  }, [orderId, router]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (!orderId || !order) return;
    if (order.status !== "IN_TRANSIT" && order.status !== "CUSTOMS_FILING") return;

    fetch(`/api/orders/sync-intl-tracking?order_id=${orderId}`, { method: "POST" })
      .then(() => loadOrder())
      .catch(() => {});
  }, [orderId, order?.status]);

  async function confirmCancel(parcelIdsToRemove: string[] | null) {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError("");
    try {
      const res = await fetch(`/api/orders/${cancelTarget.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          parcelIdsToRemove?.length ? { parcel_ids: parcelIdsToRemove } : {},
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "취소에 실패했습니다.");
      setCancelTarget(null);
      setCancelInitialRemoveIds(undefined);
      if (data.mode === "full") {
        router.replace("/orders");
        return;
      }
      await loadOrder();
    } catch (e: unknown) {
      setCancelError(e instanceof Error ? e.message : "취소 중 오류가 발생했습니다.");
    } finally {
      setCancelling(false);
    }
  }

  function openCancelModal(target: OrderDetail, removeParcelId?: string) {
    setCancelError("");
    setCancelTarget(target);
    setCancelInitialRemoveIds(removeParcelId ? [removeParcelId] : undefined);
  }

  if (loading || !order) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 pb-24 space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.back()} className="p-1 -ml-1">
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">주문 상세</h1>
          <p className="text-xs text-gray-400">{order.order_no}</p>
        </div>
      </div>

      <OrderDetailView
        order={order}
        variant="page"
        onCancelClick={() => openCancelModal(order)}
        onExcludeParcel={(parcelId) => openCancelModal(order, parcelId)}
      />

      {cancelTarget && (
        <OrderCancelModal
          order={cancelTarget}
          error={cancelError}
          cancelling={cancelling}
          initialRemoveIds={cancelInitialRemoveIds}
          onClose={() => {
            setCancelTarget(null);
            setCancelInitialRemoveIds(undefined);
          }}
          onConfirm={confirmCancel}
        />
      )}
    </div>
  );
}
