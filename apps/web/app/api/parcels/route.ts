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

  // 동일 운송장 중복 등록 방지
  const { data: dup } = await supabase
    .from("parcels")
    .select("id")
    .eq("tracking_no", tracking_no.trim())
    .eq("customer_id", user.id)
    .maybeSingle();

  if (dup) {
    return NextResponse.json({ error: "이미 등록된 운송장 번호입니다" }, { status: 409 });
  }

  const { data: parcel, error } = await supabase
    .from("parcels")
    .insert({
      customer_id: user.id,
      tracking_no: tracking_no.trim(),
      courier: courier?.trim() || null,
      sender_name: sender_name?.trim() || null,
      sender_phone: sender_phone?.trim() || null,
      sender_address: sender_address?.trim() || null,
      notes: notes?.trim() || null,
      item_condition: item_condition ?? "NEW",
      pre_invoice_items: pre_invoice_items,
      status: "PRE_REGISTERED",
      registered_by: "CUSTOMER",
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
