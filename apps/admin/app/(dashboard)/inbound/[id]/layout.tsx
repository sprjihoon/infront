import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/server";

export default async function InboundDetailLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  if (!user) redirect("/login");
  // 바코드 출력 페이지는 사이드바 없이 전체화면
  return <>{children}</>;
}
