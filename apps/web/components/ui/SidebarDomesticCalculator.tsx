"use client";

import { useState } from "react";
import { Calculator, Package, ChevronDown, MapPin, RotateCcw } from "lucide-react";

// ── 요금 테이블 (창구접수 · 등기소포) ──────────────────────────────
// 구분: 크기(L+W+H) 및 무게에 따라 8개 구간
const TIERS = [
  { id: 1, maxSizeCm: 80,  maxWeightG: 3000,  label: "80cm이하 · 3kg이하", regular: 4000,  jejuExpress: 6500  },
  { id: 2, maxSizeCm: 100, maxWeightG: 5000,  label: "~100cm · 5kg이하",   regular: 4500,  jejuExpress: 7000  },
  { id: 3, maxSizeCm: 100, maxWeightG: 7000,  label: "~100cm · 7kg이하",   regular: 5000,  jejuExpress: 7500  },
  { id: 4, maxSizeCm: 120, maxWeightG: 10000, label: "~120cm · 10kg이하",  regular: 6000,  jejuExpress: 8500  },
  { id: 5, maxSizeCm: 120, maxWeightG: 15000, label: "~120cm · 15kg이하",  regular: 7000,  jejuExpress: 9500  },
  { id: 6, maxSizeCm: 120, maxWeightG: 20000, label: "~120cm · 20kg이하",  regular: 8000,  jejuExpress: 10500 },
  { id: 7, maxSizeCm: 120, maxWeightG: 25000, label: "~120cm · 25kg이하",  regular: 11000, jejuExpress: 13500 },
  { id: 8, maxSizeCm: 160, maxWeightG: 30000, label: "~160cm · 30kg이하",  regular: 13000, jejuExpress: 15500 },
] as const;

// 크기 구간 → 최소 tier id (크기만으로 결정되는 하한)
function sizeMinTierId(sizeCm: number): number {
  if (sizeCm <= 80)  return 1;
  if (sizeCm <= 100) return 2;
  if (sizeCm <= 120) return 4;
  return 8;
}
// 무게 → tier id
function weightTierId(weightG: number): number {
  if (weightG <= 3000)  return 1;
  if (weightG <= 5000)  return 2;
  if (weightG <= 7000)  return 3;
  if (weightG <= 10000) return 4;
  if (weightG <= 15000) return 5;
  if (weightG <= 20000) return 6;
  if (weightG <= 25000) return 7;
  return 8;
}

type DestType = "regular" | "jejuExpress";

const DEST_OPTS: { id: DestType; label: string; sub: string }[] = [
  { id: "regular",     label: "일반",       sub: "전국 익일배달" },
  { id: "jejuExpress", label: "제주발 익일", sub: "제주→육지 익일" },
];

export default function SidebarDomesticCalculator() {
  const [weightG, setWeightG]     = useState("1000");
  const [length,  setLength]      = useState("");
  const [width,   setWidth]       = useState("");
  const [height,  setHeight]      = useState("");
  const [dest,    setDest]        = useState<DestType>("regular");
  const [result,  setResult]      = useState<{ tier: typeof TIERS[number]; fee: number } | null>(null);
  const [error,   setError]       = useState<string | null>(null);

  const volSizeCm = length && width && height
    ? parseFloat(length) + parseFloat(width) + parseFloat(height)
    : null;

  function reset() { setResult(null); setError(null); }

  function calc() {
    setError(null);
    setResult(null);

    const w = parseFloat(weightG);
    if (!w || w <= 0) { setError("무게를 입력해주세요."); return; }
    if (w > 30000)    { setError("최대 30kg 초과 — 등기소포 불가."); return; }

    const wTier  = weightTierId(w);
    let   sTier  = 1;
    if (volSizeCm !== null) {
      if (volSizeCm > 160) { setError("크기 합계가 160cm를 초과합니다."); return; }
      sTier = sizeMinTierId(volSizeCm);
    }
    const tierId = Math.max(wTier, sTier);
    const tier   = TIERS[tierId - 1];
    setResult({ tier, fee: tier[dest] });
  }

  return (
    <div className="w-full bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden select-none">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-800 px-4 py-3 flex items-center gap-2 shrink-0 min-w-0">
        <Package size={16} className="text-white shrink-0" />
        <span className="text-white font-semibold text-sm whitespace-nowrap">국내배송 계산기</span>
        <span className="ml-auto text-white/60 text-xs shrink-0 whitespace-nowrap">창구접수 · 등기소포</span>
      </div>

      <div className="p-4 space-y-3">
        {/* 배송 목적지 유형 */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">배송 구분</p>
          <div className="grid grid-cols-2 gap-1.5">
            {DEST_OPTS.map(opt => (
              <button
                key={opt.id}
                onClick={() => { setDest(opt.id); reset(); }}
                className={`rounded-lg px-2 py-2 text-center border transition-all ${
                  dest === opt.id
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-gray-100 bg-gray-50 text-gray-500 hover:bg-gray-100"
                }`}
              >
                <p className="text-xs font-semibold leading-tight">{opt.label}</p>
                <p className="text-[9px] text-current opacity-60 mt-0.5">{opt.sub}</p>
              </button>
            ))}
          </div>
          {dest !== "regular" && (
            <p className="text-[9px] text-amber-600 mt-1.5 bg-amber-50 rounded-lg px-2 py-1 border border-amber-100">
              ※ 제주발 익일배달은 제주→육지 발송에만 적용
            </p>
          )}
        </div>

        {/* 실중량 */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">실중량</p>
          <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
            <input
              type="number" min="1"
              value={weightG}
              onChange={e => { setWeightG(e.target.value); reset(); }}
              className="flex-1 bg-transparent text-sm font-medium text-gray-900 outline-none w-0"
              placeholder="1000"
            />
            <span className="text-xs text-gray-400 shrink-0">g</span>
          </div>
          {parseFloat(weightG) > 0 && (
            <p className="text-[10px] text-gray-400 mt-1">
              = {(parseFloat(weightG) / 1000).toFixed(2).replace(/\.?0+$/, "")}kg
            </p>
          )}
        </div>

        {/* 박스 크기 (선택) */}
        <details className="group">
          <summary className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide cursor-pointer flex items-center gap-1 list-none">
            <ChevronDown size={10} className="group-open:rotate-180 transition-transform" />
            박스 크기 (가로+세로+높이 합계)
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
          {volSizeCm !== null && (
            <p className="text-[10px] text-emerald-600 mt-1.5">
              합계 {volSizeCm.toFixed(0)}cm
            </p>
          )}
        </details>

        {/* 계산 버튼 */}
        <button
          onClick={calc}
          className="w-full bg-emerald-600 text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
        >
          <Calculator size={14} />
          배송비 계산
        </button>

        {/* 에러 */}
        {error && (
          <p className="text-xs text-red-500 text-center">{error}</p>
        )}

        {/* 결과 */}
        {result && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-[10px] text-gray-400">
                {DEST_OPTS.find(d => d.id === dest)?.label} · {result.tier.label}
              </p>
              <button onClick={reset} className="text-gray-300 hover:text-gray-500">
                <RotateCcw size={12} />
              </button>
            </div>
            <div className="rounded-xl px-4 py-3 bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-emerald-800">등기소포</p>
                  <p className="text-[10px] text-emerald-600">{result.tier.label}</p>
                </div>
              </div>
              <span className="text-lg font-bold text-emerald-900">
                {result.fee.toLocaleString()}원
              </span>
            </div>
            <p className="text-[10px] text-gray-400 text-center pt-0.5">
              창구접수 기준 · 실제 접수 시 우체국 요금으로 확정
            </p>
          </div>
        )}

        {/* 요금 안내 (접기) */}
        <details className="group">
          <summary className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide cursor-pointer flex items-center gap-1 list-none">
            <ChevronDown size={10} className="group-open:rotate-180 transition-transform" />
            전체 요금표
          </summary>
          <div className="mt-2 space-y-1">
            {TIERS.map(t => (
              <div key={t.id} className="flex items-center justify-between text-[10px] px-2 py-1 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-gray-500 truncate pr-2">{t.label}</span>
                <div className="flex gap-2 shrink-0">
                  <span className="text-gray-700 font-medium">{t.regular.toLocaleString()}</span>
                  <span className="text-amber-600">{t.jejuExpress.toLocaleString()}</span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-end gap-3 text-[9px] text-gray-400 px-1 pt-0.5">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block"/>일반</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>제주발 익일</span>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
