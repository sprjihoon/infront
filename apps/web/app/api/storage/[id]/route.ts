import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function createSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
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

type Params = { params: Promise<{ id: string }> };

/** GET /api/storage/[id] — 특정 스토리지 + 내품 조회 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createSupabase(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [
    { data: storage, error: sErr },
    { data: items, error: iErr },
    { data: parcels, error: pErr },
  ] = await Promise.all([
    supabase
      .from("customer_storages")
      .select(`
        id, storage_name, storage_mode, plan_type, current_plan_type, max_plan_type,
        monthly_amount, capacity_score, used_score, usage_percent,
        status, short_term_started_at, paid_until_date, next_billing_date,
        created_at, updated_at,
        storage_plan_config!customer_storages_plan_type_fkey (label_ko, label_en, weekly_rate, monthly_amount)
      `)
      .eq("id", id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("customer_storage_items")
      .select(`
        id, product_name, category, image_url, capacity_score,
        location_code, status, source, verification_status,
        received_at, released_at, notes, created_at
      `)
      .eq("storage_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("parcels")
      .select(`
        id, tracking_no, status, inbound_at,
        weight_actual, sender_name, pre_invoice_items,
        is_shippable, hold_reason, created_at,
        parcel_media(storage_url, cf_thumbnail_url, stage, is_visible)
      `)
      .eq("customer_storage_id", id)
      .eq("customer_id", user.id)
      .not("status", "in", '("SHIPPED","RETURNED","PICKUP_CANCELLED","DISPOSED")')
      .order("inbound_at", { ascending: false }),
  ]);

  if (sErr) {
    if (sErr.code === "PGRST116") {
      return NextResponse.json({ error: "스토리지를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ error: sErr.message }, { status: 500 });
  }

  if (iErr) console.error("[storage/[id] items]", iErr);
  if (pErr) console.error("[storage/[id] parcels]", pErr);

  return NextResponse.json({ storage, items: items ?? [], parcels: parcels ?? [] });
}

/** PATCH /api/storage/[id] — 스토리지 정보 수정 (이름, 해지 신청 등) */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createSupabase(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    storage_name?: string;
    status?: string;
  };

  const allowed: Record<string, unknown> = {};
  if (body.storage_name) allowed.storage_name = body.storage_name;
  // 해지는 EMPTY 상태일 때만 허용
  if (body.status === "CANCELLED") allowed.status = "CANCELLED";

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "변경할 항목이 없습니다." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("customer_storages")
    .update({ ...allowed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ storage: data });
}
