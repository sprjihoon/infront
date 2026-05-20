import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** 로그인된 관리자 유저 확인용 서버 클라이언트 */
export async function makeUserClient() {
  const cookieStore = await cookies();
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

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase());

export async function requireAdmin() {
  const supabase = await makeUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? "")) {
    return null;
  }
  return user;
}
