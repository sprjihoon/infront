import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ────────────────────────────────────────────────────────────────
   GET /api/cron/storage-billing
   활성 storage_recurring_profiles 중 next_billing_date <= today
   → /api/inicis/billing/pay 내부 호출
──────────────────────────────────────────────────────────────── */

function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function todayYmd(): string {
  return new Date().toISOString().split("T")[0]!;
}

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = adminDb();
  const today = todayYmd();

  const { data: profiles, error } = await db
    .from("storage_recurring_profiles")
    .select("id")
    .eq("status", "ACTIVE")
    .lte("next_billing_date", today)
    .not("pg_bill_key", "like", "PENDING:%")
    .limit(100);

  if (error) {
    console.error("[cron/storage-billing] query error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://infront.kr").trim();
  const cronSecret = process.env.CRON_SECRET!.trim();
  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const profile of profiles ?? []) {
    try {
      const res = await fetch(`${appUrl}/api/inicis/billing/pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({ recurring_id: profile.id }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      results.push({
        id: profile.id,
        ok: res.ok && Boolean(data.ok),
        error: data.error,
      });
    } catch (e) {
      console.error("[cron/storage-billing] error:", profile.id, e);
      results.push({ id: profile.id, ok: false, error: String(e) });
    }
  }

  return NextResponse.json({
    ok: true,
    date: today,
    processed: results.length,
    success: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
