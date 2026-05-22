"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Truck, Package, Send, Globe,
  ChevronDown, ChevronUp, CheckCircle2, Clock, Shield,
  Calculator, MapPin, Box, ClipboardList,
} from "lucide-react";
import Link from "next/link";

const STEPS = [
  {
    step: 1,
    icon: Truck,
    color: "bg-blue-600",
    lightColor: "bg-blue-50",
    textColor: "text-blue-600",
    borderColor: "border-blue-200",
    title: "수거 신청",
    subtitle: "우체국 집배원이 직접 방문",
    desc: "앱에서 주소와 날짜를 입력하면 우체국 집배원이 직접 방문하여 수거해갑니다. 따로 우체국에 갈 필요 없이 집에서 편리하게 이용하세요.",
    details: [
      "주소·수거 희망일 입력 (1~2일 전 신청 권장)",
      "집배원 방문 수거 — 별도 비용 없음",
      "수거 후 추적번호로 이동 경로 확인 가능",
      "창고 직접 발송도 가능 (택배 이용)",
    ],
  },
  {
    step: 2,
    icon: Package,
    color: "bg-emerald-600",
    lightColor: "bg-emerald-50",
    textColor: "text-emerald-600",
    borderColor: "border-emerald-200",
    title: "입고 & 검품",
    subtitle: "인프론트 센터에서 꼼꼼히 확인",
    desc: "물품이 센터에 도착하면 입고 처리 후 검품을 진행합니다. 파손·오배송 여부를 확인하고 물품 정보를 등록합니다.",
    details: [
      "도착 즉시 입고 알림 앱으로 전송",
      "외관 검품 및 물품 상태 확인",
      "실제 무게 측정 및 기록",
      "보류 사유 발생 시 즉시 고객 알림",
    ],
  },
  {
    step: 3,
    icon: ClipboardList,
    color: "bg-violet-600",
    lightColor: "bg-violet-50",
    textColor: "text-violet-600",
    borderColor: "border-violet-200",
    title: "출고 신청",
    subtitle: "배송지·서비스 선택 후 결제",
    desc: "앱에서 해외 배송지를 등록하고 배송 방법(EMS / EMS 프리미엄 / K-Packet)을 선택합니다. 견적 확인 후 결제하면 발송이 시작됩니다.",
    details: [
      "해외 수취인 주소 등록",
      "EMS / EMS 프리미엄 / K-Packet 선택",
      "포장 옵션 추가 (안전포장, 재포장, 합포장)",
      "토스페이먼츠로 간편 결제 (카드·간편결제)",
    ],
  },
  {
    step: 4,
    icon: Globe,
    color: "bg-orange-500",
    lightColor: "bg-orange-50",
    textColor: "text-orange-600",
    borderColor: "border-orange-200",
    title: "국제 배송",
    subtitle: "우체국 EMS로 전 세계 발송",
    desc: "결제가 완료되면 우체국 EMS로 국제 발송이 시작됩니다. 앱에서 실시간으로 배송 현황을 추적할 수 있습니다.",
    details: [
      "결제 완료 다음 영업일 발송 (원칙)",
      "우체국 EMS 추적번호 발급",
      "앱에서 실시간 배송 현황 확인",
      "도착 국가 세관 통과 후 최종 배달",
    ],
  },
];

const SERVICES = [
  {
    icon: Shield,
    title: "무료 기본 서비스",
    items: ["우체국 방문 수거", "창고 입고·보관", "외관 검품", "물품 무게 측정"],
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-100",
  },
  {
    icon: Box,
    title: "유료 부가 서비스",
    items: ["안전포장 +3,000원", "재포장 +2,000원", "합포장 +2,000원"],
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-100",
  },
];

const SHIPPING_METHODS = [
  {
    name: "EMS",
    badge: "bg-blue-600",
    maxWeight: "최대 30kg",
    days: "3~8일",
    features: ["전 세계 대부분 국가", "빠른 배송", "추적 가능"],
    desc: "일반적인 해외 발송에 가장 많이 사용되는 서비스입니다.",
  },
  {
    name: "EMS 프리미엄",
    badge: "bg-violet-600",
    maxWeight: "최대 30kg",
    days: "2~4일",
    features: ["빠른 배송 보장", "DHL 협력", "익일 배송 가능 (일부)"],
    desc: "가장 빠른 배송이 필요할 때 선택하세요.",
  },
  {
    name: "K-Packet",
    badge: "bg-emerald-600",
    maxWeight: "최대 2kg",
    days: "7~15일",
    features: ["EMS 대비 최대 47% 저렴", "약 19개국", "소형 경량 물품에 적합"],
    desc: "가볍고 작은 물품을 저렴하게 보낼 때 이용하세요.",
  },
];

const FAQS = [
  {
    q: "수거 신청 후 얼마나 기다려야 하나요?",
    a: "신청 다음 날 또는 희망일에 집배원이 방문합니다. 오전 신청 시 당일 방문 가능한 경우도 있으나, 배송 상황에 따라 다를 수 있습니다.",
  },
  {
    q: "어떤 물품은 발송이 불가능한가요?",
    a: "리튬배터리 단품, 인화성 물질, 마약류, 동식물, 화폐, 의약품 등은 발송이 제한됩니다. 목적 국가별 통관 제한 품목이 다를 수 있으니 통관 정보를 꼭 확인하세요.",
  },
  {
    q: "물품이 창고에 도착하면 어떻게 알 수 있나요?",
    a: "입고가 완료되면 앱 푸시 알림으로 즉시 알려드립니다. 홈 화면의 '최근 물품 현황'에서도 확인할 수 있습니다.",
  },
  {
    q: "실제 요금은 견적과 다를 수 있나요?",
    a: "요금 계산기는 입력한 무게·크기 기준으로 계산됩니다. 실제 창고에서 측정한 실중량과 부피중량 중 큰 값이 적용되므로 최종 요금이 달라질 수 있습니다.",
  },
  {
    q: "결제 후 배송지 변경이 가능한가요?",
    a: "결제 완료 후에는 배송지 변경이 어려울 수 있습니다. 변경이 필요한 경우 빠르게 고객센터로 문의해 주세요.",
  },
  {
    q: "여러 물품을 하나의 박스로 합쳐서 보낼 수 있나요?",
    a: "네, 출고 신청 시 '합포장' 옵션을 선택하시면 선택한 물품들을 하나로 합쳐서 발송합니다. 합포장 수수료는 2,000원입니다.",
  },
];

export default function GuidePage() {
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-[600px] mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="p-1 -ml-1">
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <div>
            <h1 className="text-base font-semibold text-gray-900">쉬운 가이드</h1>
            <p className="text-[10px] text-gray-400">인프론트 이용 방법</p>
          </div>
        </div>
      </div>

      <div className="max-w-[600px] mx-auto px-4 py-4 space-y-5">

        {/* 안내 배너 */}
        <div className="bg-gradient-to-r from-blue-600 to-violet-600 rounded-2xl p-5 text-white">
          <p className="text-white/70 text-xs font-medium mb-1">인프론트 해외배송 대행 서비스</p>
          <p className="text-xl font-bold leading-tight mb-2">집에서 전 세계로<br />쉽고 빠르게</p>
          <p className="text-white/80 text-sm">수거 → 검품 → 포장 → 국제발송</p>
          <p className="text-white/60 text-xs mt-1">우체국 EMS · EMS 프리미엄 · K-Packet</p>
        </div>

        {/* 4단계 이용 방법 */}
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3">4단계로 끝나는 해외배송</h2>
          <div className="space-y-3">
            {STEPS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.step} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="flex items-start gap-4 p-4">
                    <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center shrink-0`}>
                      <Icon size={20} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-bold text-gray-400">STEP {s.step}</span>
                      </div>
                      <p className="text-sm font-bold text-gray-900">{s.title}</p>
                      <p className={`text-xs font-medium ${s.textColor} mb-1`}>{s.subtitle}</p>
                      <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                  <div className={`${s.lightColor} border-t ${s.borderColor} px-4 py-3`}>
                    <ul className="space-y-1">
                      {s.details.map((d, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                          <CheckCircle2 size={12} className={`${s.textColor} shrink-0 mt-0.5`} />
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 배송 방법 비교 */}
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3">배송 방법 비교</h2>
          <div className="space-y-2">
            {SHIPPING_METHODS.map(m => (
              <div key={m.name} className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${m.badge}`} />
                  <span className="font-bold text-gray-900 text-sm">{m.name}</span>
                  <span className="ml-auto flex items-center gap-1 text-[11px] text-gray-400">
                    <Clock size={11} />
                    {m.days}
                  </span>
                  <span className="text-[11px] text-gray-400 flex items-center gap-1">
                    <MapPin size={11} />
                    {m.maxWeight}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-2 leading-relaxed">{m.desc}</p>
                <div className="flex flex-wrap gap-1">
                  {m.features.map(f => (
                    <span key={f} className="text-[10px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 서비스 요금 요약 */}
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3">서비스 요금</h2>
          <div className="grid grid-cols-2 gap-3">
            {SERVICES.map(s => {
              const Icon = s.icon;
              return (
                <div key={s.title} className={`${s.bg} border ${s.border} rounded-2xl p-3.5`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon size={14} className={s.color} />
                    <p className={`text-xs font-bold ${s.color}`}>{s.title}</p>
                  </div>
                  <ul className="space-y-1">
                    {s.items.map(item => (
                      <li key={item} className="text-[11px] text-gray-600 flex items-start gap-1">
                        <span className="shrink-0">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        {/* 바로가기 버튼들 */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/pickup"
            className="bg-blue-600 rounded-2xl p-4 flex flex-col gap-2 active:scale-[0.97] transition-transform"
          >
            <Truck size={22} className="text-white" />
            <div>
              <p className="text-white text-sm font-semibold">수거 신청</p>
              <p className="text-blue-200 text-xs">지금 바로 시작</p>
            </div>
          </Link>
          <Link
            href="/shipping-calc"
            className="bg-white rounded-2xl p-4 flex flex-col gap-2 shadow-sm active:scale-[0.97] transition-transform"
          >
            <Calculator size={22} className="text-violet-600" />
            <div>
              <p className="text-gray-900 text-sm font-semibold">요금 계산</p>
              <p className="text-gray-500 text-xs">EMS · K-Packet</p>
            </div>
          </Link>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3">자주 묻는 질문</h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-start justify-between gap-3 px-4 py-3.5 text-left"
                >
                  <p className="text-sm font-medium text-gray-800 flex-1">{faq.q}</p>
                  {openFaq === i
                    ? <ChevronUp size={16} className="text-gray-400 shrink-0 mt-0.5" />
                    : <ChevronDown size={16} className="text-gray-400 shrink-0 mt-0.5" />}
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4">
                    <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                      <p className="text-xs text-gray-600 leading-relaxed">{faq.a}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 가격표 링크 */}
        <Link
          href="/pricing"
          className="flex items-center justify-between bg-white rounded-2xl shadow-sm p-4 active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Calculator size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">자세한 요금표 보기</p>
              <p className="text-xs text-gray-400">EMS · K-Packet · EMS 프리미엄</p>
            </div>
          </div>
          <Send size={16} className="text-gray-400" />
        </Link>

      </div>
    </div>
  );
}
