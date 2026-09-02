import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  buildBillKeyCancelSignData,
  CANCEL_BILL_KEY_URL,
  getBillingCredentials,
  isIniapiSuccess,
  parseIniapiResponse,
} from "@/lib/inicis/billing";
import { cancelPaypalSubscription } from "@/lib/paypal/client";

/* ────────────────────────────────────────────────────────────────
   샵 구독 빌링키 해지
   POST /api/shop/billing/cancel
   Body: { sub_id: string }
──────────────────────────────────────────────────────────────── */

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) =>
          list.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { sub_id } = await request.json() as { sub_id: string };
  if (!sub_id) {
    return NextResponse.json({ error: "sub_id 필수" }, { status: 400 });
  }

  const db = adminDb();
  const { data: sub, error: subErr } = await db
    .from("shop_subscriptions")
    .select("id, pg_bill_key, status, pg_provider, paypal_subscription_id")
    .eq("id", sub_id)
    .eq("user_id", user.id)
    .in("status", ["ACTIVE", "PENDING"])
    .single();

  if (subErr || !sub) {
    return NextResponse.json({ error: "구독 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  if (sub.pg_provider === "paypal") {
    if (sub.paypal_subscription_id) {
      try {
        await cancelPaypalSubscription(sub.paypal_subscription_id, "샵 구독 해지");
      } catch (e) {
        console.error("[shop/billing/cancel] paypal:", e);
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "PayPal 구독 해지 실패" },
          { status: 400 },
        );
      }
    }
    await db.from("shop_subscriptions").update({
      status: "CANCELLED",
      updated_at: new Date().toISOString(),
    }).eq("id", sub_id);
    return NextResponse.json({ ok: true, provider: "paypal" });
  }

  const billKey = sub.pg_bill_key as string | null;

  if (billKey) {
    const creds = getBillingCredentials();
    if (!creds?.iniapiKey || !creds.iniapiIv) {
      return NextResponse.json({ error: "결제 설정 오류" }, { status: 500 });
    }

    const msg = "샵 구독 해지";
    const type = "BillKeyCancel";
    const timestamp = Date.now().toString();
    let signData: string;
    try {
      signData = buildBillKeyCancelSignData(
        creds.mid, billKey, msg, timestamp, creds.iniapiKey, creds.iniapiIv,
      );
    } catch (e) {
      console.error("[shop/billing/cancel] signData error:", e);
      return NextResponse.json({ error: "서명 생성 실패" }, { status: 500 });
    }

    const params = new URLSearchParams({
      type, mid: creds.mid, tid: billKey, msg, timestamp, signData,
    });

    const res = await fetch(CANCEL_BILL_KEY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
      body: params.toString(),
    });
    const result = parseIniapiResponse(await res.text());

    if (!isIniapiSuccess(result)) {
      const resultMsg = result.resultMsg ?? result.P_RMESG1 ?? "해지 실패";
      console.error("[shop/billing/cancel] failed:", result.resultCode, resultMsg);
      return NextResponse.json({ error: resultMsg, code: result.resultCode }, { status: 400 });
    }
  }

  await db.from("shop_subscriptions").update({
    status:     "CANCELLED",
    updated_at: new Date().toISOString(),
  }).eq("id", sub_id);

  return NextResponse.json({ ok: true });
}
