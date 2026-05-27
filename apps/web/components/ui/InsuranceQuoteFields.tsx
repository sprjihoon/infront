"use client";

import { usdToBoprcKrw } from "@/lib/ems/insurance";
import { useEmsExchangeRate } from "@/lib/hooks/useEmsExchangeRate";

interface InsuranceQuoteFieldsProps {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  usdAmount: string;
  onUsdAmountChange: (value: string) => void;
  compact?: boolean;
}

export default function InsuranceQuoteFields({
  enabled,
  onEnabledChange,
  usdAmount,
  onUsdAmountChange,
  compact = false,
}: InsuranceQuoteFieldsProps) {
  const usd = parseFloat(usdAmount) || 0;
  const { rate, info } = useEmsExchangeRate();
  const labelClass = compact
    ? "text-[10px] font-semibold text-gray-400 uppercase tracking-wide"
    : "text-xs font-semibold text-gray-500";

  return (
    <div className="space-y-2">
      <p className={labelClass}>보험 (선택)</p>
      <button
        type="button"
        onClick={() => onEnabledChange(!enabled)}
        className={`w-full text-left flex items-center gap-3 rounded-xl border-2 transition-all ${
          compact ? "p-3" : "p-4"
        } ${enabled ? "border-brand-500 bg-brand-50" : "border-gray-100 bg-gray-50"}`}
      >
        <div
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
            enabled ? "bg-brand-600 border-brand-600" : "border-gray-300 bg-white"
          }`}
        >
          {enabled && <span className="text-white text-xs font-bold">✓</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-gray-800 ${compact ? "text-xs" : "text-sm"}`}>
            보험료 포함 계산
          </p>
          <p className={`text-gray-400 mt-0.5 ${compact ? "text-[10px]" : "text-xs"}`}>
            신고가액(USD) 기준으로 EMS 보험 수수료를 합산합니다.
          </p>
        </div>
      </button>

      {enabled && (
        <div className={`bg-brand-50 border border-brand-100 rounded-xl space-y-2 ${compact ? "p-3" : "p-4"}`}>
          <label className={`block font-semibold text-brand-800 ${compact ? "text-[10px]" : "text-xs"}`}>
            보험 신고가액 (USD)
          </label>
          <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-brand-100">
            <span className="text-xs text-gray-400 shrink-0">USD</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={usdAmount}
              onChange={(e) => onUsdAmountChange(e.target.value)}
              placeholder="예: 100"
              className="flex-1 bg-transparent text-sm font-medium text-gray-900 outline-none min-w-0"
            />
          </div>
          {info && (
            <p className={`text-brand-600/90 ${compact ? "text-[10px]" : "text-xs"}`}>
              적용 환율: 1 USD = {rate.toLocaleString()}원
              {info.as_of_date_display ? ` (${info.label}, ${info.as_of_date_display})` : ""}
            </p>
          )}
          {usd > 0 ? (
            <p className={`text-brand-700 ${compact ? "text-[10px]" : "text-xs"}`}>
              EMS 보험가액(원화): 약 {usdToBoprcKrw(usd, rate).toLocaleString()}원
            </p>
          ) : (
            <p className={`text-brand-600/80 ${compact ? "text-[10px]" : "text-xs"}`}>
              신고가액을 입력하면 보험 수수료가 포함된 예상 요금을 조회합니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
