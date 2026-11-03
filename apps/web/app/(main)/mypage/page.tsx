"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Copy, LogOut, User, ChevronRight,
  Pencil, X, Check, ArrowLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import FlowModeToggle from "@/components/ui/FlowModeToggle";
import {
  CUSTOMER_TYPE_LABEL,
  type CustomerType,
} from "@/lib/shop/products";

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
  customer_type: CustomerType;
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
  const [editCustomerType, setEditCustomerType] = useState<CustomerType>("domestic");
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
        supabase
          .from("customers")
          .select("name, email, phone, avatar_url, customer_type")
          .eq("id", user.id)
          .single(),
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

      const meta = user.user_metadata as { customer_type?: string };
      setCustomer(
        cust
          ? {
              ...cust,
              customer_type:
                cust.customer_type === "foreigner" || meta.customer_type === "foreigner"
                  ? "foreigner"
                  : "domestic",
            }
          : null
      );

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
    setEditCustomerType(customer?.customer_type ?? "domestic");
    setEditSheet(true);
  }

  async function handleSaveProfile() {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          phone: editPhone,
          customer_type: editCustomerType,
        }),
      });
      if (res.ok) {
        setCustomer(c =>
          c
            ? {
                ...c,
                name: editName,
                phone: editPhone || null,
                customer_type: editCustomerType,
              }
            : c
        );
        setEditSheet(false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="bg-white px-4 py-3.5 sticky top-0 z-10 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => router.back()} className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-900">마이페이지</h1>
          <p className="text-xs text-gray-400 mt-0.5">계정과 주소, 진행 상황</p>
        </div>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            className="relative w-14 h-14 rounded-full flex-shrink-0 overflow-hidden bg-brand-50"
          >
            {customer?.avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={customer.avatar_url} alt="프로필" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User size={24} className="text-brand-600" />
              </div>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <div className="min-w-0 flex-1">
            <p className="text-gray-900 font-bold text-base leading-snug truncate">
              {customer?.name ?? "—"}님
            </p>
            <p className="text-gray-500 text-sm truncate">{customer?.email ?? "—"}</p>
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              {[customer?.phone, customer ? CUSTOMER_TYPE_LABEL[customer.customer_type] : ""]
                .filter((part): part is string => Boolean(part))
                .join(" · ") || "프로필을 입력해 주세요"}
            </p>
          </div>
          <button
            type="button"
            onClick={openEditSheet}
            className="p-2 rounded-full hover:bg-gray-100 active:scale-95 transition-all flex-shrink-0"
            aria-label="프로필 수정"
          >
            <Pencil size={16} className="text-gray-500" />
          </button>
        </div>

        {/* ── 통계 그리드 2×2 ── */}
        <div className="grid grid-cols-2 gap-3">
          {/* 입고 진행현황 */}
          <button
            type="button"
            onClick={() => router.push("/pickup/history")}
            className="bg-white rounded-2xl p-4 shadow-sm text-left active:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center">
                <img src="/icon-pickup.png" alt="입고" className="w-10 h-10 object-contain" fetchPriority="high" />
              </div>
              <ChevronRight size={14} className="text-gray-300 mt-0.5" />
            </div>
            <p className="text-xs font-medium text-gray-700">오는 중</p>
            <p className="text-[11px] text-gray-400 mt-0.5">센터로 이동 중</p>
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
              <div className="w-11 h-11 rounded-xl bg-sky-50 flex items-center justify-center">
                <img src="/icon-orders.png" alt="출고" className="w-10 h-10 object-contain" fetchPriority="high" />
              </div>
              <ChevronRight size={14} className="text-gray-300 mt-0.5" />
            </div>
            <p className="text-xs font-medium text-gray-700">출고 중</p>
            <p className="text-[11px] text-gray-400 mt-0.5">보내는 중</p>
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
              <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center">
                <img src="/icon-storage.png" alt="보관" className="w-10 h-10 object-contain" fetchPriority="high" />
              </div>
              <ChevronRight size={14} className="text-gray-300 mt-0.5" />
            </div>
            <p className="text-xs font-medium text-gray-700">센터에 있음</p>
            <p className="text-[11px] text-gray-400 mt-0.5">보관·출고 대기</p>
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
              <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center">
                <img src="/icon-addressbook.png" alt="주소록" className="w-10 h-10 object-contain" fetchPriority="high" />
              </div>
              <ChevronRight size={14} className="text-gray-300 mt-0.5" />
            </div>
            <p className="text-xs font-medium text-gray-700">주소록</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              수거 {stats.addrPickup} · 해외 {stats.addrOverseas}
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
              <img src="/icon-address.png" alt="주소" className="w-10 h-10 object-contain" fetchPriority="high" />
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
            직접 보낼 때 이 주소와 이름을 적습니다.
          </p>
        </div>

        {/* ── 입력 모드 ── */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <img src="/icon-settings.png" alt="설정" className="w-10 h-10 object-contain" fetchPriority="high" />
            <p className="text-sm font-semibold text-gray-900">입력 모드</p>
          </div>
          <p className="text-xs text-gray-400 mb-4 leading-relaxed">
            수거와 출고 화면입니다. 일반은 단계별로, 고급은 한 화면에 입력합니다.
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
              {/* 프로필 이미지 변경 */}
              <div className="flex flex-col items-center gap-2 pb-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="relative w-20 h-20 rounded-full overflow-hidden ring-4 ring-brand-100 active:scale-95 transition-transform"
                >
                  {customer?.avatar_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={customer.avatar_url} alt="프로필" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-brand-50 flex items-center justify-center">
                      <User size={32} className="text-brand-300" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    {avatarUploading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                    )}
                  </div>
                </button>
                <p className="text-xs text-gray-400">탭하여 사진 변경</p>
              </div>

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
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  고객 구분
                </label>
                <select
                  value={editCustomerType}
                  onChange={e => setEditCustomerType(e.target.value as CustomerType)}
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200"
                >
                  <option value="domestic">내국인</option>
                  <option value="foreigner">외국인/해외고객</option>
                </select>
                <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                  서비스 안내·배송 관련 안내에 참고됩니다.
                </p>
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
