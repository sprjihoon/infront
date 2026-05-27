import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  getEmsUsdKrwRate,
  getEmsUsdKrwRateNumber,
} from "@/lib/ems/exchange-rate-store";
import { formatExchangeRateDate } from "@/lib/ems/exchange-rate";

export const preferredRegion = "icn1";

function createAdminSupabase() {
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!srk) return null;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    srk,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

/** GET /api/ems/exchange-rate — EMS 보험 USD→KRW 적용 환율 */
export async function GET() {
  try {
    const db = createAdminSupabase();
    const info = await getEmsUsdKrwRate(db ?? undefined);

    return NextResponse.json({
      rate: getEmsUsdKrwRateNumber(info),
      source: info.source,
      label: info.label,
      as_of_date: info.as_of_date,
      as_of_date_display: formatExchangeRateDate(info.as_of_date),
      updated_at: info.updated_at,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
