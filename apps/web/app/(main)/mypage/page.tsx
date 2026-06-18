"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Copy, LogOut, User, MapPin, ChevronRight,
  SlidersHorizontal, Pencil, X, Check, ArrowLeft,
  Package, Send, Archive, BookOpen,
} from "lucide-react";
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

const INBOUND_STATUSES = [
  "CREATED", "PENDING_PICKUP", "PICKUP_REQUESTED",
  "IN_TRANSIT", "INBOUND", "INSPECTING", "INSPECTION",
];
const STORAGE_STATUSES = ["SHIPPABLE", "READY", "HOLD", "PICKUP_CANCELLED"];

interface Customer {
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
}

interface Stats {
  inboundCount: number;
  shippingCount: number;
  storageCount: number;
  addrPickup: number;
  addrOverseas: number;
  addressCount: number;
}

export default function MyPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [copied, setCopied] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState<Stats>({
    inboundCount: 0,
    shippingCount: 0,
    storageCount: 0,
    addrPickup: 0,
    addrOverseas: 0,
    addressCount: 0,
  });

  const [editSheet, setEditSheet] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;

      const [
        { data: cust },
        { data: parcels },
        { data: orders },
        { data: addrs },
      ] = await Promise.all([
        supabase.from("customers").select("name, email, phone, avatar_url").eq("id", user.id).single(),
        supabase
          .from("parcels")
          .select("status")
          .eq("customer_id", user.id)
          .neq("status", "DONE")
          .neq("status", "SHIPPED"),
        supabase
          .from("orders")
          .select("status")
          .eq("customer_id", user.id),
        supabase
          .from("customer_addresses")
          .select("type")
          .eq("customer_id", user.id),
      ]);

      setCustomer(cust);

      const parcelList = parcels ?? [];
      const orderList = orders ?? [];
      const addrList = addrs ?? [];

      setStats({
        inboundCount: parcelList.filter(p => INBOUND_STATUSES.includes(p.status)).length,
        shippingCount: orderList.filter(o => o.status === "IN_TRANSIT").length,
        storageCount: parcelList.filter(p => STORAGE_STATUSES.includes(p.status)).length,
        addrPickup: addrList.filter(a => a.type === "pickup").length,
        addrOverseas: addrList.filter(a => a.type === "overseas").length,
        addressCount: addrList.length,
      });
    });
  }, []);

  function copyAddress() {
    navigator.clipboard.writeText(
      `[${INFRONT_ZIPCODE}] ${INFRONT_ADDRESS}\n수취인: ${customer?.name ?? ""}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: form });
      const json = await res.json();
      if (res.ok && json.avatar_url) {
        setCustomer(c => c ? { ...c, avatar_url: json.avatar_url } : c);
      } else {
        alert(json.error ?? "업로드에 실패했습니다.");
      }
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
      {/* ── 상단 헤더 (흰색 배경) ── */}
      <div className="bg-white px-4 py-3.5 sticky top-0 z-10 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="text-base font-bold text-gray-900">마이페이지</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-brand-600">infront</span>
        </div>
      </div>

      {/* ── 프로필 헤더 (브랜드 배경) ── */}
      <div className="bg-brand-600 px-5 pt-5 pb-5">
        <div className="flex items-center gap-4">
          {/* 아바타 - 탭하면 사진 변경 */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            className="relative w-16 h-16 rounded-full flex-shrink-0 overflow-hidden"
          >
            {customer?.avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={customer.avatar_url} alt="프로필" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-white/20 flex items-center justify-center">
                <User size={28} className="text-white" />
              </div>
            )}
            {/* 카메라 오버레이 */}
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 active:opacity-100 transition-opacity">
              {avatarUploading ? (
                <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                </svg>
              ) : (
                <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <div className="min-w-0 flex-1">
            <p className="text-white font-bold text-lg leading-snug">
              {customer?.name ?? "—"}님
            </p>
            <p className="text-white/80 text-sm truncate">{customer?.email ?? "—"}</p>
            {customer?.phone && (
              <p className="text-white/70 text-xs mt-0.5">{customer.phone}</p>
            )}
          </div>
          <button
            type="button"
            onClick={openEditSheet}
            className="p-2.5 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 transition-all flex-shrink-0"
            aria-label="프로필 수정"
          >
            <Pencil size={16} className="text-white" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-3">

        {/* ── 통계 그리드 2×2 ── */}
        <div className="grid grid-cols-2 gap-3">
          {/* 입고 진행현황 */}
          <button
            type="button"
            onClick={() => router.push("/pickup/history")}
            className="bg-white rounded-2xl p-4 shadow-sm text-left active:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
                <Package size={18} className="text-brand-600" />
              </div>
              <ChevronRight size={14} className="text-gray-300 mt-0.5" />
            </div>
            <p className="text-xs font-medium text-gray-700">입고 진행현황</p>
            <p className="text-[11px] text-gray-400 mt-0.5">입고 처리 중</p>
            <p className="text-2xl font-bold text-gray-900 mt-1.5 tabular-nums">
              {stats.inboundCount}
            </p>
          </button>

          {/* 출고·배송현황 */}
          <button
            type="button"
            onClick={() => router.push("/orders")}
            className="bg-white rounded-2xl p-4 shadow-sm text-left active:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center">
                <Send size={17} className="text-sky-500" />
              </div>
              <ChevronRight size={14} className="text-gray-300 mt-0.5" />
            </div>
            <p className="text-xs font-medium text-gray-700">출고·배송현황</p>
            <p className="text-[11px] text-gray-400 mt-0.5">배송 중</p>
            <p className="text-2xl font-bold text-gray-900 mt-1.5 tabular-nums">
              {stats.shippingCount}
            </p>
          </button>

          {/* 보관 중 물품 */}
          <button
            type="button"
            onClick={() => router.push("/storage")}
            className="bg-white rounded-2xl p-4 shadow-sm text-left active:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
                <Archive size={17} className="text-violet-500" />
              </div>
              <ChevronRight size={14} className="text-gray-300 mt-0.5" />
            </div>
            <p className="text-xs font-medium text-gray-700">보관 중 물품</p>
            <p className="text-[11px] text-gray-400 mt-0.5">보관 중</p>
            <p className="text-2xl font-bold text-gray-900 mt-1.5 tabular-nums">
              {stats.storageCount}
            </p>
          </button>

          {/* 주소록 관리 */}
          <button
            type="button"
            onClick={() => router.push("/addresses")}
            className="bg-white rounded-2xl p-4 shadow-sm text-left active:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
                <BookOpen size={17} className="text-teal-500" />
              </div>
              <ChevronRight size={14} className="text-gray-300 mt-0.5" />
            </div>
            <p className="text-xs font-medium text-gray-700">주소록 관리</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              국내 {stats.addrPickup} / 해외 {stats.addrOverseas}
            </p>
            <p className="text-2xl font-bold text-gray-900 mt-1.5 tabular-nums">
              {stats.addressCount}
            </p>
          </button>
        </div>

        {/* ── 입고 주소 ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-brand-600" />
              <p className="text-sm font-semibold text-gray-900">입고 주소</p>
            </div>
            <button
              type="button"
              onClick={copyAddress}
              className="flex items-center gap-1.5 text-xs text-brand-600 font-medium bg-brand-50 px-2.5 py-1.5 rounded-lg active:bg-brand-100 transition-colors"
            >
              <Copy size={11} />
              {copied ? "복사됨!" : "복사"}
            </button>
          </div>

          <p className="text-[11px] text-gray-400 mb-0.5">수취인명 (반드시 기재)</p>
          <p className="text-sm font-bold text-gray-900 mb-3">{customer?.name ?? "—"}</p>

          <p className="text-[11px] text-gray-400 mb-0.5">배송지 주소</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            [{INFRONT_ZIPCODE}] {INFRONT_ADDRESS}
          </p>

          <p className="text-xs text-gray-400 mt-3 leading-relaxed">
            📦 입고 시 이 주소로 발송해 주세요.
          </p>
        </div>

        {/* ── 입력 모드 ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <SlidersHorizontal size={15} className="text-brand-600" />
            <p className="text-sm font-semibold text-gray-900">입력 모드</p>
          </div>
          <p className="text-xs text-gray-400 mb-4 leading-relaxed">
            수거·출고 신청 화면 표시 방식입니다. 일반모드는 단계별, 고급모드는 한 페이지에 모두 입력합니다.
          </p>
          <FlowModeToggle />
        </div>

        {/* ── 메뉴 링크 ── */}
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

        {/* ── 로그아웃 ── */}
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

      {/* ── 프로필 수정 모달 ── */}
      {editSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setEditSheet(false)}
          />
          <div className="relative w-full max-w-[440px] bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="text-base font-bold text-gray-900">프로필 수정</p>
              <button
                onClick={() => setEditSheet(false)}
                className="p-1.5 rounded-full hover:bg-gray-100"
              >
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
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  연락처
                </label>
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
      )}
    </>
  );
}
