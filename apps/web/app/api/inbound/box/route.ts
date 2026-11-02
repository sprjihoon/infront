import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  inferPickupAddressDetail,
  isValidPickupAddressDetail,
  normalizeEpostAddr1,
  normalizeEpostZip,
  validatePickupAddressDetail,
} from "@/lib/epost/client";
import { listEmptyBoxes } from "@/lib/storage/empty-boxes";

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    },
  );

  const boxes = await listEmptyBoxes(supabase);
  if (!boxes.length) return NextResponse.json({ error: "박스 요금을 불러오지 못했습니다." }, { status: 500 });
  return NextResponse.json({ boxes });
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = await req.json() as {
    purpose?: string;
    storage_id?: string;
    size_code?: string;
    qty?: number;
    name?: string;
    phone?: string;
    zipcode?: string;
    address?: string;
    address_detail?: string;
  };

  const purpose = "shipping";
  const size = (body.size_code ?? "").toUpperCase();
  const qty = Math.min(20, Math.max(1, Math.floor(body.qty ?? 1)));
  const address = normalizeEpostAddr1(body.address);
  const zipcode = normalizeEpostZip(body.zipcode);
  const detail = inferPickupAddressDetail(address, body.address_detail);
  const phone = (body.phone ?? "").replace(/[^0-9\-]/g, "");

  if (zipcode.length !== 5 || address.length < 2) {
    return NextResponse.json({ error: "주소 검색으로 우편번호와 도로명 주소를 입력해 주세요." }, { status: 400 });
  }
  const detailErr = validatePickupAddressDetail(isValidPickupAddressDetail(detail) ? detail : body.address_detail);
  if (detailErr) return NextResponse.json({ error: detailErr }, { status: 400 });
  if (phone.length < 8) return NextResponse.json({ error: "연락처를 입력해 주세요." }, { status: 400 });

  const boxes = await listEmptyBoxes(supabase);
  const fee = boxes.find((box) => box.size_code === size);
  if (!fee) return NextResponse.json({ error: "우체국 박스 1호~5호만 구입할 수 있습니다." }, { status: 400 });

  const amount = fee.price * qty;
  const { data, error } = await supabase
    .from("box_requests")
    .insert({
      user_id: user.id,
      purpose,
      size_code: size,
      qty,
      address,
      address_detail: detail,
      zipcode,
      phone,
      amount,
      status: "PENDING_PAYMENT",
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "신청에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    id: data.id,
    storage_id: null,
    amount,
    size_code: size,
    qty,
    label: fee.label_ko,
    purpose,
  });
}
