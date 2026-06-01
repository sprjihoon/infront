import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ customers: [] });

  const { data } = await adminDb
    .from("customers")
    .select("id, name, customer_code, email")
    .or(`name.ilike.%${q}%,customer_code.ilike.%${q}%,email.ilike.%${q}%`)
    .order("customer_code")
    .limit(10);

  return NextResponse.json({ customers: data ?? [] });
}
