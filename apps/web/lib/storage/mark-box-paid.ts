import type { SupabaseClient } from "@supabase/supabase-js";

export async function withBoxRequestMemo(
  supabase: SupabaseClient,
  userId: string,
  boxRequestId: string | undefined,
  amount: number,
  goodname: string,
  memo: string | null,
): Promise<{ goodname: string; billing_memo: string | null } | { error: string; status: number }> {
  if (!boxRequestId) return { goodname, billing_memo: memo };

  const { data } = await supabase
    .from("box_requests")
    .select("id, purpose, status, amount")
    .eq("id", boxRequestId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!data || data.status !== "PENDING_PAYMENT") {
    return { error: "결제할 박스 신청을 찾을 수 없습니다.", status: 400 };
  }
  if (data.amount != null && Number(data.amount) !== amount) {
    return { error: "박스 금액이 바뀌었습니다. 다시 신청해 주세요.", status: 400 };
  }

  return {
    goodname: "인프론트 빈 박스",
    billing_memo: `box_request:${data.id}|purpose:${data.purpose}|${memo ?? ""}`,
  };
}

export function boxRequestFromMemo(memo: string | null | undefined): { id: string; purpose: string | null } | null {
  if (!memo) return null;
  const id = memo.match(/box_request:([0-9a-f-]{36})/i)?.[1];
  if (!id) return null;
  const purpose = memo.match(/purpose:(storage|shipping)/)?.[1] ?? null;
  return { id, purpose };
}

export async function markBoxRequestPaid(
  db: SupabaseClient,
  memo: string | null | undefined,
  oid: string,
): Promise<void> {
  const box = boxRequestFromMemo(memo);
  if (!box) return;
  await db
    .from("box_requests")
    .update({ status: "REQUESTED", pg_oid: oid })
    .eq("id", box.id)
    .eq("status", "PENDING_PAYMENT");
}
