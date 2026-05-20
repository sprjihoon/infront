"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Package, Globe, Shield, Box,
  Plus, Trash2, CheckCircle, Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import OverseasAddressPicker, { OverseasAddressValue, COUNTRIES } from "@/components/ui/OverseasAddressPicker";

// ── 타입 ────────────────────────────────────────────────────
interface Parcel {
  id: string;
  tracking_no: string | null;
  sender_name: string | null;
  status: string;
  weight_actual: number | null;
  notes: string | null;
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

const STEP_LABELS = ["물품 확인", "배송 옵션", "해외 배송지", "인보이스", "견적 확인"];

function newItem(): InvoiceItem {
  return { key: Math.random().toString(36).slice(2), name_en: "", quantity: 1, unit_price_usd: 0, hs_code: "", origin_country: "KR" };
}

// 출고 가능 상태
const SHIPPABLE_STATUSES = ["INBOUND", "INSPECTION"];

// ── 메인 컴포넌트 ─────────────────────────────────────────────
function ShippingRequestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlParcelIds = useMemo(() => searchParams.get("parcels")?.split(",").filter(Boolean) ?? [], [searchParams]);

  // Step 0: parcel 선택 (URL에 parcels 없을 때)
  const [step0Done, setStep0Done] = useState(urlParcelIds.length > 0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(urlParcelIds));
  const [shippableParcels, setShippableParcels] = useState<Parcel[]>([]);
  const [step0Loading, setStep0Loading] = useState(false);

  const parcelIds = useMemo(
    () => (step0Done ? Array.from(selectedIds) : []),
    [step0Done, selectedIds]
  );

  const [step, setStep] = useState(1);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);

  // Step 2
  const [shippingMethod, setShippingMethod] = useState<"EMS" | "EMS_PREMIUM" | "KPACKET">("EMS");
  const [packOpts, setPackOpts] = useState({ safe_pack: false, repack: false, consolidate: false });
  const [packNote, setPackNote] = useState("");

  // Step 3 — OverseasAddressPicker
  const [overseasAddress, setOverseasAddress] = useState<OverseasAddressValue | null>(null);

  // Step 4
  const [items, setItems] = useState<InvoiceItem[]>([newItem()]);

  // Step 5
  const [estimatedFee, setEstimatedFee] = useState<number | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Step 0: 출고 가능 물품 목록 로드
  useEffect(() => {
    if (step0Done) return;
    setStep0Loading(true);
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setCustomerId(user.id);
      const { data } = await supabase
        .from("parcels")
        .select("id, tracking_no, sender_name, status, weight_actual, notes")
        .eq("customer_id", user.id)
        .in("status", SHIPPABLE_STATUSES)
        .order("inbound_at", { ascending: false });
      setShippableParcels(data ?? []);
      setStep0Loading(false);
    });
  }, [step0Done]);

  // 물품 로드 (Step 0 완료 후)
  useEffect(() => {
    if (!step0Done || parcelIds.length === 0) return;
    setLoading(true);
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCustomerId(user.id);
    });
    supabase
      .from("parcels")
      .select("id, tracking_no, sender_name, status, weight_actual, notes")
      .in("id", parcelIds)
      .then(({ data }) => {
        setParcels(data ?? []);
        setLoading(false);
      });
  }, [step0Done, parcelIds]);

  // EMS 견적 조회
  const fetchQuote = useCallback(async () => {
    const countrycd = overseasAddress?.countryCode;
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
  }, [overseasAddress, parcels, shippingMethod]);

  useEffect(() => {
    if (step === 5) fetchQuote();
  }, [step, fetchQuote]);

  // ── 계산 ──────────────────────────────────────────────────
  const packagingFee = PACKAGING_OPTS.filter((o) => packOpts[o.code as keyof typeof packOpts]).reduce((s, o) => s + o.price, 0);
  const totalAmount = (estimatedFee ?? 0) + packagingFee;
  const customsValue = items.reduce((s, i) => s + i.unit_price_usd * i.quantity, 0);
  const totalWeightKg = parcels.reduce((s, p) => s + (p.weight_actual ?? 0), 0) / 1000;

  const country = overseasAddress
    ? COUNTRIES.find((c) => c.code === overseasAddress.countryCode)
    : null;

  // ── 유효성 검사 ───────────────────────────────────────────
  function canProceed(): boolean {
    if (step === 3) {
      return !!(overseasAddress?.name?.trim() && overseasAddress?.addr3?.trim());
    }
    if (step === 4) {
      return items.every((i) => i.name_en.trim() && i.quantity > 0 && i.unit_price_usd >= 0);
    }
    return true;
  }

  // ── 주문 제출 ─────────────────────────────────────────────
  async function submit() {
    if (!overseasAddress) return;
    setSubmitting(true);
    setError("");
    try {
      const addr = {
        country_code: overseasAddress.countryCode,
        name: overseasAddress.name,
        phone: overseasAddress.phone || undefined,
        overseas_addr1: overseasAddress.addr1,
        overseas_addr2: overseasAddress.addr2,
        overseas_addr3: overseasAddress.addr3,
        overseas_zip: overseasAddress.zip || undefined,
        email: overseasAddress.email || undefined,
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

  // ── Step 0: 물품 선택 ─────────────────────────────────────────
  if (!step0Done) {
    return (
      <div className="min-h-screen bg-gray-50 pb-32">
        <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="max-w-[600px] mx-auto flex items-center gap-3 px-4 py-3">
            <button onClick={() => router.back()} className="p-1 -ml-1">
              <ArrowLeft size={22} className="text-gray-700" />
            </button>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">{"\ucd9c\uace0\uc2e0\uccad"}</p>
              <p className="text-xs text-gray-400">{"\ucd9c\uace0\ud560 \ubb3c\ud488\uc744 \uc120\ud0dd\ud574\uc8fc\uc138\uc694"}</p>
            </div>
          </div>
        </div>

        <div className="max-w-[600px] mx-auto px-4 pt-5 space-y-3">
          {step0Loading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={28} className="animate-spin text-blue-500" />
            </div>
          ) : shippableParcels.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
              <Package size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-500">{"\ucd9c\uace0 \uac00\ub2a5\ud55c \ubb3c\ud488\uc774 \uc5c6\uc2b5\ub2c8\ub2e4"}</p>
              <p className="text-xs text-gray-400 mt-1">{"\uc785\uace0 \uc644\ub8cc\ub41c \ubb3c\ud488\uc774 \uc5c6\uc73c\uba74 \ucd9c\uace0\uc2e0\uccad\uc744 \ud560 \uc218 \uc5c6\uc5b4\uc694"}</p>
              <button
                onClick={() => router.push("/warehouse")}
                className="mt-5 bg-blue-600 text-white text-sm font-bold px-6 py-3 rounded-2xl"
              >
                {"\ub9c8\uc774\ucc3d\uace0 \ubcf4\uae30"}
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 px-1">{"\uc785\uace0 \uc644\ub8cc\ub41c \ubb3c\ud488 \u00b7 \ubcf5\uc218 \uc120\ud0dd \uac00\ub2a5"}</p>
              {shippableParcels.map((p) => {
                const checked = selectedIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() =>
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(p.id)) next.delete(p.id);
                        else next.add(p.id);
                        return next;
                      })
                    }
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
                      checked ? "border-blue-500 bg-blue-50" : "border-gray-100 bg-white"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                      checked ? "bg-blue-600 border-blue-600" : "border-gray-300"
                    }`}>
                      {checked && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                    <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                      <Package size={18} className="text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {p.tracking_no ?? "\uc1a1\uc7a5\ubc88\ud638 \ubbf8\ub4f1\ub85d"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {p.sender_name ?? "\ubc1c\uc1a1\uc778 \ubbf8\ud655\uc778"}
                        {p.notes ? ` \u00b7 ${p.notes}` : ""}
                      </p>
                    </div>
                    {p.weight_actual ? (
                      <span className="text-xs text-gray-500 shrink-0">{(p.weight_actual / 1000).toFixed(2)}kg</span>
                    ) : (
                      <span className="text-xs text-gray-300 shrink-0">{"\ubbf8\uce21\uc815"}</span>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>

        {selectedIds.size > 0 && (
          <div className="fixed bottom-20 left-0 right-0 flex justify-center px-4 z-40">
            <button
              onClick={() => setStep0Done(true)}
              className="flex items-center gap-2.5 bg-blue-600 text-white font-bold px-6 py-4 rounded-2xl shadow-lg shadow-blue-200 text-sm active:scale-95 transition-transform"
            >
              <Globe size={16} />
              {selectedIds.size}{"\uac1c \ubb3c\ud488 \ucd9c\uace0\uc2e0\uccad"}
            </button>
          </div>
        )}
      </div>
    );
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
        <div className="max-w-[600px] mx-auto flex items-center gap-3 px-4 py-3">
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

      <div className="max-w-[600px] mx-auto px-4 pt-5 space-y-4">

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
            <p className="text-sm text-gray-500">수취인 주소를 선택하거나 새로 입력해주세요</p>
            <OverseasAddressPicker
              value={overseasAddress}
              onChange={setOverseasAddress}
              customerId={customerId}
            />
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
                    {country?.flag} {overseasAddress?.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {overseasAddress?.addr3}
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
        <div className="max-w-[600px] mx-auto">
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
