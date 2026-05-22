"use client";

import { Package, Zap, Shield, TrendingDown } from "lucide-react";

const SERVICE_COMPARISON = [
  {
    id: "ems",
    name: "EMS",
    icon: Zap,
    color: "blue",
    pros: ["빠른 국제 배송", "30kg까지 발송", "실시간 추적", "높은 신뢰도"],
    bestFor: "빠른 배송이 필요하거나 무거운 물품",
    speed: "⚡ 3~10일",
    speedNote: "도착 국가·품목별 상이",
    weight: "최대 30kg",
  },
  {
    id: "ems-premium",
    name: "EMS 프리미엄",
    icon: Shield,
    color: "violet",
    pros: ["최고 속도", "70kg까지 발송", "우선 처리", "방문 위탁"],
    bestFor: "긴급 배송이나 대형 화물",
    speed: "🚀 2~4일",
    speedNote: "도착 국가별 상이",
    weight: "최대 70kg",
  },
  {
    id: "kpacket",
    name: "K-Packet",
    icon: TrendingDown,
    color: "emerald",
    pros: ["저렴한 요금", "EMS 대비 40~50% 절감", "소형 물품 특화"],
    bestFor: "가벼운 소형 물품, 저렴한 배송",
    speed: "📦 7~15일",
    speedNote: "도착 국가별 상이",
    weight: "최대 2kg",
  },
] as const;

type ActiveTab = "ems" | "kpacket" | "premium";

interface SidebarPricingGuideProps {
  activeTab?: ActiveTab;
}

export default function SidebarPricingGuide({ activeTab }: SidebarPricingGuideProps) {
  return (
    <div className="w-72 space-y-4">
      <div className="bg-gradient-to-r from-blue-600 to-violet-600 rounded-2xl p-4 text-white">
        <p className="font-bold text-base mb-0.5">국제배송 요금 안내</p>
        <p className="text-white/80 text-xs leading-relaxed">
          아래 요금은 우체국 기준 참고 요금입니다 (VAT 포함).
          정확한 요금은 요금 계산기로 확인하세요.
        </p>
      </div>

      <section className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3">
          <h3 className="text-white font-bold text-sm flex items-center gap-2">
            <Package size={15} />
            배송 서비스 비교
          </h3>
        </div>
        <div className="p-4 space-y-3 max-h-[calc(100vh-14rem)] overflow-y-auto">
          {SERVICE_COMPARISON.map((service) => {
            const Icon = service.icon;
            const isActive =
              activeTab !== undefined &&
              ((activeTab === "ems" && service.id === "ems") ||
                (activeTab === "kpacket" && service.id === "kpacket") ||
                (activeTab === "premium" && service.id === "ems-premium"));

            const colorClasses = {
              blue: { border: "border-blue-500", bg: "bg-blue-50", icon: "text-blue-600" },
              violet: { border: "border-violet-500", bg: "bg-violet-50", icon: "text-violet-600" },
              emerald: { border: "border-emerald-500", bg: "bg-emerald-50", icon: "text-emerald-600" },
            };
            const colors = colorClasses[service.color];

            return (
              <div
                key={service.id}
                className={`rounded-xl p-3 border-2 transition-all ${
                  isActive
                    ? `${colors.border} ${colors.bg}`
                    : "border-gray-100 bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={16} className={colors.icon} />
                  <h4 className="text-sm font-bold text-gray-800">{service.name}</h4>
                </div>

                <div className="grid grid-cols-2 gap-1 mb-1 text-[10px]">
                  <div className="bg-white rounded px-2 py-1">
                    <div className="text-gray-400">속도</div>
                    <div className="font-medium text-gray-700">{service.speed}</div>
                  </div>
                  <div className="bg-white rounded px-2 py-1">
                    <div className="text-gray-400">중량</div>
                    <div className="font-medium text-gray-700">{service.weight}</div>
                  </div>
                </div>
                {service.speedNote && (
                  <p className="text-[9px] text-gray-400 mb-2">{service.speedNote}</p>
                )}

                <div className="space-y-1.5">
                  <div>
                    <p className="text-[9px] font-semibold text-green-600 mb-0.5">✓ 장점</p>
                    <ul className="space-y-0.5">
                      {service.pros.slice(0, 2).map((pro, i) => (
                        <li key={i} className="text-[10px] text-gray-600 flex items-start gap-1">
                          <span className="shrink-0">•</span><span>{pro}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="pt-1 border-t border-gray-200">
                    <p className="text-[9px] text-gray-400">추천</p>
                    <p className="text-[10px] font-medium text-gray-700">{service.bestFor}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="px-4 pb-3 text-[9px] text-gray-400 leading-relaxed">
          ※ 표시된 배송일은 참고 범위이며, 도착 국가·통관·품목에 따라 달라질 수 있습니다.
        </p>
      </section>
    </div>
  );
}
