"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Calculator, Globe, Weight,
  ChevronDown, ChevronUp, Info, Loader2, RotateCcw, CheckCircle2, XCircle,
  ShieldAlert, Zap,
} from "lucide-react";
import { getCustomsInfo } from "@/lib/customs-data";
import { snapDocWeightG } from "@/lib/ems/client";
import { validateShippingDimensions } from "@/lib/ems/dimension-limits";
import { appendInsuranceQuoteParams } from "@/lib/ems/insurance";
import SidebarPricingGuide from "@/components/ui/SidebarPricingGuide";
import InsuranceQuoteFields from "@/components/ui/InsuranceQuoteFields";

const SERVICES = [
  {
    id: "ems-doc",
    label: "EMS",
    sublabel: "서류",
    premiumcd: "31",
    em_ee: "ee",
    color: "bg-brand-400",
    textColor: "text-brand-500",
    badgeBg: "bg-sky-50",
    badgeBorder: "border-sky-200",
    maxWeight: 2000,
  },
  {
    id: "ems-parcel",
    label: "EMS",
    sublabel: "비서류",
    premiumcd: "31",
    em_ee: "em",
    color: "bg-brand-600",
    textColor: "text-brand-700",
    badgeBg: "bg-brand-50",
    badgeBorder: "border-brand-200",
    maxWeight: 30000,
  },
  {
    id: "ems-premium",
    label: "EMS 프리미엄",
    sublabel: "비서류",
    premiumcd: "32",
    em_ee: "em",
    color: "bg-violet-600",
    textColor: "text-violet-700",
    badgeBg: "bg-violet-50",
    badgeBorder: "border-violet-200",
    maxWeight: 70000,
  },
  {
    id: "k-packet",
    label: "K-Packet",
    sublabel: "",
    premiumcd: "14",
    em_ee: "rl",
    color: "bg-emerald-600",
    textColor: "text-emerald-700",
    badgeBg: "bg-emerald-50",
    badgeBorder: "border-emerald-200",
    maxWeight: 2000,
  },
] as const;

const COUNTRIES = [
  { code: "JP", name: "일본", flag: "🇯🇵" },
  { code: "US", name: "미국", flag: "🇺🇸" },
  { code: "CN", name: "중국", flag: "🇨🇳" },
  { code: "AU", name: "호주", flag: "🇦🇺" },
  { code: "CA", name: "캐나다", flag: "🇨🇦" },
  { code: "GB", name: "영국", flag: "🇬🇧" },
  { code: "DE", name: "독일", flag: "🇩🇪" },
  { code: "FR", name: "프랑스", flag: "🇫🇷" },
  { code: "SG", name: "싱가포르", flag: "🇸🇬" },
  { code: "HK", name: "홍콩", flag: "🇭🇰" },
  { code: "TH", name: "태국", flag: "🇹🇭" },
  { code: "VN", name: "베트남", flag: "🇻🇳" },
  { code: "PH", name: "필리핀", flag: "🇵🇭" },
  { code: "MY", name: "말레이시아", flag: "🇲🇾" },
  { code: "ID", name: "인도네시아", flag: "🇮🇩" },
  { code: "TW", name: "대만", flag: "🇹🇼" },
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

type ServiceResult =
  | { status: "ok"; shippingFee: number; insuranceFee: number }
  | { status: "error"; message: string }
  | { status: "overweight" };

interface Results {
  countryCode: string;
  appliedWeight: number;
  services: Record<string, ServiceResult>;
}

export default function ShippingCalcPage() {
  const router = useRouter();

  const [countryCode, setCountryCode] = useState("JP");
  const [countrySearch, setCountrySearch] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);

  const [weight, setWeight] = useState("1000");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Results | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [insuranceEnabled, setInsuranceEnabled] = useState(false);
  const [insuranceUsd, setInsuranceUsd] = useState("");

  const country = COUNTRIES.find(c => c.code === countryCode)!;
  const filtered = COUNTRIES.filter(c =>
    c.name.includes(countrySearch) || c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const volWeight =
    length && width && height
      ? Math.round((parseFloat(length) * parseFloat(width) * parseFloat(height)) / 6)
      : 0;
  const realWeight = parseFloat(weight) || 0;
  const appliedWeight = Math.max(realWeight, volWeight);

  async function fetchService(
    svc: (typeof SERVICES)[number],
    wg: number,
    cc: string,
    l?: string, w?: string, h?: string,
    insurance?: { enabled: boolean; usd: number },
  ): Promise<ServiceResult> {
    if (wg > svc.maxWeight) return { status: "overweight" };
    if (l && w && h && svc.em_ee !== "ee") {
      const dimErr = validateShippingDimensions({
        premiumcd: svc.premiumcd,
        em_ee: svc.em_ee,
        countrycd: cc,
        boxlength: parseFloat(l),
        boxwidth: parseFloat(w),
        boxheight: parseFloat(h),
      });
      if (dimErr) return { status: "error", message: dimErr };
    }
    const baseParams = new URLSearchParams({
      premiumcd: svc.premiumcd,
      em_ee: svc.em_ee,
      countrycd: cc,
      totweight: String(Math.round(wg)),
      ...(l ? { boxlength: l } : {}),
      ...(w ? { boxwidth: w } : {}),
      ...(h ? { boxheight: h } : {}),
    });

    // 기본 배송료 (보험 미포함)
    const baseRes = await fetch(`/api/ems/quote?${baseParams}`);
    const baseData = await baseRes.json();
    if (!baseRes.ok) return { status: "error", message: baseData.error ?? "조회 실패" };
    const shippingFee = baseData.totalFee as number;

    // 보험 수수료 = (보험 포함 총액) − 배송료
    if (insurance?.enabled && insurance.usd > 0) {
      const insParams = new URLSearchParams(baseParams);
      appendInsuranceQuoteParams(insParams, true, insurance.usd);
      const insRes = await fetch(`/api/ems/quote?${insParams}`);
      const insData = await insRes.json();
      if (!insRes.ok) return { status: "error", message: insData.error ?? "조회 실패" };
      const insuranceFee = Math.max(0, (insData.totalFee as number) - shippingFee);
      return { status: "ok", shippingFee, insuranceFee };
    }

    return { status: "ok", shippingFee, insuranceFee: 0 };
  }

  async function calculate() {
    setInputError(null);
    setResults(null);
    if (!weight || parseFloat(weight) <= 0) {
      setInputError("무게를 입력해주세요.");
      return;
    }
    if (insuranceEnabled && !(parseFloat(insuranceUsd) > 0)) {
      setInputError("보험 신고가액(USD)을 입력해주세요.");
      return;
    }

    const insurance = {
      enabled: insuranceEnabled,
      usd: parseFloat(insuranceUsd) || 0,
    };

    setLoading(true);
    try {
      const services: Record<string, ServiceResult> = {};
      for (const svc of SERVICES) {
        const isDoc = svc.em_ee === "ee";
        if (isDoc && realWeight > svc.maxWeight) {
          services[svc.id] = { status: "overweight" };
          continue;
        }
        const wg = isDoc ? snapDocWeightG(realWeight) : appliedWeight;
        services[svc.id] = await fetchService(
          svc, wg, countryCode,
          isDoc ? undefined : length,
          isDoc ? undefined : width,
          isDoc ? undefined : height,
          insurance,
        );
      }
      setResults({ countryCode, appliedWeight, services });
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResults(null);
    setInputError(null);
    setWeight("1000");
    setLength("");
    setWidth("");
    setHeight("");
    setInsuranceEnabled(false);
    setInsuranceUsd("");
  }

  const cheapestFee = results
    ? Math.min(
        ...Object.values(results.services)
          .filter((r): r is { status: "ok"; shippingFee: number; insuranceFee: number } => r.status === "ok")
          .map(r => r.shippingFee + r.insuranceFee)
      )
    : Infinity;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="p-1 -ml-1">
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <h1 className="text-base font-semibold text-gray-900 flex items-center gap-1.5">
            <Calculator size={17} className="text-brand-600" />
            해외배송 계산기
          </h1>
        </div>
      </div>

      {/* 데스크톱: 600px 영역 왼쪽 — 요금 안내 위젯 */}
      <aside
        className="hidden xl:block fixed top-4 bottom-[calc(60px+var(--sab,0px)+0.5rem)] w-72 overflow-y-auto z-[1]"
        style={{ right: "calc(50% + 300px + 24px)" }}
      >
        <SidebarPricingGuide />
      </aside>

      <div className="px-4 py-4 space-y-4">

        {/* 목적국 */}
        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-1.5">
            <Globe size={13} /> 목적국
          </p>
          <button
            onClick={() => { setCountryOpen(v => !v); setCountrySearch(""); }}
            className="w-full flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100"
          >
            <span className="text-sm font-medium text-gray-800">
              {country.flag} {country.name} ({country.code})
            </span>
            {countryOpen
              ? <ChevronUp size={16} className="text-gray-400" />
              : <ChevronDown size={16} className="text-gray-400" />}
          </button>

          {countryOpen && (
            <div className="mt-2 border border-gray-100 rounded-xl overflow-hidden">
              <div className="p-2 border-b border-gray-100">
                <input
                  autoFocus
                  placeholder="국가 검색..."
                  value={countrySearch}
                  onChange={e => setCountrySearch(e.target.value)}
                  className="w-full text-sm px-3 py-2 bg-gray-50 rounded-lg outline-none"
                />
              </div>
              <div className="max-h-52 overflow-y-auto">
                {filtered.map(c => (
                  <button
                    key={c.code}
                    onClick={() => { setCountryCode(c.code); setCountryOpen(false); setResults(null); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-brand-50 transition-colors ${
                      c.code === countryCode ? "bg-brand-50 text-brand-700 font-medium" : "text-gray-700"
                    }`}
                  >
                    <span className="text-lg">{c.flag}</span>
                    <span>{c.name}</span>
                    <span className="ml-auto text-xs text-gray-400">{c.code}</span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="text-center text-sm text-gray-400 py-4">검색 결과 없음</p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* 무게 & 크기 */}
        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-1.5">
            <Weight size={13} /> 무게 & 크기
          </p>

          <div className="mb-3">
            <label className="block text-xs text-gray-400 mb-1">
              실중량 (g) <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              <input
                type="number"
                min="1"
                value={weight}
                onChange={e => { setWeight(e.target.value); setResults(null); }}
                className="flex-1 bg-transparent text-sm font-medium text-gray-900 outline-none"
                placeholder="예: 1000"
              />
              <span className="text-xs text-gray-400">g</span>
              <span className="text-xs text-gray-300">
                ({weight ? (parseFloat(weight) / 1000).toFixed(2) : "0"}kg)
              </span>
            </div>
          </div>

          <div className="mb-1">
            <label className="block text-xs text-gray-400 mb-1">박스 크기 (cm) — 부피중량 계산용</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "가로", val: length, set: setLength },
                { label: "세로", val: width, set: setWidth },
                { label: "높이", val: height, set: setHeight },
              ].map(({ label, val, set }) => (
                <div key={label} className="bg-gray-50 rounded-xl border border-gray-100 px-3 py-2.5">
                  <p className="text-[10px] text-gray-400 mb-1">{label}</p>
                  <input
                    type="number"
                    min="0"
                    value={val}
                    onChange={e => { set(e.target.value); setResults(null); }}
                    className="w-full bg-transparent text-sm font-medium text-gray-900 outline-none"
                    placeholder="cm"
                  />
                </div>
              ))}
            </div>
          </div>

          {volWeight > 0 && (
            <div className="mt-3 bg-brand-50 rounded-xl px-4 py-3 text-xs space-y-1">
              <div className="flex justify-between text-gray-600">
                <span>실중량</span>
                <span className="font-medium">{realWeight.toLocaleString()} g</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>부피중량 ({length}×{width}×{height}÷6)</span>
                <span className="font-medium">{volWeight.toLocaleString()} g</span>
              </div>
              <div className="flex justify-between border-t border-brand-100 pt-1 mt-1">
                <span className="font-semibold text-brand-700">적용 중량</span>
                <span className="font-bold text-brand-700">
                  {appliedWeight.toLocaleString()} g ({(appliedWeight / 1000).toFixed(2)}kg)
                </span>
              </div>
            </div>
          )}

          <div className="mt-3 flex gap-1.5 text-[11px] text-gray-400">
            <Info size={12} className="shrink-0 mt-0.5" />
            <span>부피중량 = 가로 × 세로 × 높이 ÷ 6. 실중량과 부피중량 중 큰 값이 적용됩니다.</span>
          </div>
        </section>

        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <InsuranceQuoteFields
            enabled={insuranceEnabled}
            onEnabledChange={(v) => { setInsuranceEnabled(v); setResults(null); }}
            usdAmount={insuranceUsd}
            onUsdAmountChange={(v) => { setInsuranceUsd(v); setResults(null); }}
          />
        </section>

        {/* 계산 버튼 */}
        <button
          onClick={calculate}
          disabled={loading}
          className="w-full bg-brand-600 text-white rounded-2xl py-4 font-semibold text-base shadow-md active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading
            ? <><Loader2 size={18} className="animate-spin" /> 계산 중...</>
            : <><Calculator size={18} /> 전체 서비스 요금 비교</>}
        </button>

        {/* 입력 오류 */}
        {inputError && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-sm text-red-600">
            {inputError}
          </div>
        )}

        {/* 결과 비교표 */}
        {results && (
          <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* 헤더 */}
            <div className="bg-brand-600 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-white/80 text-xs">
                  {country.flag} {country.name} · 적용 중량 {results.appliedWeight.toLocaleString()} g
                </p>
                <p className="text-white font-bold text-sm mt-0.5">
                  서비스별 예상 배송비{insuranceEnabled ? " (배송료·보험료 별도)" : ""}
                </p>
              </div>
              <button onClick={reset} className="text-white/70 hover:text-white">
                <RotateCcw size={16} />
              </button>
            </div>

            <div className="divide-y divide-gray-50">
              {SERVICES.map(svc => {
                const r = results.services[svc.id];
                const isCheapest = r.status === "ok" && (r.shippingFee + r.insuranceFee) === cheapestFee;
                return (
                  <div
                    key={svc.id}
                    className={`flex items-start gap-3 px-4 py-3.5 ${
                      isCheapest ? "bg-green-50" : ""
                    }`}
                  >
                    {/* 서비스명 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${svc.color} shrink-0`} />
                        <span className="text-sm font-semibold text-gray-800">{svc.label}</span>
                        {svc.sublabel && (
                          <span className="text-[10px] bg-gray-100 text-gray-500 rounded px-1">
                            {svc.sublabel}
                          </span>
                        )}
                        {isCheapest && (
                          <span className="text-[10px] bg-green-100 text-green-700 rounded-full px-1.5 py-0.5 font-semibold">
                            최저가
                          </span>
                        )}
                      </div>
                      {svc.em_ee === "ee" ? (
                        <>
                          <p className="text-[10px] text-gray-400 mt-0.5 ml-3.5">
                            최대 {svc.maxWeight / 1000}kg · 실중량 기준
                          </p>
                          <p className="text-[10px] text-amber-700 mt-1 ml-3.5 leading-snug">
                            서류·페이퍼류만 발송 가능합니다. 일반 물품·현금·상품권·수표 등은 서류로 보낼 수 없습니다.
                          </p>
                        </>
                      ) : svc.maxWeight <= 2000 ? (
                        <p className="text-[10px] text-gray-400 mt-0.5 ml-3.5">
                          최대 {svc.maxWeight / 1000}kg
                        </p>
                      ) : null}
                    </div>

                    {/* 금액 / 상태 */}
                    <div className="text-right shrink-0 pt-0.5">
                      {r.status === "ok" && (
                        r.insuranceFee > 0 ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 justify-end">
                              <CheckCircle2 size={13} className="text-green-500" />
                              <span className="text-[11px] text-gray-400">배송료</span>
                              <span className={`text-base font-bold ${isCheapest ? "text-green-700" : "text-gray-900"}`}>
                                {r.shippingFee.toLocaleString()}
                                <span className="text-xs font-normal text-gray-400 ml-0.5">원</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-1 justify-end">
                              <span className="text-[11px] text-blue-500">보험료</span>
                              <span className="text-sm font-bold text-blue-600">
                                {r.insuranceFee.toLocaleString()}
                                <span className="text-xs font-normal ml-0.5">원</span>
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <CheckCircle2 size={13} className="text-green-500" />
                            <span className={`text-base font-bold ${isCheapest ? "text-green-700" : "text-gray-900"}`}>
                              {r.shippingFee.toLocaleString()}
                              <span className="text-xs font-normal text-gray-400 ml-0.5">원</span>
                            </span>
                          </div>
                        )
                      )}
                      {r.status === "overweight" && (
                        <div className="flex items-center gap-1">
                          <XCircle size={13} className="text-orange-400" />
                          <span className="text-xs text-orange-500 font-medium">중량 초과</span>
                        </div>
                      )}
                      {r.status === "error" && (
                        <div className="flex items-center gap-1 max-w-[140px]">
                          <XCircle size={13} className="text-red-400 shrink-0" />
                          <span className="text-[11px] text-red-500 text-right leading-tight">
                            {r.message}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 안내 */}
            <div className="px-4 pb-4 pt-2">
              <div className="flex gap-2 bg-yellow-50 rounded-xl p-3 text-[11px] text-yellow-800">
                <Info size={13} className="shrink-0 mt-0.5" />
                <span>
                  VAT 포함 예상 금액입니다.
                  {insuranceEnabled ? " 배송료와 보험료를 별도 표시합니다." : ""}
                  {" "}실제 접수 시 창고 실측 무게·크기로 재계산될 수 있습니다.
                </span>
              </div>
            </div>
          </section>
        )}

        {/* 통관 정보 */}
        {(() => {
          const info = getCustomsInfo(countryCode);
          if (!info) return null;
          return (
            <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-rose-500 px-4 py-3 flex items-center gap-2">
                <ShieldAlert size={15} className="text-white" />
                <span className="text-white font-semibold text-sm">
                  {country.flag} {country.name} 통관 정보
                </span>
              </div>
              <div className="p-4 space-y-3">
                {/* 면세한도 */}
                <div className="bg-brand-50 rounded-xl px-3 py-2.5 border border-brand-100">
                  <p className="text-[10px] font-bold text-brand-700 mb-1">💰 면세한도</p>
                  <p className="text-sm font-bold text-brand-900">{info.dutyFree}</p>
                  {info.dutyFreeNote && (
                    <p className="text-[10px] text-brand-600 mt-0.5">{info.dutyFreeNote}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* 금지품목 */}
                  <div className="bg-red-50 rounded-xl px-3 py-2.5 border border-red-100">
                    <p className="text-[10px] font-bold text-red-700 mb-1.5">🚫 절대 금지</p>
                    <ul className="space-y-0.5">
                      {info.prohibited.map(item => (
                        <li key={item} className="text-[10px] text-red-700 flex items-start gap-1">
                          <span className="shrink-0">•</span><span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* 제한품목 */}
                  <div className="bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-100">
                    <p className="text-[10px] font-bold text-amber-700 mb-1.5">⚠️ 제한·주의</p>
                    <ul className="space-y-0.5">
                      {info.restricted.map(item => (
                        <li key={item} className="text-[10px] text-amber-700 flex items-start gap-1">
                          <span className="shrink-0">•</span><span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* 배터리 + 유의사항 */}
                <div className="flex items-start gap-2 bg-violet-50 rounded-xl px-3 py-2.5 border border-violet-100">
                  <Zap size={12} className="text-brand-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-violet-700">
                    <span className="font-bold">리튬배터리</span> {info.batteryLimit}
                  </p>
                </div>
                {info.customsNote && (
                  <div className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                    <p className="text-[10px] text-gray-500 leading-relaxed">📌 {info.customsNote}</p>
                  </div>
                )}
              </div>
            </section>
          );
        })()}
      </div>
    </div>
  );
}
