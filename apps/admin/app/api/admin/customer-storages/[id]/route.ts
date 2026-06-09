import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

/** GET /api/admin/customer-storages/[id] — 스토리지 상세 + 내품 목록 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: storage, error: sErr }, { data: items, error: iErr }, { data: payments }] =
    await Promise.all([
      adminDb
        .from("customer_storages")
        .select(`
          id, storage_name, storage_mode, plan_type, current_plan_type, max_plan_type,
          monthly_amount, capacity_score, used_score, usage_percent,
          status, short_term_started_at, paid_until_date, next_billing_date,
          long_term_notified_at, long_term_requested_at, notes,
          created_at, updated_at,
          customers!user_id (id, name, email, customer_code, phone),
          storage_plan_config!customer_storages_plan_type_fkey (label_ko, label_en, weekly_rate, monthly_amount)
        `)
        .eq("id", id)
        .single(),
      adminDb
        .from("customer_storage_items")
        .select(`
          id, product_name, category, image_url, capacity_score,
          location_code, status, source, verification_status,
          received_at, released_at, notes, created_at, updated_at
        `)
        .eq("storage_id", id)
        .order("created_at", { ascending: false }),
      adminDb
        .from("storage_payments")
        .select("id, payment_type, amount, status, approved_at, billing_memo, created_at")
        .eq("storage_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  if (sErr) {
    return NextResponse.json({ error: sErr.message }, { status: sErr.code === "PGRST116" ? 404 : 500 });
  }

  if (iErr) console.error("[admin customer-storages/[id] items]", iErr);

  return NextResponse.json({ storage, items: items ?? [], payments: payments ?? [] });
}

/** PATCH /api/admin/customer-storages/[id] — 스토리지 상태/메모 수정 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    status?: string;
    notes?: string;
    paid_until_date?: string;
    next_billing_date?: string;
  };

  const { data, error } = await adminDb
    .from("customer_storages")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ storage: data });
}
