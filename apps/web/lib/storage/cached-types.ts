import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

/** storage_types는 관리자가 변경하지 않는 한 바뀌지 않는 정적 데이터.
 *  1시간 서버사이드 캐시로 DB 조회를 최소화한다. */
export const getCachedStorageTypes = unstable_cache(
  async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data, error } = await supabase
      .from("storage_types")
      .select(
        "id, code, name, price_per_week, price_max, price_per_month, max_parcels, volume_liter, dim_l_mm, dim_w_mm, dim_h_mm"
      )
      .eq("is_active", true)
      .order("sort_order");

    if (error) throw error;
    return data ?? [];
  },
  ["storage-types"],
  { revalidate: 3600 }
);
