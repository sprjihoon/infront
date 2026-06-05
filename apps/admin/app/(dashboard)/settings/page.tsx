import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SamplePageToggle from "@/components/settings/SamplePageToggle";

async function getSamplePageEnabled(): Promise<boolean> {
  const { data } = await adminDb
    .from("admin_config")
    .select("value")
    .eq("key", "sample_page_mode")
    .maybeSingle();
  return (data?.value as { enabled?: boolean })?.enabled ?? false;
}

export default async function SettingsPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/login");

  const samplePageEnabled = await getSamplePageEnabled();

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">서비스 설정</h1>
        <p className="text-sm text-gray-500 mt-1">앱 동작 방식을 제어합니다.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">결제 / 심사</h2>
        <SamplePageToggle initialEnabled={samplePageEnabled} />
      </section>
    </div>
  );
}
