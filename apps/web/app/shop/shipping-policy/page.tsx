"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { INTL_TRACKING_NOTE_KO } from "@/lib/shop/products";

const SECTIONS = [
  {
    title: "제1조 (서비스 개요)",
    body: "인프론트는 고객이 온라인으로 물품 수거를 신청하고, 물류센터에서 보관한 뒤, 요청에 따라 포장·검품 후 국내배송 또는 해외배송을 진행하는 수거·보관·배송대행 플랫폼입니다.",
  },
  {
    title: "제2조 (국내배송)",
    body: "① 국내배송: 출고 요청 및 결제 완료 후 통상 1~3영업일 내 발송됩니다.\n② 국내 택배·우편을 이용하며, 운송장번호 발급 후 배송조회가 가능합니다.\n③ 물량 집중, 기상 악화 등 불가항력적 사유로 지연될 수 있습니다.",
  },
  {
    title: "제3조 (해외배송)",
    body: `① 해외배송: 국가 및 배송수단에 따라 통상 3~15영업일 내외 소요됩니다.\n② 해외배송은 EMS, EMS Premium, K-Packet 등 추적 가능한 배송수단을 사용합니다.\n③ 발송 후 운송장번호를 제공하며, 회원은 /shop/orders 또는 /shop/tracking/{주문번호} 에서 배송조회가 가능합니다.\n④ ${INTL_TRACKING_NOTE_KO}\n⑤ 통관 및 현지 배송사 사정에 따라 배송 기간이 지연될 수 있습니다.\n⑥ 통관 이후 현지 배송 추적 범위는 국가별로 다를 수 있습니다.`,
  },
  {
    title: "제4조 (수거·검품/포장)",
    body: "① 수거: 결제 완료 후 1~2영업일 내 지정 주소에서 수거합니다.\n② 검품/포장: 수거 후 당일~1영업일 내 완료됩니다.\n③ 포장 완료 사진을 제공합니다.",
  },
  {
    title: "제5조 (보관 서비스)",
    body: "① 스토리지 보관 서비스는 물류센터 내 전용 공간에서 물품을 보관합니다.\n② 보관 기간은 구독 계약 기간에 따르며, 별도 출고 요청 시 배송 서비스와 연계됩니다.\n③ 장기보관 월 이용료는 신용카드 자동결제(빌링)로 운영되며, 해외카드 결제 대상이 아닙니다.",
  },
  {
    title: "부칙",
    body: "본 정책은 2026년 6월 1일부터 시행합니다.",
  },
];

export default function ShippingPolicyPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-base font-bold text-gray-900">배송/서비스 제공 정책</h1>
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        >
          <X size={18} className="text-gray-500" />
        </button>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4 flex-1">
        <p className="text-xs text-gray-400">시행일: 2026년 6월 1일</p>
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-6">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="text-sm font-bold text-gray-900 mb-2">{section.title}</h2>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
