import { NextRequest, NextResponse } from "next/server";

/**
 * Eximbay server-to-server payment notification (status_url).
 * Called by Eximbay after every payment attempt.
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let body: Record<string, string> = {};

    if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const text = await request.text();
      text.split("&").forEach((pair) => {
        const [k, v] = pair.split("=");
        if (k) body[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
      });
    }

    console.log("[Eximbay notify]", JSON.stringify(body));

    const resCd = body["res_cd"] ?? body["payment"]?.toString();
    if (resCd === "0000") {
      // TODO: 실결제 승인 후 주문 상태 업데이트 로직 추가
    }

    return new NextResponse("OK", { status: 200 });
  } catch (e) {
    console.error("[Eximbay notify error]", e);
    return new NextResponse("Error", { status: 500 });
  }
}
