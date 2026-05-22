import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/server";
import DashboardNav from "@/components/dashboard/DashboardNav";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <DashboardNav />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader email={user.email ?? ""} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
