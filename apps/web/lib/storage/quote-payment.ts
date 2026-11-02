import type { SupabaseClient } from "@supabase/supabase-js";
import { pricePendingBox } from "@/lib/storage/empty-boxes";

export type StoragePayType =
  | "PICKUP_FEE"
  | "LISTING_FEE"
  | "PHOTO_INSPECTION_FEE"
  | "SHORT_TERM_STORAGE"
  | "LONG_TERM_FIRST"
  | "UPGRADE_FEE"
  | "RELEASE_FEE"
  | "SHIPPING_FEE"
  | "OPEN_CHECK_FEE"
  | "PENALTY_FEE";

export type StoragePayInput = {
  storage_id: string;
  payment_type: StoragePayType;
  pickup_boxes?: Array<{ size_code: string; qty: number }>;
  billing_weeks?: number;
  billing_plan_type?: string;
  item_count?: number;
  amount?: number;
  long_term_plan_type?: string;
  box_request_id?: string;
};

export type StorageQuote = {
  amount: number;
  goodname: string;
  billing_memo: string | null;
  billing_weeks: number | null;
  billing_plan_type: string | null;
  item_count: number | null;
  monthly_amount: number | null;
};

export async function quoteStoragePayment(
  supabase: SupabaseClient,
  userId: string,
  body: StoragePayInput,
): Promise<{ ok: true; data: StorageQuote } | { ok: false; error: string; status: number }> {
  const { storage_id, payment_type } = body;

  const { data: storage, error: sErr } = await supabase
    .from("customer_storages")
    .select("id, user_id, max_plan_type")
    .eq("id", storage_id)
    .eq("user_id", userId)
    .single();

  if (sErr || !storage) {
    return { ok: false, error: "스토리지를 찾을 수 없습니다.", status: 404 };
  }

  let amount = 0;
  let goodname = "";
  let billing_memo: string | null = null;
  let billing_weeks: number | null = null;
  let billing_plan_type: string | null = null;
  let item_count: number | null = null;
  let monthly_amount: number | null = null;

  if (payment_type === "PICKUP_FEE" && body.box_request_id) {
    const priced = await pricePendingBox(supabase, userId, body.box_request_id);
    if ("error" in priced) return { ok: false, error: priced.error, status: priced.status };
    amount = priced.amount;
    goodname = priced.goodname;
    billing_memo = priced.billing_memo;
  } else if (payment_type === "PICKUP_FEE") {
    const { data: feeRows, error: feeErr } = await supabase
      .from("pickup_box_fees")
      .select("size_code, label_ko, pickup_fee")
      .eq("is_active", true);
    if (feeErr || !feeRows?.length) {
      return { ok: false, error: "박스 요금 정보를 불러올 수 없습니다.", status: 500 };
    }
    const feeMap = Object.fromEntries(feeRows.map((r) => [r.size_code, r]));
    const boxes = body.pickup_boxes?.length ? body.pickup_boxes : [{ size_code: "DEFAULT", qty: 1 }];
    const boxLines: string[] = [];
    for (const b of boxes) {
      const spec = feeMap[b.size_code];
      if (!spec) return { ok: false, error: `잘못된 박스 규격: ${b.size_code}`, status: 400 };
      const qty = Math.max(1, Math.floor(b.qty ?? 1));
      amount += spec.pickup_fee * qty;
      boxLines.push(`${spec.label_ko} ${qty}개 × ${spec.pickup_fee.toLocaleString()}원`);
    }
    goodname = "인프론트 보관 서비스 수거비";
    billing_memo = boxLines.join(" / ");
  } else if (payment_type === "LISTING_FEE") {
    const cnt = Math.max(1, Math.floor(body.item_count ?? 1));
    amount = cnt * 500;
    item_count = cnt;
    goodname = "인프론트 리스트 확인비";
    billing_memo = `물품 ${cnt}개 × 500원`;
  } else if (payment_type === "PHOTO_INSPECTION_FEE") {
    const cnt = Math.max(1, Math.floor(body.item_count ?? 1));
    amount = cnt * 1_000;
    item_count = cnt;
    goodname = "인프론트 사진·검품 등록비";
    billing_memo = `물품 ${cnt}개 × 1,000원`;
  } else if (payment_type === "RELEASE_FEE") {
    amount = 1_000;
    goodname = "인프론트 보관 서비스 출고 처리비";
    billing_memo = "출고 처리비 1,000원";
  } else if (payment_type === "UPGRADE_FEE") {
    amount = body.amount ?? 0;
    if (amount <= 0) return { ok: false, error: "업그레이드 차액을 입력해 주세요.", status: 400 };
    goodname = "인프론트 플랜 업그레이드";
    billing_memo = `업그레이드 차액 ${amount.toLocaleString()}원`;
  } else if (payment_type === "SHIPPING_FEE") {
    amount = body.amount ?? 0;
    if (amount <= 0) return { ok: false, error: "배송비를 입력해 주세요.", status: 400 };
    goodname = "인프론트 배송비";
    billing_memo = `배송비 ${amount.toLocaleString()}원`;
  } else if (payment_type === "OPEN_CHECK_FEE") {
    amount = body.amount ?? 5_000;
    goodname = "인프론트 해외배송 개봉 확인비";
    billing_memo = `개봉 확인비 ${amount.toLocaleString()}원`;
  } else if (payment_type === "PENALTY_FEE") {
    amount = body.amount ?? 0;
    if (amount <= 0) return { ok: false, error: "페널티 금액을 입력해 주세요.", status: 400 };
    goodname = "인프론트 페널티";
    billing_memo = `페널티 ${amount.toLocaleString()}원`;
  } else if (payment_type === "LONG_TERM_FIRST") {
    const planType = body.long_term_plan_type;
    if (!planType) return { ok: false, error: "long_term_plan_type 필수", status: 400 };
    const { data: planData } = await supabase
      .from("storage_plan_config")
      .select("monthly_rate, label_ko")
      .eq("plan_type", planType)
      .single();
    if (!planData?.monthly_rate) return { ok: false, error: "플랜 요금 정보 없음", status: 400 };
    const { data: feeRows } = await supabase
      .from("pickup_box_fees")
      .select("size_code, label_ko, pickup_fee")
      .eq("is_active", true);
    const feeMap = Object.fromEntries((feeRows ?? []).map((r) => [r.size_code, r]));
    const boxes = body.pickup_boxes?.length ? body.pickup_boxes : [{ size_code: "DEFAULT", qty: 1 }];
    let pickupAmount = 0;
    const pickupLines: string[] = [];
    for (const b of boxes) {
      const spec = feeMap[b.size_code];
      if (!spec) return { ok: false, error: `잘못된 박스 규격: ${b.size_code}`, status: 400 };
      const qty = Math.max(1, Math.floor(b.qty ?? 1));
      pickupAmount += spec.pickup_fee * qty;
      pickupLines.push(`${spec.label_ko} ${qty}개 × ${spec.pickup_fee.toLocaleString()}원`);
    }
    monthly_amount = Number(planData.monthly_rate);
    amount = pickupAmount + monthly_amount;
    billing_plan_type = planType;
    goodname = `인프론트 장기보관 시작 (${planType}플랜)`;
    billing_memo = `수거비(${pickupLines.join("/")})+첫달이용료(${planData.label_ko} ${monthly_amount.toLocaleString()}원)`;
  } else if (payment_type === "SHORT_TERM_STORAGE") {
    billing_weeks = body.billing_weeks ?? null;
    billing_plan_type = body.billing_plan_type ?? (storage.max_plan_type as string | null);
    if (!billing_weeks || billing_weeks <= 0) {
      return { ok: false, error: "보관 기간(주)이 올바르지 않습니다.", status: 400 };
    }
    if (!billing_plan_type) {
      return { ok: false, error: "과금 플랜을 확인할 수 없습니다.", status: 400 };
    }
    const { data: planData } = await supabase
      .from("storage_plan_config")
      .select("weekly_rate, label_ko")
      .eq("plan_type", billing_plan_type)
      .single();
    if (!planData?.weekly_rate) {
      return { ok: false, error: "플랜 요금 정보를 찾을 수 없습니다.", status: 400 };
    }
    amount = billing_weeks * planData.weekly_rate;
    goodname = `인프론트 단기보관 정산 (${billing_plan_type}플랜 ${billing_weeks}주)`;
    billing_memo = `${billing_weeks}주 × ${planData.label_ko} ${planData.weekly_rate.toLocaleString()}원`;
  } else {
    return { ok: false, error: "지원하지 않는 결제 유형입니다.", status: 400 };
  }

  if (amount <= 0) {
    return { ok: false, error: "결제 금액이 0원입니다.", status: 400 };
  }

  return {
    ok: true,
    data: {
      amount,
      goodname,
      billing_memo,
      billing_weeks,
      billing_plan_type,
      item_count,
      monthly_amount,
    },
  };
}
