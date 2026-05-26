"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { OrderDetail } from "@/lib/order-display";
import OrderDetailView from "@/components/orders/OrderDetailView";
import OrderCancelModal from "@/components/orders/OrderCancelModal";

const ORDER_SELECT = `
  id, order_no, status, shipping_method, packaging_type,
  packaging_fee, shipping_fee, extra_fee, total_amount, payment_status,
  recipient_name, recipient_phone, recipient_address, recipient_country,
  recipient_addr1, recipient_addr2, recipient_addr3, recipient_zip, recipient_email,
  customs_value, insurance_enabled, insurance_amount, item_list, intl_tracking_no,
  intl_tracking_status, intl_tracking_last_event, intl_tracking_events,
  intl_tracking_synced_at, delivered_at,
  actual_weight, chargeable_weight,
  created_at, updated_at,
  order_parcels (
    parcel_id,
    parcels (id, tracking_no, sender_name, status)
  ),
  shipping_boxes (id, box_seq, intl_tracking_no, carrier, status, weight_kg)
`;

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<OrderDetail | null>(null);
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

    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("id", orderId)
      .eq("customer_id", user.id)
      .maybeSingle();

    if (error || !data) {
      router.replace("/orders");
      return;
    }

    setOrder(data as unknown as OrderDetail);
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

  async function confirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError("");
    try {
      const res = await fetch(`/api/orders/${cancelTarget.id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "취소에 실패했습니다.");
      setCancelTarget(null);
      await loadOrder();
    } catch (e: unknown) {
      setCancelError(e instanceof Error ? e.message : "취소 중 오류가 발생했습니다.");
    } finally {
      setCancelling(false);
    }
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
        onCancelClick={() => {
          setCancelError("");
          setCancelTarget(order);
        }}
      />

      {cancelTarget && (
        <OrderCancelModal
          order={cancelTarget}
          error={cancelError}
          cancelling={cancelling}
          onClose={() => setCancelTarget(null)}
          onConfirm={confirmCancel}
        />
      )}
    </div>
  );
}
