import type { SupabaseClient } from "@supabase/supabase-js";

/** 임시보관 로케이션 (TEMP-001) ID 조회 */
export async function getTempLocationId(db: SupabaseClient): Promise<string | null> {
  const { data } = await db
    .from("storage_locations")
    .select("id")
    .eq("is_temp", true)
    .neq("status", "DISABLED")
    .order("code")
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}
