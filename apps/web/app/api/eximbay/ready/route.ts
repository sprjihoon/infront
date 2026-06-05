import { NextRequest, NextResponse } from "next/server";

const TEST_API_KEY = "test_1849705C642C217E0B2D";
const TEST_MID = "1849705C64";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { order_id, amount, buyer_name, buyer_email } = body as {
      order_id: string;
      amount: number;
      buyer_name: string;
      buyer_email: string;
    };

    if (!order_id || !amount || !buyer_name || !buyer_email) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    const apiKey = process.env.EXIMBAY_API_KEY ?? TEST_API_KEY;
    const mid = process.env.EXIMBAY_MID ?? TEST_MID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://infront.kr";
    const isTest = apiKey.startsWith("test_");
    const apiBase = isTest
      ? "https://api-test.eximbay.com"
      : "https://api.eximbay.com";

    const authHeader = `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;

    const payload = {
      payment: {
        transaction_type: "PAYMENT",
        order_id,
        currency: "KRW",
        amount: String(amount),
        lang: "KO",
      },
      merchant: { mid },
      buyer: { name: buyer_name, email: buyer_email },
      url: {
        return_url: `${appUrl}/shop/payment/success`,
        status_url: `${appUrl}/api/eximbay/notify`,
      },
    };

    const res = await fetch(`${apiBase}/v1/payments/ready`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok || data.code !== "0000") {
      console.error("Eximbay ready error:", data);
      return NextResponse.json(
        { error: data.msg ?? "Eximbay API 오류" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      fgkey: data.fgkey,
      sdk_url: `${apiBase}/v2/javascriptSDK.js`,
      payload,
    });
  } catch (e) {
    console.error("Eximbay ready route error:", e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
