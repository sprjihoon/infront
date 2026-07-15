"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";

const SECTIONS = [
  {
    title: "제1조 (취소 및 환불 원칙)",
    body: "틸리언(이하 \"회사\")은 전자상거래 등에서의 소비자보호에 관한 법률 및 KG이니시스 결제 정책에 따라 서비스 특성에 맞는 취소·환불 기준을 적용합니다.\n\n본 정책은 인프론트(infront.kr/shop)에서 제공하는 보관·검품/포장·배송 등 물류대행 서비스에 적용됩니다.",
  },
  {
    title: "제2조 (서비스 진행 전 취소)",
    body: "① 결제 완료 후 해당 서비스(검품/포장 등)가 시작되기 전에는 전액 취소 및 환불이 가능합니다.\n② 환불 처리 기간은 결제 취소 후 카드사 기준 3~5영업일입니다.",
  },
  {
    title: "제3조 (보관료 — 스토리지 구독)",
    body: "① 소형·중형·대형 스토리지 보관 서비스는 월 단위 선불 자동결제(빌링)로 운영됩니다.\n② 장기보관 월 이용료는 월 단위 선불이며, 중도 해지 시 남은 기간에 대한 환불은 불가합니다.\n③ 구독 해지는 다음 결제일 이전에 신청하면 이후 자동결제가 중단됩니다.",
  },
  {
    title: "제4조 (검품/포장 서비스)",
    body: "① 검품/포장 서비스는 물품 사이즈(소형·중형·대형)에 따라 요금이 상이하며, 물류센터 내 물품 상태 확인 및 안전 포장 작업에 대한 요금입니다.\n② 검품/포장 서비스 결제 시 왕복배송비(제5조)가 함께 청구되며, 결제 화면에 두 항목이 합산되어 표시됩니다.\n③ 검품/포장 작업이 완료된 이후에는 작업비 환불이 불가합니다.\n④ 포장 불량 등 회사 귀책 사유가 확인된 경우 무상 재작업 또는 전액 환불을 제공합니다.",
  },
  {
    title: "제5조 (왕복배송비)",
    body: "① 왕복배송비는 고객 지정 주소에서의 수거와 물류센터에서의 반송을 모두 포함하는 국내 배송 요금입니다.\n② 수거가 시작된 이후에는 왕복배송비 환불이 제한됩니다.\n③ 통관 지연, 운송 지연 등 불가항력적 사유로 인한 지연은 환불 사유에 해당하지 않을 수 있습니다.",
  },
  {
    title: "제6조 (회사 귀책 사유)",
    body: "회사 귀책 사유(불량 포장, 의뢰 내용과 상이한 처리 등)로 서비스 제공이 불가능하거나 중대한 하자가 발생한 경우, 전액 환불 또는 무상 재작업을 제공합니다.",
  },
  {
    title: "부칙",
    body: "본 정책은 2026년 6월 1일부터 시행합니다.",
  },
];

export default function RefundPolicyPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-base font-bold text-gray-900">취소/환불 정책</h1>
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
