"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, LogOut, User, MapPin, ChevronRight, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// 인프론트 공용 입고주소 (쇼핑몰 배송지)
const INFRONT_ADDRESS = "대구광역시 동구 동촌로 1 (동대구우체국 소포실) 인프론트";
const INFRONT_ZIPCODE = "41068";

interface Customer {
  name: string;
  email: string;
  customer_code: string;
  phone: string | null;
}

export default function MyPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [copied, setCopied] = useState(false);
  const [addrCount, setAddrCount] = useState<{ pickup: number; overseas: number }>({ pickup: 0, overseas: 0 });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const [{ data: cust }, { data: addrs }] = await Promise.all([
        supabase.from("customers").select("name, email, customer_code, phone").eq("id", user.id).single(),
        supabase.from("customer_addresses").select("type").eq("customer_id", user.id),
      ]);
      setCustomer(cust);
      if (addrs) {
        setAddrCount({
          pickup:   addrs.filter((a) => a.type === "pickup").length,
          overseas: addrs.filter((a) => a.type === "overseas").length,
        });
      }
    });
  }, []);

  function copyAddress() {
    const text = `[${INFRONT_ZIPCODE}] ${INFRONT_ADDRESS}\n수취인: ${customer?.name ?? ""}`;
    navigator.clipboard.writeText(text);
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
      </div>

      {/* 입고 주소 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <MapPin size={16} className="text-blue-600" />
          <p className="text-sm font-semibold text-gray-900">입고 주소</p>
        </div>

        {/* 수취인 */}
        <div className="bg-blue-50 rounded-xl px-4 py-3 mb-3">
          <p className="text-[11px] text-blue-500 font-medium mb-0.5">수취인명 (반드시 기재)</p>
          <p className="text-sm font-bold text-blue-800 tracking-wide">
            {customer?.name ?? "—"}
          </p>
        </div>

        {/* 주소 */}
        <div className="mb-3">
          <p className="text-[11px] text-gray-400 mb-0.5">배송지 주소</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            [{INFRONT_ZIPCODE}] {INFRONT_ADDRESS}
          </p>
        </div>

        <button
          onClick={copyAddress}
          className="flex items-center gap-2 text-xs text-blue-600 font-medium bg-blue-50 px-3 py-2 rounded-lg active:bg-blue-100 transition-colors"
        >
          <Copy size={13} />
          {copied ? "복사됨!" : "주소 + 수취인 복사"}
        </button>
        <p className="text-xs text-gray-400 mt-3 leading-relaxed">
          💡 국내 쇼핑몰 주문 시 위 주소로 배송받으시면 자동 입고됩니다.
        </p>
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-2 leading-relaxed">
          ⚠️ 수거 신청 이외의 입고는 <span className="font-semibold">마이창고 물품 등록</span>이 필수입니다.
        </p>
      </div>

      {/* 주소록 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <button
          onClick={() => router.push("/addresses")}
          className="w-full flex items-center justify-between px-5 py-4 active:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <BookOpen size={15} className="text-blue-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-800">주소록 관리</p>
              <p className="text-xs text-gray-400 mt-0.5">
                수거지 {addrCount.pickup}개 · 해외배송지 {addrCount.overseas}개
              </p>
            </div>
          </div>
          <ChevronRight size={16} className="text-gray-300" />
        </button>
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
        인프론트 v1.0.0
      </p>
    </div>
  );
}
