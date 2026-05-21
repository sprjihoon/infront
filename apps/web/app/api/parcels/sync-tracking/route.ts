import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  trackParcel,
  COURIER_TO_CARRIER_ID,
} from "@/lib/tracking/client";
import { getResInfo } from "@/lib/epost/client";

// 추적 대상 상태 (창고 도착 전 국내 이동 중)
const TRACKABLE_STATUSES = new Set(["PRE_REGISTERED", "PENDING_PICKUP", "PICKED_UP"]);

export async function POST(_req: NextRequest) {
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
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });

  // 추적 가능 물품 조회 (tracking_no 있는 것만)
  const { data: parcels, error } = await supabase
    .from("parcels")
    .select("id, tracking_no, courier, tracking_carrier_id")
    .eq("customer_id", user.id)
    .in("status", Array.from(TRACKABLE_STATUSES))
    .not("tracking_no", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!parcels || parcels.length === 0) return NextResponse.json({ synced: 0 });

  let synced = 0;
  const now = new Date().toISOString();

  await Promise.all(
    parcels.map(async (parcel) => {
      // carrierId 결정: 저장된 값 또는 courier 이름으로 매핑
      const carrierId =
        parcel.tracking_carrier_id ??
        (parcel.courier ? COURIER_TO_CARRIER_ID[parcel.courier] : null);

      if (!carrierId || !parcel.tracking_no) return;

      const result = await trackParcel(carrierId, parcel.tracking_no);
      if (!result) return;

      await supabase
        .from("parcels")
        .update({
          tracking_carrier_id: carrierId,
          tracking_status:     result.statusCode,
          tracking_last_event: result.lastEvent,
          tracking_events:     result.events,
          tracking_synced_at:  now,
        })
        .eq("id", parcel.id);

      synced++;
    })
  );

  // ── PENDING_PICKUP 수거상태 동기화 (우체국 GetResInfo) ──────────────────
  const { data: pendingParcels } = await supabase
    .from("parcels")
    .select("id, epost_order_no, pickup_requested_at, epost_req_no, pickup_tracking_no")
    .eq("customer_id", user.id)
    .eq("status", "PENDING_PICKUP")
    .not("epost_order_no", "is", null);

  let pickupSynced = 0;
  if (pendingParcels && pendingParcels.length > 0) {
    await Promise.all(
      pendingParcels.map(async (p) => {
        if (!p.epost_order_no || !p.pickup_requested_at) return;
        if (p.epost_req_no?.startsWith("MOCK-")) return;

        const reqYmd = new Date(p.pickup_requested_at)
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, "");

        try {
          const result = await getResInfo({
            reqType: "2",
            orderNo: p.epost_order_no,
            reqYmd,
          });

          if (parseInt(result.treatStusCd) >= 1) {
            await supabase
              .from("parcels")
              .update({ status: "PICKED_UP" })
              .eq("id", p.id);

            await supabase.from("notifications").insert({
              customer_id: user.id,
              parcel_id: p.id,
              type: "INBOUND",
              title: "수거 완료",
              body: `운송장 ${p.pickup_tracking_no ?? p.epost_order_no} 물품이 수거되었습니다.`,
            });

            pickupSynced++;
          }
        } catch {
          // 개별 조회 실패는 무시하고 계속
        }
      })
    );
  }

  return NextResponse.json({
    synced,
    total: parcels.length,
    pickup_synced: pickupSynced,
  });
}
