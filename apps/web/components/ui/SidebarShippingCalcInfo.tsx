"use client";

import { Scale, Box, FileText, Package, Info, AlertCircle } from "lucide-react";

const WEIGHT_LIMITS = [
  { name: "EMS (서류)", limit: "2kg", note: "실중량만 · 구간 요금" },
  { name: "EMS (비서류)", limit: "30kg", note: "부피중량 적용" },
  { name: "EMS 프리미엄", limit: "70kg", note: "부피중량 적용" },
  { name: "K-Packet", limit: "2kg", note: "부피중량 적용" },
] as const;

const DOC_TIERS = ["300g", "500g", "750g", "1kg", "1.25kg", "1.5kg", "1.75kg", "2kg"];

export default function SidebarShippingCalcInfo() {
  return (
    <div className="w-full bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden select-none">
      <div className="bg-gradient-to-r from-brand-600 to-brand-800 px-4 py-3 flex items-center gap-2 shrink-0">
        <Info size={16} className="text-white" />
        <span className="text-white font-semibold text-sm">해외배송 계산 안내</span>
        <span className="ml-auto text-white/60 text-xs">우체국 기준</span>
      </div>

      <div className="overflow-y-auto p-4 space-y-4">
        {/* 부피중량 */}
        <section>
          <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1.5 mb-2">
            <Box size={14} className="text-brand-600" />
            부피중량 계산
          </h3>
          <div className="bg-brand-50 rounded-xl px-3 py-2.5 border border-brand-100 space-y-2">
            <p className="text-[11px] text-brand-900 font-medium leading-relaxed">
              가로 × 세로 × 높이 ÷ 6,000 = kg
            </p>
            <p className="text-[10px] text-brand-700 leading-relaxed">
              크기 단위는 cm입니다. g 단위로 계산할 때는 ÷ 6을 사용합니다.
            </p>
            <div className="bg-white rounded-lg px-2.5 py-2 border border-brand-100">
              <p className="text-[10px] text-gray-500 mb-1">예시 (30 × 20 × 15 cm)</p>
              <p className="text-[11px] text-gray-800 font-medium">
                9,000 ÷ 6,000 = <span className="text-brand-700">1.5 kg (1,500 g)</span>
              </p>
            </div>
          </div>
        </section>

        {/* 적용 중량 */}
        <section>
          <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1.5 mb-2">
            <Scale size={14} className="text-brand-600" />
            적용 중량
          </h3>
          <div className="space-y-1.5">
            <div className="flex items-start gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
              <FileText size={12} className="text-gray-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-semibold text-gray-800">서류 (EMS)</p>
                <p className="text-[10px] text-gray-600 mt-0.5">
                  부피중량 미적용 · 실중량만 사용하며 아래 구간 중 상위 구간으로 올림됩니다.
                </p>
                <p className="text-[9px] text-gray-400 mt-1 leading-relaxed">
                  {DOC_TIERS.join(" · ")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
              <Package size={12} className="text-gray-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-semibold text-gray-800">비서류 (EMS · K-Packet)</p>
                <p className="text-[10px] text-gray-600 mt-0.5">
                  실중량과 부피중량 중 <span className="font-bold text-violet-700">큰 값</span>이 요금에 적용됩니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 서비스별 중량 한도 */}
        <section>
          <h3 className="text-xs font-bold text-gray-800 mb-2">서비스별 중량 한도</h3>
          <div className="space-y-1">
            {WEIGHT_LIMITS.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100"
              >
                <div>
                  <p className="text-[11px] font-medium text-gray-800">{item.name}</p>
                  <p className="text-[9px] text-gray-400">{item.note}</p>
                </div>
                <span className="text-[11px] font-bold text-gray-700 shrink-0 ml-2">
                  최대 {item.limit}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 참고사항 */}
        <section className="bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-100">
          <p className="text-[10px] font-bold text-amber-800 flex items-center gap-1 mb-1.5">
            <AlertCircle size={11} />
            참고사항
          </p>
          <ul className="text-[10px] text-amber-700 space-y-1 leading-relaxed">
            <li>• 표시 요금은 VAT 포함 예상 금액입니다.</li>
            <li>• 실제 접수 시 창고 실측 무게·크기로 재계산됩니다.</li>
            <li>• 가볍고 부피가 큰 물품은 부피중량이 적용될 수 있습니다.</li>
            <li>• 보험 미선택 시 배송비만 표시됩니다. 보험 포함 계산은 옵션에서 선택할 수 있습니다.</li>
            <li>• 추가운송수수료 등은 별도일 수 있습니다.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
