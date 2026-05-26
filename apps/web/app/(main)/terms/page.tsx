"use client";

import SubPageHeader from "@/components/layout/SubPageHeader";

const SECTIONS = [
  {
    title: "제1조 (목적)",
    body: "본 약관은 인프론트(이하 \"회사\")가 제공하는 해외배송 대행 서비스(이하 \"서비스\")의 이용과 관련하여 회사와 이용자 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.",
  },
  {
    title: "제2조 (서비스 내용)",
    body: "회사는 국내 수거, 창고 보관, 검수, 포장, 국제배송(EMS/K-Packet 등) 대행 서비스를 제공합니다. 배송비 및 부가서비스 요금은 창고 실측 후 확정되며, 이용자는 견적 확인 후 결제합니다.",
  },
  {
    title: "제3조 (이용자의 의무)",
    body: "이용자는 발송 금지 물품(리튬배터리 단품, 인화성 물품, 마약류 등)을 접수하지 않으며, 정확한 수취인 정보와 세관신고(인보이스) 정보를 제공해야 합니다. 허위 신고로 인한 통관 지연·반송·과태료는 이용자 책임입니다.",
  },
  {
    title: "제4조 (취소 및 환불)",
    body: "해외배송 신청 완료(DRAFT) 상태에서는 이용자가 직접 취소할 수 있습니다. 포장·견적 진행 이후 또는 결제 완료 후 취소·환불은 회사 정책 및 실비에 따라 처리되며, 자세한 사항은 고객센터로 문의해 주세요.",
  },
  {
    title: "제5조 (면책)",
    body: "천재지변, 세관 검사, 항공·운송 지연, 목적국 정책 변경 등 회사의 합리적 통제 범위를 벗어난 사유로 발생한 손해에 대해 회사는 법령이 허용하는 범위 내에서 책임을 제한할 수 있습니다.",
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <SubPageHeader title="이용약관" subtitle="최종본 준비 중 · 2026.05.26" />

      <div className="px-4 py-5 space-y-4">
        <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-4 py-3 leading-relaxed">
          아래 내용은 서비스 이용을 위한 요약 안내입니다. 법무 검토 후 최종본으로
          교체될 예정입니다.
        </p>

        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-5">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="text-sm font-bold text-gray-900 mb-1.5">{section.title}</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
