import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

export async function GET(_req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data } = await adminDb
    .from("storage_locations")
    .select("id, code, zone, slot, status, customer_id, is_temp, customers(name, customer_code), storage_types(id, code, name, volume_liter, price_per_week, price_per_month)")
    .order("zone")
    .order("slot");

  return NextResponse.json({ locations: data ?? [] });
}
