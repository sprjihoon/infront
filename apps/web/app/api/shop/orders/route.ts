import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getShopAuthUser } from "@/lib/shop/auth";

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  const user = await getShopAuthUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  const { data: orders, error } = await admin
    .from("shop_orders")
    .select(
      "oid, product_id, amount, status, customer_type, shipping_type, ems_regino, tracking_available, paid_at, created_at, payment_method, is_foreign_card"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ orders: orders ?? [] });
}
