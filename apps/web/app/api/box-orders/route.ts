import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const BOX_CATALOG = {
  BOX_S: { name: "소형 박스 (20×15×10 cm)", price: 3000 },
  BOX_M: { name: "중형 박스 (30×25×20 cm)", price: 4000 },
  BOX_L: { name: "대형 박스 (40×35×30 cm)", price: 5000 },
};

async function makeSupabase() {
  const cookieStore = await cookies();
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
  const supabase = await makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { box_code, quantity, delivery_name, delivery_phone, delivery_zipcode, delivery_address, delivery_address_detail } = body;

  if (!box_code || !quantity || !delivery_name || !delivery_phone || !delivery_zipcode || !delivery_address) {
    return NextResponse.json({ error: "필수 항목이 누락되었습니다" }, { status: 400 });
  }

  const catalog = BOX_CATALOG[box_code as keyof typeof BOX_CATALOG];
  if (!catalog) return NextResponse.json({ error: "올바르지 않은 박스 코드입니다" }, { status: 400 });

  const unit_price = catalog.price;
  const total_amount = unit_price * quantity;

  // order_no 생성
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const { count } = await supabase.from("box_orders").select("*", { count: "exact", head: true });
  const seq = String((count ?? 0) + 1).padStart(4, "0");
  const order_no = `BOX-${today}-${seq}`;

  const { data, error } = await supabase
    .from("box_orders")
    .insert({
      customer_id: user.id,
      order_no,
      box_code,
      quantity,
      unit_price,
      total_amount,
      delivery_name,
      delivery_phone,
      delivery_zipcode,
      delivery_address,
      delivery_address_detail: delivery_address_detail || null,
      status: "PENDING_PAYMENT",
      payment_status: "UNPAID",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("notifications").insert({
    customer_id: user.id,
    type: "BOX_ORDER_CREATED",
    title: "빈 박스 주문이 접수되었습니다",
    body: `${catalog.name} ${quantity}개 주문이 접수되었어요.`,
    data: { box_order_id: data.id },
  });

  return NextResponse.json({ data }, { status: 201 });
}

export async function GET() {
  const supabase = await makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("box_orders")
    .select("*")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
