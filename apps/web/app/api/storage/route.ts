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

/** GET /api/storage — 내 스토리지 목록 조회 */
export async function GET() {
  const cookieStore = await cookies();
  const supabase = createSupabase(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("customer_storages")
    .select(`
      id, storage_name, storage_mode, plan_type, current_plan_type, max_plan_type,
      monthly_amount, capacity_score, used_score, usage_percent,
      status, short_term_started_at, paid_until_date, next_billing_date,
      created_at, updated_at,
      storage_plan_config!customer_storages_plan_type_fkey (label_ko, label_en, weekly_rate)
    `)
    .eq("user_id", user.id)
    .neq("status", "CANCELLED")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[storage GET]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ storages: data ?? [] });
}

/** POST /api/storage — 새 스토리지 신청 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabase(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    storage_name?: string;
    storage_mode: "short_term" | "long_term";
    plan_type?: string;
    status?: string;
  };

  if (!body.storage_mode) {
    return NextResponse.json({ error: "storage_mode 는 필수입니다." }, { status: 400 });
  }

  // 플랜 정보 조회
  let planConfig = null;
  if (body.plan_type) {
    const { data } = await supabase
      .from("storage_plan_config")
      .select("capacity_score, monthly_amount")
      .eq("plan_type", body.plan_type)
      .single();
    planConfig = data;
  }

  // 허용된 상태값 (클라이언트에서 PENDING_PAYMENT 가능)
  const ALLOWED_INIT_STATUS = ["ACTIVE", "PENDING_PAYMENT"];
  const initStatus = body.status && ALLOWED_INIT_STATUS.includes(body.status)
    ? body.status
    : "ACTIVE";

  // 기존 스토리지 수 조회 → 기본 이름 순번 결정
  let defaultName = "내 스토리지";
  if (!body.storage_name) {
    const { count } = await supabase
      .from("customer_storages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .neq("status", "CANCELLED");
    const n = (count ?? 0) + 1;
    defaultName = n === 1 ? "내 스토리지" : `내 스토리지 ${n}`;
  }

  const { data, error } = await supabase
    .from("customer_storages")
    .insert({
      user_id: user.id,
      storage_name: body.storage_name || defaultName,
      storage_mode: body.storage_mode,
      plan_type: body.plan_type ?? null,
      capacity_score: planConfig?.capacity_score ?? null,
      monthly_amount: planConfig?.monthly_amount ?? null,
      status: initStatus,
      short_term_started_at:
        body.storage_mode === "short_term" ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    console.error("[storage POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ storage: data });
}
