"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Package, Globe, Shield, Box,
  Plus, Trash2, ChevronDown, CheckCircle, Loader2, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ── 타입 ────────────────────────────────────────────────────
interface Parcel {
  id: string;
  tracking_no: string | null;
  sender_name: string | null;
  status: string;
  weight_actual: number | null;
  notes: string | null;
}

interface OverseasAddress {
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

interface InvoiceItem {
  key: string;
  name_en: string;
  quantity: number;
  unit_price_usd: number;
  hs_code: string;
  origin_country: string;
}

// ── 상수 ────────────────────────────────────────────────────
const SHIPPING_METHODS = [
  { code: "EMS",         name: "EMS",         desc: "일반 국제우편 · 3-7일",  premiumcd: "31", em_ee: "em", badge: "bg-blue-600" },
  { code: "EMS_PREMIUM", name: "EMS 프리미엄", desc: "빠른 국제우편 · 2-4일", premiumcd: "32", em_ee: "em", badge: "bg-violet-600" },
  { code: "KPACKET",     name: "K-Packet",    desc: "소형 경량 · 7-15일 · 2kg 이하", premiumcd: "14", em_ee: "rl", badge: "bg-emerald-600" },
] as const;

const PACKAGING_OPTS = [
  { code: "safe_pack",  name: "안전포장",  desc: "에어캡, 완충재 추가",      price: 3000 },
  { code: "repack",     name: "재포장",    desc: "새 박스로 교체",            price: 2000 },
  { code: "consolidate",name: "합포장",    desc: "선택 물품을 하나로 합치기", price: 2000 },
] as const;

const COUNTRIES = [
  { code: "JP", name: "일본",       flag: "🇯🇵" },
  { code: "CN", name: "중국",       flag: "🇨🇳" },
  { code: "US", name: "미국",       flag: "🇺🇸" },
  { code: "AU", name: "호주",       flag: "🇦🇺" },
  { code: "CA", name: "캐나다",     flag: "🇨🇦" },
  { code: "GB", name: "영국",       flag: "🇬🇧" },
  { code: "DE", name: "독일",       flag: "🇩🇪" },
  { code: "FR", name: "프랑스",     flag: "🇫🇷" },
  { code: "SG", name: "싱가포르",   flag: "🇸🇬" },
  { code: "HK", name: "홍콩",       flag: "🇭🇰" },
  { code: "TW", name: "대만",       flag: "🇹🇼" },
  { code: "TH", name: "태국",       flag: "🇹🇭" },
  { code: "VN", name: "베트남",     flag: "🇻🇳" },
  { code: "PH", name: "필리핀",     flag: "🇵🇭" },
  { code: "MY", name: "말레이시아", flag: "🇲🇾" },
  { code: "ID", name: "인도네시아", flag: "🇮🇩" },
  { code: "MO", name: "마카오",     flag: "🇲🇴" },
  { code: "MN", name: "몽골",       flag: "🇲🇳" },
  { code: "NZ", name: "뉴질랜드",   flag: "🇳🇿" },
  { code: "IT", name: "이탈리아",   flag: "🇮🇹" },
  { code: "ES", name: "스페인",     flag: "🇪🇸" },
  { code: "RU", name: "러시아",     flag: "🇷🇺" },
  { code: "AE", name: "아랍에미리트", flag: "🇦🇪" },
  { code: "IN", name: "인도",       flag: "🇮🇳" },
];

const STEP_LABELS = ["물품 확인", "배송 옵션", "해외 배송지", "인보이스", "견적 확인"];

function newItem(): InvoiceItem {
  return { key: Math.random().toString(36).slice(2), name_en: "", quantity: 1, unit_price_usd: 0, hs_code: "", origin_country: "KR" };
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
function ShippingRequestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parcelIds = useMemo(() => searchParams.get("parcels")?.split(",").filter(Boolean) ?? [], [searchParams]);

  const [step, setStep] = useState(1);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);

  // Step 2
  const [shippingMethod, setShippingMethod] = useState<"EMS" | "EMS_PREMIUM" | "KPACKET">("EMS");
  const [packOpts, setPackOpts] = useState({ safe_pack: false, repack: false, consolidate: false });
  const [packNote, setPackNote] = useState("");

  // Step 3
  const [savedAddresses, setSavedAddresses] = useState<OverseasAddress[]>([]);
  const [selectedAddrId, setSelectedAddrId] = useState<string | null>(null);
  const [showNewAddr, setShowNewAddr] = useState(false);
  const [newAddr, setNewAddr] = useState({ name: "", phone: "", country_code: "JP", overseas_addr1: "", overseas_addr2: "", overseas_addr3: "", overseas_zip: "", email: "" });
  const [countryOpen, setCountryOpen] = useState(false);
  const [addrLoading, setAddrLoading] = useState(true);

  // Step 4
  const [items, setItems] = useState<InvoiceItem[]>([newItem()]);

  // Step 5
  const [estimatedFee, setEstimatedFee] = useState<number | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // 물품 로드
  useEffect(() => {
    if (parcelIds.length === 0) { router.replace("/warehouse"); return; }
    const supabase = createClient();
    supabase
      .from("parcels")
      .select("id, tracking_no, sender_name, status, weight_actual, notes")
      .in("id", parcelIds)
      .then(({ data }) => {
        setParcels(data ?? []);
        setLoading(false);
      });
  }, [parcelIds, router]);

  // 해외 배송지 로드
  const loadAddresses = useCallback(async () => {
    setAddrLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("customer_addresses")
      .select("*")
      .eq("customer_id", user.id)
      .eq("type", "overseas")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    setSavedAddresses(data ?? []);
    const def = data?.find((a) => a.is_default);
    if (def && !selectedAddrId) setSelectedAddrId(def.id);
    setAddrLoading(false);
  }, [selectedAddrId]);

  useEffect(() => { loadAddresses(); }, [loadAddresses]);

  // EMS 견적 조회
  const fetchQuote = useCallback(async () => {
    const addr = selectedAddrId
      ? savedAddresses.find((a) => a.id === selectedAddrId)
      : null;
    const countrycd = addr?.country_code ?? newAddr.country_code;
    if (!countrycd) return;

    const totalWeightG = parcels.reduce((sum, p) => sum + (p.weight_actual ?? 500), 0);
    const method = SHIPPING_METHODS.find((m) => m.code === shippingMethod)!;

    setQuoteLoading(true);
    try {
      const res = await fetch(
        `/api/ems/quote?premiumcd=${method.premiumcd}&em_ee=${method.em_ee}&countrycd=${countrycd}&totweight=${totalWeightG}`
      );
      const data = await res.json();
      setEstimatedFee(data.fee ? parseInt(data.fee, 10) : null);
    } catch {
      setEstimatedFee(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [selectedAddrId, savedAddresses, newAddr.country_code, parcels, shippingMethod]);

  useEffect(() => {
    if (step === 5) fetchQuote();
  }, [step, fetchQuote]);

  // ── 계산 ──────────────────────────────────────────────────
  const packagingFee = PACKAGING_OPTS.filter((o) => packOpts[o.code as keyof typeof packOpts]).reduce((s, o) => s + o.price, 0);
  const totalAmount = (estimatedFee ?? 0) + packagingFee;
  const customsValue = items.reduce((s, i) => s + i.unit_price_usd * i.quantity, 0);
  const totalWeightKg = parcels.reduce((s, p) => s + (p.weight_actual ?? 0), 0) / 1000;

  // 현재 선택된 주소
  const selectedAddress = selectedAddrId
    ? savedAddresses.find((a) => a.id === selectedAddrId)
    : null;
  const country = COUNTRIES.find((c) => c.code === (selectedAddress?.country_code ?? newAddr.country_code));

  // ── 유효성 검사 ───────────────────────────────────────────
  function canProceed(): boolean {
    if (step === 3) {
      if (showNewAddr || !selectedAddrId) {
        return !!(newAddr.name.trim() && newAddr.overseas_addr3.trim());
      }
      return !!selectedAddrId;
    }
    if (step === 4) {
      return items.every((i) => i.name_en.trim() && i.quantity > 0 && i.unit_price_usd >= 0);
    }
    return true;
  }

  // ── 주소 저장 후 선택 ─────────────────────────────────────
  async function saveAndSelectAddress() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: inserted } = await supabase
      .from("customer_addresses")
      .insert({
        customer_id: user.id,
        type: "overseas",
        label: `${country?.name ?? newAddr.country_code} 배송지`,
        name: newAddr.name,
        phone: newAddr.phone || null,
        country_code: newAddr.country_code,
        overseas_addr1: newAddr.overseas_addr1 || null,
        overseas_addr2: newAddr.overseas_addr2 || null,
        overseas_addr3: newAddr.overseas_addr3,
        overseas_zip: newAddr.overseas_zip || null,
        email: newAddr.email || null,
        is_default: savedAddresses.length === 0,
      })
      .select()
      .single();

    if (inserted) {
      await loadAddresses();
      setSelectedAddrId(inserted.id);
      setShowNewAddr(false);
    }
  }

  // ── 주문 제출 ─────────────────────────────────────────────
  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const addr = selectedAddress ?? {
        country_code: newAddr.country_code,
        name: newAddr.name,
        phone: newAddr.phone || undefined,
        overseas_addr1: newAddr.overseas_addr1,
        overseas_addr2: newAddr.overseas_addr2,
        overseas_addr3: newAddr.overseas_addr3,
        overseas_zip: newAddr.overseas_zip || undefined,
        email: newAddr.email || undefined,
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parcel_ids: parcelIds,
          shipping_method: shippingMethod,
          packaging_options: { ...packOpts, note: packNote },
          overseas_address: addr,
          item_list: items.map(({ key: _k, ...rest }) => rest),
          estimated_shipping_fee: estimatedFee ?? 0,
          packaging_fee: packagingFee,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "주문 생성 실패");

      router.push(`/orders?new=${data.order_no}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-[430px] mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={() => (step === 1 ? router.back() : setStep(step - 1))} className="p-1 -ml-1">
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <div className="flex-1">
            <p className="text-xs text-gray-400">Step {step} / {STEP_LABELS.length}</p>
            <p className="text-sm font-bold text-gray-900">{STEP_LABELS[step - 1]}</p>
          </div>
        </div>
        {/* 진행 바 */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${(step / STEP_LABELS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="max-w-[430px] mx-auto px-4 pt-5 space-y-4">

        {/* ── Step 1: 물품 확인 ─────────────────────────────── */}
        {step === 1 && (
          <>
            <div className="bg-blue-50 rounded-2xl p-4">
              <p className="text-xs text-blue-700 font-semibold mb-1">선택한 물품 {parcels.length}개</p>
              {totalWeightKg > 0 ? (
                <p className="text-xs text-blue-600">총 예상 무게: {totalWeightKg.toFixed(2)}kg (실측 후 확정)</p>
              ) : (
                <p className="text-xs text-blue-600">무게는 창고 검수 후 확정됩니다</p>
              )}
            </div>
            <div className="space-y-2">
              {parcels.map((p) => (
                <div key={p.id} className="bg-white rounded-xl p-4 flex items-center gap-3 shadow-sm">
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                    <Package size={18} className="text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {p.tracking_no ?? "송장번호 미등록"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {p.sender_name ?? "발송인 미확인"}
                      {p.notes ? ` · ${p.notes}` : ""}
                    </p>
                  </div>
                  {p.weight_actual ? (
                    <span className="text-xs text-gray-500 shrink-0">{(p.weight_actual / 1000).toFixed(2)}kg</span>
                  ) : (
                    <span className="text-xs text-gray-300 shrink-0">미측정</span>
                  )}
                </div>
              ))}
            </div>
            <div className="bg-amber-50 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-700 leading-relaxed">
                실제 배송비는 물품 입고 후 실측 무게 기준으로 확정됩니다.
                지금 입력하는 정보를 바탕으로 사전 견적을 안내해드립니다.
              </p>
            </div>
          </>
        )}

        {/* ── Step 2: 배송 옵션 ─────────────────────────────── */}
        {step === 2 && (
          <>
            <p className="text-sm font-bold text-gray-800">배송 방법 선택</p>
            <div className="space-y-2">
              {SHIPPING_METHODS.map((m) => (
                <button
                  key={m.code}
                  onClick={() => setShippingMethod(m.code)}
                  className={`w-full text-left flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                    shippingMethod === m.code
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-100 bg-white"
                  }`}
                >
                  <span className={`text-xs text-white font-bold px-2.5 py-1 rounded-lg ${m.badge}`}>
                    {m.name}
                  </span>
                  <p className="text-xs text-gray-500">{m.desc}</p>
                  {shippingMethod === m.code && <CheckCircle size={16} className="text-blue-500 ml-auto shrink-0" />}
                </button>
              ))}
            </div>

            <p className="text-sm font-bold text-gray-800 pt-2">포장 옵션 (선택)</p>
            <div className="space-y-2">
              {PACKAGING_OPTS.map((o) => {
                const checked = packOpts[o.code as keyof typeof packOpts];
                return (
                  <button
                    key={o.code}
                    onClick={() => setPackOpts((p) => ({ ...p, [o.code]: !p[o.code as keyof typeof packOpts] }))}
                    className={`w-full text-left flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                      checked ? "border-blue-500 bg-blue-50" : "border-gray-100 bg-white"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                      checked ? "bg-blue-600 border-blue-600" : "border-gray-300"
                    }`}>
                      {checked && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">{o.name}</p>
                      <p className="text-xs text-gray-400">{o.desc}</p>
                    </div>
                    <span className="text-xs font-semibold text-blue-600 shrink-0">
                      +{o.price.toLocaleString()}원
                    </span>
                  </button>
                );
              })}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">요청 메모 (선택)</label>
              <textarea
                value={packNote}
                onChange={(e) => setPackNote(e.target.value)}
                rows={3}
                placeholder="포장 관련 특별 요청사항을 입력해주세요"
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </>
        )}

        {/* ── Step 3: 해외 배송지 ───────────────────────────── */}
        {step === 3 && (
          <>
            {addrLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={24} className="animate-spin text-blue-400" />
              </div>
            ) : (
              <>
                {savedAddresses.length > 0 && !showNewAddr && (
                  <>
                    <p className="text-sm font-bold text-gray-800">저장된 배송지 선택</p>
                    <div className="space-y-2">
                      {savedAddresses.map((addr) => {
                        const c = COUNTRIES.find((cc) => cc.code === addr.country_code);
                        return (
                          <button
                            key={addr.id}
                            onClick={() => setSelectedAddrId(addr.id)}
                            className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                              selectedAddrId === addr.id
                                ? "border-violet-500 bg-violet-50"
                                : "border-gray-100 bg-white"
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">
                                    {addr.label}
                                  </span>
                                  {addr.is_default && (
                                    <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full font-semibold">기본</span>
                                  )}
                                </div>
                                <p className="text-sm font-semibold text-gray-900">
                                  {c?.flag} {addr.name}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                                  {addr.overseas_addr3}, {addr.overseas_addr2}
                                  {addr.overseas_zip ? ` (${addr.overseas_zip})` : ""}
                                </p>
                              </div>
                              {selectedAddrId === addr.id && (
                                <CheckCircle size={18} className="text-violet-500 shrink-0 mt-0.5" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setShowNewAddr(true)}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-violet-300 hover:text-violet-600 transition-colors"
                    >
                      <Plus size={15} /> 새 배송지 추가
                    </button>
                  </>
                )}

                {(savedAddresses.length === 0 || showNewAddr) && (
                  <div className="space-y-4">
                    {showNewAddr && (
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-800">새 해외 배송지</p>
                        <button onClick={() => setShowNewAddr(false)} className="p-1.5 rounded-full hover:bg-gray-100">
                          <X size={16} className="text-gray-500" />
                        </button>
                      </div>
                    )}

                    {/* 국가 */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">국가 *</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setCountryOpen((v) => !v)}
                          className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm"
                        >
                          <span>
                            {COUNTRIES.find((c) => c.code === newAddr.country_code)?.flag}{" "}
                            {COUNTRIES.find((c) => c.code === newAddr.country_code)?.name}
                          </span>
                          <ChevronDown size={15} className="text-gray-400" />
                        </button>
                        {countryOpen && (
                          <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-44 overflow-y-auto">
                            {COUNTRIES.map((c) => (
                              <button
                                key={c.code}
                                type="button"
                                onClick={() => { setNewAddr((a) => ({ ...a, country_code: c.code })); setCountryOpen(false); }}
                                className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-blue-50 text-left ${
                                  newAddr.country_code === c.code ? "text-blue-600 font-semibold" : "text-gray-700"
                                }`}
                              >
                                {c.flag} {c.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {[
                      { key: "name",           label: "수취인 이름 *",    placeholder: "이름" },
                      { key: "phone",          label: "연락처",           placeholder: "+81-90-0000-0000" },
                      { key: "overseas_addr3", label: "상세주소 (Street) *", placeholder: "123 Main St" },
                      { key: "overseas_addr2", label: "시 (City)",        placeholder: "Tokyo" },
                      { key: "overseas_addr1", label: "주·도 (State)",    placeholder: "Tokyo-to" },
                      { key: "overseas_zip",   label: "우편번호",          placeholder: "100-0001" },
                      { key: "email",          label: "이메일",            placeholder: "recipient@example.com" },
                    ].map(({ key, label, placeholder }) => (
                      <div key={key}>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5">{label}</label>
                        <input
                          value={newAddr[key as keyof typeof newAddr]}
                          onChange={(e) => setNewAddr((a) => ({ ...a, [key]: e.target.value }))}
                          placeholder={placeholder}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                      </div>
                    ))}

                    {showNewAddr && (
                      <button
                        onClick={saveAndSelectAddress}
                        disabled={!newAddr.name.trim() || !newAddr.overseas_addr3.trim()}
                        className="w-full py-3 bg-violet-600 text-white text-sm font-bold rounded-2xl disabled:opacity-50"
                      >
                        이 주소로 선택
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── Step 4: 인보이스 ──────────────────────────────── */}
        {step === 4 && (
          <>
            <div className="bg-amber-50 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-700 leading-relaxed">
                세관 신고를 위한 물품 내역입니다. <strong>영문으로</strong> 입력해주세요.
                실제 가격을 정확히 기재해주세요 (USD 기준).
              </p>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={item.key} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-gray-500">물품 {idx + 1}</span>
                    {items.length > 1 && (
                      <button
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">품목명 (영문) *</label>
                      <input
                        value={item.name_en}
                        onChange={(e) => setItems((p) => p.map((it, i) => i === idx ? { ...it, name_en: e.target.value } : it))}
                        placeholder="e.g. Clothing, Cosmetics, Electronics"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">수량 *</label>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => setItems((p) => p.map((it, i) => i === idx ? { ...it, quantity: parseInt(e.target.value) || 1 } : it))}
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">단가 (USD) *</label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.unit_price_usd}
                          onChange={(e) => setItems((p) => p.map((it, i) => i === idx ? { ...it, unit_price_usd: parseFloat(e.target.value) || 0 } : it))}
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">HS코드 (선택)</label>
                        <input
                          value={item.hs_code}
                          onChange={(e) => setItems((p) => p.map((it, i) => i === idx ? { ...it, hs_code: e.target.value } : it))}
                          placeholder="6단위"
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">원산지 (선택)</label>
                        <input
                          value={item.origin_country}
                          onChange={(e) => setItems((p) => p.map((it, i) => i === idx ? { ...it, origin_country: e.target.value } : it))}
                          placeholder="KR"
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setItems((p) => [...p, newItem()])}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              <Plus size={15} /> 물품 추가
            </button>

            <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-600">총 신고 금액</span>
              <span className="text-sm font-bold text-gray-900">USD {customsValue.toFixed(2)}</span>
            </div>
          </>
        )}

        {/* ── Step 5: 견적 확인 ─────────────────────────────── */}
        {step === 5 && (
          <>
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
              <p className="text-sm font-bold text-gray-800">주문 요약</p>

              {/* 물품 */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 flex items-center gap-1.5"><Package size={14} /> 물품</span>
                <span className="font-semibold text-gray-800">{parcels.length}개</span>
              </div>

              {/* 배송 방법 */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 flex items-center gap-1.5"><Globe size={14} /> 배송 방법</span>
                <span className="font-semibold text-gray-800">
                  {SHIPPING_METHODS.find((m) => m.code === shippingMethod)?.name}
                </span>
              </div>

              {/* 배송지 */}
              <div className="flex items-start justify-between text-sm gap-4">
                <span className="text-gray-500 shrink-0">수취인</span>
                <div className="text-right">
                  <p className="font-semibold text-gray-800">
                    {country?.flag} {selectedAddress?.name ?? newAddr.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedAddress?.overseas_addr3 ?? newAddr.overseas_addr3}
                  </p>
                </div>
              </div>

              {/* 포장 옵션 */}
              {Object.entries(packOpts).some(([, v]) => v) && (
                <div className="flex items-start justify-between text-sm gap-4">
                  <span className="text-gray-500 flex items-center gap-1.5 shrink-0"><Box size={14} /> 포장 옵션</span>
                  <div className="text-right">
                    {PACKAGING_OPTS.filter((o) => packOpts[o.code as keyof typeof packOpts]).map((o) => (
                      <p key={o.code} className="text-xs text-gray-600">{o.name}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* 인보이스 */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 flex items-center gap-1.5"><Shield size={14} /> 세관 신고액</span>
                <span className="font-semibold text-gray-800">USD {customsValue.toFixed(2)}</span>
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">예상 배송비</span>
                  {quoteLoading ? (
                    <Loader2 size={14} className="animate-spin text-gray-400" />
                  ) : (
                    <span className="font-semibold text-gray-800">
                      {estimatedFee != null ? `${estimatedFee.toLocaleString()}원` : "확인 중..."}
                    </span>
                  )}
                </div>
                {packagingFee > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">포장 서비스</span>
                    <span className="font-semibold text-gray-800">+{packagingFee.toLocaleString()}원</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-sm font-bold text-gray-900">예상 합계</span>
                  <span className="text-base font-bold text-blue-600">
                    {totalAmount > 0 ? `${totalAmount.toLocaleString()}원` : "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-700 leading-relaxed">
                실제 요금은 창고 입고 후 실측 무게 기준으로 확정되며, 견적 확인 후 결제하실 수 있습니다.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 rounded-xl px-4 py-3">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 z-30">
        <div className="max-w-[430px] mx-auto">
          {step < 5 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-4 rounded-2xl disabled:opacity-40 transition-opacity"
            >
              다음 단계 <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-4 rounded-2xl disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              {submitting ? "신청 중..." : "해외배송 신청하기"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShippingRequestPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    }>
      <ShippingRequestContent />
    </Suspense>
  );
}
