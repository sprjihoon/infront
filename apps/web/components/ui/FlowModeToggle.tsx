"use client";

import { useFlowMode } from "@/lib/flow-mode";

/** 일반모드: 단계별 입력 · 고급모드: 한 페이지에 모두 입력 */
export default function FlowModeToggle() {
  const { setMode, isAdvanced } = useFlowMode();

  return (
    <div className="flex items-center gap-2 shrink-0">
      <span
        className={`text-[11px] font-bold whitespace-nowrap ${
          !isAdvanced ? "text-blue-700" : "text-gray-400"
        }`}
      >
        일반모드
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isAdvanced}
        aria-label="일반모드와 고급모드 전환"
        onClick={() => setMode(isAdvanced ? "simple" : "advanced")}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          isAdvanced ? "bg-blue-600" : "bg-gray-300"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            isAdvanced ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <span
        className={`text-[11px] font-bold whitespace-nowrap ${
          isAdvanced ? "text-blue-700" : "text-gray-400"
        }`}
      >
        고급모드
      </span>
    </div>
  );
}
