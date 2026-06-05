import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";

async function isSamplePageEnabled(): Promise<boolean> {
  try {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { data } = await db
      .from("admin_config")
      .select("value")
      .eq("key", "sample_page_mode")
      .maybeSingle();
    return (data?.value as { enabled?: boolean })?.enabled === true;
  } catch {
    return false;
  }
}

export default async function HomePage() {
  const sampleMode = await isSamplePageEnabled();
  if (sampleMode) redirect("/shop");
  return <HomeClient />;
}
