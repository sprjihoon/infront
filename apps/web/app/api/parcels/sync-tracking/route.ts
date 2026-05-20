import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  trackParcel,
  COURIER_TO_CARRIER_ID,
} from "@/lib/tracking/client";

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

  return NextResponse.json({ synced, total: parcels.length });
}
