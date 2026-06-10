"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, LogOut, User, MapPin, ChevronRight, BookOpen, SlidersHorizontal, Globe, Truck, Pencil, X, Check } from "lucide-react";
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
  phone: string | null;
}

export default function MyPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [copied, setCopied] = useState<"address" | null>(null);
  const [addrCount, setAddrCount] = useState<{ pickup: number; overseas: number }>({
    pickup: 0,
    overseas: 0,
  });

  // 프로필 수정 시트
  const [editSheet, setEditSheet] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const [{ data: cust }, { data: addrs }] = await Promise.all([
        supabase.from("customers").select("name, email, phone").eq("id", user.id).single(),
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

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    setCopied("address");
    setTimeout(() => setCopied(null), 2000);
  }

  function copyAddress() {
    copyText(`[${INFRONT_ZIPCODE}] ${INFRONT_ADDRESS}\n수취인: ${customer?.name ?? ""}`);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  function openEditSheet() {
    setEditName(customer?.name ?? "");
    setEditPhone(customer?.phone ?? "");
    setEditSheet(true);
  }

  async function handleSaveProfile() {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, phone: editPhone }),
      });
      if (res.ok) {
        setCustomer(c => c ? { ...c, name: editName, phone: editPhone || null } : c);
        setEditSheet(false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
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
          <button
            type="button"
            onClick={openEditSheet}
            className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 active:scale-95 transition-all"
            aria-label="프로필 수정"
          >
            <Pencil size={15} className="text-gray-500" />
          </button>
        </div>

      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => router.push("/addresses")}
          className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-50 active:bg-gray-50 transition-colors"
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
        <button
          type="button"
          onClick={() => router.push("/orders")}
          className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-50 active:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center">
              <Globe size={15} className="text-sky-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-800">배송 현황</p>
              <p className="text-xs text-gray-400 mt-0.5">국제배송 진행 상태 확인</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-gray-300" />
        </button>
        <button
          type="button"
          onClick={() => router.push("/pickup/history")}
          className="w-full flex items-center justify-between px-5 py-4 active:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <Truck size={15} className="text-orange-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-800">수거 현황</p>
              <p className="text-xs text-gray-400 mt-0.5">수거 전 · 이동 중 · 입고 중</p>
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

    {/* 프로필 수정 시트 */}
    {editSheet && (
      <div className="fixed inset-0 z-50 flex flex-col bg-black/40">
        <div
          className="flex-1 flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) setEditSheet(false); }}
        >
          <div className="w-full max-w-[600px] bg-white rounded-t-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-900">프로필 수정</p>
              <button onClick={() => setEditSheet(false)} className="p-1.5 rounded-full hover:bg-gray-100">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  이름 <span className="text-red-400">*</span>
                </label>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="이름을 입력해주세요"
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">연락처</label>
                <input
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>
            </div>
            <div className="px-5 pb-6 pt-2">
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={saving || !editName.trim()}
                className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white font-semibold py-4 rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-transform"
              >
                {saving
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Check size={16} />}
                저장하기
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
