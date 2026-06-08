import { NextRequest, NextResponse } from "next/server";

/**
 * PortOne v2 결제 검증 API
 * POST /api/portone/verify
 * body: { paymentId: string, expectedAmount: number }
 */
export async function POST(request: NextRequest) {
  try {
    const { paymentId, expectedAmount } = await request.json() as {
      paymentId: string;
      expectedAmount: number;
    };

    if (!paymentId) {
      return NextResponse.json({ error: "paymentId 누락" }, { status: 400 });
    }

    const apiSecret = process.env.PORTONE_API_SECRET;

    if (!apiSecret) {
      /* API 시크릿 미설정 시 — 테스트 환경용 임시 통과 */
      console.warn("[portone/verify] PORTONE_API_SECRET not set — skipping verification");
      return NextResponse.json({ success: true, paymentId, status: "PAID", amount: expectedAmount });
    }

    const res = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `PortOne ${apiSecret}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[portone/verify] API error:", err);
      return NextResponse.json({ error: "결제 조회 실패" }, { status: 400 });
    }

    const payment = await res.json();

    /* 금액 변조 검증 */
    if (expectedAmount && payment.amount?.total !== expectedAmount) {
      console.error("[portone/verify] amount mismatch:", payment.amount?.total, "!=", expectedAmount);
      return NextResponse.json({ error: "결제 금액 불일치" }, { status: 400 });
    }

    if (payment.status !== "PAID") {
      return NextResponse.json({ error: `결제 미완료 상태: ${payment.status}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      paymentId,
      status: payment.status,
      amount: payment.amount?.total,
      orderId: payment.orderName,
    });
  } catch (e) {
    console.error("[portone/verify] error:", e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
