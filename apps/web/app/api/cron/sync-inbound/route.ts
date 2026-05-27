import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getKstClock } from "@/lib/business-days/kr";
import { syncParcelsInboundBatch } from "@/lib/parcels/inbound-sync";
import {
  loadInboundSyncSchedule,
  saveInboundSyncLastRun,
} from "@/lib/parcels/inbound-sync-config";
import { shouldRunInboundSyncCron } from "@/lib/parcels/inbound-sync-schedule";

export const preferredRegion = "icn1";
export const maxDuration = 60;

function createAdminSupabase() {
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!srk) throw new Error("SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.");
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    srk,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * GET /api/cron/sync-inbound
 * 평일(공휴일·주말 제외) 설정 시각(KST)에 입고 전 구간 API 동기화
 * ?force=1 — 스케줄 무시하고 즉시 실행 (CRON_SECRET 필요)
 */
export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = new URL(req.url).searchParams.get("force") === "1";
  const limit = parseInt(new URL(req.url).searchParams.get("limit") ?? "200", 10);
  const now = new Date();
  const kst = getKstClock(now);

  try {
    const supabase = createAdminSupabase();
    const schedule = await loadInboundSyncSchedule(supabase);
    const decision = shouldRunInboundSyncCron(schedule, { force, at: now });

    if (!decision.run) {
      await saveInboundSyncLastRun(supabase, {
        at: now.toISOString(),
        decision: decision.reason,
        skipped_reason: decision.reason,
      });
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: decision.reason,
        kst,
        schedule,
      });
    }

    const summary = await syncParcelsInboundBatch(supabase, { limit });
    await saveInboundSyncLastRun(supabase, {
      at: now.toISOString(),
      decision: decision.reason,
      summary,
    });

    return NextResponse.json({
      ok: true,
      ran: true,
      reason: decision.reason,
      kst,
      schedule,
      ...summary,
    });
  } catch (e) {
    console.error("[cron/sync-inbound]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "sync failed" },
      { status: 500 },
    );
  }
}
