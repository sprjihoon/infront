import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function createSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
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
}

export async function PATCH(req: Request) {
  const cookieStore = await cookies();
  const supabase = createSupabase(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, string> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    updates.name = body.name.trim();
  }
  if (typeof body.phone === "string") {
    updates.phone = body.phone.trim();
  }
  if (typeof body.avatar_url === "string") {
    updates.avatar_url = body.avatar_url;
  }
  if (body.customer_type === "domestic" || body.customer_type === "foreigner") {
    if (body.customer_type === "foreigner" && !user.email_confirmed_at) {
      return NextResponse.json(
        {
          error:
            "외국인/해외고객으로 변경하려면 이메일 인증을 먼저 완료해 주세요.",
        },
        { status: 403 }
      );
    }
    updates.customer_type = body.customer_type;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { error } = await supabase
    .from("customers")
    .update(updates)
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (updates.customer_type) {
    const { error: metaError } = await supabase.auth.updateUser({
      data: { customer_type: updates.customer_type },
    });
    if (metaError) {
      return NextResponse.json({ error: metaError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, customer_type: updates.customer_type });
}
