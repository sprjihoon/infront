import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

// 스토리지 타입 목록 조회
export async function GET() {
  // price_per_month 컬럼이 아직 없는 환경을 위한 fallback
  const { data, error } = await adminDb
    .from("storage_types")
    .select("id, code, name, dim_l_mm, dim_w_mm, dim_h_mm, volume_liter, max_parcels, price_per_week, price_max, price_per_month")
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    // price_per_month 컬럼 미존재 시 해당 컬럼 제외하고 재시도
    if (error.message.includes("price_per_month")) {
      const { data: fallback, error: fallbackError } = await adminDb
        .from("storage_types")
        .select("id, code, name, dim_l_mm, dim_w_mm, dim_h_mm, volume_liter, max_parcels, price_per_week, price_max")
        .eq("is_active", true)
        .order("sort_order");
      if (fallbackError) return NextResponse.json({ error: fallbackError.message }, { status: 500 });
      const withNull = (fallback ?? []).map((t) => ({ ...t, price_per_month: null }));
      return NextResponse.json({ types: withNull });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
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

// 스토리지 타입 설정 수정 (max_parcels, price_per_week, price_max, price_per_month)
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { type_id, max_parcels, price_per_week, price_max, price_per_month } = body as {
    type_id: string;
    max_parcels?: number | null;
    price_per_week?: number | null;
    price_max?: number | null;
    price_per_month?: number | null;
  };

  if (!type_id) return NextResponse.json({ error: "type_id 필수" }, { status: 400 });

  if (max_parcels !== undefined && max_parcels !== null && (typeof max_parcels !== "number" || max_parcels < 1)) {
    return NextResponse.json({ error: "max_parcels는 1 이상 정수 또는 null" }, { status: 400 });
  }
  if (price_per_week !== undefined && price_per_week !== null && (typeof price_per_week !== "number" || price_per_week < 0)) {
    return NextResponse.json({ error: "price_per_week는 0 이상 숫자" }, { status: 400 });
  }
  if (price_max !== undefined && price_max !== null && (typeof price_max !== "number" || price_max < 0)) {
    return NextResponse.json({ error: "price_max는 0 이상 숫자 또는 null" }, { status: 400 });
  }
  if (price_per_month !== undefined && price_per_month !== null && (typeof price_per_month !== "number" || price_per_month < 0)) {
    return NextResponse.json({ error: "price_per_month는 0 이상 숫자 또는 null" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (max_parcels !== undefined) patch.max_parcels = max_parcels ?? null;
  if (price_per_week !== undefined) patch.price_per_week = price_per_week;
  if (price_max !== undefined) patch.price_max = price_max ?? null;
  if (price_per_month !== undefined) patch.price_per_month = price_per_month ?? null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "변경할 항목이 없습니다" }, { status: 400 });
  }

  const { data, error } = await adminDb
    .from("storage_types")
    .update(patch)
    .eq("id", type_id)
    .select("id, code, name, max_parcels, price_per_week, price_max, price_per_month")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, type: data });
}
