import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/server";

export default async function AdminRoot() {
  const user = await requireAdmin();
  if (!user) redirect("/login");
  redirect("/dashboard");
}
