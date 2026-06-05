import { createClient } from "@supabase/supabase-js";
import HomeClient from "./HomeClient";
import SampleHomePage from "./SampleHomePage";

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
  if (sampleMode) return <SampleHomePage />;
  return <HomeClient />;
}
