import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

/**
 * POST /api/admin/storage/auto-assign
 * 고객에게 새 빈 로케이션 추가 배정
 * Body: { customer_id: string }
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { customer_id } = await req.json();
  if (!customer_id) return NextResponse.json({ error: "customer_id 필요" }, { status: 400 });

  // 빈 로케이션 중 첫 번째 배정
  const { data: loc } = await adminDb
    .from("storage_locations")
    .select("id, code")
    .eq("status", "AVAILABLE")
    .is("customer_id", null)
    .order("zone")
    .order("slot")
    .limit(1)
    .maybeSingle();

  if (!loc) {
    return NextResponse.json({ error: "배정 가능한 빈 로케이션이 없습니다." }, { status: 404 });
  }

  const { error } = await adminDb
    .from("storage_locations")
    .update({ customer_id, status: "OCCUPIED", assigned_at: new Date().toISOString() })
    .eq("id", loc.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, location_id: loc.id, location_code: loc.code });
}
