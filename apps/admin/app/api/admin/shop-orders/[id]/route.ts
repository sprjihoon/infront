import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

/* ────────────────────────────────────────────────────────────────
   GET   /api/admin/shop-orders/[id]   단건 조회
   PATCH /api/admin/shop-orders/[id]   상태/메모 변경
──────────────────────────────────────────────────────────────── */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { data, error } = await adminDb
    .from("shop_orders")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ order: data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const allowed = ["status", "admin_memo"];
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  allowed.forEach(k => { if (k in body) update[k] = body[k]; });

  const { data, error } = await adminDb
    .from("shop_orders")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: data });
}
