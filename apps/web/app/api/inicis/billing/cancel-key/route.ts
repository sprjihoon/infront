import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  buildBillKeyCancelSignData,
  CANCEL_BILL_KEY_URL,
  getBillingCredentials,
  isIniapiSuccess,
  parseIniapiResponse,
} from "@/lib/inicis/billing";

/* ────────────────────────────────────────────────────────────────
   KG이니시스 빌링키 해지
   POST /api/inicis/billing/cancel-key
   Body: { recurring_id?: string, storage_id?: string, msg?: string }
   Auth: 로그인 사용자(본인 프로파일) 또는 CRON_SECRET
──────────────────────────────────────────────────────────────── */

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET?.trim();
    const isCron = Boolean(
      cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`,
    );

    let userId: string | null = null;
    if (!isCron) {
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
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = user.id;
    }

    const body = await request.json() as {
      recurring_id?: string;
      storage_id?:   string;
      msg?:          string;
    };

    const db = adminDb();

    let profileQuery = db
      .from("storage_recurring_profiles")
      .select("id, user_id, pg_bill_key, status")
      .in("status", ["ACTIVE", "PAUSED"]);

    if (body.recurring_id) {
      profileQuery = profileQuery.eq("id", body.recurring_id);
    } else if (body.storage_id) {
      profileQuery = profileQuery.eq("storage_id", body.storage_id);
    } else {
      return NextResponse.json({ error: "recurring_id 또는 storage_id 필수" }, { status: 400 });
    }

    if (userId) {
      profileQuery = profileQuery.eq("user_id", userId);
    }

    const { data: profile, error: pErr } = await profileQuery.single();
    if (pErr || !profile) {
      return NextResponse.json({ error: "자동결제 프로파일을 찾을 수 없습니다." }, { status: 404 });
    }

    const billKey = profile.pg_bill_key as string;
    if (!billKey || billKey.startsWith("PENDING:")) {
      await db.from("storage_recurring_profiles")
        .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
        .eq("id", profile.id);
      return NextResponse.json({ ok: true, msg: "빌링키 없음, 프로파일 해지 처리" });
    }

    const creds = getBillingCredentials();
    if (!creds?.iniapiKey || !creds.iniapiIv) {
      return NextResponse.json({ error: "결제 설정 오류" }, { status: 500 });
    }

    const msg       = body.msg ?? "자동결제 해지";
    const type      = "BillKeyCancel";
    const timestamp = Date.now().toString();
    const signData  = buildBillKeyCancelSignData(
      creds.mid, billKey, msg, timestamp, creds.iniapiKey, creds.iniapiIv,
    );

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
      const resultMsg = result.resultMsg ?? "알 수 없는 오류";
      console.error("[billing/cancel-key] failed:", result.resultCode, resultMsg);
      return NextResponse.json({ error: resultMsg, code: result.resultCode }, { status: 400 });
    }

    await db.from("storage_recurring_profiles")
      .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("id", profile.id);

    console.log("[billing/cancel-key] success:", billKey);
    return NextResponse.json({ ok: true, resultCode: result.resultCode, resultMsg: result.resultMsg });

  } catch (e) {
    console.error("[billing/cancel-key] error:", e);
    return NextResponse.json({ error: "빌링키 해지 오류" }, { status: 500 });
  }
}
