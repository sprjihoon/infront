"use client";

import FlowModeToggle from "@/components/ui/FlowModeToggle";
import { useFlowMode } from "@/lib/flow-mode";

/**
 * 메인 앱 상단 헤더 — 일반/고급 모드 전환.
 * 추후 수거·창고·출고 등 플로우별 진행률 바를 이 영역에 통합(최보모드).
 */
export default function MainFlowHeader() {
  const { isSimple } = useFlowMode();

  return (
    <header
      className="sticky top-0 z-20 h-12 bg-white/95 backdrop-blur-sm border-b border-gray-100"
      style={{ top: "var(--sat, 0px)" }}
    >
      <div className="h-full px-4 flex items-center justify-between gap-2">
        <div className="min-w-0 leading-tight">
          <p className="text-[10px] font-semibold text-gray-400">입력 방식</p>
          <p className="text-xs font-bold text-gray-800 truncate">
            {isSimple ? "일반모드 · 단계별" : "고급모드 · 한 페이지"}
          </p>
        </div>
        <FlowModeToggle />
      </div>
      {/* TODO(최보모드): 플로우별 전역 진행률 바 — pickup / warehouse / shipping-request */}
    </header>
  );
}
