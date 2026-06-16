import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: parcelId } = await params;

  // 최근 3단계 이력 (from/to 로케이션 코드 포함)
  const { data, error } = await adminDb
    .from("parcel_location_events")
    .select(`
      id,
      reason,
      notes,
      photo_url,
      created_by,
      created_at,
      from_location:from_location_id(id, code, zone, is_temp),
      to_location:to_location_id(id, code, zone, is_temp)
    `)
    .eq("parcel_id", parcelId)
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ history: data ?? [] });
}
