import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

/**
 * GET /api/admin/orders/[id]/adjacent?status=...&q=...
 * 현재 주문의 앞/뒤 주문 ID를 반환합니다 (목록 필터 유지).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") ?? "";
  const q      = searchParams.get("q")      ?? "";

  // 목록과 동일한 조건으로 전체 ID 순서 조회
  let query = adminDb
    .from("orders")
    .select("id, order_no, status, recipient_name")
    .order("created_at", { ascending: false })
    .limit(500);

  if (status) query = query.eq("status", status);
  if (q) {
    const { data: custMatches } = await adminDb
      .from("customers")
      .select("id")
      .or(`name.ilike.%${q}%,customer_code.ilike.%${q}%,email.ilike.%${q}%`);
    const custIds = (custMatches ?? []).map((c) => c.id);
    if (custIds.length > 0) {
      query = query.or(
        `order_no.ilike.%${q}%,recipient_name.ilike.%${q}%,customer_id.in.(${custIds.join(",")})`
      );
    } else {
      query = query.or(`order_no.ilike.%${q}%,recipient_name.ilike.%${q}%`);
    }
  }

  const { data: orders } = await query;
  if (!orders) return NextResponse.json({ prev: null, next: null, index: 0, total: 0 });

  const idx   = orders.findIndex((o) => o.id === id);
  const total = orders.length;

  const prev = idx > 0            ? { id: orders[idx - 1].id, order_no: orders[idx - 1].order_no } : null;
  const next = idx < total - 1    ? { id: orders[idx + 1].id, order_no: orders[idx + 1].order_no } : null;

  return NextResponse.json({ prev, next, index: idx + 1, total });
}
