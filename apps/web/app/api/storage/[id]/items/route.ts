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

/** GET /api/storage/[id]/items — 스토리지 내품 목록 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createSupabase(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("customer_storage_items")
    .select(`
      id, product_name, category, image_url, capacity_score,
      location_code, status, source, verification_status,
      received_at, released_at, notes, created_at, updated_at
    `)
    .eq("storage_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

/** POST /api/storage/[id]/items — 내품 추가 신고 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createSupabase(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 스토리지 소유권 확인
  const { data: storage, error: sErr } = await supabase
    .from("customer_storages")
    .select("id, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (sErr || !storage) {
    return NextResponse.json({ error: "스토리지를 찾을 수 없습니다." }, { status: 404 });
  }

  const body = await request.json() as {
    items: Array<{
      product_name: string;
      category?: string;
      capacity_score?: number;
      notes?: string;
    }>;
  };

  if (!body.items?.length) {
    return NextResponse.json({ error: "내품 정보가 없습니다." }, { status: 400 });
  }

  const inserts = body.items.map((item) => ({
    user_id: user.id,
    storage_id: id,
    product_name: item.product_name,
    category: item.category ?? null,
    capacity_score: item.capacity_score ?? 1,
    notes: item.notes ?? null,
    status: "PENDING_INBOUND" as const,
    source: "customer" as const,
    verification_status: "unverified" as const,
  }));

  const { data, error } = await supabase
    .from("customer_storage_items")
    .insert(inserts)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data });
}
