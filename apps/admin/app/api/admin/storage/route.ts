import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

// 스토리지 타입 목록 조회
export async function GET() {
  const { data, error } = await adminDb
    .from("storage_types")
    .select("id, code, name, dim_l_mm, dim_w_mm, dim_h_mm, volume_liter, max_parcels, price_per_week, price_max")
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

  // 타입이 지정된 경우 max_parcels 자동 적용
  let typeMaxParcels: number | null = null;
  if (typeId) {
    const { data: typeData } = await adminDb
      .from("storage_types")
      .select("max_parcels")
      .eq("id", typeId)
      .single();
    typeMaxParcels = typeData?.max_parcels ?? null;
  }

  const rows = slots.map((slot: string) => ({
    zone:              zoneUpper,
    slot:              slot.trim(),
    code:              `${zoneUpper}-${slot.trim()}`,
    status:            "AVAILABLE",
    storage_type_id:   typeId ?? null,
    ...(typeMaxParcels !== null ? { max_parcels: typeMaxParcels } : {}),
  }));

  const { data, error } = await adminDb
    .from("storage_locations")
    .upsert(rows, { onConflict: "code", ignoreDuplicates: true })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, created: data?.length ?? 0 });
}

// 스토리지 타입 max_parcels 수정
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { type_id, max_parcels } = body as { type_id: string; max_parcels: number | null };

  if (!type_id) return NextResponse.json({ error: "type_id 필수" }, { status: 400 });
  if (max_parcels !== null && max_parcels !== undefined && (typeof max_parcels !== "number" || max_parcels < 1)) {
    return NextResponse.json({ error: "max_parcels는 1 이상 정수 또는 null" }, { status: 400 });
  }

  const { data, error } = await adminDb
    .from("storage_types")
    .update({ max_parcels: max_parcels ?? null })
    .eq("id", type_id)
    .select("id, code, name, max_parcels")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, type: data });
}
