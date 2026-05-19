"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Calculator, Package, Globe, Weight,
  ChevronDown, ChevronUp, Info, Loader2, RotateCcw,
} from "lucide-react";

// ─── 서비스 유형 ─────────────────────────────────────────────
const SERVICES = [
  {
    id: "ems-parcel",
    label: "EMS",
    sublabel: "비서류",
    premiumcd: "31",
    em_ee: "em",
    color: "bg-blue-600",
    textColor: "text-blue-600",
    borderColor: "border-blue-600",
    maxWeight: 30000,
    desc: "항공 특급 / 전세계 배송",
  },
  {
    id: "ems-doc",
    label: "EMS",
    sublabel: "서류",
    premiumcd: "31",
    em_ee: "ee",
    color: "bg-blue-400",
    textColor: "text-blue-400",
    borderColor: "border-blue-400",
    maxWeight: 30000,
    desc: "문서·서류 전용",
  },
  {
    id: "ems-premium",
    label: "EMS 프리미엄",
    sublabel: "비서류",
    premiumcd: "32",
    em_ee: "em",
    color: "bg-violet-600",
    textColor: "text-violet-600",
    borderColor: "border-violet-600",
    maxWeight: 30000,
    desc: "빠른 배송 / 주요국",
  },
  {
    id: "k-packet",
    label: "K-Packet",
    sublabel: "",
    premiumcd: "14",
    em_ee: "rl",
    color: "bg-emerald-600",
    textColor: "text-emerald-600",
    borderColor: "border-emerald-600",
    maxWeight: 2000,
    desc: "소형 / 2kg 이하 경량",
  },
] as const;

// ─── 주요 국가 목록 ───────────────────────────────────────────
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

interface QuoteResult {
  totalFee: number;
  realWeight: number;
  volWeight: number;
  appliedWeight: number;
}

export default function ShippingCalcPage() {
  const router = useRouter();

  const [serviceId, setServiceId] = useState<string>("ems-parcel");
  const [countryCode, setCountryCode] = useState<string>("JP");
  const [countrySearch, setCountrySearch] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);

  const [weight, setWeight] = useState<string>("1000");
  const [length, setLength] = useState<string>("");
  const [width, setWidth]   = useState<string>("");
  const [height, setHeight] = useState<string>("");

  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<QuoteResult | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const service    = SERVICES.find(s => s.id === serviceId)!;
  const country    = COUNTRIES.find(c => c.code === countryCode)!;
  const filtered   = COUNTRIES.filter(c =>
    c.name.includes(countrySearch) || c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const volWeight = length && width && height
    ? Math.round((parseFloat(length) * parseFloat(width) * parseFloat(height)) / 6)
    : 0;
  const realWeight   = parseFloat(weight) || 0;
  const appliedWeight = Math.max(realWeight, volWeight);

  async function calculate() {
    setError(null);
    setResult(null);
    if (!weight || parseFloat(weight) <= 0) {
      setError("무게를 입력해주세요.");
      return;
    }
    if (parseFloat(weight) > service.maxWeight) {
      setError(`${service.label} ${service.sublabel} 최대 중량은 ${(service.maxWeight/1000).toFixed(0)}kg 입니다.`);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        premiumcd:  service.premiumcd,
        em_ee:      service.em_ee,
        countrycd:  countryCode,
        totweight:  String(Math.round(appliedWeight)),
        ...(length ? { boxlength: length } : {}),
        ...(width  ? { boxwidth:  width  } : {}),
        ...(height ? { boxheight: height } : {}),
      });
      const res = await fetch(`/api/ems/quote?${params}`);
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 400) throw new Error("선택 국가에서 해당 서비스를 지원하지 않습니다.");
        throw new Error(data.error ?? "견적 조회 실패");
      }
      setResult({
        totalFee:      data.totalFee,
        realWeight,
        volWeight,
        appliedWeight,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
    setWeight("1000");
    setLength("");
    setWidth("");
    setHeight("");
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-[430px] mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="p-1 -ml-1">
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <h1 className="text-base font-semibold text-gray-900 flex items-center gap-1.5">
            <Calculator size={17} className="text-blue-600" />
            국제배송 요금 계산기
          </h1>
        </div>
      </div>

      <div className="max-w-[430px] mx-auto px-4 py-4 space-y-4">

        {/* ① 서비스 선택 */}
        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-1.5">
            <Package size={13} /> 서비스 선택
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SERVICES.map(s => (
              <button
                key={s.id}
                onClick={() => { setServiceId(s.id); setResult(null); setError(null); }}
                className={`rounded-xl border-2 p-3 text-left transition-all active:scale-[0.97] ${
                  serviceId === s.id
                    ? `${s.borderColor} bg-white shadow-md`
                    : "border-gray-100 bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`w-2 h-2 rounded-full ${s.color}`} />
                  <span className={`text-sm font-bold ${serviceId === s.id ? s.textColor : "text-gray-800"}`}>
                    {s.label}
                  </span>
                  {s.sublabel && (
                    <span className="text-[10px] bg-gray-100 text-gray-500 rounded px-1">{s.sublabel}</span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">{s.desc}</p>
                <p className="text-[10px] text-gray-300 mt-0.5">최대 {(s.maxWeight/1000).toFixed(0)}kg</p>
              </button>
            ))}
          </div>
        </section>

        {/* ② 목적국 선택 */}
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
            {countryOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
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
                    onClick={() => { setCountryCode(c.code); setCountryOpen(false); setResult(null); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-blue-50 transition-colors ${
                      c.code === countryCode ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"
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

        {/* ③ 무게 & 크기 */}
        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-1.5">
            <Weight size={13} /> 무게 & 크기
          </p>

          {/* 실중량 */}
          <div className="mb-3">
            <label className="block text-xs text-gray-400 mb-1">실중량 (g) <span className="text-red-400">*</span></label>
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              <input
                type="number"
                min="1"
                max={service.maxWeight}
                value={weight}
                onChange={e => { setWeight(e.target.value); setResult(null); }}
                className="flex-1 bg-transparent text-sm font-medium text-gray-900 outline-none"
                placeholder="예: 1000"
              />
              <span className="text-xs text-gray-400">g</span>
              <span className="text-xs text-gray-300">({weight ? (parseFloat(weight)/1000).toFixed(2) : "0"}kg)</span>
            </div>
          </div>

          {/* 박스 크기 */}
          <div className="mb-1">
            <label className="block text-xs text-gray-400 mb-1">박스 크기 (cm) — 부피중량 계산용</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "가로", val: length, set: setLength },
                { label: "세로", val: width,  set: setWidth  },
                { label: "높이", val: height, set: setHeight },
              ].map(({ label, val, set }) => (
                <div key={label} className="bg-gray-50 rounded-xl border border-gray-100 px-3 py-2.5">
                  <p className="text-[10px] text-gray-400 mb-1">{label}</p>
                  <input
                    type="number"
                    min="0"
                    value={val}
                    onChange={e => { set(e.target.value); setResult(null); }}
                    className="w-full bg-transparent text-sm font-medium text-gray-900 outline-none"
                    placeholder="cm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 부피중량 계산 결과 */}
          {volWeight > 0 && (
            <div className="mt-3 bg-blue-50 rounded-xl px-4 py-3 text-xs space-y-1">
              <div className="flex justify-between text-gray-600">
                <span>실중량</span>
                <span className="font-medium">{realWeight.toLocaleString()} g</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>부피중량 ({length}×{width}×{height}÷6)</span>
                <span className="font-medium">{volWeight.toLocaleString()} g</span>
              </div>
              <div className="flex justify-between border-t border-blue-100 pt-1 mt-1">
                <span className="font-semibold text-blue-700">적용 중량</span>
                <span className="font-bold text-blue-700">{appliedWeight.toLocaleString()} g ({(appliedWeight/1000).toFixed(2)}kg)</span>
              </div>
            </div>
          )}

          {/* 안내 */}
          <div className="mt-3 flex gap-1.5 text-[11px] text-gray-400">
            <Info size={12} className="shrink-0 mt-0.5" />
            <span>부피중량 = 가로 × 세로 × 높이 ÷ 6. 실중량과 부피중량 중 큰 값이 적용됩니다.</span>
          </div>
        </section>

        {/* 계산 버튼 */}
        <button
          onClick={calculate}
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded-2xl py-4 font-semibold text-base shadow-md active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading
            ? <><Loader2 size={18} className="animate-spin" /> 계산 중...</>
            : <><Calculator size={18} /> 배송비 계산하기</>
          }
        </button>

        {/* 에러 */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* 결과 */}
        {result && (
          <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* 서비스 배지 */}
            <div className={`${service.color} px-4 py-3 flex items-center justify-between`}>
              <div>
                <p className="text-white/80 text-xs">{country.flag} {country.name} · {service.label} {service.sublabel}</p>
                <p className="text-white font-bold text-sm mt-0.5">예상 배송비</p>
              </div>
              <button onClick={reset} className="text-white/70 hover:text-white">
                <RotateCcw size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* 금액 */}
              <div className="text-center py-3">
                <p className="text-4xl font-bold text-gray-900">
                  {result.totalFee.toLocaleString()}
                  <span className="text-lg font-medium text-gray-500 ml-1">원</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">VAT 포함 · 실제 접수 시 변동될 수 있음</p>
              </div>

              {/* 중량 요약 */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-500">
                  <span>실중량</span>
                  <span>{result.realWeight.toLocaleString()} g</span>
                </div>
                {result.volWeight > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>부피중량</span>
                    <span>{result.volWeight.toLocaleString()} g</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-gray-700 pt-1 border-t border-gray-100">
                  <span>적용 중량</span>
                  <span>{result.appliedWeight.toLocaleString()} g ({(result.appliedWeight/1000).toFixed(2)}kg)</span>
                </div>
              </div>

              {/* 안내 */}
              <div className="flex gap-2 bg-yellow-50 rounded-xl p-3 text-[11px] text-yellow-800">
                <Info size={13} className="shrink-0 mt-0.5" />
                <span>실제 접수 시 창고에서 실측한 무게·크기로 요금이 재계산될 수 있습니다. 이 금액은 예상치입니다.</span>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
