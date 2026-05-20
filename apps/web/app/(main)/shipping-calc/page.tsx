"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Calculator, Globe, Weight,
  ChevronDown, ChevronUp, Info, Loader2, RotateCcw, CheckCircle2, XCircle,
  ShieldAlert, Zap,
} from "lucide-react";
import { getCustomsInfo } from "@/lib/customs-data";

const SERVICES = [
  {
    id: "ems-parcel",
    label: "EMS",
    sublabel: "ÎπÑÏÑúÎ•?,
    premiumcd: "31",
    em_ee: "em",
    color: "bg-blue-600",
    textColor: "text-blue-700",
    badgeBg: "bg-blue-50",
    badgeBorder: "border-blue-200",
    maxWeight: 30000,
  },
  {
    id: "ems-doc",
    label: "EMS",
    sublabel: "?úÎ•ò",
    premiumcd: "31",
    em_ee: "ee",
    color: "bg-blue-400",
    textColor: "text-blue-500",
    badgeBg: "bg-sky-50",
    badgeBorder: "border-sky-200",
    maxWeight: 30000,
  },
  {
    id: "ems-premium",
    label: "EMS ?ÑÎ¶¨ÎØ∏ÏóÑ",
    sublabel: "ÎπÑÏÑúÎ•?,
    premiumcd: "32",
    em_ee: "em",
    color: "bg-violet-600",
    textColor: "text-violet-700",
    badgeBg: "bg-violet-50",
    badgeBorder: "border-violet-200",
    maxWeight: 30000,
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
  { code: "JP", name: "?ºÎ≥∏", flag: "?áØ?áµ" },
  { code: "US", name: "ÎØ∏Íµ≠", flag: "?á∫?á∏" },
  { code: "CN", name: "Ï§ëÍµ≠", flag: "?á®?á≥" },
  { code: "AU", name: "?∏Ï£º", flag: "?á¶?á∫" },
  { code: "CA", name: "Ï∫êÎÇò??, flag: "?á®?á¶" },
  { code: "GB", name: "?ÅÍµ≠", flag: "?á¨?áß" },
  { code: "DE", name: "?ÖÏùº", flag: "?á©?á™" },
  { code: "FR", name: "?ÑÎûë??, flag: "?á´?á∑" },
  { code: "SG", name: "?±Í??¨Î•¥", flag: "?á∏?á¨" },
  { code: "HK", name: "?çÏΩ©", flag: "?á≠?á∞" },
  { code: "TH", name: "?úÍµ≠", flag: "?áπ?á≠" },
  { code: "VN", name: "Î≤†Ìä∏??, flag: "?áª?á≥" },
  { code: "PH", name: "?ÑÎ¶¨?Ä", flag: "?áµ?á≠" },
  { code: "MY", name: "ÎßêÎ†à?¥Ïãú??, flag: "?á≤?áæ" },
  { code: "ID", name: "?∏ÎèÑ?§Ïãú??, flag: "?áÆ?á©" },
  { code: "TW", name: "?ÄÎß?, flag: "?áπ?áº" },
  { code: "MO", name: "ÎßàÏπ¥??, flag: "?á≤?á¥" },
  { code: "MN", name: "Î™ΩÍ≥®", flag: "?á≤?á≥" },
  { code: "NZ", name: "?¥Ïßà?úÎìú", flag: "?á≥?áø" },
  { code: "IT", name: "?¥ÌÉàÎ¶¨ÏïÑ", flag: "?áÆ?áπ" },
  { code: "ES", name: "?§Ìéò??, flag: "?á™?á∏" },
  { code: "NL", name: "?§Îçú?Ä??, flag: "?á≥?á±" },
  { code: "SE", name: "?§Ïõ®??, flag: "?á∏?á™" },
  { code: "CH", name: "?§ÏúÑ??, flag: "?á®?á≠" },
  { code: "RU", name: "?¨Ïãú??, flag: "?á∑?á∫" },
  { code: "BR", name: "Î∏åÎùºÏß?, flag: "?áß?á∑" },
  { code: "MX", name: "Î©ïÏãúÏΩ?, flag: "?á≤?áΩ" },
  { code: "AE", name: "?ÑÎûç?êÎ?Î¶¨Ìä∏", flag: "?á¶?á™" },
  { code: "SA", name: "?¨Ïö∞?îÏïÑ?ºÎπÑ??, flag: "?á∏?á¶" },
  { code: "IN", name: "?∏ÎèÑ", flag: "?áÆ?á≥" },
];

type ServiceResult =
  | { status: "ok"; fee: number }
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
  ): Promise<ServiceResult> {
    if (wg > svc.maxWeight) return { status: "overweight" };
    const params = new URLSearchParams({
      premiumcd: svc.premiumcd,
      em_ee: svc.em_ee,
      countrycd: cc,
      totweight: String(Math.round(wg)),
      ...(l ? { boxlength: l } : {}),
      ...(w ? { boxwidth: w } : {}),
      ...(h ? { boxheight: h } : {}),
    });
    const res = await fetch(`/api/ems/quote?${params}`);
    const data = await res.json();
    if (!res.ok) return { status: "error", message: data.error ?? "Ï°∞Ìöå ?§Ìå®" };
    return { status: "ok", fee: data.totalFee };
  }

  async function calculate() {
    setInputError(null);
    setResults(null);
    if (!weight || parseFloat(weight) <= 0) {
      setInputError("Î¨¥Í≤åÎ•??ÖÎ†•?¥Ï£º?∏Ïöî.");
      return;
    }

    setLoading(true);
    try {
      const services: Record<string, ServiceResult> = {};
      for (const svc of SERVICES) {
        services[svc.id] = await fetchService(svc, appliedWeight, countryCode, length, width, height);
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
  }

  const cheapestFee = results
    ? Math.min(
        ...Object.values(results.services)
          .filter((r): r is { status: "ok"; fee: number } => r.status === "ok")
          .map(r => r.fee)
      )
    : Infinity;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* ?§Îçî */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-[600px] mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="p-1 -ml-1">
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <h1 className="text-base font-semibold text-gray-900 flex items-center gap-1.5">
            <Calculator size={17} className="text-blue-600" />
            Íµ?†úÎ∞∞ÏÜ° ?îÍ∏à Í≥ÑÏÇ∞Í∏?          </h1>
        </div>
      </div>

      <div className="max-w-[600px] mx-auto px-4 py-4 space-y-4">

        {/* Î™©Ï†ÅÍµ?*/}
        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-1.5">
            <Globe size={13} /> Î™©Ï†ÅÍµ?          </p>
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
                  placeholder="Íµ?? Í≤Ä??.."
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
                  <p className="text-center text-sm text-gray-400 py-4">Í≤Ä??Í≤∞Í≥º ?ÜÏùå</p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Î¨¥Í≤å & ?¨Í∏∞ */}
        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-1.5">
            <Weight size={13} /> Î¨¥Í≤å & ?¨Í∏∞
          </p>

          <div className="mb-3">
            <label className="block text-xs text-gray-400 mb-1">
              ?§Ï§ë??(g) <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              <input
                type="number"
                min="1"
                value={weight}
                onChange={e => { setWeight(e.target.value); setResults(null); }}
                className="flex-1 bg-transparent text-sm font-medium text-gray-900 outline-none"
                placeholder="?? 1000"
              />
              <span className="text-xs text-gray-400">g</span>
              <span className="text-xs text-gray-300">
                ({weight ? (parseFloat(weight) / 1000).toFixed(2) : "0"}kg)
              </span>
            </div>
          </div>

          <div className="mb-1">
            <label className="block text-xs text-gray-400 mb-1">Î∞ïÏä§ ?¨Í∏∞ (cm) ??Î∂Ä?ºÏ§ë??Í≥ÑÏÇ∞??/label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Í∞ÄÎ°?, val: length, set: setLength },
                { label: "?∏Î°ú", val: width, set: setWidth },
                { label: "?íÏù¥", val: height, set: setHeight },
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
            <div className="mt-3 bg-blue-50 rounded-xl px-4 py-3 text-xs space-y-1">
              <div className="flex justify-between text-gray-600">
                <span>?§Ï§ë??/span>
                <span className="font-medium">{realWeight.toLocaleString()} g</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Î∂Ä?ºÏ§ë??({length}√ó{width}√ó{height}√∑6)</span>
                <span className="font-medium">{volWeight.toLocaleString()} g</span>
              </div>
              <div className="flex justify-between border-t border-blue-100 pt-1 mt-1">
                <span className="font-semibold text-blue-700">?ÅÏö© Ï§ëÎüâ</span>
                <span className="font-bold text-blue-700">
                  {appliedWeight.toLocaleString()} g ({(appliedWeight / 1000).toFixed(2)}kg)
                </span>
              </div>
            </div>
          )}

          <div className="mt-3 flex gap-1.5 text-[11px] text-gray-400">
            <Info size={12} className="shrink-0 mt-0.5" />
            <span>Î∂Ä?ºÏ§ë??= Í∞ÄÎ°?√ó ?∏Î°ú √ó ?íÏù¥ √∑ 6. ?§Ï§ë?âÍ≥º Î∂Ä?ºÏ§ë??Ï§???Í∞íÏù¥ ?ÅÏö©?©Îãà??</span>
          </div>
        </section>

        {/* Í≥ÑÏÇ∞ Î≤ÑÌäº */}
        <button
          onClick={calculate}
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded-2xl py-4 font-semibold text-base shadow-md active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading
            ? <><Loader2 size={18} className="animate-spin" /> Í≥ÑÏÇ∞ Ï§?..</>
            : <><Calculator size={18} /> ?ÑÏ≤¥ ?úÎπÑ???îÍ∏à ÎπÑÍµê</>}
        </button>

        {/* ?ÖÎ†• ?§Î•ò */}
        {inputError && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-sm text-red-600">
            {inputError}
          </div>
        )}

        {/* ?µÍ? ?ïÎ≥¥ */}
        {(() => {
          const info = getCustomsInfo(countryCode);
          if (!info) return null;
          return (
            <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-rose-500 px-4 py-3 flex items-center gap-2">
                <ShieldAlert size={15} className="text-white" />
                <span className="text-white font-semibold text-sm">
                  {country.flag} {country.name} ?µÍ? ?ïÎ≥¥
                </span>
              </div>
              <div className="p-4 space-y-3">
                {/* Î©¥ÏÑ∏?úÎèÑ */}
                <div className="bg-blue-50 rounded-xl px-3 py-2.5 border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-700 mb-1">?í∞ Î©¥ÏÑ∏?úÎèÑ</p>
                  <p className="text-sm font-bold text-blue-900">{info.dutyFree}</p>
                  {info.dutyFreeNote && (
                    <p className="text-[10px] text-blue-600 mt-0.5">{info.dutyFreeNote}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Í∏àÏ??àÎ™© */}
                  <div className="bg-red-50 rounded-xl px-3 py-2.5 border border-red-100">
                    <p className="text-[10px] font-bold text-red-700 mb-1.5">?ö´ ?àÎ? Í∏àÏ?</p>
                    <ul className="space-y-0.5">
                      {info.prohibited.map(item => (
                        <li key={item} className="text-[10px] text-red-700 flex items-start gap-1">
                          <span className="shrink-0">??/span><span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* ?úÌïú?àÎ™© */}
                  <div className="bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-100">
                    <p className="text-[10px] font-bold text-amber-700 mb-1.5">?†Ô∏è ?úÌïú¬∑Ï£ºÏùò</p>
                    <ul className="space-y-0.5">
                      {info.restricted.map(item => (
                        <li key={item} className="text-[10px] text-amber-700 flex items-start gap-1">
                          <span className="shrink-0">??/span><span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Î∞∞ÌÑ∞Î¶?+ ?†Ïùò?¨Ìï≠ */}
                <div className="flex items-start gap-2 bg-violet-50 rounded-xl px-3 py-2.5 border border-violet-100">
                  <Zap size={12} className="text-violet-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-violet-700">
                    <span className="font-bold">Î¶¨Ìä¨Î∞∞ÌÑ∞Î¶?/span> {info.batteryLimit}
                  </p>
                </div>
                {info.customsNote && (
                  <div className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                    <p className="text-[10px] text-gray-500 leading-relaxed">?ìå {info.customsNote}</p>
                  </div>
                )}
              </div>
            </section>
          );
        })()}

        {/* Í≤∞Í≥º ÎπÑÍµê??*/}
        {results && (
          <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* ?§Îçî */}
            <div className="bg-blue-600 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-white/80 text-xs">
                  {country.flag} {country.name} ¬∑ ?ÅÏö© Ï§ëÎüâ {results.appliedWeight.toLocaleString()} g
                </p>
                <p className="text-white font-bold text-sm mt-0.5">?úÎπÑ?§Î≥Ñ ?àÏÉÅ Î∞∞ÏÜ°Îπ?/p>
              </div>
              <button onClick={reset} className="text-white/70 hover:text-white">
                <RotateCcw size={16} />
              </button>
            </div>

            <div className="divide-y divide-gray-50">
              {SERVICES.map(svc => {
                const r = results.services[svc.id];
                const isCheapest = r.status === "ok" && r.fee === cheapestFee;
                return (
                  <div
                    key={svc.id}
                    className={`flex items-center gap-3 px-4 py-3.5 ${
                      isCheapest ? "bg-green-50" : ""
                    }`}
                  >
                    {/* ?úÎπÑ?§Î™Ö */}
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
                            ÏµúÏ?Í∞Ä
                          </span>
                        )}
                      </div>
                      {svc.maxWeight < 30000 && (
                        <p className="text-[10px] text-gray-400 mt-0.5 ml-3.5">
                          ÏµúÎ? {svc.maxWeight / 1000}kg
                        </p>
                      )}
                    </div>

                    {/* Í∏àÏï° / ?ÅÌÉú */}
                    <div className="text-right shrink-0">
                      {r.status === "ok" && (
                        <div className="flex items-center gap-1">
                          <CheckCircle2 size={13} className="text-green-500" />
                          <span className={`text-base font-bold ${isCheapest ? "text-green-700" : "text-gray-900"}`}>
                            {r.fee.toLocaleString()}
                            <span className="text-xs font-normal text-gray-400 ml-0.5">??/span>
                          </span>
                        </div>
                      )}
                      {r.status === "overweight" && (
                        <div className="flex items-center gap-1">
                          <XCircle size={13} className="text-orange-400" />
                          <span className="text-xs text-orange-500 font-medium">Ï§ëÎüâ Ï¥àÍ≥º</span>
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

            {/* ?àÎÇ¥ */}
            <div className="px-4 pb-4 pt-2">
              <div className="flex gap-2 bg-yellow-50 rounded-xl p-3 text-[11px] text-yellow-800">
                <Info size={13} className="shrink-0 mt-0.5" />
                <span>
                  VAT ?¨Ìï® ?àÏÉÅ Í∏àÏï°?ÖÎãà?? ?§Ï†ú ?ëÏàò ??Ï∞ΩÍ≥† ?§Ï∏° Î¨¥Í≤å¬∑?¨Í∏∞Î°??¨Í≥Ñ?∞Îê† ???àÏäµ?àÎã§.
                </span>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
