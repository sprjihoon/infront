import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * GET /api/storage/my-locations
 * 현재 사용자에게 배정된 storage_locations + storage_types 반환
 */
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: locations, error } = await supabase
    .from("storage_locations")
    .select(`
      id, code, zone, slot, status,
      storage_types (
        id, code, name,
        price_per_week, price_max, price_per_month,
        max_parcels,
        dim_l_mm, dim_w_mm, dim_h_mm, volume_liter
      )
    `)
    .eq("customer_id", user.id)
    .not("status", "eq", "DISABLED")
    .order("code");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 요약: 타입별 슬롯 수, 주간 총 요금
  type LocationRow = {
    id: string;
    code: string;
    status: string;
    storage_types: {
      id: string; code: string; name: string;
      price_per_week: number; max_parcels: number | null;
    } | null;
  };

  const rows = (locations ?? []) as unknown as LocationRow[];
  const totalWeeklyFee = rows.reduce(
    (sum, loc) => sum + (loc.storage_types?.price_per_week ?? 0),
    0
  );

  // 가장 많이 배정된 타입 (dominant)
  const typeCount: Record<string, { code: string; name: string; count: number; price_per_week: number }> = {};
  rows.forEach((loc) => {
    const t = loc.storage_types;
    if (!t) return;
    if (!typeCount[t.code]) typeCount[t.code] = { code: t.code, name: t.name, count: 0, price_per_week: t.price_per_week };
    typeCount[t.code].count++;
  });
  const dominantType = Object.values(typeCount).sort((a, b) => b.count - a.count)[0] ?? null;

  return NextResponse.json({
    locations: rows,
    summary: {
      slot_count: rows.length,
      total_weekly_fee: totalWeeklyFee,
      dominant_type: dominantType,
    },
  });
}
