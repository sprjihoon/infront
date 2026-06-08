import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

/** GET /api/admin/pickup-box-fees — 박스 요금 목록 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await adminDb
    .from("pickup_box_fees")
    .select("*")
    .order("sort_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ fees: data });
}

/** PATCH /api/admin/pickup-box-fees — 요금 일괄 수정 */
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    updates: Array<{
      size_code: string;
      pickup_fee: number;
      is_active?: boolean;
    }>;
  };

  if (!body.updates?.length) {
    return NextResponse.json({ error: "updates 배열이 필요합니다." }, { status: 400 });
  }

  const results = await Promise.all(
    body.updates.map(({ size_code, pickup_fee, is_active }) =>
      adminDb
        .from("pickup_box_fees")
        .update({ pickup_fee, ...(is_active !== undefined ? { is_active } : {}) })
        .eq("size_code", size_code)
        .select()
        .single()
    )
  );

  const failed = results.filter((r) => r.error);
  if (failed.length) {
    return NextResponse.json(
      { error: `${failed.length}건 업데이트 실패`, details: failed.map((r) => r.error?.message) },
      { status: 500 }
    );
  }

  return NextResponse.json({ updated: results.map((r) => r.data) });
}
