"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Info, ExternalLink, ChevronDown, ChevronUp,
  Package, Ruler, AlertCircle, CheckCircle2,
} from "lucide-react";
import Link from "next/link";

// ── 창구접수 등기소포 요금표 ────────────────────────────────────────
// 출처: 우정사업본부 창구접수 등기소포 기준 (koreapost.go.kr)
// 크기: 가로+세로+높이 합계(cm) / 제주 익일은 제주↔육지 쌍방향 적용
const DOMESTIC_RATES = [
  { label: "80cm이하 · 3kg이하",  regular: 4000,  jeju: 6500  },
  { label: "~100cm · 5kg이하",    regular: 4500,  jeju: 7000  },
  { label: "~100cm · 7kg이하",    regular: 5000,  jeju: 7500  },
  { label: "~120cm · 10kg이하",   regular: 6000,  jeju: 8500  },
  { label: "~120cm · 15kg이하",   regular: 7000,  jeju: 9500  },
  { label: "~120cm · 20kg이하",   regular: 8000,  jeju: 10500 },
  { label: "~120cm · 25kg이하",   regular: 11000, jeju: 13500 },
  { label: "~160cm · 30kg이하",   regular: 13000, jeju: 15500 },
];

// ── 우체국 규격 박스 종류 ──────────────────────────────────────────
const BOX_SIZES = [
  {
    name: "극소형 (1호)",
    dims: "16 × 13 × 8.5 cm",
    maxWeight: "1kg",
    circum: "38 cm",
    price: "박스 별도 구매",
  },
  {
    name: "소형 (2호)",
    dims: "22 × 19 × 9 cm",
    maxWeight: "3kg",
    circum: "50 cm",
    price: "박스 별도 구매",
  },
  {
    name: "중형 (3호)",
    dims: "35 × 25 × 12 cm",
    maxWeight: "5kg",
    circum: "72 cm",
    price: "박스 별도 구매",
  },
  {
    name: "대형 (4호)",
    dims: "44 × 36 × 28 cm",
    maxWeight: "10kg",
    circum: "108 cm",
    price: "박스 별도 구매",
  },
  {
    name: "특대형 (5호)",
    dims: "53 × 42 × 35 cm",
    maxWeight: "20kg",
    circum: "130 cm",
    price: "박스 별도 구매",
  },
];

// ── 크기 제한 안내 ─────────────────────────────────────────────────
const SIZE_LIMITS = [
  { label: "최대 무게",      value: "30kg 이하",               note: "" },
  { label: "세 변의 합",    value: "160cm 이하",              note: "가로 + 세로 + 높이" },
  { label: "최장 변 길이",  value: "100cm 이하",              note: "한 변 기준" },
  { label: "최소 크기",     value: "15cm × 10.5cm 이상",      note: "소형 기준" },
];

// ── 추가 서비스 요금 ───────────────────────────────────────────────
const EXTRA_SERVICES = [
  { name: "비규격 소포", fee: "+3,000원", desc: "세 변의 합 160cm 초과 또는 30kg 초과" },
];

type Tab = "rates" | "size" | "extra";

export default function DomesticRatesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("rates");
  const [openSection, setOpenSection] = useState<Set<string>>(() => new Set());

  function toggleSection(id: string) {
    setOpenSection(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const TABS: { id: Tab; label: string; active: string }[] = [
    { id: "rates", label: "📦 요금표",    active: "bg-blue-600 text-white" },
    { id: "size",  label: "📐 규격·크기", active: "bg-indigo-600 text-white" },
    { id: "extra", label: "➕ 부가서비스", active: "bg-gray-700 text-white" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="p-1 -ml-1">
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <div>
            <h1 className="text-base font-semibold text-gray-900">국내 택배 요금 안내</h1>
            <p className="text-[10px] text-gray-400">우체국택배 요금 · 규격 · 무게 제한</p>
          </div>
          <a
            href="https://www.koreapost.go.kr/postal/postInfo/parcelRate.do"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-xs bg-blue-600 text-white rounded-xl px-3 py-1.5 font-medium"
          >
            <ExternalLink size={12} />
            공식사이트
          </a>
        </div>
      </div>

      <main className="px-4 py-4 space-y-4">

        {/* 탭 */}
        <div className="bg-white rounded-2xl p-1.5 shadow-sm flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                tab === t.id ? t.active : "text-gray-600 bg-transparent"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── 요금표 탭 ── */}
        {tab === "rates" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 bg-emerald-50 rounded-xl px-3 py-2.5 border border-emerald-100">
              <Info size={13} className="text-emerald-500 shrink-0 mt-0.5" />
              <div className="text-[11px] text-emerald-700 space-y-0.5">
                <p>• <strong>크기</strong>: 가로+세로+높이 합계(cm)</p>
                <p>• <strong>중량</strong>: 실중량 기준 (최대 30kg)</p>
                <p>• 크기·중량 중 더 높은 구간 요금 적용</p>
                <p>• <strong>제주 익일</strong>: 제주↔육지 쌍방향 적용</p>
                <p className="text-emerald-500">※ 아래 요금은 참고값입니다. 실제 요금은 공식사이트에서 확인하세요.</p>
              </div>
            </div>

            {/* 요금표 */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 to-emerald-800 px-4 py-3">
                <p className="text-white font-bold text-sm">창구접수 등기소포 요금</p>
                <p className="text-white/70 text-[10px] mt-0.5">크기(가로+세로+높이 합계) · 무게 기준</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-semibold">크기 · 중량</th>
                    <th className="text-right px-4 py-2.5 text-xs text-emerald-600 font-semibold">일반</th>
                    <th className="text-right px-4 py-2.5 text-xs text-amber-600 font-semibold">제주 익일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {DOMESTIC_RATES.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 text-gray-700 text-sm font-medium">{row.label}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">
                        {row.regular.toLocaleString()}원
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-amber-600">
                        {row.jeju.toLocaleString()}원
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 제주 익일배달 안내 */}
            <div className="bg-amber-50 rounded-xl px-4 py-3 border border-amber-100 flex items-start gap-2">
              <AlertCircle size={13} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-700 space-y-0.5">
                <p className="font-semibold">제주 익일배달 안내</p>
                <p>• 제주↔육지 쌍방향(제주발·육지발 모두) 적용</p>
                <p>• 도서·산간 지역은 추가 요금 또는 배달 지연이 발생할 수 있습니다</p>
              </div>
            </div>

            {/* 배달 소요일 */}
            <div className="bg-amber-50 rounded-xl px-4 py-3 border border-amber-100">
              <p className="text-[11px] text-amber-700 font-semibold mb-1.5">⏱️ 우체국택배 배달 소요일 (예상)</p>
              <div className="space-y-1 text-[11px] text-amber-600">
                <p>• 일반 소포: 접수 다음날 배달 (D+1, 평일 기준)</p>
                <p>• 빠른 소포 (익일특급): 당일 접수 → 다음날 배달 보장</p>
                <p>• 도서·산간 지역: 추가 1~2일 소요</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">국내 배송 신청하기</p>
                <p className="text-xs text-gray-400 mt-0.5">우체국 소포로 국내 주소 발송</p>
              </div>
              <Link
                href="/domestic-shipping"
                className="flex items-center gap-1.5 bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-semibold shrink-0"
              >
                <Package size={14} />
                신청하기
              </Link>
            </div>
          </div>
        )}

        {/* ── 규격·크기 탭 ── */}
        {tab === "size" && (
          <div className="space-y-3">
            {/* 최대 크기 제한 */}
            <div className="flex items-start gap-2 bg-indigo-50 rounded-xl px-3 py-2.5 border border-indigo-100">
              <Ruler size={13} className="text-indigo-500 shrink-0 mt-0.5" />
              <div className="text-[11px] text-indigo-700 space-y-0.5">
                <p className="font-semibold">우체국 소포 접수 제한 (초과 시 접수 불가)</p>
                <p>• 최대 무게: <strong>30kg 이하</strong></p>
                <p>• 세 변의 합: <strong>160cm 이하</strong> (가로 + 세로 + 높이)</p>
                <p>• 가장 긴 변: <strong>100cm 이하</strong></p>
              </div>
            </div>

            {/* 크기 제한 카드 */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 px-4 py-3">
                <p className="text-white font-bold text-sm">크기·무게 제한표</p>
              </div>
              <div className="divide-y divide-gray-50">
                {SIZE_LIMITS.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3.5">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                      {item.note && <p className="text-xs text-gray-400 mt-0.5">{item.note}</p>}
                    </div>
                    <span className="text-sm font-bold text-indigo-700">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 규격 박스 종류 */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <button
                onClick={() => toggleSection("box-sizes")}
                className="w-full flex items-center justify-between px-4 py-3 text-left active:bg-gray-50"
              >
                <p className="text-sm font-bold text-gray-800">📦 우체국 규격 박스 종류</p>
                {openSection.has("box-sizes")
                  ? <ChevronUp size={16} className="text-gray-400 shrink-0" />
                  : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
              </button>
              {openSection.has("box-sizes") && (
                <div className="border-t border-gray-100">
                  <p className="text-[10px] text-gray-400 px-4 py-2">
                    우체국 창구 및 우체국쇼핑(mall.epost.go.kr)에서 구매 가능
                  </p>
                  <div className="divide-y divide-gray-50">
                    {BOX_SIZES.map((box, i) => (
                      <div key={i} className="px-4 py-3.5">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-gray-800">{box.name}</p>
                          <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg font-medium">
                            최대 {box.maxWeight}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>📏 {box.dims}</span>
                          <span>둘레 약 {box.circum}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 비규격 안내 */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <button
                onClick={() => toggleSection("non-standard")}
                className="w-full flex items-center justify-between px-4 py-3 text-left active:bg-gray-50"
              >
                <p className="text-sm font-bold text-gray-800">⚠️ 비규격 소포 안내</p>
                {openSection.has("non-standard")
                  ? <ChevronUp size={16} className="text-gray-400 shrink-0" />
                  : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
              </button>
              {openSection.has("non-standard") && (
                <div className="border-t border-gray-100 px-4 py-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-gray-600">
                      세 변의 합이 160cm 초과 또는 무게 30kg 초과 시 <strong className="text-amber-700">비규격 소포 추가 요금 (+3,000원)</strong>이 부과됩니다.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-gray-600">
                      세 변의 합 250cm 초과 또는 무게 50kg 초과는 <strong className="text-red-600">접수 불가</strong>입니다.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 부피중량 계산 안내 */}
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <p className="text-sm font-bold text-gray-800">📊 부피중량 계산 방법</p>
              <div className="bg-indigo-50 rounded-xl px-4 py-3 text-center">
                <p className="text-xs text-indigo-500 mb-1">부피중량 (kg)</p>
                <p className="text-base font-bold text-indigo-800">
                  가로(cm) × 세로(cm) × 높이(cm) ÷ 6,000
                </p>
              </div>
              <p className="text-[11px] text-gray-500">
                실제 무게와 부피중량 중 <strong>더 큰 값</strong>으로 요금이 계산됩니다.
              </p>
              <div className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                <p className="text-[11px] text-gray-500 font-semibold mb-1">예시</p>
                <p className="text-[11px] text-gray-600">
                  박스 크기 40 × 30 × 20 cm, 실중량 2.5kg
                </p>
                <p className="text-[11px] text-gray-600">
                  부피중량 = 40×30×20÷6,000 = <strong className="text-indigo-700">4.0kg</strong>
                </p>
                <p className="text-[11px] text-gray-600">
                  → 더 큰 값인 <strong className="text-indigo-700">4kg 이하</strong> 요금 적용
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── 부가서비스 탭 ── */}
        {tab === "extra" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 bg-gray-100 rounded-xl px-3 py-2.5 border border-gray-200">
              <Info size={13} className="text-gray-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-gray-600">
                부가서비스 요금은 기본 소포 요금에 추가됩니다. 우체국 창구 접수 시 신청 가능합니다.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-gray-700 to-gray-900 px-4 py-3">
                <p className="text-white font-bold text-sm">부가서비스 요금</p>
              </div>
              <div className="divide-y divide-gray-50">
                {EXTRA_SERVICES.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3.5">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                    </div>
                    <span className="text-sm font-bold text-gray-900 ml-2 shrink-0">{item.fee}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 발송 불가 품목 */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <button
                onClick={() => toggleSection("prohibited")}
                className="w-full flex items-center justify-between px-4 py-3 text-left active:bg-gray-50"
              >
                <p className="text-sm font-bold text-gray-800">🚫 발송 불가 품목</p>
                {openSection.has("prohibited")
                  ? <ChevronUp size={16} className="text-gray-400 shrink-0" />
                  : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
              </button>
              {openSection.has("prohibited") && (
                <div className="border-t border-gray-100 px-4 py-3 space-y-1.5">
                  {[
                    "폭발물 · 인화성 물질 · 독극물",
                    "살아있는 동물",
                    "화폐 · 수표 · 유가증권 (등기 이용)",
                    "음란물",
                    "법령에 의해 금지된 물품",
                    "액체류 (적정 포장 없이 발송 불가)",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                      <p className="text-[11px] text-gray-600">{item}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 이용 유의사항 */}
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
              <p className="text-sm font-bold text-gray-800">✅ 이용 유의사항</p>
              {[
                "소포는 우체국 창구, 우체통, 우체국 앱에서 접수 가능합니다.",
                "방문 수거 서비스는 당일 오전 접수 기준 당일 수거입니다.",
                "파손 방지를 위해 내용물 주변 완충재를 충분히 넣어 포장하세요.",
                "포장 박스 외부에 수취인 정보(이름, 주소, 전화번호)를 명확히 기재하세요.",
                "접수 취소는 집배원이 수거하기 전에만 가능합니다.",
              ].map((note, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 size={13} className="text-green-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-gray-600">{note}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 출처 안내 */}
        <div className="flex items-start gap-2 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
          <Info size={12} className="text-gray-400 shrink-0 mt-0.5" />
          <div className="text-[10px] text-gray-400 space-y-0.5">
            <p>위 요금은 우체국 소포 공시 요금 기준 참고값입니다 (2024년 기준, VAT 포함).</p>
            <p>제주·도서·산간 지역, 특수 품목 등에 따라 실제 요금이 달라질 수 있습니다.</p>
            <a
              href="https://www.koreapost.go.kr/postal/postInfo/parcelRate.do"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-0.5 text-blue-500 mt-1"
            >
              <ExternalLink size={10} />
              우체국 소포 공식 요금조회 바로가기
            </a>
          </div>
        </div>

      </main>
    </div>
  );
}
