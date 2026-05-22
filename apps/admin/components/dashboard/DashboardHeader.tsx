"use client";

import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function DashboardHeader({ email }: { email: string }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">관리자 콘솔</h2>
          <p className="text-sm text-gray-500 mt-0.5">인프론트 국제배송 운영</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
            <User className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-700 max-w-[200px] truncate">{email}</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors border border-gray-200"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">로그아웃</span>
          </button>
        </div>
      </div>
    </header>
  );
}
