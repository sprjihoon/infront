import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/server";
import AdminNav from "./AdminNav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  if (!user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminNav email={user.email ?? ""} />
      <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
        {children}
      </main>
    </div>
  );
}
