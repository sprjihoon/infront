"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, LogOut, User, MapPin, ChevronRight, BookOpen, Hash, SlidersHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import FlowModeToggle from "@/components/ui/FlowModeToggle";

const INFRONT_ADDRESS = "대구광역시 동구 동촌로 1 (동대구우체국 소포실) 인프론트";
const INFRONT_ZIPCODE = "41068";

const MENU_ITEMS = [
  { label: "공지사항", href: "/notices" },
  { label: "이용약관", href: "/terms" },
  { label: "개인정보처리방침", href: "/privacy" },
  { label: "고객센터", href: "/support" },
] as const;

interface Customer {
  name: string;
  email: string;
  customer_code: string;
  phone: string | null;
}

export default function MyPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [copied, setCopied] = useState<"address" | "code" | null>(null);
  const [addrCount, setAddrCount] = useState<{ pickup: number; overseas: number }>({
    pickup: 0,
    overseas: 0,
  });

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
          pickup: addrs.filter((a) => a.type === "pickup").length,
          overseas: addrs.filter((a) => a.type === "overseas").length,
        });
      }
    });
  }, []);

  function copyText(text: string, kind: "address" | "code") {
    navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  }

  function copyAddress() {
    copyText(`[${INFRONT_ZIPCODE}] ${INFRONT_ADDRESS}\n수취인: ${customer?.name ?? ""}`, "address");
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="px-4 py-6 space-y-5">
      <h1 className="text-xl font-bold text-gray-900">마이페이지</h1>

      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center">
            <User size={22} className="text-brand-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900">{customer?.name ?? "—"}</p>
            <p className="text-sm text-gray-500 truncate">{customer?.email ?? "—"}</p>
            {customer?.phone && (
              <p className="text-xs text-gray-400 mt-0.5">{customer.phone}</p>
            )}
          </div>
        </div>

        {customer?.customer_code && (
          <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Hash size={14} className="text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] text-gray-400 font-medium">고객번호</p>
                <p className="text-sm font-bold text-gray-800 tracking-wide truncate">
                  {customer.customer_code}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => copyText(customer.customer_code, "code")}
              className="flex items-center gap-1 text-xs text-brand-600 font-medium bg-brand-50 px-2.5 py-1.5 rounded-lg shrink-0"
            >
              <Copy size={12} />
              {copied === "code" ? "복사됨" : "복사"}
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => router.push("/addresses")}
          className="w-full flex items-center justify-between px-5 py-4 active:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center">
              <BookOpen size={15} className="text-brand-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-800">주소록 관리</p>
              <p className="text-xs text-gray-400 mt-0.5">
                국내배송지 {addrCount.pickup}개 · 해외배송지 {addrCount.overseas}개
              </p>
            </div>
          </div>
          <ChevronRight size={16} className="text-gray-300" />
        </button>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <MapPin size={16} className="text-brand-600" />
          <p className="text-sm font-semibold text-gray-900">입고 주소</p>
        </div>

        <div className="bg-brand-50 rounded-xl px-4 py-3 mb-3">
          <p className="text-[11px] text-brand-500 font-medium mb-0.5">수취인명 (반드시 기재)</p>
          <p className="text-sm font-bold text-brand-800 tracking-wide">
            {customer?.name ?? "—"}
          </p>
        </div>

        <div className="mb-3">
          <p className="text-[11px] text-gray-400 mb-0.5">배송지 주소</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            [{INFRONT_ZIPCODE}] {INFRONT_ADDRESS}
          </p>
        </div>

        <button
          type="button"
          onClick={copyAddress}
          className="flex items-center gap-2 text-xs text-brand-600 font-medium bg-brand-50 px-3 py-2 rounded-lg active:bg-brand-100 transition-colors"
        >
          <Copy size={13} />
          {copied === "address" ? "복사됨!" : "주소 + 수취인 복사"}
        </button>
        <p className="text-xs text-gray-400 mt-3 leading-relaxed">
          💡 국내 쇼핑몰 주문 시 위 주소로 배송받으시면 자동 입고됩니다.
        </p>
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-2 leading-relaxed">
          ⚠️ 수거 신청 이외의 입고는 <span className="font-semibold">스토리지 물품 등록</span>이 필수입니다.
        </p>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <SlidersHorizontal size={16} className="text-brand-600" />
          <p className="text-sm font-semibold text-gray-900">입력 모드</p>
        </div>
        <p className="text-xs text-gray-400 mb-4 leading-relaxed">
          수거·출고 신청 화면 표시 방식입니다. 일반모드는 단계별, 고급모드는 한 페이지에 모두 입력합니다.
        </p>
        <FlowModeToggle />
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {MENU_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-50 last:border-0 active:bg-gray-50 transition-colors"
          >
            <span className="text-sm text-gray-700">{item.label}</span>
            <ChevronRight size={16} className="text-gray-300" />
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-white rounded-2xl shadow-sm text-sm text-red-500 font-medium active:bg-red-50 transition-colors"
      >
        <LogOut size={16} />
        로그아웃
      </button>

      <p className="text-center text-xs text-gray-300 pb-2">인프론트 v1.0.0</p>
    </div>
  );
}
