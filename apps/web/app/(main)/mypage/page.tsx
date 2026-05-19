"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, LogOut, User, MapPin, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Customer {
  name: string;
  email: string;
  customer_code: string;
  personal_address: string;
  phone: string | null;
}

export default function MyPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("customers")
        .select("name, email, customer_code, personal_address, phone")
        .eq("id", user.id)
        .single()
        .then(({ data }) => setCustomer(data));
    });
  }, []);

  function copyAddress() {
    if (!customer?.personal_address) return;
    navigator.clipboard.writeText(customer.personal_address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="px-4 py-6 space-y-5">
      <h1 className="text-xl font-bold text-gray-900">마이페이지</h1>

      {/* 프로필 카드 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <User size={22} className="text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{customer?.name ?? "—"}</p>
            <p className="text-sm text-gray-500">{customer?.email ?? "—"}</p>
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">고객번호</p>
          <p className="text-sm font-bold text-blue-600 tracking-wide">
            {customer?.customer_code ?? "—"}
          </p>
        </div>
      </div>

      {/* 개인 입고주소 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <MapPin size={16} className="text-blue-600" />
          <p className="text-sm font-semibold text-gray-900">개인 입고주소</p>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed mb-3">
          {customer?.personal_address ?? "주소 로딩 중..."}
        </p>
        <button
          onClick={copyAddress}
          className="flex items-center gap-2 text-xs text-blue-600 font-medium bg-blue-50 px-3 py-2 rounded-lg active:bg-blue-100 transition-colors"
        >
          <Copy size={13} />
          {copied ? "복사됨!" : "주소 복사하기"}
        </button>
        <p className="text-xs text-gray-400 mt-3">
          💡 이 주소로 국내 쇼핑몰에서 주문하시면 자동으로 입고됩니다
        </p>
      </div>

      {/* 메뉴 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {[
          { label: "공지사항" },
          { label: "이용약관" },
          { label: "개인정보처리방침" },
          { label: "고객센터" },
        ].map((item) => (
          <button
            key={item.label}
            className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-50 last:border-0 active:bg-gray-50 transition-colors"
          >
            <span className="text-sm text-gray-700">{item.label}</span>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
        ))}
      </div>

      {/* 로그아웃 */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-white rounded-2xl shadow-sm text-sm text-red-500 font-medium active:bg-red-50 transition-colors"
      >
        <LogOut size={16} />
        로그아웃
      </button>

      <p className="text-center text-xs text-gray-300 pb-2">
        스프링박스 v1.0.0
      </p>
    </div>
  );
}
