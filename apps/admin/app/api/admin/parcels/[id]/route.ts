import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const [{ data: parcel }, { data: inspections }] = await Promise.all([
    adminDb
      .from("parcels")
      .select("*, customers(name, email, customer_code)")
      .eq("id", id)
      .single(),
    adminDb
      .from("inspection_results")
      .select("*")
      .eq("parcel_id", id)
      .order("inspected_at", { ascending: false }),
  ]);

  if (!parcel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ parcel, inspections: inspections ?? [] });
}
