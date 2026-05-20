import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function makeSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );
}

export async function POST(req: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    parcel_id,
    request_stage,
    reason,
    reason_note,
    seller_name,
    seller_address,
    seller_phone,
    prepaid_label_url,
  } = body;

  if (!parcel_id || !request_stage || !reason || !seller_name || !seller_address) {
    return NextResponse.json({ error: "필수 항목이 누락되었습니다" }, { status: 400 });
  }

  // 물품 소유권 확인
  const { data: parcel } = await supabase
    .from("parcels")
    .select("id, status")
    .eq("id", parcel_id)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (!parcel) return NextResponse.json({ error: "물품을 찾을 수 없습니다" }, { status: 404 });

  // 중복 신청 확인
  const { data: existing } = await supabase
    .from("return_requests")
    .select("id")
    .eq("parcel_id", parcel_id)
    .not("status", "eq", "CANCELLED")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "이미 반품 신청이 접수된 물품입니다" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("return_requests")
    .insert({
      parcel_id,
      customer_id: user.id,
      request_stage,
      reason,
      reason_note: reason_note || null,
      seller_name,
      seller_address,
      seller_phone: seller_phone || null,
      prepaid_label_url: prepaid_label_url || null,
      status: "REQUESTED",
    })
    .select()
    .single();

  if (error) {
    console.error("return_requests insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 알림 생성
  await supabase.from("notifications").insert({
    customer_id: user.id,
    type: "RETURN_REQUESTED",
    title: "반품 신청이 접수되었습니다",
    body: `${REASON_LABEL[reason] ?? reason} 사유로 반품 신청이 접수되었어요.`,
    data: { return_request_id: data.id, parcel_id },
  });

  return NextResponse.json({ data }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const supabase = makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("return_requests")
    .select("*, parcels(tracking_no, sender_name)")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

const REASON_LABEL: Record<string, string> = {
  SIZE_MISMATCH: "사이즈 불일치",
  DEFECT:        "불량/파손",
  WRONG_ITEM:    "오배송",
  CHANGE_MIND:   "단순 변심",
  OTHER:         "기타",
};
