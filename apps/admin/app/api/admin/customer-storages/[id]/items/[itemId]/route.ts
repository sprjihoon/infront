import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string; itemId: string }> };

/** PATCH /api/admin/customer-storages/[id]/items/[itemId] — 내품 상태/검증 수정 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { itemId } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    status?: string;
    verification_status?: string;
    location_code?: string;
    received_at?: string;
    released_at?: string;
    notes?: string;
    capacity_score?: number;
  };

  const { data, error } = await adminDb
    .from("customer_storage_items")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}
