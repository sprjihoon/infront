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
      "id, tracking_no, status, inbound_at, pre_invoice_items, customer_storage_id, is_shippable"
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

  // pre_invoice_items 를 펼쳐서 개별 제품 행으로 변환
  const items = (parcels ?? []).flatMap((parcel) => {
    const declared: PreInvoiceItem[] = Array.isArray(parcel.pre_invoice_items)
      ? parcel.pre_invoice_items
      : [];

    if (declared.length === 0) {
      // 신고 내역 없는 경우 parcel 자체를 한 행으로
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
    }));
  });

  return NextResponse.json({ items });
}
