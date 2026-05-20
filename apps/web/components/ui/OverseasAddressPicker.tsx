"use client";

import { useState, useEffect } from "react";
import { Globe, Star, Plus, ChevronRight, ChevronDown, X, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export const COUNTRIES = [
  { code: "JP", name: "일본",         flag: "🇯🇵" },
  { code: "CN", name: "중국",         flag: "🇨🇳" },
  { code: "US", name: "미국",         flag: "🇺🇸" },
  { code: "AU", name: "호주",         flag: "🇦🇺" },
  { code: "CA", name: "캐나다",       flag: "🇨🇦" },
  { code: "GB", name: "영국",         flag: "🇬🇧" },
  { code: "DE", name: "독일",         flag: "🇩🇪" },
  { code: "FR", name: "프랑스",       flag: "🇫🇷" },
  { code: "SG", name: "싱가포르",     flag: "🇸🇬" },
  { code: "HK", name: "홍콩",         flag: "🇭🇰" },
  { code: "TW", name: "대만",         flag: "🇹🇼" },
  { code: "TH", name: "태국",         flag: "🇹🇭" },
  { code: "VN", name: "베트남",       flag: "🇻🇳" },
  { code: "PH", name: "필리핀",       flag: "🇵🇭" },
  { code: "MY", name: "말레이시아",   flag: "🇲🇾" },
  { code: "ID", name: "인도네시아",   flag: "🇮🇩" },
  { code: "MO", name: "마카오",       flag: "🇲🇴" },
  { code: "MN", name: "몽골",         flag: "🇲🇳" },
  { code: "NZ", name: "뉴질랜드",     flag: "🇳🇿" },
  { code: "IT", name: "이탈리아",     flag: "🇮🇹" },
  { code: "ES", name: "스페인",       flag: "🇪🇸" },
  { code: "NL", name: "네덜란드",     flag: "🇳🇱" },
  { code: "SE", name: "스웨덴",       flag: "🇸🇪" },
  { code: "CH", name: "스위스",       flag: "🇨🇭" },
  { code: "RU", name: "러시아",       flag: "🇷🇺" },
  { code: "BR", name: "브라질",       flag: "🇧🇷" },
  { code: "MX", name: "멕시코",       flag: "🇲🇽" },
  { code: "AE", name: "아랍에미리트", flag: "🇦🇪" },
  { code: "SA", name: "사우디아라비아",flag:"🇸🇦" },
  { code: "IN", name: "인도",         flag: "🇮🇳" },
];

export interface OverseasAddressValue {
  savedId?: string;
  label?: string;
  name: string;
  phone: string;
  countryCode: string;
  addr1: string;   // State / Province
  addr2: string;   // City
  addr3: string;   // Street / 상세주소
  zip: string;
  email: string;
}

interface SavedAddress {
  id: string;
  label: string;
  name: string;
  phone: string | null;
  country_code: string;
  overseas_addr1: string | null;
  overseas_addr2: string | null;
  overseas_addr3: string | null;
  overseas_zip: string | null;
  email: string | null;
  is_default: boolean;
}

interface Props {
  value: OverseasAddressValue | null;
  onChange: (v: OverseasAddressValue) => void;
  customerId: string | null;
}

const EMPTY_NEW = (): OverseasAddressValue => ({
  name: "", phone: "", countryCode: "JP",
  addr1: "", addr2: "", addr3: "", zip: "", email: "",
});

export default function OverseasAddressPicker({ value, onChange, customerId }: Props) {
  const [sheet, setSheet] = useState(false);
  const [saved, setSaved] = useState<SavedAddress[]>([]);
  const [mode, setMode] = useState<"list" | "new">("list");

  const [newVal, setNewVal] = useState<OverseasAddressValue>(EMPTY_NEW());
  const [saveToBook, setSaveToBook] = useState(true);
  const [saving, setSaving] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    loadSaved();
  }, [customerId]);

  async function loadSaved() {
    if (!customerId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("customer_addresses")
      .select("id, label, name, phone, country_code, overseas_addr1, overseas_addr2, overseas_addr3, overseas_zip, email, is_default")
      .eq("customer_id", customerId)
      .eq("type", "overseas")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    setSaved(data ?? []);

    // 기본 주소 자동 채움
    if (!value && data && data.length > 0) {
      const def = data.find((a) => a.is_default) ?? data[0];
      onChange(toValue(def));
    }
  }

  function toValue(a: SavedAddress): OverseasAddressValue {
    return {
      savedId: a.id,
      label: a.label,
      name: a.name,
      phone: a.phone ?? "",
      countryCode: a.country_code,
      addr1: a.overseas_addr1 ?? "",
      addr2: a.overseas_addr2 ?? "",
      addr3: a.overseas_addr3 ?? "",
      zip: a.overseas_zip ?? "",
      email: a.email ?? "",
    };
  }

  function selectSaved(a: SavedAddress) {
    onChange(toValue(a));
    setSheet(false);
  }

  async function confirmNew() {
    if (!newVal.name || !newVal.addr3) return;
    setSaving(true);

    if (saveToBook && customerId) {
      const supabase = createClient();
      const country = COUNTRIES.find((c) => c.code === newVal.countryCode);
      const { data } = await supabase
        .from("customer_addresses")
        .insert({
          customer_id: customerId,
          type: "overseas",
          label: newVal.label || `${country?.name ?? newVal.countryCode} 배송지`,
          name: newVal.name,
          phone: newVal.phone || null,
          country_code: newVal.countryCode,
          overseas_addr1: newVal.addr1 || null,
          overseas_addr2: newVal.addr2 || null,
          overseas_addr3: newVal.addr3,
          overseas_zip: newVal.zip || null,
          email: newVal.email || null,
          is_default: saved.length === 0,
        })
        .select()
        .single();

      onChange({ ...newVal, savedId: data?.id });
      await loadSaved();
    } else {
      onChange({ ...newVal });
    }

    setSaving(false);
    setSheet(false);
    setMode("list");
    setNewVal(EMPTY_NEW());
  }

  function openNew() {
    setNewVal(EMPTY_NEW());
    setSaveToBook(true);
    setMode("new");
  }

  const countryInfo = value ? COUNTRIES.find((c) => c.code === value.countryCode) : null;
  const newCountryInfo = COUNTRIES.find((c) => c.code === newVal.countryCode);

  return (
    <>
      {/* 선택된 주소 카드 */}
      <button
        type="button"
        onClick={() => { setMode("list"); setSheet(true); }}
        className={`w-full text-left rounded-2xl border-2 p-4 transition-all active:scale-[0.98] ${
          value
            ? "bg-white border-violet-200 shadow-sm"
            : "bg-gray-50 border-dashed border-gray-300"
        }`}
      >
        {value ? (
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                {value.label && (
                  <span className="text-xs font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full shrink-0">
                    {value.label}
                  </span>
                )}
                <span className="text-sm font-semibold text-gray-900">
                  {countryInfo?.flag} {value.name}
                </span>
                {value.phone && (
                  <span className="text-sm text-gray-500 shrink-0">{value.phone}</span>
                )}
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                {value.addr3}
                {value.addr2 ? `, ${value.addr2}` : ""}
                {value.addr1 ? `, ${value.addr1}` : ""}
                {value.zip ? ` (${value.zip})` : ""}
              </p>
              {value.email && (
                <p className="text-xs text-gray-400 mt-0.5">{value.email}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0 text-violet-600 text-xs font-medium mt-0.5">
              <Globe size={12} />
              변경
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 py-1">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
              <Globe size={18} className="text-violet-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">해외 배송지를 선택해주세요</p>
              <p className="text-xs text-gray-400 mt-0.5">저장된 주소 선택 또는 새로 입력</p>
            </div>
            <ChevronRight size={16} className="text-gray-300 ml-auto" />
          </div>
        )}
      </button>

      {/* 바텀시트 */}
      {sheet && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) { setSheet(false); setMode("list"); } }}
        >
          <div className="w-full max-w-[430px] bg-white rounded-t-3xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <p className="text-sm font-bold text-gray-900">
                {mode === "list" ? "해외 배송지 선택" : "새 해외 배송지 등록"}
              </p>
              <button
                onClick={() => {
                  if (mode === "new") setMode("list");
                  else { setSheet(false); }
                }}
                className="p-1.5 rounded-full hover:bg-gray-100 flex items-center"
              >
                {mode === "new"
                  ? <span className="text-xs text-gray-500 px-1">← 목록</span>
                  : <X size={18} className="text-gray-500" />}
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {/* 목록 모드 */}
              {mode === "list" && (
                <div className="p-4 space-y-2">
                  {saved.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Globe size={32} className="mx-auto mb-2 text-gray-200" />
                      <p className="text-sm">저장된 해외 배송지가 없어요</p>
                      <p className="text-xs mt-1">새 배송지를 등록해보세요</p>
                    </div>
                  ) : (
                    saved.map((a) => {
                      const c = COUNTRIES.find((cc) => cc.code === a.country_code);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => selectSaved(a)}
                          className={`w-full text-left rounded-2xl border-2 p-4 transition-all active:scale-[0.98] ${
                            value?.savedId === a.id
                              ? "border-violet-500 bg-violet-50"
                              : "border-gray-100 bg-gray-50 hover:border-violet-200 hover:bg-violet-50"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-xs font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full shrink-0">
                                  {a.label}
                                </span>
                                {a.is_default && (
                                  <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0">
                                    <Star size={9} fill="currentColor" /> 기본
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-semibold text-gray-900">
                                {c?.flag} {a.name}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                                {a.overseas_addr3}
                                {a.overseas_addr2 ? `, ${a.overseas_addr2}` : ""}
                                {a.overseas_zip ? ` (${a.overseas_zip})` : ""}
                              </p>
                              {a.phone && <p className="text-xs text-gray-400 mt-0.5">{a.phone}</p>}
                            </div>
                            {value?.savedId === a.id && (
                              <div className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center shrink-0 mt-0.5">
                                <Check size={12} className="text-white" />
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}

                  {/* 새 주소 추가 버튼 */}
                  <button
                    type="button"
                    onClick={openNew}
                    className="w-full flex items-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 p-4 text-left hover:border-violet-300 hover:bg-violet-50 transition-all active:scale-[0.98]"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                      <Plus size={18} className="text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">새 해외 배송지 등록</p>
                      <p className="text-xs text-gray-400 mt-0.5">주소록에 저장하거나 일회성으로 입력</p>
                    </div>
                  </button>
                </div>
              )}

              {/* 새 주소 입력 모드 */}
              {mode === "new" && (
                <div className="p-4 space-y-4">
                  {/* 별칭 */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                      별칭 <span className="text-gray-400 font-normal">(예: 일본 친구, 도쿄 자택)</span>
                    </label>
                    <input
                      value={newVal.label ?? ""}
                      onChange={(e) => setNewVal((v) => ({ ...v, label: e.target.value }))}
                      placeholder="도쿄 자택"
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                    />
                  </div>

                  {/* 국가 */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                      국가 <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setCountryOpen((v) => !v)}
                        className="w-full flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm"
                      >
                        <span>{newCountryInfo?.flag} {newCountryInfo?.name} ({newVal.countryCode})</span>
                        <ChevronDown size={15} className="text-gray-400" />
                      </button>
                      {countryOpen && (
                        <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-lg max-h-44 overflow-y-auto">
                          {COUNTRIES.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => { setNewVal((v) => ({ ...v, countryCode: c.code })); setCountryOpen(false); }}
                              className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-violet-50 text-left ${
                                newVal.countryCode === c.code ? "text-violet-600 font-semibold" : "text-gray-700"
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

                  {/* 수취인 */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                      수취인 이름 <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={newVal.name}
                      onChange={(e) => setNewVal((v) => ({ ...v, name: e.target.value }))}
                      placeholder="Gildong Hong"
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                    />
                  </div>

                  {/* 연락처 */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">연락처</label>
                    <input
                      value={newVal.phone}
                      onChange={(e) => setNewVal((v) => ({ ...v, phone: e.target.value }))}
                      placeholder="+81-90-0000-0000"
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                    />
                  </div>

                  {/* 상세주소 */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                      상세주소 (Street) <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={newVal.addr3}
                      onChange={(e) => setNewVal((v) => ({ ...v, addr3: e.target.value }))}
                      placeholder="1-1-1 Shibuya, Apt 101"
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                    />
                  </div>

                  {/* 시/도 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">시 (City)</label>
                      <input
                        value={newVal.addr2}
                        onChange={(e) => setNewVal((v) => ({ ...v, addr2: e.target.value }))}
                        placeholder="Tokyo"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">주·도 (State)</label>
                      <input
                        value={newVal.addr1}
                        onChange={(e) => setNewVal((v) => ({ ...v, addr1: e.target.value }))}
                        placeholder="Tokyo-to"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                      />
                    </div>
                  </div>

                  {/* 우편번호 + 이메일 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">우편번호</label>
                      <input
                        value={newVal.zip}
                        onChange={(e) => setNewVal((v) => ({ ...v, zip: e.target.value }))}
                        placeholder="100-0001"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">이메일</label>
                      <input
                        type="email"
                        value={newVal.email}
                        onChange={(e) => setNewVal((v) => ({ ...v, email: e.target.value }))}
                        placeholder="user@example.com"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                      />
                    </div>
                  </div>

                  {/* 주소록 저장 토글 */}
                  <button
                    type="button"
                    onClick={() => setSaveToBook(!saveToBook)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all ${
                      saveToBook ? "border-violet-400 bg-violet-50" : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      saveToBook ? "bg-violet-600 border-violet-600" : "border-gray-300"
                    }`}>
                      {saveToBook && <Check size={12} className="text-white" />}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-800">주소록에 저장</p>
                      <p className="text-xs text-gray-500 mt-0.5">다음에도 빠르게 선택할 수 있어요</p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* 확인 버튼 */}
            {mode === "new" && (
              <div className="px-4 pb-6 pt-3 border-t border-gray-100 shrink-0">
                <button
                  type="button"
                  disabled={saving || !newVal.name || !newVal.addr3}
                  onClick={confirmNew}
                  className="w-full bg-violet-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-transform"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><Check size={16} /> 이 주소로 선택</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
