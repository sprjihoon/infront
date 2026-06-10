"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, MapPin, Globe, Star, Pencil, Trash2,
  Phone, Mail, X, Check, ChevronDown,
} from "lucide-react";
import {
  normalizeEpostZip,
  normalizeEpostAddr1,
  inferPickupAddressDetail,
  validatePickupAddressDetail,
  isValidPickupAddressDetail,
} from "@/lib/epost/client";
import { createClient } from "@/lib/supabase/client";
import { AddressSearchButton } from "@/components/ui/AddressSearchButton";
import { loadGoogleMapsScript, parsePlaceResult, validateAddressWithGoogle, supportsAddressValidation } from "@/lib/google-places";
import AddressSuggestionDialog from "@/components/ui/AddressSuggestionDialog";

const GMAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

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

// 주요 수요 국가 순위 (상단 고정)
const PRIORITY_CODES = [
  "JP","CN","US","HK","TW","SG","AU","CA","GB","DE",
  "FR","VN","TH","PH","MY","ID","MO","MN","NZ","IT",
  "ES","NL","SE","CH","RU","BR","MX","AE","SA","IN",
];

// EMS 국가코드 → 한글명·이모지 매핑 (없으면 영문명 fallback)
const KO_NAME: Record<string, string> = {
  JP:"일본",CN:"중국",US:"미국",AU:"호주",CA:"캐나다",GB:"영국",DE:"독일",
  FR:"프랑스",SG:"싱가포르",HK:"홍콩",TW:"대만",TH:"태국",VN:"베트남",
  PH:"필리핀",MY:"말레이시아",ID:"인도네시아",MO:"마카오",MN:"몽골",
  NZ:"뉴질랜드",IT:"이탈리아",ES:"스페인",NL:"네덜란드",SE:"스웨덴",
  CH:"스위스",RU:"러시아",BR:"브라질",MX:"멕시코",AE:"아랍에미리트",
  SA:"사우디아라비아",IN:"인도",AT:"오스트리아",BE:"벨기에",DK:"덴마크",
  FI:"핀란드",GR:"그리스",HU:"헝가리",IE:"아일랜드",NO:"노르웨이",
  PL:"폴란드",PT:"포르투갈",RO:"루마니아",CZ:"체코",TR:"튀르키예",
  UA:"우크라이나",IL:"이스라엘",EG:"이집트",ZA:"남아프리카공화국",
  NG:"나이지리아",KE:"케냐",MA:"모로코",AR:"아르헨티나",CL:"칠레",
  CO:"콜롬비아",PE:"페루",VE:"베네수엘라",KZ:"카자흐스탄",UZ:"우즈베키스탄",
  KH:"캄보디아",MM:"미얀마",LA:"라오스",BD:"방글라데시",LK:"스리랑카",
  NP:"네팔",PK:"파키스탄",KW:"쿠웨이트",QA:"카타르",BH:"바레인",
  JO:"요르단",OM:"오만",NR:"나우루",PW:"팔라우",FJ:"피지",
  WS:"사모아",TO:"통가",VU:"바누아투",PG:"파푸아뉴기니",
};

const FLAG: Record<string, string> = {
  JP:"🇯🇵",CN:"🇨🇳",US:"🇺🇸",AU:"🇦🇺",CA:"🇨🇦",GB:"🇬🇧",DE:"🇩🇪",
  FR:"🇫🇷",SG:"🇸🇬",HK:"🇭🇰",TW:"🇹🇼",TH:"🇹🇭",VN:"🇻🇳",PH:"🇵🇭",
  MY:"🇲🇾",ID:"🇮🇩",MO:"🇲🇴",MN:"🇲🇳",NZ:"🇳🇿",IT:"🇮🇹",ES:"🇪🇸",
  NL:"🇳🇱",SE:"🇸🇪",CH:"🇨🇭",RU:"🇷🇺",BR:"🇧🇷",MX:"🇲🇽",AE:"🇦🇪",
  SA:"🇸🇦",IN:"🇮🇳",AT:"🇦🇹",BE:"🇧🇪",DK:"🇩🇰",FI:"🇫🇮",GR:"🇬🇷",
  HU:"🇭🇺",IE:"🇮🇪",NO:"🇳🇴",PL:"🇵🇱",PT:"🇵🇹",RO:"🇷🇴",CZ:"🇨🇿",
  TR:"🇹🇷",UA:"🇺🇦",IL:"🇮🇱",EG:"🇪🇬",ZA:"🇿🇦",NG:"🇳🇬",KE:"🇰🇪",
  MA:"🇲🇦",AR:"🇦🇷",CL:"🇨🇱",CO:"🇨🇴",PE:"🇵🇪",VE:"🇻🇪",KZ:"🇰🇿",
  UZ:"🇺🇿",KH:"🇰🇭",MM:"🇲🇲",LA:"🇱🇦",BD:"🇧🇩",LK:"🇱🇰",NP:"🇳🇵",
  PK:"🇵🇰",KW:"🇰🇼",QA:"🇶🇦",BH:"🇧🇭",JO:"🇯🇴",OM:"🇴🇲",
};

interface Country { code: string; name: string; flag: string; isPriority: boolean; }

function buildCountryList(emsCodes: string[]): Country[] {
  const set = new Set(emsCodes.length > 0 ? emsCodes : PRIORITY_CODES);
  const all = Array.from(set).map(code => ({
    code,
    name: KO_NAME[code] ?? code,
    flag: FLAG[code] ?? "🌐",
    isPriority: PRIORITY_CODES.includes(code),
  }));
  const priority = PRIORITY_CODES.filter(c => set.has(c)).map(code => ({
    code, name: KO_NAME[code] ?? code, flag: FLAG[code] ?? "🌐", isPriority: true,
  }));
  const rest = all
    .filter(c => !PRIORITY_CODES.includes(c.code))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return [...priority, ...rest];
}

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
  const [countrySearch, setCountrySearch] = useState("");
  const [countries, setCountries] = useState<Country[]>(() => buildCountryList([]));

  // Google Places Autocomplete (overseas address)
  const addr3InputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [addrValidating, setAddrValidating] = useState(false);
  const [addrSuggestion, setAddrSuggestion] = useState<{
    original: { addr3: string; addr2: string; addr1: string; zip: string };
    suggested: { addr3: string; addr2: string; addr1: string; zip: string; formattedAddress?: string };
  } | null>(null);

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

  // EMS 지원 국가 목록 로드
  useEffect(() => {
    fetch("/api/ems/nations?premiumcd=31")
      .then(r => r.json())
      .then((data: { nationcd: string }[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setCountries(buildCountryList(data.map(d => d.nationcd)));
        }
      })
      .catch(() => {});
  }, []);

  const filteredCountries = countrySearch.trim()
    ? countries.filter(c =>
        c.name.includes(countrySearch) ||
        c.code.toUpperCase().includes(countrySearch.toUpperCase())
      )
    : countries;

  const filtered = addresses.filter(a => a.type === tab);

  // ── 저장 ────────────────────────────────────────────────
  async function save() {
    if (!customerId) return;
    if (!form.label?.trim()) { alert("표시명을 입력해주세요."); return; }
    if (!form.name?.trim())  { alert("이름을 입력해주세요."); return; }
    if (tab === "overseas" && /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(form.name ?? "")) {
      if (!confirm("수취인 이름에 한글이 포함되어 있습니다.\n해외 배송 시 영문 이름이 필요합니다.\n그래도 저장하시겠습니까?")) return;
    }
    if (tab === "pickup" && normalizeEpostAddr1(form.address).length < 2) {
      alert("주소를 검색해주세요.");
      return;
    }
    if (tab === "pickup" && normalizeEpostZip(form.zipcode).length !== 5) {
      alert("우편번호가 없습니다. 주소 검색으로 다시 선택해주세요.");
      return;
    }
    if (tab === "pickup") {
      const effectiveDetail = inferPickupAddressDetail(
        form.address,
        form.address_detail,
      );
      const detailErr = validatePickupAddressDetail(
        effectiveDetail.length >= 2 ? effectiveDetail : form.address_detail,
      );
      if (detailErr) {
        alert(detailErr);
        return;
      }
    }
    if (tab === "overseas" && !form.overseas_addr3?.trim()) { alert("상세주소를 입력해주세요."); return; }

    setSaving(true);
    const payload = {
      ...form,
      customer_id: customerId,
      type: tab,
      ...(tab === "pickup"
        ? {
            zipcode: normalizeEpostZip(form.zipcode),
            address: normalizeEpostAddr1(form.address),
          }
        : {}),
    };

    if (form.is_default) {
      await supabase.from("customer_addresses")
        .update({ is_default: false })
        .eq("customer_id", customerId).eq("type", tab);
    }

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

  // Initialize autocomplete for overseas addr3 input
  const initOverseasAutocomplete = useCallback(() => {
    if (!GMAPS_API_KEY || !addr3InputRef.current) return;
    loadGoogleMapsScript(GMAPS_API_KEY).then(() => {
      if (!addr3InputRef.current || autocompleteRef.current) return;
      const countryCode = form.country_code ?? "JP";
      const ac = new window.google.maps.places.Autocomplete(addr3InputRef.current, {
        types: ["address"],
        componentRestrictions: { country: countryCode.toLowerCase() },
        fields: ["address_components", "formatted_address"],
      });
      autocompleteRef.current = ac;
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (!place.address_components) return;
        const parsed = parsePlaceResult(place, countryCode);
        setForm((f) => ({
          ...f,
          overseas_addr3: parsed.addr3 || f.overseas_addr3,
          overseas_addr2: parsed.addr2 || f.overseas_addr2,
          overseas_addr1: parsed.addr1 || f.overseas_addr1,
          overseas_zip: parsed.zip || f.overseas_zip,
        }));
      });
    }).catch(() => {});
  }, [form.country_code]);

  // Re-init autocomplete when modal opens in overseas mode or country changes
  useEffect(() => {
    if (modal && tab === "overseas") {
      autocompleteRef.current = null;
      const t = setTimeout(() => initOverseasAutocomplete(), 150);
      return () => clearTimeout(t);
    } else {
      autocompleteRef.current = null;
    }
  }, [modal, tab, initOverseasAutocomplete]);

  useEffect(() => {
    if (autocompleteRef.current && form.country_code) {
      autocompleteRef.current.setComponentRestrictions({ country: form.country_code.toLowerCase() });
    }
  }, [form.country_code]);

  const triggerOverseasValidation = useCallback(async () => {
    if (!GMAPS_API_KEY) return;
    const addr3 = form.overseas_addr3 ?? "";
    if (!addr3.trim()) return;
    if (!supportsAddressValidation(form.country_code ?? "")) return;
    const addr2 = form.overseas_addr2 ?? "";
    const addr1 = form.overseas_addr1 ?? "";
    const zip = form.overseas_zip ?? "";
    const countryCode = form.country_code ?? "JP";
    setAddrValidating(true);
    try {
      const result = await validateAddressWithGoogle(GMAPS_API_KEY, { addr3, addr2, addr1, zip, countryCode });
      if (result && !result.isSame) {
        setAddrSuggestion({
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
      setAddrValidating(false);
    }
  }, [form.overseas_addr3, form.overseas_addr2, form.overseas_addr1, form.overseas_zip, form.country_code]);

  const selCountry = countries.find(c => c.code === form.country_code) ?? countries[0];

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
            className="ml-auto flex items-center gap-1 bg-brand-600 text-white text-xs font-semibold px-3 py-2 rounded-xl"
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
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-violet-600 text-white shadow-sm"
                  : "text-gray-400"
              }`}
            >
              {t === "pickup" ? <><MapPin size={14} /> 국내 주소</> : <><Globe size={14} /> 해외 주소</>}
            </button>
          ))}
        </div>

        {/* 주소 목록 */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center px-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
              tab === "pickup" ? "bg-brand-50" : "bg-violet-50"
            }`}>
              {tab === "pickup"
                ? <MapPin size={28} className="text-brand-300" />
                : <Globe size={28} className="text-violet-300" />}
            </div>
            <p className="text-base font-semibold text-gray-700 mb-1">
              {tab === "pickup" ? "저장된 국내 주소가 없어요" : "저장된 해외 주소가 없어요"}
            </p>
            <p className="text-xs text-gray-400 mb-6 leading-relaxed">
              {tab === "pickup"
                ? "국내 수거·배송 주소를 저장해두면\n수거 신청·국내 배송 시 빠르게 선택할 수 있어요."
                : "자주 발송하는 해외 수취인 주소를\n저장해두면 발송 시 바로 선택할 수 있어요."}
            </p>
            <button
              onClick={openAdd}
              className={`flex items-center gap-2 text-white text-sm font-semibold px-6 py-3 rounded-2xl shadow-sm ${
                tab === "pickup" ? "bg-brand-600" : "bg-violet-600"
              }`}
            >
              <Plus size={16} />
              {tab === "pickup" ? "국내 주소 추가하기" : "해외 주소 추가하기"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(addr => (
              <div
                key={addr.id}
                className={`bg-white rounded-2xl p-4 shadow-sm border-2 transition-all ${
                  addr.is_default
                    ? tab === "pickup" ? "border-brand-200" : "border-violet-200"
                    : "border-transparent"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      tab === "pickup"
                        ? "bg-brand-100 text-brand-700"
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
                    {FLAG[addr.country_code ?? ""] ?? "🌐"}{" "}
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

      {/* 구글 추천 주소 다이얼로그 */}
      {addrSuggestion && (
        <AddressSuggestionDialog
          original={addrSuggestion.original}
          suggested={addrSuggestion.suggested}
          onKeepOriginal={() => setAddrSuggestion(null)}
          onUseSuggested={() => {
            setForm((f) => ({
              ...f,
              overseas_addr3: addrSuggestion.suggested.addr3 || f.overseas_addr3,
              overseas_addr2: addrSuggestion.suggested.addr2 || f.overseas_addr2,
              overseas_addr1: addrSuggestion.suggested.addr1 || f.overseas_addr1,
              overseas_zip: addrSuggestion.suggested.zip || f.overseas_zip,
            }));
            setAddrSuggestion(null);
          }}
        />
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
                  {tab === "pickup" ? "국내배송지" : "해외 배송지"} {modal === "add" ? "추가" : "수정"}
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
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200"
                  />
                </div>

                {/* 이름 */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    {tab === "pickup" ? "수취인 이름" : "수취인 이름 (영문)"} <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={form.name ?? ""}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder={tab === "overseas" ? "Recipient Name (English)" : "이름 입력"}
                    className={`w-full bg-gray-50 border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200 ${
                      tab === "overseas" && /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(form.name ?? "")
                        ? "border-amber-300 ring-1 ring-amber-100"
                        : "border-gray-100"
                    }`}
                  />
                  {tab === "overseas" && /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(form.name ?? "") && (
                    <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                      ⚠️ 해외 배송 수취인 이름은 <strong>영문</strong>으로 입력해주세요. (예: Hong Gil Dong)
                    </p>
                  )}
                </div>

                {/* 연락처 */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">연락처</label>
                  <input
                    value={form.phone ?? ""}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder={tab === "pickup" ? "010-0000-0000" : "+81-90-0000-0000"}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200"
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
                          className="flex-1 bg-brand-600 text-white text-sm font-semibold rounded-xl py-3 flex items-center justify-center gap-1.5"
                        />
                      </div>
                      <input
                        value={form.address ?? ""}
                        readOnly
                        placeholder="도로명 주소 (주소 검색 후 자동 입력)"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-500 mb-2"
                      />
                      <input
                        value={form.address_detail ?? ""}
                        onChange={e => setForm(f => ({ ...f, address_detail: e.target.value }))}
                        placeholder="상세주소 (동·호수, 층) * — 예: 3층, 302호"
                        className={`w-full bg-gray-50 border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200 ${
                          (form.address_detail ?? "").trim().length > 0 &&
                          !isValidPickupAddressDetail(form.address_detail)
                            ? "border-red-300 ring-1 ring-red-100"
                            : "border-gray-100"
                        }`}
                      />
                      {(form.address_detail ?? "").trim().length > 0 &&
                        validatePickupAddressDetail(form.address_detail) && (
                        <p className="text-xs text-red-500 mt-1">
                          {validatePickupAddressDetail(form.address_detail)}
                        </p>
                      )}
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
                          onClick={() => { setCountryOpen(v => !v); setCountrySearch(""); }}
                          className="w-full flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm"
                        >
                          <span>{selCountry.flag} {selCountry.name} ({selCountry.code})</span>
                          <ChevronDown size={15} className="text-gray-400" />
                        </button>
                        {countryOpen && (
                          <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-lg flex flex-col max-h-64">
                            <div className="px-3 py-2 border-b border-gray-100 shrink-0">
                              <input
                                autoFocus
                                value={countrySearch}
                                onChange={e => setCountrySearch(e.target.value)}
                                placeholder="국가 검색..."
                                className="w-full bg-gray-50 rounded-lg px-3 py-1.5 text-sm outline-none"
                              />
                            </div>
                            <div className="overflow-y-auto flex-1">
                              {filteredCountries.map((c, idx) => {
                                const prevIsPriority = idx > 0 ? filteredCountries[idx - 1].isPriority : true;
                                const showDivider = !countrySearch && !c.isPriority && prevIsPriority;
                                return (
                                  <div key={c.code}>
                                    {showDivider && (
                                      <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-50">
                                        <span className="text-[10px] text-gray-400 font-semibold tracking-wide">기타 국가</span>
                                      </div>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setForm(f => ({ ...f, country_code: c.code }));
                                        setCountryOpen(false);
                                        setCountrySearch("");
                                      }}
                                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-brand-50 text-left ${
                                        form.country_code === c.code ? "text-brand-600 font-semibold" : "text-gray-700"
                                      }`}
                                    >
                                      {c.flag} {c.name}
                                      <span className="ml-auto text-xs text-gray-400">{c.code}</span>
                                    </button>
                                  </div>
                                );
                              })}
                              {filteredCountries.length === 0 && (
                                <p className="text-center text-xs text-gray-400 py-4">검색 결과 없음</p>
                              )}
                            </div>
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
                        ref={addr3InputRef}
                        value={form.overseas_addr3 ?? ""}
                        onChange={e => setForm(f => ({ ...f, overseas_addr3: e.target.value }))}
                        onBlur={() => { if ((form.overseas_addr3 ?? "").trim()) triggerOverseasValidation(); }}
                        placeholder="Street / 상세주소"
                        autoComplete="off"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200 mb-2"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <input
                            value={form.overseas_addr2 ?? ""}
                            onChange={e => setForm(f => ({ ...f, overseas_addr2: e.target.value }))}
                            placeholder={addrValidating ? "자동 입력 중..." : "시 / City"}
                            className={`w-full bg-gray-50 border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-colors ${
                              addrValidating ? "border-violet-200 bg-violet-50/30 placeholder:text-violet-400" : "border-gray-100"
                            }`}
                          />
                        </div>
                        <div>
                          <input
                            value={form.overseas_addr1 ?? ""}
                            onChange={e => setForm(f => ({ ...f, overseas_addr1: e.target.value }))}
                            placeholder={addrValidating ? "자동 입력 중..." : "주·도 / State"}
                            className={`w-full bg-gray-50 border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-colors ${
                              addrValidating ? "border-violet-200 bg-violet-50/30 placeholder:text-violet-400" : "border-gray-100"
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">우편번호</label>
                      <input
                        value={form.overseas_zip ?? ""}
                        onChange={e => setForm(f => ({ ...f, overseas_zip: e.target.value }))}
                        onBlur={() => { if ((form.overseas_addr3 ?? "").trim()) triggerOverseasValidation(); }}
                        placeholder="Postal code"
                        className={`w-full bg-gray-50 border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-colors ${
                          addrValidating ? "border-violet-200 bg-violet-50/30" : "border-gray-100"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">이메일</label>
                      <input
                        type="email"
                        value={form.email ?? ""}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="recipient@example.com"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-200"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* 저장 버튼 */}
              <div className="px-5 py-4 border-t border-gray-100 shrink-0 space-y-3">
                {/* 기본 주소 설정 토글 */}
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_default: !f.is_default }))}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl"
                >
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Star size={15} className={form.is_default ? "text-amber-500 fill-amber-400" : "text-gray-400"} />
                    기본 주소로 설정
                  </div>
                  <div className={`w-10 h-6 rounded-full transition-colors relative ${form.is_default ? "bg-amber-400" : "bg-gray-200"}`}>
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.is_default ? "left-5" : "left-1"}`} />
                  </div>
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className={`w-full text-white font-semibold py-4 rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2 ${
                    tab === "pickup" ? "bg-brand-600" : "bg-violet-600"
                  }`}
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
