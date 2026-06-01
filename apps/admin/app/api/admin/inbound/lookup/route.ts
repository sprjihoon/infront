import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

/**
 * GET /api/admin/inbound/lookup?tracking_no=xxx
 * 송장번호로 parcel + 고객 + 내품 조회
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const trackingNo = req.nextUrl.searchParams.get("tracking_no")?.trim();
  if (!trackingNo) return NextResponse.json({ error: "tracking_no 필요" }, { status: 400 });

  const { data, error } = await adminDb
    .from("parcels")
    .select(`
      id, tracking_no, status, is_shippable, inbound_at,
      item_count, pre_invoice_items, item_condition, courier, sender_name,
      customers(id, name, customer_code, email),
      storage_locations(id, code, zone, slot)
    `)
    .eq("tracking_no", trackingNo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "해당 송장번호를 찾을 수 없습니다." }, { status: 404 });

  return NextResponse.json({ parcel: data });
}
