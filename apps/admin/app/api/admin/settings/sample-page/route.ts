import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

const CONFIG_KEY = "sample_page_mode";

/** GET /api/admin/settings/sample-page */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data } = await adminDb
    .from("admin_config")
    .select("value")
    .eq("key", CONFIG_KEY)
    .maybeSingle();

  const enabled = (data?.value as { enabled?: boolean })?.enabled ?? false;
  return NextResponse.json({ enabled });
}

/** PATCH /api/admin/settings/sample-page */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { enabled } = await req.json();
    const { error } = await adminDb.from("admin_config").upsert({
      key: CONFIG_KEY,
      value: { enabled: Boolean(enabled) },
      updated_at: new Date().toISOString(),
    });

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, enabled: Boolean(enabled) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "저장 실패" },
      { status: 400 },
    );
  }
}
