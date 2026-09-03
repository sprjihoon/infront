import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";

/*
 * 샵 UI 숨김 (SHOP_UI_ENABLED = false).
 * 심사 때 lib/shop/visible.ts 를 true 로 되돌린 뒤 아래 리다이렉트를 살린다.
 *
 * import { createClient } from "@supabase/supabase-js";
 * import { redirect } from "next/navigation";
 * import { SHOP_UI_ENABLED } from "@/lib/shop/visible";
 *
 * async function isSamplePageEnabled(): Promise<boolean> {
 *   ...
 * }
 * if (SHOP_UI_ENABLED && (await isSamplePageEnabled())) redirect("/shop");
 */

export default async function HomePage() {
  return <HomeClient />;
}
