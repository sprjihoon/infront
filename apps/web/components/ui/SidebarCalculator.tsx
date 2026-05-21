"use client";

import { useState } from "react";
import { Calculator, Loader2, RotateCcw, ChevronDown, ChevronUp, Package, FileText } from "lucide-react";

const PARCEL_SERVICES = [
  { id: "ems-parcel",  label: "EMS 비서류",  premiumcd: "31", em_ee: "em", color: "bg-blue-600",    maxW: 30000 },
  { id: "ems-premium", label: "EMS프리미엄", premiumcd: "32", em_ee: "em", color: "bg-violet-600",  maxW: 30000 },
  { id: "k-packet",    label: "K-Packet",   premiumcd: "14", em_ee: "rl", color: "bg-emerald-600", maxW: 2000  },
] as const;

const DOC_SERVICES = [
  { id: "ems-doc", label: "EMS 서류", premiumcd: "31", em_ee: "ee", color: "bg-blue-400", maxW: 30000 },
] as const;

const POPULAR = [
  { code: "JP", flag: "🇯🇵", name: "일본" },
  { code: "US", flag: "🇺🇸", name: "미국" },
  { code: "CN", flag: "🇨🇳", name: "중국" },
  { code: "AU", flag: "🇦🇺", name: "호주" },
  { code: "CA", flag: "🇨🇦", name: "캐나다" },
  { code: "GB", flag: "🇬🇧", name: "영국" },
  { code: "DE", flag: "🇩🇪", name: "독일" },
  { code: "SG", flag: "🇸🇬", name: "싱가포르" },
  { code: "TH", flag: "🇹🇭", name: "태국" },
  { code: "VN", flag: "🇻🇳", name: "베트남" },
  { code: "HK", flag: "🇭🇰", name: "홍콩" },
  { code: "TW", flag: "🇹🇼", name: "대만" },
];

type ServiceResult = {
  id: string;
  label: string;
  color: string;
  fee: number | null;
  err: string | null;
};

export default function SidebarCalculator() {
  const [docType, setDocType] = useState<"parcel" | "doc">("parcel");
  const [country, setCountry] = useState("JP");
  const [weight,  setWeight]  = useState("1000");
  const [length,  setLength]  = useState("");
  const [width,   setWidth]   = useState("");
  const [height,  setHeight]  = useState("");
  const [showMore, setShowMore] = useState(false);

  const [loading, setLoading]   = useState(false);
  const [results, setResults]   = useState<ServiceResult[] | null>(null);
  const [error,   setError]     = useState<string | null>(null);

  const volWeight = length && width && height
    ? Math.round(parseFloat(length) * parseFloat(width) * parseFloat(height) / 6)
    : 0;
  const applied = Math.max(parseFloat(weight) || 0, volWeight);

  const services = docType === "doc" ? DOC_SERVICES : PARCEL_SERVICES;

  function reset() {
    setResults(null);
    setError(null);
  }

  async function calc() {
    setError(null);
    setResults(null);
    if (!weight || parseFloat(weight) <= 0) { setError("무게를 입력해주세요."); return; }

    setLoading(true);
    try {
      const fetches = services.map(async (s): Promise<ServiceResult> => {
        if (applied > s.maxW) {
          return { id: s.id, label: s.label, color: s.color, fee: null, err: `최대 ${s.maxW / 1000}kg 초과` };
        }
        const p = new URLSearchParams({
          premiumcd: s.premiumcd, em_ee: s.em_ee,
          countrycd: country, totweight: String(Math.round(applied)),
          ...(length ? { boxlength: length } : {}),
          ...(width  ? { boxwidth:  width  } : {}),
          ...(height ? { boxheight: height } : {}),
        });
        try {
          const res  = await fetch(`/api/ems/quote?${p}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "조회 실패");
          return { id: s.id, label: s.label, color: s.color, fee: data.totalFee as number, err: null };
        } catch (e) {
          return { id: s.id, label: s.label, color: s.color, fee: null, err: e instanceof Error ? e.message : "오류" };
        }
      });
      setResults(await Promise.all(fetches));
    } finally {
      setLoading(false);
    }
  }

  const selectedCountry = POPULAR.find(c => c.code === country);
  const validFees = results?.filter(r => r.fee !== null).map(r => r.fee!) ?? [];
  const minFee = validFees.length ? Math.min(...validFees) : null;

  return (
    <div className="sticky top-4 w-72 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden select-none">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3 flex items-center gap-2">
        <Calculator size={16} className="text-white" />
        <span className="text-white font-semibold text-sm">가견적 계산기</span>
        <span className="ml-auto text-white/60 text-xs">EMS · K-Packet</span>
      </div>

      <div className="p-4 space-y-3">

        {/* 서류 / 비서류 */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">종류</p>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => { setDocType("parcel"); reset(); }}
              className={`rounded-lg px-3 py-2 text-sm font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                docType === "parcel"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-100 bg-gray-50 text-gray-500 hover:bg-gray-100"
              }`}
            >
              <Package size={13} />
              비서류
            </button>
            <button
              onClick={() => { setDocType("doc"); reset(); }}
              className={`rounded-lg px-3 py-2 text-sm font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                docType === "doc"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-100 bg-gray-50 text-gray-500 hover:bg-gray-100"
              }`}
            >
              <FileText size={13} />
              서류
            </button>
          </div>
        </div>

        {/* 목적국 */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">목적국</p>
          <div className="grid grid-cols-4 gap-1">
            {POPULAR.slice(0, showMore ? 12 : 8).map(c => (
              <button
                key={c.code}
                onClick={() => { setCountry(c.code); reset(); }}
                title={c.name}
                className={`rounded-lg py-1.5 text-center text-base transition-all border ${
                  country === c.code
                    ? "border-blue-500 bg-blue-50 scale-105"
                    : "border-gray-100 bg-gray-50 hover:bg-gray-100"
                }`}
              >
                {c.flag}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowMore(v => !v)}
            className="mt-1 text-[10px] text-blue-500 flex items-center gap-0.5"
          >
            {showMore ? <><ChevronUp size={10} />간략히</> : <><ChevronDown size={10} />더보기</>}
          </button>
          {selectedCountry && (
            <p className="text-xs text-gray-500 mt-1">
              선택: {selectedCountry.flag} {selectedCountry.name} ({selectedCountry.code})
            </p>
          )}
        </div>

        {/* 실중량 */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">실중량</p>
          <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
            <input
              type="number" min="1"
              value={weight}
              onChange={e => { setWeight(e.target.value); reset(); }}
              className="flex-1 bg-transparent text-sm font-medium text-gray-900 outline-none w-0"
              placeholder="1000"
            />
            <span className="text-xs text-gray-400 shrink-0">g</span>
          </div>
        </div>

        {/* 박스 크기 (접기) */}
        <details className="group">
          <summary className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide cursor-pointer flex items-center gap-1 list-none">
            <ChevronDown size={10} className="group-open:rotate-180 transition-transform" />
            박스 크기 (부피중량)
          </summary>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {[
              { label: "가로", val: length, set: setLength },
              { label: "세로", val: width,  set: setWidth  },
              { label: "높이", val: height, set: setHeight },
            ].map(({ label, val, set }) => (
              <div key={label} className="bg-gray-50 rounded-lg border border-gray-100 px-2 py-1.5">
                <p className="text-[9px] text-gray-400">{label}(cm)</p>
                <input
                  type="number" min="0"
                  value={val}
                  onChange={e => { set(e.target.value); reset(); }}
                  className="w-full bg-transparent text-xs font-medium text-gray-900 outline-none"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
          {volWeight > 0 && (
            <p className="text-[10px] text-blue-600 mt-1.5">
              부피중량 {volWeight.toLocaleString()}g · 적용 {applied.toLocaleString()}g
            </p>
          )}
        </details>

        {/* 계산 버튼 */}
        <button
          onClick={calc}
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {loading
            ? <><Loader2 size={14} className="animate-spin" />계산 중...</>
            : <><Calculator size={14} />견적 계산</>
          }
        </button>

        {/* 에러 */}
        {error && (
          <p className="text-xs text-red-500 text-center">{error}</p>
        )}

        {/* 결과 */}
        {results && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-[10px] text-gray-400">
                {selectedCountry?.flag} {selectedCountry?.name} · {docType === "doc" ? "서류" : "비서류"} · {applied.toLocaleString()}g
              </p>
              <button onClick={reset} className="text-gray-300 hover:text-gray-500">
                <RotateCcw size={12} />
              </button>
            </div>
            {results.map(r => (
              <div
                key={r.id}
                className={`rounded-xl px-3 py-2 border flex items-center justify-between ${
                  r.fee !== null && r.fee === minFee && validFees.length > 1
                    ? "bg-blue-50 border-blue-200"
                    : "bg-gray-50 border-gray-100"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${r.color}`} />
                  <span className="text-xs text-gray-600 truncate">{r.label}</span>
                  {r.fee !== null && r.fee === minFee && validFees.length > 1 && (
                    <span className="text-[9px] bg-blue-500 text-white px-1 py-0.5 rounded font-bold shrink-0">최저</span>
                  )}
                </div>
                {r.err ? (
                  <span className="text-[10px] text-gray-400 shrink-0 ml-2">{r.err}</span>
                ) : (
                  <span className="text-sm font-bold text-gray-900 shrink-0 ml-2">{r.fee!.toLocaleString()}원</span>
                )}
              </div>
            ))}
            <p className="text-[10px] text-gray-400 text-center pt-0.5">가견적 · 실제 접수 시 우체국 요금 기준으로 확정</p>
          </div>
        )}
      </div>
    </div>
  );
}
