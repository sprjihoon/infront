"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Truck, Package, Send, Globe,
  ChevronDown, ChevronUp, CheckCircle2, Clock, Shield,
  Calculator, MapPin, Box, ClipboardList, Home, Receipt,
  HelpCircle, PackageCheck,
} from "lucide-react";
import Link from "next/link";

// ── 해외배송 데이터 ────────────────────────────────────────────────

const INTL_STEPS = [
  {
    step: 1,
    icon: Truck,
    color: "bg-brand-600",
    lightColor: "bg-brand-50",
    textColor: "text-brand-600",
    borderColor: "border-brand-200",
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

const SHIPPING_METHODS = [
  {
    name: "EMS",
    badge: "bg-brand-600",
    maxWeight: "최대 30kg",
    days: "3~8일",
    features: ["전 세계 대부분 국가", "빠른 배송", "추적 가능"],
    desc: "일반적인 해외 발송에 가장 많이 사용되는 서비스입니다.",
  },
  {
    name: "EMS 프리미엄",
    badge: "bg-violet-600",
    maxWeight: "최대 70kg",
    days: "2~4일",
    features: ["FedEx 특송 (2026.4~)", "70kg까지", "미국 $800+ 발송"],
    desc: "긴급·대형·미국 고가 물품. FedEx 네트워크로 배송됩니다.",
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

const INTL_SERVICES = [
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
    color: "text-brand-600",
    bg: "bg-brand-50",
    border: "border-brand-100",
  },
];

const INTL_FAQS = [
  {
    q: "수거 신청 후 얼마나 기다려야 하나요?",
    a: "수거 희망일은 우체국에 방문 희망일로 전달됩니다. 실제 방문은 집배 일정에 따라 달라질 수 있으며, 토·일·공휴일은 선택할 수 없습니다.",
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
    a: "해외배송 계산기는 입력한 무게·크기 기준으로 예상 배송비를 보여줍니다. 실제 창고에서 측정한 실중량과 부피중량 중 큰 값이 적용되므로 최종 요금이 달라질 수 있습니다.",
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

// ── 국내배송 데이터 ────────────────────────────────────────────────

const DOMESTIC_STEPS = [
  {
    step: 1,
    icon: Truck,
    color: "bg-blue-600",
    lightColor: "bg-blue-50",
    textColor: "text-blue-600",
    borderColor: "border-blue-200",
    title: "물품 입고",
    subtitle: "인프론트 창고에 물품 보내기",
    desc: "수거 신청으로 집배원이 방문하거나, 직접 택배로 인프론트 센터에 물품을 보냅니다. 입고 완료 시 앱으로 알림이 발송됩니다.",
    details: [
      "앱에서 수거 신청 → 집배원 방문 수거 (무료)",
      "또는 택배로 인프론트 창고 직접 발송",
      "입고 완료 즉시 앱 푸시 알림 수신",
      "입고 후 스토리지에서 물품 목록 확인",
    ],
  },
  {
    step: 2,
    icon: ClipboardList,
    color: "bg-indigo-600",
    lightColor: "bg-indigo-50",
    textColor: "text-indigo-600",
    borderColor: "border-indigo-200",
    title: "국내 배송 신청",
    subtitle: "수취인 주소 입력 후 신청",
    desc: "앱의 '국내 배송 신청' 메뉴에서 발송할 물품을 선택하고 국내 수취인 주소를 입력합니다. 우체국 소포로 발송됩니다.",
    details: [
      "스토리지에서 발송할 물품 선택",
      "국내 수취인 이름·주소·연락처 입력",
      "우체국 소포 요금 자동 계산",
      "토스페이먼츠로 간편 결제",
    ],
  },
  {
    step: 3,
    icon: PackageCheck,
    color: "bg-cyan-600",
    lightColor: "bg-cyan-50",
    textColor: "text-cyan-600",
    borderColor: "border-cyan-200",
    title: "우체국 소포 발송",
    subtitle: "D+1 국내 배송 완료",
    desc: "결제 완료 후 다음 영업일에 우체국 소포로 발송됩니다. 앱에서 운송장 번호와 배송 현황을 실시간으로 확인할 수 있습니다.",
    details: [
      "결제 완료 다음 영업일 발송",
      "우체국 소포 운송장 번호 발급",
      "앱에서 배송 현황 실시간 추적",
      "일반 소포: D+1 배달 완료 (평일 기준)",
    ],
  },
];

const DOMESTIC_RATE_SUMMARY = [
  { weight: "1kg 이하",  same: "4,000원", other: "5,000원" },
  { weight: "2kg 이하",  same: "4,500원", other: "5,500원" },
  { weight: "4kg 이하",  same: "5,500원", other: "6,500원" },
  { weight: "6kg 이하",  same: "6,500원", other: "7,500원" },
  { weight: "10kg 이하", same: "8,500원", other: "9,500원" },
  { weight: "20kg 이하", same: "11,000원",other: "12,000원" },
];

const DOMESTIC_FAQS = [
  {
    q: "국내 배송은 어느 지역까지 가능한가요?",
    a: "대한민국 전 지역 배송이 가능합니다. 제주도 및 도서·산간 지역은 추가 요금이 발생하거나 배달 기간이 더 걸릴 수 있습니다.",
  },
  {
    q: "동일권과 타권의 차이는 무엇인가요?",
    a: "동일권은 발송지와 수령지가 같은 시·도 내에 있는 경우이며, 타권은 서로 다른 시·도인 경우입니다. 동일권이 타권보다 약 1,000원 저렴합니다.",
  },
  {
    q: "국내 배송에도 부피중량이 적용되나요?",
    a: "네, 실제 무게와 부피중량(가로×세로×높이÷6,000) 중 더 큰 값으로 요금이 계산됩니다.",
  },
  {
    q: "국내 소포의 최대 크기·무게 제한은?",
    a: "최대 무게 30kg, 세 변의 합 160cm 이하, 가장 긴 변 100cm 이하입니다. 초과 시 비규격 소포 추가 요금이 부과됩니다.",
  },
  {
    q: "국내 배송 신청 후 취소가 가능한가요?",
    a: "발송 전(운송장 출력 전)에는 취소가 가능합니다. 발송 이후에는 취소가 어려울 수 있으니 신청 전 주소를 꼼꼼히 확인해 주세요.",
  },
];

// ── 컴포넌트 ──────────────────────────────────────────────────────

function StepCard({ s }: { s: typeof INTL_STEPS[number] }) {
  const Icon = s.icon;
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-start gap-4 p-4">
        <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center shrink-0`}>
          <Icon size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold text-gray-400">STEP {s.step}</span>
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
}

function FaqItem({ faq, isOpen, onToggle }: {
  faq: { q: string; a: string };
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-3 px-4 py-3.5 text-left active:bg-gray-50"
      >
        <div className="flex items-start gap-2 flex-1">
          <HelpCircle size={14} className="text-gray-400 shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-gray-800">{faq.q}</p>
        </div>
        {isOpen
          ? <ChevronUp size={16} className="text-gray-400 shrink-0 mt-0.5" />
          : <ChevronDown size={16} className="text-gray-400 shrink-0 mt-0.5" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4">
          <div className="bg-gray-50 rounded-xl px-3 py-2.5">
            <p className="text-xs text-gray-600 leading-relaxed">{faq.a}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 페이지 ────────────────────────────────────────────────────────

export default function GuidePage() {
  const router = useRouter();

  const [intlOpen, setIntlOpen] = useState(true);
  const [domOpen, setDomOpen]   = useState(false);

  const [intlSub, setIntlSub] = useState<Set<string>>(() => new Set(["intl-steps"]));
  const [domSub,  setDomSub]  = useState<Set<string>>(() => new Set(["dom-steps"]));

  const [intlFaq, setIntlFaq] = useState<number | null>(null);
  const [domFaq,  setDomFaq]  = useState<number | null>(null);

  function toggleIntlSub(id: string) {
    setIntlSub(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleDomSub(id: string) {
    setDomSub(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

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

      <div className="max-w-[600px] mx-auto px-4 py-4 space-y-3">

        {/* ── 해외배송 안내 아코디언 ── */}
        <div className="rounded-2xl overflow-hidden shadow-sm">
          {/* 헤더 */}
          <button
            onClick={() => setIntlOpen(v => !v)}
            className="w-full flex items-center justify-between bg-gradient-to-r from-brand-600 to-brand-800 px-5 py-4 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <Globe size={20} className="text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-base">해외배송 안내</p>
                <p className="text-white/70 text-xs">EMS · EMS 프리미엄 · K-Packet</p>
              </div>
            </div>
            {intlOpen
              ? <ChevronUp size={20} className="text-white/80 shrink-0" />
              : <ChevronDown size={20} className="text-white/80 shrink-0" />}
          </button>

          {intlOpen && (
            <div className="bg-gray-50 space-y-3 p-4">

              {/* 이용 방법 서브 아코디언 */}
              <div className="rounded-2xl overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleIntlSub("intl-steps")}
                  className="w-full flex items-center justify-between bg-white px-4 py-3.5 text-left active:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-brand-100 flex items-center justify-center">
                      <ClipboardList size={13} className="text-brand-600" />
                    </span>
                    <p className="text-sm font-bold text-gray-900">4단계 이용 방법</p>
                  </div>
                  {intlSub.has("intl-steps")
                    ? <ChevronUp size={16} className="text-gray-400 shrink-0" />
                    : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                </button>
                {intlSub.has("intl-steps") && (
                  <div className="bg-gray-50 border-t border-gray-100 p-3 space-y-2.5">
                    {INTL_STEPS.map(s => <StepCard key={s.step} s={s} />)}
                  </div>
                )}
              </div>

              {/* 배송 방법 비교 서브 아코디언 */}
              <div className="rounded-2xl overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleIntlSub("intl-methods")}
                  className="w-full flex items-center justify-between bg-white px-4 py-3.5 text-left active:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-orange-100 flex items-center justify-center">
                      <Send size={13} className="text-orange-500" />
                    </span>
                    <p className="text-sm font-bold text-gray-900">배송 방법 비교</p>
                  </div>
                  {intlSub.has("intl-methods")
                    ? <ChevronUp size={16} className="text-gray-400 shrink-0" />
                    : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                </button>
                {intlSub.has("intl-methods") && (
                  <div className="bg-gray-50 border-t border-gray-100 p-3 space-y-2">
                    {SHIPPING_METHODS.map(m => (
                      <div key={m.name} className="bg-white rounded-2xl shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${m.badge}`} />
                          <span className="font-bold text-gray-900 text-sm">{m.name}</span>
                          <span className="ml-auto flex items-center gap-1 text-[11px] text-gray-400">
                            <Clock size={11} />{m.days}
                          </span>
                          <span className="text-[11px] text-gray-400 flex items-center gap-1">
                            <MapPin size={11} />{m.maxWeight}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mb-2 leading-relaxed">{m.desc}</p>
                        <div className="flex flex-wrap gap-1">
                          {m.features.map(f => (
                            <span key={f} className="text-[10px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{f}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 서비스 요금 서브 아코디언 */}
              <div className="rounded-2xl overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleIntlSub("intl-fees")}
                  className="w-full flex items-center justify-between bg-white px-4 py-3.5 text-left active:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-green-100 flex items-center justify-center">
                      <Shield size={13} className="text-green-600" />
                    </span>
                    <p className="text-sm font-bold text-gray-900">서비스 요금</p>
                  </div>
                  {intlSub.has("intl-fees")
                    ? <ChevronUp size={16} className="text-gray-400 shrink-0" />
                    : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                </button>
                {intlSub.has("intl-fees") && (
                  <div className="bg-gray-50 border-t border-gray-100 p-3">
                    <div className="grid grid-cols-2 gap-3">
                      {INTL_SERVICES.map(s => {
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
                                  <span className="shrink-0">•</span><span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* FAQ 서브 아코디언 */}
              <div className="rounded-2xl overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleIntlSub("intl-faq")}
                  className="w-full flex items-center justify-between bg-white px-4 py-3.5 text-left active:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center">
                      <HelpCircle size={13} className="text-gray-500" />
                    </span>
                    <p className="text-sm font-bold text-gray-900">자주 묻는 질문</p>
                  </div>
                  {intlSub.has("intl-faq")
                    ? <ChevronUp size={16} className="text-gray-400 shrink-0" />
                    : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                </button>
                {intlSub.has("intl-faq") && (
                  <div className="bg-gray-50 border-t border-gray-100 p-3 space-y-2">
                    {INTL_FAQS.map((faq, i) => (
                      <FaqItem
                        key={i}
                        faq={faq}
                        isOpen={intlFaq === i}
                        onToggle={() => setIntlFaq(intlFaq === i ? null : i)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* 바로가기 */}
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/pickup"
                  className="bg-brand-600 rounded-2xl p-4 flex flex-col gap-2 active:scale-[0.97] transition-transform"
                >
                  <Truck size={22} className="text-white" />
                  <div>
                    <p className="text-white text-sm font-semibold">수거 신청</p>
                    <p className="text-brand-200 text-xs">지금 바로 시작</p>
                  </div>
                </Link>
                <Link
                  href="/pricing"
                  className="bg-white rounded-2xl p-4 flex flex-col gap-2 shadow-sm active:scale-[0.97] transition-transform"
                >
                  <Calculator size={22} className="text-brand-600" />
                  <div>
                    <p className="text-gray-900 text-sm font-semibold">해외 요금표</p>
                    <p className="text-gray-500 text-xs">EMS · K-Packet</p>
                  </div>
                </Link>
              </div>

            </div>
          )}
        </div>

        {/* ── 국내배송 안내 아코디언 ── */}
        <div className="rounded-2xl overflow-hidden shadow-sm">
          {/* 헤더 */}
          <button
            onClick={() => setDomOpen(v => !v)}
            className="w-full flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-800 px-5 py-4 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <Home size={20} className="text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-base">국내배송 안내</p>
                <p className="text-white/70 text-xs">우체국 소포 국내 발송</p>
              </div>
            </div>
            {domOpen
              ? <ChevronUp size={20} className="text-white/80 shrink-0" />
              : <ChevronDown size={20} className="text-white/80 shrink-0" />}
          </button>

          {domOpen && (
            <div className="bg-gray-50 space-y-3 p-4">

              {/* 이용 방법 서브 아코디언 */}
              <div className="rounded-2xl overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleDomSub("dom-steps")}
                  className="w-full flex items-center justify-between bg-white px-4 py-3.5 text-left active:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center">
                      <ClipboardList size={13} className="text-blue-600" />
                    </span>
                    <p className="text-sm font-bold text-gray-900">3단계 이용 방법</p>
                  </div>
                  {domSub.has("dom-steps")
                    ? <ChevronUp size={16} className="text-gray-400 shrink-0" />
                    : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                </button>
                {domSub.has("dom-steps") && (
                  <div className="bg-gray-50 border-t border-gray-100 p-3 space-y-2.5">
                    {DOMESTIC_STEPS.map(s => <StepCard key={s.step} s={s} />)}
                  </div>
                )}
              </div>

              {/* 요금 요약 서브 아코디언 */}
              <div className="rounded-2xl overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleDomSub("dom-rates")}
                  className="w-full flex items-center justify-between bg-white px-4 py-3.5 text-left active:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Receipt size={13} className="text-amber-600" />
                    </span>
                    <p className="text-sm font-bold text-gray-900">요금 요약</p>
                  </div>
                  {domSub.has("dom-rates")
                    ? <ChevronUp size={16} className="text-gray-400 shrink-0" />
                    : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                </button>
                {domSub.has("dom-rates") && (
                  <div className="bg-gray-50 border-t border-gray-100 p-3 space-y-2">
                    <div className="bg-blue-50 rounded-xl px-3 py-2 border border-blue-100">
                      <p className="text-[11px] text-blue-700">
                        • <strong>동일권</strong>: 같은 시·도 내 배송 &nbsp;|&nbsp;
                        <strong>타권</strong>: 다른 시·도로 배송
                      </p>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-semibold">중량</th>
                            <th className="text-right px-4 py-2.5 text-xs text-blue-600 font-semibold">동일권</th>
                            <th className="text-right px-4 py-2.5 text-xs text-indigo-600 font-semibold">타권</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {DOMESTIC_RATE_SUMMARY.map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50/50">
                              <td className="px-4 py-2.5 text-gray-700 text-sm font-medium">{row.weight}</td>
                              <td className="px-4 py-2.5 text-right font-semibold text-blue-700">{row.same}</td>
                              <td className="px-4 py-2.5 text-right font-semibold text-indigo-700">{row.other}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="bg-amber-50 rounded-xl px-3 py-2 border border-amber-100">
                      <p className="text-[10px] text-amber-700">
                        ※ 최대 무게 30kg / 세 변의 합 160cm 이하 / 가장 긴 변 100cm 이하
                      </p>
                    </div>
                    <Link
                      href="/domestic-rates"
                      className="flex items-center justify-between bg-white rounded-2xl p-3.5 shadow-sm active:scale-[0.98] transition-transform"
                    >
                      <div className="flex items-center gap-2">
                        <Receipt size={16} className="text-amber-500" />
                        <p className="text-sm font-semibold text-gray-800">상세 요금표 · 규격 안내</p>
                      </div>
                      <ChevronDown size={14} className="text-gray-400 -rotate-90" />
                    </Link>
                  </div>
                )}
              </div>

              {/* FAQ 서브 아코디언 */}
              <div className="rounded-2xl overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleDomSub("dom-faq")}
                  className="w-full flex items-center justify-between bg-white px-4 py-3.5 text-left active:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center">
                      <HelpCircle size={13} className="text-gray-500" />
                    </span>
                    <p className="text-sm font-bold text-gray-900">자주 묻는 질문</p>
                  </div>
                  {domSub.has("dom-faq")
                    ? <ChevronUp size={16} className="text-gray-400 shrink-0" />
                    : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                </button>
                {domSub.has("dom-faq") && (
                  <div className="bg-gray-50 border-t border-gray-100 p-3 space-y-2">
                    {DOMESTIC_FAQS.map((faq, i) => (
                      <FaqItem
                        key={i}
                        faq={faq}
                        isOpen={domFaq === i}
                        onToggle={() => setDomFaq(domFaq === i ? null : i)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* 바로가기 */}
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/domestic-shipping"
                  className="bg-blue-600 rounded-2xl p-4 flex flex-col gap-2 active:scale-[0.97] transition-transform"
                >
                  <Package size={22} className="text-white" />
                  <div>
                    <p className="text-white text-sm font-semibold">국내 배송 신청</p>
                    <p className="text-blue-200 text-xs">우체국 소포 발송</p>
                  </div>
                </Link>
                <Link
                  href="/domestic-rates"
                  className="bg-white rounded-2xl p-4 flex flex-col gap-2 shadow-sm active:scale-[0.97] transition-transform"
                >
                  <Receipt size={22} className="text-amber-500" />
                  <div>
                    <p className="text-gray-900 text-sm font-semibold">국내 요금표</p>
                    <p className="text-gray-500 text-xs">규격·크기·무게</p>
                  </div>
                </Link>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
