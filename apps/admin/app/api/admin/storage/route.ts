import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

// 스토리지 타입 목록 조회
export async function GET() {
  const { data, error } = await adminDb
    .from("storage_types")
    .select("id, code, name, dim_l_mm, dim_w_mm, dim_h_mm, volume_liter, price_per_week, price_max")
    .eq("is_active", true)
    .order("sort_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ types: data ?? [] });
}

// 대량 로케이션 생성
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { zone, slots, typeId } = body as { zone: string; slots: string[]; typeId?: string };

  if (!zone || !slots?.length) {
    return NextResponse.json({ error: "zone, slots 필수" }, { status: 400 });
  }

  const zoneUpper = zone.toUpperCase().trim();

  const rows = slots.map((slot: string) => ({
    zone:              zoneUpper,
    slot:              slot.trim(),
    code:              `${zoneUpper}-${slot.trim()}`,
    status:            "AVAILABLE",
    storage_type_id:   typeId ?? null,
  }));

  const { data, error } = await adminDb
    .from("storage_locations")
    .upsert(rows, { onConflict: "code", ignoreDuplicates: true })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, created: data?.length ?? 0 });
}
