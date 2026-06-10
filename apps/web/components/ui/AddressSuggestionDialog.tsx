"use client";

import { X, Info } from "lucide-react";

export interface SuggestedAddress {
  addr3: string;
  addr2: string;
  addr1: string;
  zip: string;
  formattedAddress?: string;
}

interface Props {
  original: SuggestedAddress;
  suggested: SuggestedAddress;
  onKeepOriginal: () => void;
  onUseSuggested: () => void;
}

function formatSingle(a: SuggestedAddress): string {
  const parts = [a.addr3, a.addr2, a.addr1, a.zip].filter(Boolean);
  return parts.join(", ");
}

export default function AddressSuggestionDialog({
  original,
  suggested,
  onKeepOriginal,
  onUseSuggested,
}: Props) {
  const suggestedDisplay = suggested.formattedAddress || formatSingle(suggested);
  const originalDisplay = formatSingle(original);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/40">
      <div className="w-full max-w-[420px] bg-white rounded-2xl overflow-hidden shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            {/* Google G logo */}
            <svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
              <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
              <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
              <path d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.021 35.626 44 30.138 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
            </svg>
            <p className="text-sm font-bold text-gray-900">구글 추천 주소로 변경하시겠어요?</p>
          </div>
          <button
            onClick={onKeepOriginal}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-400"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-3">
          {/* 입력한 주소 */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            <p className="text-[10px] text-gray-400 font-semibold mb-1">입력한 주소</p>
            <p className="text-sm text-gray-700 leading-relaxed">{originalDisplay}</p>
          </div>

          {/* 화살표 */}
          <div className="flex justify-center text-gray-300 text-lg leading-none">↓</div>

          {/* 구글 추천 주소 */}
          <div className="bg-blue-50 rounded-xl px-4 py-3 border border-blue-200">
            <p className="text-[10px] text-blue-500 font-semibold mb-1">Google 추천 주소</p>
            <p className="text-sm text-blue-800 leading-relaxed font-medium">{suggestedDisplay}</p>
          </div>

          {/* 안내 */}
          <div className="flex items-start gap-1.5">
            <Info size={13} className="text-green-500 mt-0.5 shrink-0" />
            <p className="text-xs text-gray-500 leading-relaxed">
              추천 주소를 사용하시더라도 발송 전까지 주소 수정 가능합니다.
            </p>
          </div>

          {/* 버튼 */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onKeepOriginal}
              className="flex-1 py-3.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors active:scale-[0.98]"
            >
              내 주소 유지
            </button>
            <button
              onClick={onUseSuggested}
              className="flex-1 py-3.5 bg-yellow-400 text-gray-900 text-sm font-bold rounded-xl hover:bg-yellow-500 transition-colors active:scale-[0.98]"
            >
              추천 주소 사용
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
