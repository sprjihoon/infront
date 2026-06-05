import { NextRequest, NextResponse } from "next/server";

const PRODUCT_PRICES: Record<string, number> = {
  BOX_S: 5000,
  BOX_M: 8000,
  BOX_L: 12000,
  BOX_XL: 18000,
};

export async function POST(req: NextRequest) {
  try {
    const { paymentKey, orderId, amount, productId } = await req.json();

    if (!paymentKey || !orderId || !amount || !productId) {
      return NextResponse.json({ error: "필수 파라미터가 누락되었습니다." }, { status: 400 });
    }

    // 서버에서 금액 재검증 (위변조 방지)
    const expectedAmount = PRODUCT_PRICES[productId];
    if (!expectedAmount) {
      return NextResponse.json({ error: "유효하지 않은 상품입니다." }, { status: 400 });
    }
    if (expectedAmount !== Number(amount)) {
      return NextResponse.json({ error: "결제 금액이 일치하지 않습니다." }, { status: 400 });
    }

    const secretKey = process.env.TOSS_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: "결제 설정이 없습니다." }, { status: 500 });
    }

    // 토스 결제 승인 API 호출
    const encoded = Buffer.from(`${secretKey}:`).toString("base64");
    const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${encoded}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    const tossData = await tossRes.json();

    if (!tossRes.ok) {
      console.error("[SHOP] Toss confirm error:", tossData);
      return NextResponse.json(
        { error: tossData.message ?? "결제 승인에 실패했습니다." },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[SHOP] confirm error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
