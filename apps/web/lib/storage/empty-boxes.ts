import type { SupabaseClient } from "@supabase/supabase-js";

export type EmptyBoxProduct = {
  size_code: string;
  label_ko: string;
  dims_ko: string;
  price: number;
};

export async function listEmptyBoxes(supabase: SupabaseClient): Promise<EmptyBoxProduct[]> {
  const { data, error } = await supabase
    .from("empty_box_products")
    .select("size_code, label_ko, dims_ko, price, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data.map((row) => ({
    size_code: row.size_code,
    label_ko: row.label_ko,
    dims_ko: row.dims_ko,
    price: Number(row.price),
  }));
}

export async function pricePendingBox(
  supabase: SupabaseClient,
  userId: string,
  boxRequestId: string,
): Promise<
  { amount: number; goodname: string; billing_memo: string }
  | { error: string; status: number }
> {
  const { data } = await supabase
    .from("box_requests")
    .select("id, purpose, status, amount, size_code, qty")
    .eq("id", boxRequestId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!data || data.status !== "PENDING_PAYMENT") {
    return { error: "결제할 박스 신청을 찾을 수 없습니다.", status: 400 };
  }

  const { data: product } = await supabase
    .from("empty_box_products")
    .select("label_ko, price")
    .eq("size_code", data.size_code)
    .eq("is_active", true)
    .maybeSingle();

  if (!product) {
    return { error: "우체국 박스 1호~5호만 구입할 수 있습니다.", status: 400 };
  }

  const qty = Math.min(20, Math.max(1, Number(data.qty) || 1));
  const amount = Number(product.price) * qty;
  if (data.amount != null && Number(data.amount) !== amount) {
    return { error: "박스 금액이 바뀌었습니다. 다시 신청해 주세요.", status: 400 };
  }

  return {
    amount,
    goodname: `인프론트 우체국 박스 ${product.label_ko}`,
    billing_memo: `box_request:${data.id}|purpose:${data.purpose}|우체국 ${product.label_ko} ${qty}개 × ${Number(product.price).toLocaleString()}원`,
  };
}
