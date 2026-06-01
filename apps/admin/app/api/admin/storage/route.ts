import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

// 대량 로케이션 생성
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { zone, slots } = body as { zone: string; slots: string[] };

  if (!zone || !slots?.length) {
    return NextResponse.json({ error: "zone, slots 필수" }, { status: 400 });
  }

  const zoneUpper = zone.toUpperCase().trim();

  const rows = slots.map((slot: string) => ({
    zone: zoneUpper,
    slot: slot.trim(),
    code: `${zoneUpper}-${slot.trim()}`,
    status: "AVAILABLE",
  }));

  const { data, error } = await adminDb
    .from("storage_locations")
    .upsert(rows, { onConflict: "code", ignoreDuplicates: true })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, created: data?.length ?? 0 });
}
