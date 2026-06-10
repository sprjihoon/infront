"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Globe, Star, Plus, ChevronRight, ChevronDown, X, Check, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loadGoogleMapsScript, parsePlaceResult, validateAddressWithGoogle, supportsAddressValidation } from "@/lib/google-places";
import AddressSuggestionDialog from "@/components/ui/AddressSuggestionDialog";

const GMAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

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
  { code: "AE", name: "UAE",          flag: "🇦🇪" },
  { code: "SA", name: "사우디아라비아", flag: "🇸🇦" },
  { code: "IN", name: "인도",         flag: "🇮🇳" },
];

export interface OverseasAddressValue {
  savedId?: string;
  label?: string;
  name: string;
  phone: string;
  countryCode: string;
  addr1: string;
  addr2: string;
  addr3: string;
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
  const [saveOption, setSaveOption] = useState<"save" | "default" | "once">("save");
  const [saving, setSaving] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);

  // Google Places Autocomplete
  const addr3Ref = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [validating, setValidating] = useState(false);
  const [suggestionData, setSuggestionData] = useState<{
    original: { addr3: string; addr2: string; addr1: string; zip: string };
    suggested: { addr3: string; addr2: string; addr1: string; zip: string; formattedAddress?: string };
  } | null>(null);

  useEffect(() => {
    if (!customerId) return;
    loadSaved();
  }, [customerId]);

  // Initialize Google Places Autocomplete when entering new address mode
  const initAutocomplete = useCallback(() => {
    if (!GMAPS_API_KEY || !addr3Ref.current) return;
    loadGoogleMapsScript(GMAPS_API_KEY).then(() => {
      if (!addr3Ref.current || autocompleteRef.current) return;
      const ac = new window.google.maps.places.Autocomplete(addr3Ref.current, {
        types: ["address"],
        componentRestrictions: newVal.countryCode ? { country: newVal.countryCode.toLowerCase() } : undefined,
        fields: ["address_components", "formatted_address"],
      });
      autocompleteRef.current = ac;
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (!place.address_components) return;
        const parsed = parsePlaceResult(place, newVal.countryCode);
        setNewVal((v) => ({
          ...v,
          addr3: parsed.addr3 || v.addr3,
          addr2: parsed.addr2 || v.addr2,
          addr1: parsed.addr1 || v.addr1,
          zip: parsed.zip || v.zip,
        }));
      });
    }).catch(() => {/* ignore if API key is missing */});
  }, [newVal.countryCode]);

  // Re-init autocomplete when mode changes to "new" or country changes
  useEffect(() => {
    if (mode !== "new") {
      autocompleteRef.current = null;
      return;
    }
    // small delay to let the input mount
    const t = setTimeout(() => initAutocomplete(), 100);
    return () => clearTimeout(t);
  }, [mode, initAutocomplete]);

  // Update autocomplete country restriction when country changes
  useEffect(() => {
    if (autocompleteRef.current && newVal.countryCode) {
      autocompleteRef.current.setComponentRestrictions({ country: newVal.countryCode.toLowerCase() });
    }
  }, [newVal.countryCode]);

  const triggerAddressValidation = useCallback(async () => {
    if (!GMAPS_API_KEY) return;
    const { addr3, addr2, addr1, zip, countryCode } = newVal;
    if (!addr3.trim()) return;
    if (!supportsAddressValidation(countryCode)) return;
    setValidating(true);
    try {
      const result = await validateAddressWithGoogle(GMAPS_API_KEY, { addr3, addr2, addr1, zip, countryCode });
      if (result && !result.isSame) {
        setSuggestionData({
          original: { addr3, addr2, addr1, zip },
          suggested: {
            addr3: result.suggestedAddr3,
            addr2: result.suggestedAddr2,
            addr1: result.suggestedAddr1,
            zip: result.suggestedZip,
            formattedAddress: result.formattedAddress,
          },
        });
      }
    } finally {
      setValidating(false);
    }
  }, [newVal]);

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

    try {
      if (saveOption !== "once" && customerId) {
        const supabase = createClient();
        const country = COUNTRIES.find((c) => c.code === newVal.countryCode);
        const isDefault = saveOption === "default" || saved.length === 0;

        if (isDefault && saved.some((a) => a.is_default)) {
          await supabase
            .from("customer_addresses")
            .update({ is_default: false })
            .eq("customer_id", customerId)
            .eq("type", "overseas");
        }

        const defaultLabel = `${country?.name ?? newVal.countryCode} 배송지`;
        const { data } = await supabase
          .from("customer_addresses")
          .insert({
            customer_id: customerId,
            type: "overseas",
            label: (newVal.label ?? "").trim() || defaultLabel,
            name: newVal.name,
            phone: newVal.phone || null,
            country_code: newVal.countryCode,
            overseas_addr1: newVal.addr1 || null,
            overseas_addr2: newVal.addr2 || null,
            overseas_addr3: newVal.addr3,
            overseas_zip: newVal.zip || null,
            email: newVal.email || null,
            is_default: isDefault,
          })
          .select()
          .single();

        onChange({ ...newVal, savedId: data?.id });
        await loadSaved();
      } else {
        onChange({ ...newVal });
      }
    } finally {
      setSaving(false);
      setSheet(false);
      setMode("list");
      setNewVal(EMPTY_NEW());
      setSaveOption("save");
    }
  }

  const countryInfo = value ? COUNTRIES.find((c) => c.code === value.countryCode) : null;
  const newCountryInfo = COUNTRIES.find((c) => c.code === newVal.countryCode);

  return (
    <>
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
            <div className="flex items-center gap-1 shrink-0 text-brand-600 text-xs font-medium mt-0.5">
              <Pencil size={12} />
              변경
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 py-1">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
              <Globe size={18} className="text-violet-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">해외배송지를 선택해주세요</p>
              <p className="text-xs text-gray-400 mt-0.5">저장된 주소 선택 또는 새로 입력</p>
            </div>
            <ChevronRight size={16} className="text-gray-300 ml-auto" />
          </div>
        )}
      </button>

      {suggestionData && (
        <AddressSuggestionDialog
          original={suggestionData.original}
          suggested={suggestionData.suggested}
          onKeepOriginal={() => setSuggestionData(null)}
          onUseSuggested={() => {
            setNewVal((v) => ({
              ...v,
              addr3: suggestionData.suggested.addr3 || v.addr3,
              addr2: suggestionData.suggested.addr2 || v.addr2,
              addr1: suggestionData.suggested.addr1 || v.addr1,
              zip: suggestionData.suggested.zip || v.zip,
            }));
            setSuggestionData(null);
          }}
        />
      )}

      {sheet && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center px-4"
          onClick={(e) => { if (e.target === e.currentTarget) { setSheet(false); setMode("list"); setNewVal(EMPTY_NEW()); setSaveOption("save"); } }}
        >
          <div className="w-full max-w-[560px] bg-white rounded-3xl overflow-hidden flex flex-col max-h-[80vh] shadow-2xl">
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
                  ? <span className="text-xs text-brand-500 font-medium px-1">← 목록</span>
                  : <X size={18} className="text-gray-500" />}
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {mode === "list" && (
                <div className="p-4 space-y-2">
                  {saved.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Globe size={32} className="mx-auto mb-2 text-gray-200" />
                      <p className="text-sm">저장된 해외 배송지가 없어요</p>
                      <p className="text-xs mt-1">새 주소를 등록해보세요</p>
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

                  <button
                    type="button"
                    onClick={() => { setNewVal(EMPTY_NEW()); setSaveOption("save"); setMode("new"); }}
                    className="w-full flex items-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 p-4 text-left hover:border-violet-300 hover:bg-violet-50 transition-all active:scale-[0.98]"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                      <Plus size={18} className="text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">새 해외 배송지 입력</p>
                      <p className="text-xs text-gray-400 mt-0.5">주소록에 저장하거나 일회성으로 입력</p>
                    </div>
                  </button>
                </div>
              )}

              {mode === "new" && (
                <div className="p-4 space-y-4">
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
                                newVal.countryCode === c.code ? "text-brand-600 font-semibold" : "text-gray-700"
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

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">연락처</label>
                    <input
                      value={newVal.phone}
                      onChange={(e) => setNewVal((v) => ({ ...v, phone: e.target.value }))}
                      placeholder="+81-90-0000-0000"
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                      상세주소 (Street) <span className="text-red-400">*</span>
                    </label>
                    <input
                      ref={addr3Ref}
                      value={newVal.addr3}
                      onChange={(e) => setNewVal((v) => ({ ...v, addr3: e.target.value }))}
                      onBlur={() => { if (newVal.addr3.trim()) triggerAddressValidation(); }}
                      placeholder="1-1-1 Shibuya, Apt 101"
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                      autoComplete="off"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                        시 (City)
                        {validating && <span className="ml-1 text-violet-400 font-normal">확인 중...</span>}
                      </label>
                      <input
                        value={newVal.addr2}
                        onChange={(e) => setNewVal((v) => ({ ...v, addr2: e.target.value }))}
                        placeholder="Shibuya-ku"
                        className={`w-full bg-gray-50 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 transition-colors ${
                          validating ? "border-violet-200 bg-violet-50/30" : "border-gray-100"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">도/주 (State)</label>
                      <input
                        value={newVal.addr1}
                        onChange={(e) => setNewVal((v) => ({ ...v, addr1: e.target.value }))}
                        placeholder="Tokyo"
                        className={`w-full bg-gray-50 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 transition-colors ${
                          validating ? "border-violet-200 bg-violet-50/30" : "border-gray-100"
                        }`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">우편번호</label>
                      <input
                        value={newVal.zip}
                        onChange={(e) => setNewVal((v) => ({ ...v, zip: e.target.value }))}
                        onBlur={() => { if (newVal.addr3.trim()) triggerAddressValidation(); }}
                        placeholder="150-0002"
                        className={`w-full bg-gray-50 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 transition-colors ${
                          validating ? "border-violet-200 bg-violet-50/30" : "border-gray-100"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">이메일</label>
                      <input
                        value={newVal.email}
                        onChange={(e) => setNewVal((v) => ({ ...v, email: e.target.value }))}
                        placeholder="example@email.com"
                        type="email"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500">저장 방식</p>

                    <button
                      type="button"
                      onClick={() => setSaveOption("save")}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all ${
                        saveOption === "save" ? "border-violet-400 bg-violet-50" : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        saveOption === "save" ? "border-violet-500 bg-violet-500" : "border-gray-300"
                      }`}>
                        {saveOption === "save" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-sm font-semibold text-gray-800">주소록에 저장</p>
                        <p className="text-xs text-gray-500 mt-0.5">별칭을 지정해 다음에도 빠르게 선택</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSaveOption("default")}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all ${
                        saveOption === "default" ? "border-amber-400 bg-amber-50" : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        saveOption === "default" ? "border-amber-500 bg-amber-500" : "border-gray-300"
                      }`}>
                        {saveOption === "default" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div className="text-left flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-gray-800">기본 주소로 저장</p>
                          <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                            <Star size={9} fill="currentColor" /> 기본
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">앱을 열 때마다 자동으로 선택됩니다</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSaveOption("once")}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all ${
                        saveOption === "once" ? "border-gray-400 bg-gray-50" : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        saveOption === "once" ? "border-gray-500 bg-gray-500" : "border-gray-300"
                      }`}>
                        {saveOption === "once" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-sm font-semibold text-gray-800">저장하지 않고 사용</p>
                        <p className="text-xs text-gray-500 mt-0.5">이번 신청에만 사용하고 저장하지 않음</p>
                      </div>
                    </button>

                    {(saveOption === "save" || saveOption === "default") && (
                      <div className="pt-1">
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                          별칭 <span className="text-gray-400 font-normal">(예: 일본 집, 도쿠 오피스)</span>
                        </label>
                        <input
                          value={newVal.label ?? ""}
                          onChange={(e) => setNewVal((v) => ({ ...v, label: e.target.value }))}
                          placeholder={saveOption === "default" ? "기본주소" : "일본 집"}
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

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
                    <><Check size={16} /> 이 주소로 배송 신청</>
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
