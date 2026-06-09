import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** GET /api/storage/types — 관리자 로케이션에서 사용하는 스토리지 타입 목록 */
export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
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

  const { data, error } = await supabase
    .from("storage_types")
    .select("id, code, name, price_per_week, price_max, max_parcels, volume_liter, dim_l_mm, dim_w_mm, dim_h_mm")
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ types: data ?? [] });
}
