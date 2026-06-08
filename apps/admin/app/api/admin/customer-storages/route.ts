import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

/** GET /api/admin/customer-storages — 전체 고객 스토리지 목록 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search");
  const mode = url.searchParams.get("mode");

  let query = adminDb
    .from("customer_storages")
    .select(`
      id, storage_name, storage_mode, plan_type, current_plan_type, max_plan_type,
      monthly_amount, capacity_score, used_score, usage_percent,
      status, short_term_started_at, paid_until_date, next_billing_date,
      created_at, updated_at,
      customers!user_id (name, email, customer_code),
      storage_plan_config!plan_type (label_ko)
    `)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (mode) query = query.eq("storage_mode", mode);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let result = data ?? [];

  if (search) {
    const s = search.toLowerCase();
    result = result.filter((row) => {
      const c = row.customers as unknown as { name: string | null; email: string; customer_code: string } | null;
      return (
        (c?.name ?? "").toLowerCase().includes(s) ||
        (c?.email ?? "").toLowerCase().includes(s) ||
        (c?.customer_code ?? "").toLowerCase().includes(s) ||
        row.storage_name.toLowerCase().includes(s)
      );
    });
  }

  return NextResponse.json({ storages: result });
}
