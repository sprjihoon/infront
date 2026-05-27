import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateDutyDeposit } from "@/lib/duty-deposit";
import { getEmsUsdKrwRate, getEmsUsdKrwRateNumber } from "@/lib/ems/exchange-rate-store";
import {
  buildItemListFromParcels,
  sumCustomsValueUsd,
} from "@/lib/order-cancel-items";

export { buildItemListFromParcels, sumCustomsValueUsd } from "@/lib/order-cancel-items";
export type { OrderItemRow } from "@/lib/order-cancel-items";

/** order_parcels 삭제 + 해당 소포 부가서비스 요청 취소 → 마이창고 출고 가능 */
export async function releaseParcelsFromOrder(
  admin: SupabaseClient,
  orderId: string,
  parcelIds: string[],
): Promise<void> {
  if (parcelIds.length === 0) return;

  const { error: opErr } = await admin
    .from("order_parcels")
    .delete()
    .eq("order_id", orderId)
    .in("parcel_id", parcelIds);
  if (opErr) throw new Error("물품 연결 해제에 실패했습니다.");

  await admin
    .from("parcel_service_requests")
    .update({ status: "CANCELLED" })
    .in("parcel_id", parcelIds)
    .eq("status", "REQUESTED");
}

export async function cleanupOrderDraftArtifacts(
  admin: SupabaseClient,
  orderId: string,
  parcelIds: string[],
  fullCancel: boolean,
): Promise<void> {
  if (fullCancel) {
    await admin.from("packaging_requests").delete().eq("order_id", orderId).eq("status", "PENDING");
    await admin
      .from("order_services")
      .update({ status: "CANCELLED" })
      .eq("order_id", orderId)
      .neq("status", "DONE");
    await admin
      .from("shipping_boxes")
      .delete()
      .eq("order_id", orderId)
      .in("status", ["PREPARING", "PACKED"]);
  }

  if (parcelIds.length > 0) {
    await releaseParcelsFromOrder(admin, orderId, parcelIds);
  }
}

export async function rebuildOrderAfterPartialRelease(
  admin: SupabaseClient,
  order: {
    id: string;
    shipping_method: string;
    recipient_country: string | null;
    duty_prepaid: boolean | null;
    insurance_enabled: boolean | null;
  },
  remainingParcelIds: string[],
): Promise<void> {
  let parcels: Array<{ pre_invoice_items: unknown }> = [];
  if (remainingParcelIds.length > 0) {
    const { data, error } = await admin
      .from("parcels")
      .select("pre_invoice_items")
      .in("id", remainingParcelIds);
    if (error) throw new Error("남은 물품 정보를 불러오지 못했습니다.");
    parcels = data ?? [];
  }

  const item_list = buildItemListFromParcels(parcels);
  const customs_value = sumCustomsValueUsd(item_list);
  const insuranceEnabled = Boolean(order.insurance_enabled);
  const insurance_amount = insuranceEnabled ? customs_value : 0;

  let duty_prepaid = Boolean(order.duty_prepaid);
  let duty_estimate_usd: number | null = null;
  let duty_deposit_krw = 0;

  if (duty_prepaid && customs_value > 0) {
    const rateInfo = await getEmsUsdKrwRate(admin);
    const dutyResult = calculateDutyDeposit({
      countryCode: order.recipient_country?.toUpperCase() ?? "",
      customsValueUsd: customs_value,
      dutyPrepaidRequested: true,
      shippingMethod: order.shipping_method,
      usdKrwRate: getEmsUsdKrwRateNumber(rateInfo),
    });
    duty_prepaid = dutyResult.dutyPrepaid;
    duty_estimate_usd = dutyResult.dutyPrepaid ? dutyResult.estimateUsd : null;
    duty_deposit_krw = dutyResult.depositKrw;
  } else if (duty_prepaid) {
    duty_prepaid = false;
    duty_estimate_usd = null;
    duty_deposit_krw = 0;
  }

  const { error: updErr } = await admin
    .from("orders")
    .update({
      item_list,
      customs_value,
      insurance_amount,
      duty_prepaid,
      duty_estimate_usd,
      duty_deposit_krw,
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  if (updErr) throw new Error("주문 물품 정보 갱신에 실패했습니다.");
}
