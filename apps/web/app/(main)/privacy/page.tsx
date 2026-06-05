"use client";

import SubPageHeader from "@/components/layout/SubPageHeader";

const SECTIONS = [
  {
    title: "1. 수집하는 개인정보",
    body: "회원가입 시 이메일, 이름, 휴대폰 번호를 수집합니다. 서비스 이용 과정에서 수거지·해외 배송지, 주문·결제 정보, 물품 관련 정보가 추가로 수집될 수 있습니다.",
  },
  {
    title: "2. 개인정보의 이용 목적",
    body: "회원 식별, 수거·입고·배송 대행, 견적·결제 처리, 고객 문의 응대, 서비스 개선 및 법령상 의무 이행을 위해 이용합니다.",
  },
  {
    title: "3. 보관 기간",
    body: "회원 탈퇴 시 지체 없이 파기합니다. 다만 관련 법령에 따라 거래 기록 등은 일정 기간 보관할 수 있습니다.",
  },
  {
    title: "4. 제3자 제공",
    body: "배송 이행을 위해 우체국(EMS/K-Packet), 엑심베이(Eximbay, 결제대행) 등 필요한 범위 내에서만 제공하며, 그 외 목적으로 제3자에게 제공하지 않습니다.",
  },
  {
    title: "5. 이용자의 권리",
    body: "이용자는 개인정보 열람·정정·삭제·처리정지를 요청할 수 있습니다. 문의: support@infront.kr",
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <SubPageHeader title="개인정보처리방침" subtitle="최종본 준비 중 · 2026.05.26" />

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
