"use client";

import SubPageHeader from "@/components/layout/SubPageHeader";

const NOTICES = [
  {
    id: "2026-05-26",
    date: "2026.05.26",
    title: "인프론트 고객 웹 서비스 오픈",
    body: "수거 신청, 마이창고, 해외배송 신청 및 결제 기능을 이용하실 수 있습니다. 이용 중 불편한 점은 고객센터로 알려주세요.",
    pinned: true,
  },
  {
    id: "2026-05-20",
    date: "2026.05.20",
    title: "EMS · K-Packet 요금 안내",
    body: "배송비는 창고 실측 후 확정됩니다. 앱 내 요금 계산기와 가격표는 참고용이며, 최종 견적은 입고·검수 후 안내드립니다.",
    pinned: false,
  },
];

export default function NoticesPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <SubPageHeader title="공지사항" />

      <div className="px-4 py-5 space-y-3">
        {NOTICES.map((notice) => (
          <article key={notice.id} className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              {notice.pinned && (
                <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                  중요
                </span>
              )}
              <time className="text-xs text-gray-400">{notice.date}</time>
            </div>
            <h2 className="text-sm font-bold text-gray-900 mb-2">{notice.title}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{notice.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
