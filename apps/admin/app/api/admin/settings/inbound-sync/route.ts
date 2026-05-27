import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";
import {
  DEFAULT_INBOUND_SYNC_SCHEDULE,
  INBOUND_SYNC_CONFIG_KEY,
  normalizeInboundSyncSchedule,
  type InboundSyncLastRun,
  type InboundSyncSchedule,
} from "@/lib/parcels/inbound-sync-schedule";

async function loadSchedule(): Promise<InboundSyncSchedule> {
  const { data } = await adminDb
    .from("admin_config")
    .select("value")
    .eq("key", INBOUND_SYNC_CONFIG_KEY)
    .maybeSingle();

  if (!data?.value) return DEFAULT_INBOUND_SYNC_SCHEDULE;
  return normalizeInboundSyncSchedule(data.value);
}

async function loadLastRun(): Promise<InboundSyncLastRun | null> {
  const { data } = await adminDb
    .from("admin_config")
    .select("value")
    .eq("key", "inbound_sync_last_run")
    .maybeSingle();
  return (data?.value as InboundSyncLastRun) ?? null;
}

/** GET /api/admin/settings/inbound-sync */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const [schedule, lastRun] = await Promise.all([loadSchedule(), loadLastRun()]);
    return NextResponse.json({ schedule, lastRun });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "조회 실패" },
      { status: 500 },
    );
  }
}

/** PATCH /api/admin/settings/inbound-sync */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const schedule = normalizeInboundSyncSchedule(body);

    const { error } = await adminDb.from("admin_config").upsert({
      key: INBOUND_SYNC_CONFIG_KEY,
      value: schedule,
      updated_at: new Date().toISOString(),
    });

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, schedule });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "저장 실패" },
      { status: 400 },
    );
  }
}
