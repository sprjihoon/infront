import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getCachedStorageTypes } from "@/lib/storage/cached-types";

function createSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
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
}

/**
 * GET /api/storage/dashboard
 * 스토리지 페이지에 필요한 모든 데이터를 한 번의 인증으로 반환.
 * 기존 4개 API(/storage, /all-items, /my-locations, /types)를 통합.
 */
export async function GET() {
  const cookieStore = await cookies();
  const supabase = createSupabase(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 인증 1회 후 3개 DB 쿼리 + 1개 캐시 병렬 실행
  const [storagesResult, parcelsResult, locationsResult, types] =
    await Promise.all([
      // 1) 내 스토리지 목록
      supabase
        .from("customer_storages")
        .select(`
          id, storage_name, storage_mode, plan_type, current_plan_type, max_plan_type,
          monthly_amount, capacity_score, used_score, usage_percent,
          status, short_term_started_at, paid_until_date, next_billing_date,
          created_at, updated_at, card_color, storage_type_id,
          storage_plan_config!customer_storages_plan_type_fkey (label_ko, label_en, weekly_rate),
          storage_types!customer_storages_storage_type_id_fkey (code, name, volume_liter)
        `)
        .eq("user_id", user.id)
        .neq("status", "CANCELLED")
        .order("created_at", { ascending: false }),

      // 2) 보관 물품 (parcels + pre_invoice_items 펼치기)
      supabase
        .from("parcels")
        .select(
          `id, tracking_no, status, inbound_at, pre_invoice_items, customer_storage_id, is_shippable,
           parcel_media(storage_url, cf_thumbnail_url, stage, is_visible)`
        )
        .eq("customer_id", user.id)
        .not("status", "in", '("SHIPPED","RETURNED","PICKUP_CANCELLED","DISPOSED")')
        .order("inbound_at", { ascending: false }),

      // 3) 배정된 로케이션
      supabase
        .from("storage_locations")
        .select(`
          id, code, zone, slot, status,
          storage_types (
            id, code, name,
            price_per_week, price_max, price_per_month,
            max_parcels,
            dim_l_mm, dim_w_mm, dim_h_mm, volume_liter
          )
        `)
        .eq("customer_id", user.id)
        .not("status", "eq", "DISABLED")
        .order("code"),

      // 4) 스토리지 타입 (1시간 캐시)
      getCachedStorageTypes(),
    ]);

  if (storagesResult.error) {
    console.error("[dashboard] storages:", storagesResult.error);
    return NextResponse.json({ error: storagesResult.error.message }, { status: 500 });
  }
  if (parcelsResult.error) {
    console.error("[dashboard] parcels:", parcelsResult.error);
    return NextResponse.json({ error: parcelsResult.error.message }, { status: 500 });
  }

  // parcels → ProductItem[] 변환 (all-items 로직과 동일)
  type PreInvoiceItem = {
    name?: string;
    product_name?: string;
    quantity?: number;
    name_en?: string;
  };
  type MediaRow = {
    storage_url: string | null;
    cf_thumbnail_url: string | null;
    stage: string;
    is_visible: boolean;
  };

  function pickPhoto(media: MediaRow[] | null): string | null {
    if (!Array.isArray(media)) return null;
    const visible = media.filter((m) => m.is_visible);
    const photo = visible.find((m) => m.stage === "INSPECTION_PHOTO" && m.storage_url);
    if (photo) return photo.storage_url;
    const video = visible.find((m) => m.cf_thumbnail_url);
    return video?.cf_thumbnail_url ?? null;
  }

  const items = (parcelsResult.data ?? []).flatMap((parcel) => {
    const declared: PreInvoiceItem[] = Array.isArray(parcel.pre_invoice_items)
      ? parcel.pre_invoice_items
      : [];
    const photoUrl = pickPhoto(
      (parcel as { parcel_media?: MediaRow[] }).parcel_media ?? null
    );

    if (declared.length === 0) {
      return [
        {
          id: parcel.id,
          parcel_id: parcel.id,
          tracking_no: parcel.tracking_no,
          storage_id: parcel.customer_storage_id,
          name: parcel.tracking_no ?? "운송장 미확인",
          quantity: 1,
          parcel_status: parcel.status,
          is_shippable: parcel.is_shippable ?? false,
          inbound_at: parcel.inbound_at,
          photo_url: photoUrl,
        },
      ];
    }

    return declared.map((it, idx) => ({
      id: `${parcel.id}-${idx}`,
      parcel_id: parcel.id,
      tracking_no: parcel.tracking_no,
      storage_id: parcel.customer_storage_id,
      name: it.product_name ?? it.name ?? it.name_en ?? "알 수 없는 물품",
      quantity: it.quantity ?? 1,
      parcel_status: parcel.status,
      is_shippable: parcel.is_shippable ?? false,
      inbound_at: parcel.inbound_at,
      photo_url: photoUrl,
    }));
  });

  // 로케이션 요약 (my-locations 로직과 동일)
  type LocationRow = {
    id: string;
    code: string;
    status: string;
    storage_types: {
      id: string; code: string; name: string;
      price_per_week: number; max_parcels: number | null;
    } | null;
  };
  const locRows = (locationsResult.data ?? []) as unknown as LocationRow[];
  const totalWeeklyFee = locRows.reduce(
    (sum, loc) => sum + (loc.storage_types?.price_per_week ?? 0),
    0
  );
  const typeCount: Record<
    string,
    { code: string; name: string; count: number; price_per_week: number }
  > = {};
  locRows.forEach((loc) => {
    const t = loc.storage_types;
    if (!t) return;
    if (!typeCount[t.code])
      typeCount[t.code] = { code: t.code, name: t.name, count: 0, price_per_week: t.price_per_week };
    typeCount[t.code].count++;
  });
  const dominantType =
    Object.values(typeCount).sort((a, b) => b.count - a.count)[0] ?? null;

  return NextResponse.json({
    storages: storagesResult.data ?? [],
    items,
    locationSummary: {
      slot_count: locRows.length,
      total_weekly_fee: totalWeeklyFee,
      dominant_type: dominantType,
    },
    types,
  });
}
