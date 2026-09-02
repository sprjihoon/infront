import { NextRequest, NextResponse } from "next/server";
import { getShopAuthUser } from "@/lib/shop/auth";
import { assertForeignPaypalUser } from "@/lib/shop/foreign-pay";
import { capturePaypalOrder, paypalConfigured } from "@/lib/paypal/client";
import { markShopOrderPaid, markStoragePaymentPaid, paypalAdminDb } from "@/lib/paypal/mark-paid";

export async function POST(request: NextRequest) {
  try {
    if (!paypalConfigured()) {
      return NextResponse.json({ error: "PayPal이 아직 설정되지 않았습니다." }, { status: 503 });
    }
    const user = await getShopAuthUser();
    const gate = assertForeignPaypalUser(user);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { paypalOrderId } = await request.json() as { paypalOrderId?: string };
    if (!paypalOrderId) {
      return NextResponse.json({ error: "paypalOrderId 필수" }, { status: 400 });
    }

    const db = paypalAdminDb();
    if (!db) return NextResponse.json({ error: "DB 설정 오류" }, { status: 500 });

    const captured = await capturePaypalOrder(paypalOrderId);
    if (captured.status !== "COMPLETED" && !captured.captureId) {
      return NextResponse.json({ error: `결제 미완료: ${captured.status}` }, { status: 400 });
    }

    const shop = await markShopOrderPaid(db, paypalOrderId, captured.captureId);
    if (shop) {
      return NextResponse.json({
        ok: true,
        kind: "shop",
        oid: shop.oid,
        amountKrw: shop.amount,
        captureId: captured.captureId,
      });
    }

    const storage = await markStoragePaymentPaid(db, paypalOrderId, captured.captureId);
    if (storage) {
      return NextResponse.json({
        ok: true,
        kind: "storage",
        oid: storage.oid,
        amountKrw: storage.amount,
        storageId: storage.storageId,
        captureId: captured.captureId,
      });
    }

    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
  } catch (e) {
    console.error("[paypal/capture]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "서버 오류" },
      { status: 500 },
    );
  }
}
