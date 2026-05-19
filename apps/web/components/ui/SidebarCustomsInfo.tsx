"use client";

import { useState } from "react";
import { ShieldAlert, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { getCustomsInfo } from "@/lib/customs-data";

const COUNTRY_LIST = [
  { code: "JP", name: "일본", flag: "🇯🇵" },
  { code: "CN", name: "중국", flag: "🇨🇳" },
  { code: "US", name: "미국", flag: "🇺🇸" },
  { code: "AU", name: "호주", flag: "🇦🇺" },
  { code: "CA", name: "캐나다", flag: "🇨🇦" },
  { code: "GB", name: "영국", flag: "🇬🇧" },
  { code: "DE", name: "독일", flag: "🇩🇪" },
  { code: "FR", name: "프랑스", flag: "🇫🇷" },
  { code: "SG", name: "싱가포르", flag: "🇸🇬" },
  { code: "HK", name: "홍콩", flag: "🇭🇰" },
  { code: "TW", name: "대만", flag: "🇹🇼" },
  { code: "TH", name: "태국", flag: "🇹🇭" },
  { code: "VN", name: "베트남", flag: "🇻🇳" },
  { code: "PH", name: "필리핀", flag: "🇵🇭" },
  { code: "MY", name: "말레이시아", flag: "🇲🇾" },
  { code: "ID", name: "인도네시아", flag: "🇮🇩" },
  { code: "MO", name: "마카오", flag: "🇲🇴" },
  { code: "MN", name: "몽골", flag: "🇲🇳" },
  { code: "NZ", name: "뉴질랜드", flag: "🇳🇿" },
  { code: "IT", name: "이탈리아", flag: "🇮🇹" },
  { code: "ES", name: "스페인", flag: "🇪🇸" },
  { code: "NL", name: "네덜란드", flag: "🇳🇱" },
  { code: "SE", name: "스웨덴", flag: "🇸🇪" },
  { code: "CH", name: "스위스", flag: "🇨🇭" },
  { code: "RU", name: "러시아", flag: "🇷🇺" },
  { code: "BR", name: "브라질", flag: "🇧🇷" },
  { code: "MX", name: "멕시코", flag: "🇲🇽" },
  { code: "AE", name: "아랍에미리트", flag: "🇦🇪" },
  { code: "SA", name: "사우디아라비아", flag: "🇸🇦" },
  { code: "IN", name: "인도", flag: "🇮🇳" },
];

export default function SidebarCustomsInfo() {
  const [selected, setSelected] = useState("JP");
  const [open, setOpen] = useState(false);
  const [showRestricted, setShowRestricted] = useState(false);

  const country = COUNTRY_LIST.find(c => c.code === selected)!;
  const info = getCustomsInfo(selected);

  return (
    <div className="sticky top-4 w-72 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-orange-500 to-rose-500 px-4 py-3 flex items-center gap-2">
        <ShieldAlert size={15} className="text-white" />
        <span className="text-white font-semibold text-sm">국가별 통관 정보</span>
        <span className="ml-auto text-white/70 text-xs">면세한도 · 금지품목</span>
      </div>

      <div className="p-3 space-y-3">
        {/* 국가 선택 */}
        <div className="relative">
          <button
            onClick={() => setOpen(v => !v)}
            className="w-full flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100 text-sm"
          >
            <span className="font-medium text-gray-800">
              {country.flag} {country.name}
            </span>
            {open
              ? <ChevronUp size={14} className="text-gray-400" />
              : <ChevronDown size={14} className="text-gray-400" />}
          </button>
          {open && (
            <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {COUNTRY_LIST.map(c => (
                <button
                  key={c.code}
                  onClick={() => { setSelected(c.code); setOpen(false); setShowRestricted(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-orange-50 transition-colors ${
                    c.code === selected ? "bg-orange-50 text-orange-700 font-medium" : "text-gray-700"
                  }`}
                >
                  <span>{c.flag}</span>
                  <span>{c.name}</span>
                  <span className="ml-auto text-xs text-gray-400">{c.code}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {info ? (
          <>
            {/* 면세한도 */}
            <div className="bg-blue-50 rounded-xl px-3 py-2.5 border border-blue-100">
              <p className="text-[10px] font-bold text-blue-700 mb-1">💰 면세한도</p>
              <p className="text-sm font-bold text-blue-900">{info.dutyFree}</p>
              {info.dutyFreeNote && (
                <p className="text-[10px] text-blue-600 mt-0.5">{info.dutyFreeNote}</p>
              )}
            </div>

            {/* 금지품목 */}
            <div className="bg-red-50 rounded-xl px-3 py-2.5 border border-red-100">
              <p className="text-[10px] font-bold text-red-700 mb-1.5">🚫 절대 금지품목</p>
              <ul className="space-y-0.5">
                {info.prohibited.map(item => (
                  <li key={item} className="text-[11px] text-red-700 flex items-start gap-1">
                    <span className="shrink-0 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 제한/주의 품목 토글 */}
            <div className="bg-amber-50 rounded-xl border border-amber-100 overflow-hidden">
              <button
                onClick={() => setShowRestricted(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left"
              >
                <p className="text-[10px] font-bold text-amber-700">⚠️ 제한·주의 품목</p>
                {showRestricted
                  ? <ChevronUp size={12} className="text-amber-500" />
                  : <ChevronDown size={12} className="text-amber-500" />}
              </button>
              {showRestricted && (
                <div className="px-3 pb-2.5">
                  <ul className="space-y-0.5">
                    {info.restricted.map(item => (
                      <li key={item} className="text-[11px] text-amber-700 flex items-start gap-1">
                        <span className="shrink-0 mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* 배터리 */}
            <div className="flex items-start gap-2 bg-violet-50 rounded-xl px-3 py-2.5 border border-violet-100">
              <Zap size={12} className="text-violet-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-violet-700 mb-0.5">리튬배터리</p>
                <p className="text-[11px] text-violet-700">{info.batteryLimit}</p>
              </div>
            </div>

            {/* 유의사항 */}
            {info.customsNote && (
              <div className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                <p className="text-[10px] text-gray-500 leading-relaxed">📌 {info.customsNote}</p>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-gray-400 text-center py-4">해당 국가 정보가 없습니다</p>
        )}
      </div>
    </div>
  );
}
