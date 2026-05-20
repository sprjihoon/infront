import { createClient } from "@supabase/supabase-js";

/** RLS를 우회하는 서비스 역할 클라이언트 (서버 전용) */
export const adminDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
