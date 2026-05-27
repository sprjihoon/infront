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
    pros: ["FedEx 특송", "70kg까지 발송", "미국 $800+ 가능", "우선 처리"],
    bestFor: "긴급 배송, 미국 고가 물품, 대형 화물",
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

const TAB_TO_SERVICE_ID: Record<ActiveTab, string> = {
  ems: "ems",
  premium: "ems-premium",
  kpacket: "kpacket",
};

interface SidebarPricingGuideProps {
  activeTab?: ActiveTab;
}

function getSortedServices(activeTab?: ActiveTab) {
  if (!activeTab) return [...SERVICE_COMPARISON];
  const activeId = TAB_TO_SERVICE_ID[activeTab];
  return [...SERVICE_COMPARISON].sort((a, b) => {
    if (a.id === activeId) return -1;
    if (b.id === activeId) return 1;
    const order = SERVICE_COMPARISON.map((s) => s.id);
    return order.indexOf(a.id) - order.indexOf(b.id);
  });
}

export default function SidebarPricingGuide({ activeTab }: SidebarPricingGuideProps) {
  const services = getSortedServices(activeTab);

  return (
    <div className="w-full bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden select-none">
      <div className="bg-gradient-to-r from-brand-600 to-brand-800 px-4 py-3 flex items-center gap-2 shrink-0">
        <Package size={16} className="text-white shrink-0" />
        <span className="text-white font-semibold text-sm">배송 서비스 비교</span>
      </div>

      <div className="overflow-y-auto p-4 space-y-3">
        {services.map((service) => {
          const Icon = service.icon;
          const isActive =
            activeTab !== undefined &&
            ((activeTab === "ems" && service.id === "ems") ||
              (activeTab === "kpacket" && service.id === "kpacket") ||
              (activeTab === "premium" && service.id === "ems-premium"));

          const colorClasses = {
            blue: { border: "border-brand-500", bg: "bg-brand-50", icon: "text-brand-600" },
            violet: { border: "border-violet-500", bg: "bg-violet-50", icon: "text-violet-600" },
            emerald: { border: "border-emerald-500", bg: "bg-emerald-50", icon: "text-emerald-600" },
          };
          const colors = colorClasses[service.color];

          return (
            <div
              key={service.id}
              className={`rounded-xl p-3 border transition-all ${
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
                <div className="bg-white rounded-lg px-2 py-1 border border-gray-100">
                  <div className="text-gray-400">속도</div>
                  <div className="font-medium text-gray-700">{service.speed}</div>
                </div>
                <div className="bg-white rounded-lg px-2 py-1 border border-gray-100">
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
                        <span className="shrink-0">•</span>
                        <span>{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="pt-1 border-t border-gray-200/80">
                  <p className="text-[9px] text-gray-400">추천</p>
                  <p className="text-[10px] font-medium text-gray-700">{service.bestFor}</p>
                </div>
              </div>
            </div>
          );
        })}

        <p className="text-[10px] text-gray-400 leading-relaxed pt-0.5">
          ※ EMS 프리미엄(FedEx): 최장 274cm · 2번째 105cm · 최단 76cm · 길이+둘레 330cm 이하.
          <br />
          ※ 표시된 배송일은 참고 범위이며, 도착 국가·통관·품목에 따라 달라질 수 있습니다.
        </p>
      </div>
    </div>
  );
}
