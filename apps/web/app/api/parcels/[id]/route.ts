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

/**
 * PATCH /api/parcels/[id]
 * 고객이 자신의 소포 물품 내역 및 송장번호를 수정
 * PRE_REGISTERED, PENDING_PICKUP 상태에서만 허용
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { id } = await params;

  // 본인 소포 확인 + 상태 체크
  const { data: parcel } = await supabase
    .from("parcels")
    .select("id, status, customer_id")
    .eq("id", id)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (!parcel) return NextResponse.json({ error: "소포를 찾을 수 없습니다" }, { status: 404 });

  const EDITABLE_STATUSES = ["PRE_REGISTERED", "PENDING_PICKUP", "PICKED_UP"];
  if (!EDITABLE_STATUSES.includes(parcel.status)) {
    return NextResponse.json(
      { error: "창고 입고 이후에는 물품 정보를 수정할 수 없습니다" },
      { status: 403 }
    );
  }

  const body = await req.json() as {
    tracking_no?: string;
    courier?: string;
    item_condition?: "NEW" | "USED";
    pre_invoice_items?: Array<{
      product_name?: string;
      name_en: string;
      quantity: number;
      unit_price_usd: number;
      origin_country: string;
      hs_code?: string;
    }>;
  };

  const update: Record<string, unknown> = {};

  if (body.tracking_no !== undefined) {
    const t = body.tracking_no.trim();
    if (!t) return NextResponse.json({ error: "송장번호를 입력해주세요" }, { status: 400 });
    update.tracking_no = t;
  }
  if (body.courier !== undefined) update.courier = body.courier || null;
  if (body.item_condition !== undefined) update.item_condition = body.item_condition;
  if (body.pre_invoice_items !== undefined) {
    if (body.pre_invoice_items.length === 0) {
      return NextResponse.json({ error: "물품 내역을 하나 이상 입력해주세요" }, { status: 400 });
    }
    for (const item of body.pre_invoice_items) {
      if (!item.name_en?.trim()) {
        return NextResponse.json({ error: "모든 품목에 영문 품목(카테고리)을 선택해 주세요." }, { status: 400 });
      }
      if (!item.quantity || item.quantity < 1) {
        return NextResponse.json({ error: "수량을 1개 이상 입력해주세요" }, { status: 400 });
      }
    }
    update.pre_invoice_items = body.pre_invoice_items.map((item) => ({
      ...item,
      product_name: item.product_name?.trim() || undefined,
      name_en: item.name_en.trim(),
    }));
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "변경할 내용이 없습니다" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("parcels")
    .update(update)
    .eq("id", id)
    .eq("customer_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, parcel: data });
}
