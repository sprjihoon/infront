"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, MapPin, Globe, Star, Pencil, Trash2,
  Phone, Mail, X, Check, ChevronDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AddressSearchButton } from "@/components/ui/AddressSearchButton";

// ── 타입 ────────────────────────────────────────────────────
type AddrType = "pickup" | "overseas";

interface Address {
  id: string;
  type: AddrType;
  label: string;
  name: string;
  phone: string | null;
  // pickup
  zipcode: string | null;
  address: string | null;
  address_detail: string | null;
  // overseas
  country_code: string | null;
  overseas_addr1: string | null;
  overseas_addr2: string | null;
  overseas_addr3: string | null;
  overseas_zip: string | null;
  email: string | null;
  is_default: boolean;
}

const EMPTY_PICKUP = (): Partial<Address> => ({
  type: "pickup", label: "", name: "", phone: "",
  zipcode: "", address: "", address_detail: "",
});
const EMPTY_OVERSEAS = (): Partial<Address> => ({
  type: "overseas", label: "", name: "", phone: "",
  country_code: "JP", overseas_addr1: "", overseas_addr2: "",
  overseas_addr3: "", overseas_zip: "", email: "",
});

const COUNTRIES = [
  { code: "JP", name: "일본", flag: "🇯🇵" },
  { code: "CN", name: "중국", flag: "🇨🇳" },
  { code: "US", name: "미국", flag: "🇺🇸" },
  { code: "AU", name: "호주", flag: "🇦🇺" },
  { code: "CA", name: "캐나다", flag: "🇨🇦" },
  { code: "GB", name: "영국", flag: "🇬🇧" },
  { code: "DE", name: "독일", flag: "🇩🇪" },
  { code: "FR", name: "프랑스", flag: "🇫🇷" },
  { code: "SG", name: "싱가포르", flag: "🇸🇬" },
  { code: "HK", name: "홍콩", flag: "🇭🇰" },
  { code: "TW", name: "대만", flag: "🇹🇼" },
  { code: "TH", name: "태국", flag: "🇹🇭" },
  { code: "VN", name: "베트남", flag: "🇻🇳" },
  { code: "PH", name: "필리핀", flag: "🇵🇭" },
  { code: "MY", name: "말레이시아", flag: "🇲🇾" },
  { code: "ID", name: "인도네시아", flag: "🇮🇩" },
  { code: "MO", name: "마카오", flag: "🇲🇴" },
  { code: "MN", name: "몽골", flag: "🇲🇳" },
  { code: "NZ", name: "뉴질랜드", flag: "🇳🇿" },
  { code: "IT", name: "이탈리아", flag: "🇮🇹" },
  { code: "ES", name: "스페인", flag: "🇪🇸" },
  { code: "NL", name: "네덜란드", flag: "🇳🇱" },
  { code: "SE", name: "스웨덴", flag: "🇸🇪" },
  { code: "CH", name: "스위스", flag: "🇨🇭" },
  { code: "RU", name: "러시아", flag: "🇷🇺" },
  { code: "BR", name: "브라질", flag: "🇧🇷" },
  { code: "MX", name: "멕시코", flag: "🇲🇽" },
  { code: "AE", name: "아랍에미리트", flag: "🇦🇪" },
  { code: "SA", name: "사우디아라비아", flag: "🇸🇦" },
  { code: "IN", name: "인도", flag: "🇮🇳" },
];

// ── 메인 페이지 ─────────────────────────────────────────────
export default function AddressesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [tab, setTab] = useState<AddrType>("pickup");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 모달 상태
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Address | null>(null);
  const [form, setForm] = useState<Partial<Address>>({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [countryOpen, setCountryOpen] = useState(false);

  // ── 데이터 로드 ──────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: cust } = await supabase
        .from("customers").select("id").eq("id", user.id).single();
      if (!cust) return;
      setCustomerId(cust.id);

      const { data } = await supabase
        .from("customer_addresses")
        .select("*")
        .eq("customer_id", cust.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      setAddresses(data ?? []);
    } catch {
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, router]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const filtered = addresses.filter(a => a.type === tab);

  // ── 저장 ────────────────────────────────────────────────
  async function save() {
    if (!customerId) return;
    if (!form.label?.trim()) { alert("표시명을 입력해주세요."); return; }
    if (!form.name?.trim())  { alert("이름을 입력해주세요."); return; }
    if (tab === "pickup" && !form.address?.trim()) { alert("주소를 검색해주세요."); return; }
    if (tab === "overseas" && !form.overseas_addr3?.trim()) { alert("상세주소를 입력해주세요."); return; }

    setSaving(true);
    const payload = { ...form, customer_id: customerId, type: tab };

    if (modal === "edit" && editTarget) {
      await supabase.from("customer_addresses").update(payload).eq("id", editTarget.id);
    } else {
      await supabase.from("customer_addresses").insert(payload);
    }
    setSaving(false);
    setModal(null);
    load();
  }

  // ── 삭제 ────────────────────────────────────────────────
  async function remove(id: string) {
    await supabase.from("customer_addresses").delete().eq("id", id);
    setDeleteConfirm(null);
    load();
  }

  // ── 기본 주소 설정 ───────────────────────────────────────
  async function setDefault(addr: Address) {
    if (!customerId) return;
    await supabase.from("customer_addresses")
      .update({ is_default: false })
      .eq("customer_id", customerId).eq("type", tab);
    await supabase.from("customer_addresses")
      .update({ is_default: true }).eq("id", addr.id);
    load();
  }

  function openAdd() {
    setForm(tab === "pickup" ? EMPTY_PICKUP() : EMPTY_OVERSEAS());
    setEditTarget(null);
    setModal("add");
  }

  function openEdit(addr: Address) {
    setForm({ ...addr });
    setEditTarget(addr);
    setModal("edit");
  }

  const selCountry = COUNTRIES.find(c => c.code === form.country_code) ?? COUNTRIES[0];

  // ── UI ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-[600px] mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="p-1 -ml-1">
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <h1 className="text-base font-semibold text-gray-900">주소록 관리</h1>
          <button
            onClick={openAdd}
            className="ml-auto flex items-center gap-1 bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-xl"
          >
            <Plus size={14} /> 추가
          </button>
        </div>
      </div>

      <div className="max-w-[600px] mx-auto px-4 pt-4">
        {/* 탭 */}
        <div className="flex bg-white rounded-2xl p-1 shadow-sm mb-4">
          {(["pickup", "overseas"] as AddrType[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                tab === t
                  ? t === "pickup"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-violet-600 text-white shadow-sm"
                  : "text-gray-400"
              }`}
            >
              {t === "pickup" ? <><MapPin size={14} /> 수거배송지</> : <><Globe size={14} /> 해외배송지</>}
            </button>
          ))}
        </div>

        {/* 주소 목록 */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center px-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
              tab === "pickup" ? "bg-blue-50" : "bg-violet-50"
            }`}>
              {tab === "pickup"
                ? <MapPin size={28} className="text-blue-300" />
                : <Globe size={28} className="text-violet-300" />}
            </div>
            <p className="text-base font-semibold text-gray-700 mb-1">
              {tab === "pickup" ? "저장된 수거지가 없어요" : "저장된 해외 배송지가 없어요"}
            </p>
            <p className="text-xs text-gray-400 mb-6 leading-relaxed">
              {tab === "pickup"
                ? "자주 쓰는 수거지를 저장해두면\n수거 신청 시 빠르게 입력할 수 있어요."
                : "자주 발송하는 해외 수취인 주소를\n저장해두면 발송 시 바로 선택할 수 있어요."}
            </p>
            <button
              onClick={openAdd}
              className={`flex items-center gap-2 text-white text-sm font-semibold px-6 py-3 rounded-2xl shadow-sm ${
                tab === "pickup" ? "bg-blue-600" : "bg-violet-600"
              }`}
            >
              <Plus size={16} />
              {tab === "pickup" ? "수거지 추가하기" : "해외 배송지 추가하기"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(addr => (
              <div
                key={addr.id}
                className={`bg-white rounded-2xl p-4 shadow-sm border-2 transition-all ${
                  addr.is_default
                    ? tab === "pickup" ? "border-blue-200" : "border-violet-200"
                    : "border-transparent"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      tab === "pickup"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-violet-100 text-violet-700"
                    }`}>
                      {addr.label}
                    </span>
                    {addr.is_default && (
                      <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                        <Star size={9} fill="currentColor" /> 기본
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(addr)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(addr.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <p className="text-sm font-semibold text-gray-900">{addr.name}</p>

                {tab === "pickup" ? (
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    [{addr.zipcode}] {addr.address} {addr.address_detail}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    {COUNTRIES.find(c => c.code === addr.country_code)?.flag}{" "}
                    {addr.overseas_addr3}, {addr.overseas_addr2}, {addr.overseas_addr1}
                    {addr.overseas_zip ? ` (${addr.overseas_zip})` : ""}
                  </p>
                )}

                {addr.phone && (
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <Phone size={10} /> {addr.phone}
                  </p>
                )}
                {addr.email && (
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Mail size={10} /> {addr.email}
                  </p>
                )}

                {!addr.is_default && (
                  <button
                    onClick={() => setDefault(addr)}
                    className="mt-2.5 text-[11px] text-gray-400 hover:text-amber-600 transition-colors flex items-center gap-1"
                  >
                    <Star size={11} /> 기본 주소로 설정
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 삭제 확인 */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-8 sm:items-center">
          <div className="w-full max-w-[380px] bg-white rounded-2xl p-5 shadow-xl">
            <p className="text-base font-bold text-gray-900 mb-1">주소를 삭제할까요?</p>
            <p className="text-sm text-gray-500 mb-5">삭제한 주소는 복구할 수 없습니다.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl"
              >
                취소
              </button>
              <button
                onClick={() => remove(deleteConfirm)}
                className="flex-1 py-3 bg-red-500 text-white text-sm font-semibold rounded-xl"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 추가/수정 모달 */}
      {modal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/40">
          <div
            className="flex-1 flex items-end justify-center sm:items-center"
            onClick={e => { if (e.target === e.currentTarget) setModal(null); }}
          >
            <div className="w-full max-w-[600px] bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* 모달 헤더 */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                <p className="text-sm font-bold text-gray-800">
                  {tab === "pickup" ? "수거지" : "해외 배송지"} {modal === "add" ? "추가" : "수정"}
                </p>
                <button onClick={() => setModal(null)} className="p-1.5 rounded-full hover:bg-gray-100">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              {/* 모달 폼 */}
              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
                {/* 표시명 */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    표시명 <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={form.label ?? ""}
                    onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                    placeholder="예: 집, 회사, 부모님댁"
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                {/* 이름 */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    {tab === "pickup" ? "수거지 담당자" : "수취인 이름"} <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={form.name ?? ""}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="이름 입력"
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                {/* 연락처 */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">연락처</label>
                  <input
                    value={form.phone ?? ""}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder={tab === "pickup" ? "010-0000-0000" : "+81-90-0000-0000"}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                {/* ── 수거지 전용 ── */}
                {tab === "pickup" && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                        주소 <span className="text-red-400">*</span>
                      </label>
                      <div className="flex gap-2 mb-2">
                        <input
                          value={form.zipcode ?? ""}
                          readOnly
                          placeholder="우편번호"
                          className="w-24 bg-gray-50 border border-gray-100 rounded-xl px-3 py-3 text-sm text-gray-500"
                        />
                        <AddressSearchButton
                          label="주소 검색"
                          onSelect={(z, a) => setForm(f => ({ ...f, zipcode: z, address: a, address_detail: "" }))}
                          className="flex-1 bg-blue-600 text-white text-sm font-semibold rounded-xl py-3 flex items-center justify-center gap-1.5"
                        />
                      </div>
                      <input
                        value={form.address ?? ""}
                        readOnly
                        placeholder="도로명 주소"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-500 mb-2"
                      />
                      <input
                        value={form.address_detail ?? ""}
                        onChange={e => setForm(f => ({ ...f, address_detail: e.target.value }))}
                        placeholder="상세주소 (동/호수)"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>
                  </>
                )}

                {/* ── 해외 배송지 전용 ── */}
                {tab === "overseas" && (
                  <>
                    {/* 국가 선택 */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                        국가 <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setCountryOpen(v => !v)}
                          className="w-full flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm"
                        >
                          <span>{selCountry.flag} {selCountry.name} ({selCountry.code})</span>
                          <ChevronDown size={15} className="text-gray-400" />
                        </button>
                        {countryOpen && (
                          <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-lg max-h-44 overflow-y-auto">
                            {COUNTRIES.map(c => (
                              <button
                                key={c.code}
                                type="button"
                                onClick={() => { setForm(f => ({ ...f, country_code: c.code })); setCountryOpen(false); }}
                                className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-blue-50 text-left ${
                                  form.country_code === c.code ? "text-blue-600 font-semibold" : "text-gray-700"
                                }`}
                              >
                                {c.flag} {c.name}
                                <span className="ml-auto text-xs text-gray-400">{c.code}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* 주소 */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                        상세주소 <span className="text-red-400">*</span>
                      </label>
                      <input
                        value={form.overseas_addr3 ?? ""}
                        onChange={e => setForm(f => ({ ...f, overseas_addr3: e.target.value }))}
                        placeholder="Street / 상세주소"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200 mb-2"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={form.overseas_addr2 ?? ""}
                          onChange={e => setForm(f => ({ ...f, overseas_addr2: e.target.value }))}
                          placeholder="시 / City"
                          className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                        />
                        <input
                          value={form.overseas_addr1 ?? ""}
                          onChange={e => setForm(f => ({ ...f, overseas_addr1: e.target.value }))}
                          placeholder="주·도 / State"
                          className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">우편번호</label>
                      <input
                        value={form.overseas_zip ?? ""}
                        onChange={e => setForm(f => ({ ...f, overseas_zip: e.target.value }))}
                        placeholder="Postal code"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">이메일</label>
                      <input
                        type="email"
                        value={form.email ?? ""}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="recipient@example.com"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* 저장 버튼 */}
              <div className="px-5 py-4 border-t border-gray-100 shrink-0">
                <button
                  onClick={save}
                  disabled={saving}
                  className="w-full bg-blue-600 text-white font-semibold py-4 rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  저장하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
