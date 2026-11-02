import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const SIZES = new Set(["MINI", "STANDARD", "LONG", "XL", "OVERSIZE"]);

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
    size_code?: string;
    qty?: number;
    address?: string;
    address_detail?: string;
    zipcode?: string;
    phone?: string;
  };

  const purpose = body.purpose === "storage" ? "storage" : "shipping";
  const size = (body.size_code ?? "").toUpperCase();
  const qty = Math.min(20, Math.max(1, Math.floor(body.qty ?? 1)));
  if (!SIZES.has(size)) return NextResponse.json({ error: "박스 크기를 선택해 주세요." }, { status: 400 });
  if (!body.address || body.address.trim().length < 2) {
    return NextResponse.json({ error: "받을 주소를 입력해 주세요." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("box_requests")
    .insert({
      user_id: user.id,
      purpose,
      size_code: size,
      qty,
      address: body.address.trim(),
      address_detail: body.address_detail?.trim() || null,
      zipcode: body.zipcode?.trim() || null,
      phone: body.phone?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "신청에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
