import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  formatExchangeRateDate,
  getCustomsWeekStartYmd,
  shouldSkipWeeklyExchangeRateSync,
} from "@/lib/ems/exchange-rate";
import {
  loadStoredExchangeRate,
  syncEmsUsdKrwRate,
} from "@/lib/ems/exchange-rate-store";

export const preferredRegion = "icn1";

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
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * GET /api/cron/sync-usd-krw-rate
 * 관세청 수입 과세환율(주간) → admin_config 저장 (매주 1회, KST 일요일 새벽)
 * ?force=1 — 주간 스킵 무시하고 즉시 갱신
 */
export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = new URL(req.url).searchParams.get("force") === "1";
  const now = new Date();

  try {
    const supabase = createAdminSupabase();
    const stored = await loadStoredExchangeRate(supabase);

    if (shouldSkipWeeklyExchangeRateSync(stored, { force, at: now })) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "already_synced_this_customs_week",
        customs_week_start: getCustomsWeekStartYmd(now),
        rate: stored!.rate,
        source: stored!.source,
        label: stored!.label,
        as_of_date: stored!.as_of_date,
        as_of_date_display: formatExchangeRateDate(stored!.as_of_date),
        updated_at: stored!.updated_at,
      });
    }

    const result = await syncEmsUsdKrwRate(supabase);

    return NextResponse.json({
      ok: true,
      ran: true,
      customs_week_start: getCustomsWeekStartYmd(now),
      rate: result.rate,
      source: result.source,
      label: result.label,
      as_of_date: result.as_of_date,
      as_of_date_display: formatExchangeRateDate(result.as_of_date),
      updated_at: result.updated_at,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cron/sync-usd-krw-rate]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
