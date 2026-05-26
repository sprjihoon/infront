"use client";

import Link from "next/link";
import SubPageHeader from "@/components/layout/SubPageHeader";
import { Mail, MessageCircle, Clock, BookOpen } from "lucide-react";

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <SubPageHeader title="고객센터" subtitle="문의·도움말" />

      <div className="px-4 py-5 space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center shrink-0">
              <Mail size={18} className="text-brand-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">이메일 문의</p>
              <a
                href="mailto:support@infront.kr"
                className="text-sm text-brand-600 mt-0.5 block"
              >
                support@infront.kr
              </a>
              <p className="text-xs text-gray-400 mt-1">영업일 기준 1~2일 내 답변</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center shrink-0">
              <MessageCircle size={18} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">카카오톡 채널</p>
              <p className="text-sm text-gray-600 mt-0.5">@인프론트 (준비 중)</p>
              <p className="text-xs text-gray-400 mt-1">실시간 문의 · 평일 10:00–18:00</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
              <Clock size={18} className="text-gray-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">운영 시간</p>
              <p className="text-sm text-gray-600 mt-0.5">평일 10:00 – 18:00</p>
              <p className="text-xs text-gray-400 mt-1">주말·공휴일 휴무 (긴급 입고는 자동 처리)</p>
            </div>
          </div>
        </div>

        <Link
          href="/guide"
          className="flex items-center justify-between bg-white rounded-2xl px-5 py-4 shadow-sm active:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
              <BookOpen size={15} className="text-teal-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">이용 가이드</p>
              <p className="text-xs text-gray-400">수거부터 국제배송까지 단계별 안내</p>
            </div>
          </div>
        </Link>

        <p className="text-xs text-gray-400 text-center leading-relaxed px-4">
          결제 완료 후 배송지 변경, 통관 보류 해결 등은 고객번호와 주문번호를 함께
          알려주시면 더 빠르게 도와드릴 수 있습니다.
        </p>
      </div>
    </div>
  );
}
