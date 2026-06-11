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

/**
 * POST /api/storage/[id]/change-request
 * 용량 변경 / 단기→장기 전환 / 슬롯 추가 요청 접수
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id: storage_id } = await params;
  const cookieStore = await cookies();
  const supabase = createSupabase(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 본인 스토리지인지 확인
  const { data: storage, error: sErr } = await supabase
    .from("customer_storages")
    .select("id, storage_mode, plan_type")
    .eq("id", storage_id)
    .eq("user_id", user.id)
    .single();

  if (sErr || !storage) {
    return NextResponse.json({ error: "스토리지를 찾을 수 없습니다." }, { status: 404 });
  }

  const body = await req.json() as {
    request_type: string;
    requested_type_id?: string;
    requested_type_code?: string;
    requested_plan_type?: string;
    customer_note?: string;
  };

  const VALID_TYPES = ["CAPACITY_CHANGE", "CONVERT_TO_LONG_TERM", "ADD_SLOT"];
  if (!VALID_TYPES.includes(body.request_type)) {
    return NextResponse.json({ error: "유효하지 않은 요청 타입입니다." }, { status: 400 });
  }

  // 중복 PENDING 요청 방지 (동일 타입의 대기중 요청이 있으면 거부)
  const { data: existing } = await supabase
    .from("storage_change_requests")
    .select("id")
    .eq("storage_id", storage_id)
    .eq("request_type", body.request_type)
    .eq("status", "PENDING")
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "이미 처리 대기 중인 동일 요청이 있습니다." },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("storage_change_requests")
    .insert({
      user_id:              user.id,
      storage_id,
      request_type:         body.request_type,
      requested_type_id:    body.requested_type_id ?? null,
      requested_type_code:  body.requested_type_code ?? null,
      requested_plan_type:  body.requested_plan_type ?? null,
      customer_note:        body.customer_note ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[change-request POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ request: data }, { status: 201 });
}

/**
 * GET /api/storage/[id]/change-request
 * 해당 스토리지의 변경 요청 목록 조회
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: storage_id } = await params;
  const cookieStore = await cookies();
  const supabase = createSupabase(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("storage_change_requests")
    .select(`
      id, request_type, status, customer_note, admin_note,
      requested_type_code, requested_plan_type,
      created_at, processed_at
    `)
    .eq("storage_id", storage_id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ requests: data ?? [] });
}
