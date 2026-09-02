import { NextRequest, NextResponse } from "next/server";
import { getEmsUsdKrwRate, getEmsUsdKrwRateNumber } from "@/lib/ems/exchange-rate-store";
import { krwToUsd } from "@/lib/paypal/fx";
import { paypalAdminDb } from "@/lib/paypal/mark-paid";

/** GET /api/paypal/quote?amount=9900 — 외국인 checkout USD 미리보기 */
export async function GET(request: NextRequest) {
  const amount = Number(request.nextUrl.searchParams.get("amount") ?? "0");
  if (!(amount > 0)) {
    return NextResponse.json({ error: "amount 필수" }, { status: 400 });
  }
  const db = paypalAdminDb();
  const info = await getEmsUsdKrwRate(db ?? undefined);
  const fxRate = getEmsUsdKrwRateNumber(info);
  return NextResponse.json({
    amountKrw: amount,
    amountUsd: krwToUsd(amount, fxRate),
    fxRate,
    currency: "USD",
  });
}
