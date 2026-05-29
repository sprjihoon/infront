import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function makeSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) =>
          list.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );
}

import { COURIER_TO_CARRIER_ID } from "@/lib/tracking/client";

/**
 * GET /api/parcels?shippable=true
 * 출고 가능한 본인 소포 목록 반환 (국내 배송 신청용)
 */
export async function GET(req: NextRequest) {
  const shippable = req.nextUrl.searchParams.get("shippable") === "true";
  const supabase = await makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminSupa = srk
    ? createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, srk, { cookies: { getAll: () => [], setAll: () => {} } })
    : null;

  const client = adminSupa ?? supabase;

  const { data: customer } = await client
    .from("customers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!customer) return NextResponse.json({ parcels: [] });

  let query = client
    .from("parcels")
    .select("id, tracking_no, sender_name, weight_actual, status, is_shippable")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false });

  if (shippable) {
    query = query.eq("status", "INBOUND").eq("is_shippable", true);
  }

  const { data: parcels } = await query;
  return NextResponse.json({ parcels: parcels ?? [] });
}

interface InvoiceItem {
  name_en: string;
  quantity: number;
  unit_price_usd: number;
  origin_country: string;
  hs_code?: string;
}

export async function POST(req: NextRequest) {
  const supabase = await makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  // customers 레코드 확인 및 자동 생성
  let { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!customer) {
    const seq = Date.now() % 10000;
    const code = `SPB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(seq).padStart(4, "0")}`;
    const { data: created } = await supabase
      .from("customers")
      .insert({ id: user.id, email: user.email ?? "", customer_code: code })
      .select("id")
      .single();
    customer = created;
  }

  if (!customer) {
    return NextResponse.json({ error: "고객 정보를 생성할 수 없습니다" }, { status: 500 });
  }

  const body = await req.json();
  const {
    tracking_no,
    courier,
    sender_name,
    sender_phone,
    sender_address,
    notes,
    item_condition,
    pre_invoice_items,
  } = body as {
    tracking_no: string;
    courier?: string;
    sender_name?: string;
    sender_phone?: string;
    sender_address?: string;
    notes?: string;
    item_condition: "NEW" | "USED";
    pre_invoice_items: InvoiceItem[];
  };

  // 필수값 검증
  if (!tracking_no?.trim()) {
    return NextResponse.json({ error: "국내 운송장 번호는 필수입니다" }, { status: 400 });
  }
  if (!pre_invoice_items || pre_invoice_items.length === 0) {
    return NextResponse.json({ error: "물품 내역을 하나 이상 입력해주세요" }, { status: 400 });
  }
  for (const item of pre_invoice_items) {
    if (!item.name_en?.trim()) return NextResponse.json({ error: "품목명(영문)을 입력해주세요" }, { status: 400 });
    if (!item.quantity || item.quantity < 1) return NextResponse.json({ error: "수량을 1개 이상 입력해주세요" }, { status: 400 });
    if (item.unit_price_usd < 0) return NextResponse.json({ error: "단가는 0 이상이어야 합니다" }, { status: 400 });
  }

  // 동일 운송장 존재 시 → 물품 목록 병합 (추가 등록)
  const { data: existing } = await supabase
    .from("parcels")
    .select("id, pre_invoice_items")
    .eq("tracking_no", tracking_no.trim())
    .eq("customer_id", user.id)
    .maybeSingle();

  if (existing) {
    const merged = [
      ...((existing.pre_invoice_items as InvoiceItem[]) ?? []),
      ...pre_invoice_items,
    ];
    const { data: updated, error: updateError } = await supabase
      .from("parcels")
      .update({
        pre_invoice_items: merged,
        item_condition: item_condition ?? "NEW",
        ...(courier?.trim() && { courier: courier.trim() }),
        ...(sender_name?.trim() && { sender_name: sender_name.trim() }),
        ...(sender_phone?.trim() && { sender_phone: sender_phone.trim() }),
        ...(sender_address?.trim() && { sender_address: sender_address.trim() }),
        ...(notes?.trim() && { notes: notes.trim() }),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    return NextResponse.json({ data: updated, merged: true }, { status: 200 });
  }

  const { data: parcel, error } = await supabase
    .from("parcels")
    .insert({
      customer_id: user.id,
      tracking_no: tracking_no.trim(),
      courier: courier?.trim() || null,
      tracking_carrier_id: courier?.trim() ? (COURIER_TO_CARRIER_ID[courier.trim()] ?? null) : null,
      sender_name: sender_name?.trim() || null,
      sender_phone: sender_phone?.trim() || null,
      sender_address: sender_address?.trim() || null,
      notes: notes?.trim() || null,
      item_condition: item_condition ?? "NEW",
      pre_invoice_items: pre_invoice_items,
      status: "PRE_REGISTERED",
      registered_by: "CUSTOMER",
      inbound_source: "DIRECT",
    })
    .select()
    .single();

  if (error) {
    console.error("parcel insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("notifications").insert({
    customer_id: user.id,
    type: "PARCEL_REGISTERED",
    title: "물품이 등록되었습니다",
    body: `운송장 ${tracking_no} 물품이 등록되었어요. 센터 도착 후 입고 처리됩니다.`,
    data: { parcel_id: parcel.id },
  });

  return NextResponse.json({ data: parcel }, { status: 201 });
}
