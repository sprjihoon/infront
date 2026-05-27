import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";
import { getShippingQuote, EmsApiError } from "@/lib/ems/client";
import { getOrderInsuranceParams } from "@/lib/ems/insurance";
import {
  getEmsUsdKrwRate,
  getEmsUsdKrwRateNumber,
} from "@/lib/ems/exchange-rate-store";
import {
  calculateDutyDeposit,
  computeOrderTotalAmount,
} from "@/lib/duty-deposit";

export const preferredRegion = "icn1"; // EMS 요금 계산 API 접근을 위해 서울 리전

const METHOD_MAP: Record<string, { premiumcd: string; em_ee: string }> = {
  EMS:         { premiumcd: "31", em_ee: "em" },
  EMS_PREMIUM: { premiumcd: "32", em_ee: "em" },
  KPACKET:     { premiumcd: "14", em_ee: "rl" },
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const [{ data: order }, { data: orderParcels }, { data: orderServices }, { data: shippingBoxes }] =
    await Promise.all([
      adminDb.from("orders").select("*, customers(name, email, customer_code, personal_address)").eq("id", id).single(),
      adminDb.from("order_parcels").select("*, parcels(id, tracking_no, weight_actual, vol_length, vol_width, vol_height, pre_invoice_items, item_condition)").eq("order_id", id),
      adminDb.from("order_services").select("*, services(code, name, category)").eq("order_id", id),
      adminDb.from("shipping_boxes").select("*, box_items(*)").eq("order_id", id).order("box_seq"),
    ]);

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    order,
    orderParcels: orderParcels ?? [],
    orderServices: orderServices ?? [],
    shippingBoxes: shippingBoxes ?? [],
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { action } = body;

  // ─── EMS 배송비 자동 계산 (실측값 기반 견적 미리보기) ───────────────
  if (action === "calculate_ems_fee") {
    const { shipping_method, country, totweight, boxlength, boxwidth, boxheight } = body;
    if (!shipping_method || !country || !totweight) {
      return NextResponse.json({ error: "shipping_method, country, totweight 필수" }, { status: 400 });
    }
    const method = METHOD_MAP[shipping_method as string];
    if (!method) return NextResponse.json({ error: `지원하지 않는 배송방법: ${shipping_method}` }, { status: 400 });

    try {
      const { data: orderForIns } = await adminDb
        .from("orders")
        .select("insurance_enabled, insurance_amount, customs_value")
        .eq("id", id)
        .single();
      const rateInfo = await getEmsUsdKrwRate(adminDb);
      const ins = getOrderInsuranceParams(orderForIns ?? {}, getEmsUsdKrwRateNumber(rateInfo));

      const result = await getShippingQuote({
        premiumcd: method.premiumcd,
        em_ee:     method.em_ee,
        countrycd: country as string,
        totweight: Number(totweight),
        boxlength: boxlength ? Number(boxlength) : undefined,
        boxwidth:  boxwidth  ? Number(boxwidth)  : undefined,
        boxheight: boxheight ? Number(boxheight) : undefined,
        boyn: ins.boyn,
        boprc: ins.boprc,
      });
      return NextResponse.json({ fee: result.totalFee, insurance: ins });
    } catch (e: unknown) {
      if (e instanceof EmsApiError) return NextResponse.json({ error: e.message }, { status: 400 });
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  if (action === "confirm_quote") {
    const {
      final_shipping_fee,
      quote_ems_cost,
      shipping_margin,
      note,
      totweight,
      boxlength,
      boxwidth,
      boxheight,
      duty_deposit_krw,
    } = body;
    if (!final_shipping_fee) return NextResponse.json({ error: "최종 배송비가 필요합니다" }, { status: 400 });

    const { data: order } = await adminDb.from("orders").select("*").eq("id", id).single();
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const emsCost = quote_ems_cost ? parseInt(String(quote_ems_cost)) : 0;
    const marginAmt = shipping_margin ? parseInt(String(shipping_margin)) : 0;
    const shippingFee = parseInt(final_shipping_fee);

    let dutyDepositKrw = order.duty_deposit_krw ?? 0;
    let dutyEstimateUsd = order.duty_estimate_usd ?? null;

    if (order.duty_prepaid) {
      if (duty_deposit_krw != null && duty_deposit_krw !== "") {
        dutyDepositKrw = parseInt(String(duty_deposit_krw), 10) || 0;
      } else {
        const rateInfo = await getEmsUsdKrwRate(adminDb);
        const dutyResult = calculateDutyDeposit({
          countryCode: order.recipient_country ?? "",
          customsValueUsd: Number(order.customs_value ?? 0),
          dutyPrepaidRequested: true,
          shippingMethod: order.shipping_method ?? undefined,
          usdKrwRate: getEmsUsdKrwRateNumber(rateInfo),
        });
        if (dutyResult.dutyPrepaid) {
          dutyDepositKrw = dutyResult.depositKrw;
          dutyEstimateUsd = dutyResult.estimateUsd;
        } else {
          dutyDepositKrw = 0;
        }
      }
    }

    const newTotal = computeOrderTotalAmount({
      packagingFee: order.packaging_fee,
      shippingFee,
      extraFee: order.extra_fee,
      dutyDepositKrw: order.duty_prepaid ? dutyDepositKrw : 0,
    });

    const { data, error } = await adminDb
      .from("orders")
      .update({
        status: "QUOTE_SENT",
        shipping_fee: shippingFee,
        quote_ems_cost: emsCost || null,
        shipping_margin: marginAmt || null,
        duty_deposit_krw: order.duty_prepaid ? dutyDepositKrw : 0,
        duty_estimate_usd: order.duty_prepaid ? dutyEstimateUsd : null,
        total_amount: newTotal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 실측값이 있으면 shipping_box에 저장 (결제 후 EMS 자동 접수에 사용)
    if (totweight && boxlength && boxwidth && boxheight) {
      const { data: boxes } = await adminDb
        .from("shipping_boxes").select("id").eq("order_id", id).order("box_seq").limit(1);

      if (boxes && boxes.length > 0) {
        await adminDb.from("shipping_boxes").update({
          weight_kg: Number(totweight) / 1000,
          length_cm: Number(boxlength),
          width_cm:  Number(boxwidth),
          height_cm: Number(boxheight),
          updated_at: new Date().toISOString(),
        }).eq("id", boxes[0].id);
      } else {
        await adminDb.from("shipping_boxes").insert({
          order_id:  id,
          box_seq:   1,
          status:    "PREPARING",
          weight_kg: Number(totweight) / 1000,
          length_cm: Number(boxlength),
          width_cm:  Number(boxwidth),
          height_cm: Number(boxheight),
        });
      }
    }

    await adminDb.from("notifications").insert({
      customer_id: order.customer_id,
      type: "QUOTE_SENT",
      title: "배송 견적이 확정되었습니다",
      body: `총 결제 금액: ${newTotal.toLocaleString()}원${note ? ` (${note})` : ""}. 결제 후 자동 발송됩니다.`,
      data: { order_id: id, total_amount: newTotal },
    });
    return NextResponse.json({ data });
  }

  if (action === "record_duty_paid") {
    const { duty_paid_krw } = body;
    if (duty_paid_krw == null || duty_paid_krw === "") {
      return NextResponse.json({ error: "관세 납부액이 필요합니다" }, { status: 400 });
    }

    const paid = parseInt(String(duty_paid_krw), 10);
    if (Number.isNaN(paid) || paid < 0) {
      return NextResponse.json({ error: "유효한 금액을 입력해주세요" }, { status: 400 });
    }

    const { data, error } = await adminDb
      .from("orders")
      .update({
        duty_paid_krw: paid,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  // ─── 박스 관리 ───────────────────────────────────────────────
  if (action === "add_box") {
    const { data: existing } = await adminDb.from("shipping_boxes").select("box_seq").eq("order_id", id).order("box_seq", { ascending: false }).limit(1);
    const nextSeq = (existing?.[0]?.box_seq ?? 0) + 1;

    const { data, error } = await adminDb.from("shipping_boxes").insert({
      order_id: id,
      box_seq: nextSeq,
      status: "PREPARING",
      weight_kg: body.weight_kg ?? null,
      length_cm: body.length_cm ?? null,
      width_cm: body.width_cm ?? null,
      height_cm: body.height_cm ?? null,
      intl_tracking_no: body.intl_tracking_no ?? null,
      carrier: body.carrier ?? "EMS",
      admin_notes: body.admin_notes ?? null,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (action === "update_box") {
    const { box_id, ...fields } = body;
    if (!box_id) return NextResponse.json({ error: "box_id 필요" }, { status: 400 });
    const allowed = ["weight_kg","length_cm","width_cm","height_cm","intl_tracking_no","carrier","status","admin_notes","shipping_fee"];
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    allowed.forEach(k => { if (k in fields) update[k] = fields[k]; });

    const { data, error } = await adminDb.from("shipping_boxes").update(update).eq("id", box_id).eq("order_id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (action === "delete_box") {
    const { box_id } = body;
    if (!box_id) return NextResponse.json({ error: "box_id 필요" }, { status: 400 });
    const { error } = await adminDb.from("shipping_boxes").delete().eq("id", box_id).eq("order_id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // 박스 품목 배정
  if (action === "assign_item") {
    const { box_id, parcel_id, item_index, name_en, quantity, unit_price_usd, origin_country, hs_code, item_condition } = body;
    const { data, error } = await adminDb.from("box_items").upsert({
      box_id, parcel_id, item_index,
      name_en, quantity, unit_price_usd, origin_country, hs_code, item_condition,
    }, { onConflict: "box_id,parcel_id,item_index" }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (action === "unassign_item") {
    const { box_id, parcel_id, item_index } = body;
    const { error } = await adminDb.from("box_items").delete().eq("box_id", box_id).eq("parcel_id", parcel_id).eq("item_index", item_index);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // 전체 발송 처리 (모든 박스 SHIPPED + 주문 IN_TRANSIT)
  if (action === "ship_all") {
    const { data: order } = await adminDb.from("orders").select("customer_id").eq("id", id).single();
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: boxes } = await adminDb.from("shipping_boxes").select("id, intl_tracking_no").eq("order_id", id);
    const firstTracking = boxes?.find(b => b.intl_tracking_no)?.intl_tracking_no ?? null;

    // 운송장 있는 박스만 SHIPPED로 업데이트
    await adminDb.from("shipping_boxes").update({ status: "SHIPPED", shipped_at: new Date().toISOString() }).eq("order_id", id).not("intl_tracking_no", "is", null);

    const { data, error } = await adminDb.from("orders").update({
      status: "IN_TRANSIT",
      tracking_no: firstTracking,
      shipped_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", id).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await adminDb.from("notifications").insert({
      customer_id: order.customer_id,
      type: "ORDER_SHIPPED",
      title: "물품이 발송되었습니다 ✈️",
      body: `운송장: ${firstTracking ?? "등록됨"}`,
      data: { order_id: id, tracking_no: firstTracking },
    });

    const { data: parcelLinks } = await adminDb.from("order_parcels").select("parcel_id").eq("order_id", id);
    if (parcelLinks && parcelLinks.length > 0) {
      await adminDb.from("parcels").update({ status: "SHIPPING" }).in("id", parcelLinks.map(p => p.parcel_id));
    }
    return NextResponse.json({ data });
  }

  // 레거시 단일 운송장 발송
  if (action === "ship") {
    const { tracking_no, carrier } = body;
    if (!tracking_no) return NextResponse.json({ error: "운송장 번호가 필요합니다" }, { status: 400 });

    const { data: order } = await adminDb.from("orders").select("customer_id").eq("id", id).single();
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // 박스가 없으면 자동 생성
    const { count } = await adminDb.from("shipping_boxes").select("id", { count: "exact", head: true }).eq("order_id", id);
    if (!count) {
      await adminDb.from("shipping_boxes").insert({ order_id: id, box_seq: 1, intl_tracking_no: tracking_no, carrier, status: "SHIPPED", shipped_at: new Date().toISOString() });
    }

    const { data, error } = await adminDb.from("orders").update({
      status: "IN_TRANSIT", tracking_no, carrier: carrier ?? null, shipped_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", id).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await adminDb.from("notifications").insert({
      customer_id: order.customer_id, type: "ORDER_SHIPPED",
      title: "물품이 발송되었습니다 ✈️", body: `운송장: ${tracking_no}`,
      data: { order_id: id, tracking_no },
    });

    const { data: parcelLinks } = await adminDb.from("order_parcels").select("parcel_id").eq("order_id", id);
    if (parcelLinks && parcelLinks.length > 0) {
      await adminDb.from("parcels").update({ status: "SHIPPING" }).in("id", parcelLinks.map(p => p.parcel_id));
    }
    return NextResponse.json({ data });
  }

  if (action === "cancel") {
    const { data, error } = await adminDb.from("orders").update({ status: "CANCELLED", updated_at: new Date().toISOString() }).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
