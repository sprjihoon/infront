import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** GET /api/storage/all-items
 *  현재 사용자의 모든 스토리지에 속한 parcels 의 pre_invoice_items 를
 *  펼쳐서 반환합니다.
 *  Response: { items: ProductItem[] }
 */
export async function GET() {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 사용자의 모든 parcels (스토리지 연결된 것 포함) 조회
  const { data: parcels, error } = await supabase
    .from("parcels")
    .select(
      `id, tracking_no, status, inbound_at, pre_invoice_items, customer_storage_id, is_shippable,
       parcel_media(storage_url, cf_thumbnail_url, stage, is_visible)`
    )
    .eq("customer_id", user.id)
    .not("status", "in", '("SHIPPED","RETURNED","PICKUP_CANCELLED","DISPOSED")')
    .order("inbound_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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
    // 우선순위: INSPECTION_PHOTO > INBOUND_VIDEO thumbnail
    const photo = visible.find((m) => m.stage === "INSPECTION_PHOTO" && m.storage_url);
    if (photo) return photo.storage_url;
    const video = visible.find((m) => m.cf_thumbnail_url);
    return video?.cf_thumbnail_url ?? null;
  }

  // pre_invoice_items 를 펼쳐서 개별 제품 행으로 변환
  const items = (parcels ?? []).flatMap((parcel) => {
    const declared: PreInvoiceItem[] = Array.isArray(parcel.pre_invoice_items)
      ? parcel.pre_invoice_items
      : [];
    const photoUrl = pickPhoto((parcel as { parcel_media?: MediaRow[] }).parcel_media ?? null);

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

  return NextResponse.json({ items });
}
