import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

/* ────────────────────────────────────────────────────────────────
   GET  /api/admin/shop-orders          shop_orders 목록 조회
   POST /api/admin/shop-orders          (미사용)
──────────────────────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const q      = searchParams.get("q");
  const page   = parseInt(searchParams.get("page") ?? "1", 10);
  const limit  = 30;

  let query = adminDb
    .from("shop_orders")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (status) query = query.eq("status", status);
  if (q) {
    query = query.or(
      `oid.ilike.%${q}%,sender_name.ilike.%${q}%,recipient_name.ilike.%${q}%`
    );
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ orders: data ?? [], total: count ?? 0, page, limit });
}
