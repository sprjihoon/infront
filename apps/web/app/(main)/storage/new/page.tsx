"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";

interface PlanConfig {
  plan_type: string;
  label_ko: string;
  description_ko: string | null;
  capacity_score: number;
  monthly_amount: number | null;
  weekly_rate: number | null;
}

export default function StorageNewPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [mode, setMode] = useState<"short_term" | "long_term">("short_term");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [storageName, setStorageName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/storage/plans")
      .then((r) => r.json())
      .then((d) => setPlans(d.plans ?? []));
  }, []);

  async function submit() {
    if (!selectedPlan) return;
    setLoading(true);
    const res = await fetch("/api/storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storage_mode: mode,
        plan_type: selectedPlan,
        storage_name: storageName.trim() || undefined,
      }),
    });
    const json = await res.json();
    setLoading(false);
    if (res.ok && json.storage) {
      router.push(`/storage/${json.storage.id}`);
    }
  }

  const filteredPlans = plans.filter((p) => p.plan_type !== "XL");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-1 -ml-1 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-900">보관 서비스 신청</h1>
          <p className="text-xs text-gray-400 mt-0.5">플랜을 선택하고 신청해 주세요</p>
        </div>
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* 보관 방식 선택 */}
        <div>
          <p className="text-xs font-bold text-gray-700 mb-2">보관 방식</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                value: "short_term" as const,
                label: "단기보관",
                desc: "출고 시 주 단위 정산\n언제든 이용 종료 가능",
              },
              {
                value: "long_term" as const,
                label: "장기보관",
                desc: "월정액 자동결제\n안정적인 장기 보관",
              },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                  mode === opt.value
                    ? "border-brand-500 bg-brand-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-bold ${mode === opt.value ? "text-brand-700" : "text-gray-800"}`}>
                    {opt.label}
                  </span>
                  {mode === opt.value && (
                    <div className="w-4 h-4 bg-brand-600 rounded-full flex items-center justify-center">
                      <Check size={10} className="text-white" />
                    </div>
                  )}
                </div>
                <p className={`text-[11px] whitespace-pre-line leading-relaxed ${mode === opt.value ? "text-brand-600" : "text-gray-500"}`}>
                  {opt.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* 플랜 선택 */}
        <div>
          <p className="text-xs font-bold text-gray-700 mb-2">플랜 선택</p>
          <div className="space-y-2">
            {filteredPlans.map((plan) => (
              <button
                key={plan.plan_type}
                onClick={() => setSelectedPlan(plan.plan_type)}
                className={`w-full p-4 rounded-2xl border-2 text-left flex items-center gap-3 transition-all ${
                  selectedPlan === plan.plan_type
                    ? "border-brand-500 bg-brand-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black shrink-0 ${
                  selectedPlan === plan.plan_type ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600"
                }`}>
                  {plan.plan_type}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold text-gray-900">{plan.label_ko}</span>
                    <span className="text-xs text-gray-400">최대 {plan.capacity_score}점</span>
                  </div>
                  {plan.description_ko && (
                    <p className="text-xs text-gray-500 mt-0.5">{plan.description_ko}</p>
                  )}
                  <div className="flex gap-3 mt-1.5">
                    {mode === "short_term" && plan.weekly_rate != null && (
                      <span className="text-xs font-bold text-brand-700">
                        {plan.weekly_rate.toLocaleString()}원/주
                      </span>
                    )}
                    {mode === "long_term" && plan.monthly_amount != null && (
                      <span className="text-xs font-bold text-brand-700">
                        {plan.monthly_amount.toLocaleString()}원/월
                      </span>
                    )}
                  </div>
                </div>
                {selectedPlan === plan.plan_type && (
                  <div className="w-5 h-5 bg-brand-600 rounded-full flex items-center justify-center shrink-0">
                    <Check size={12} className="text-white" />
                  </div>
                )}
              </button>
            ))}

            {/* XL 플랜 (별도 견적) */}
            <div className="w-full p-4 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center text-lg font-black text-gray-500 shrink-0">
                XL
              </div>
              <div>
                <p className="text-sm font-bold text-gray-600">특수 스토리지</p>
                <p className="text-xs text-gray-400 mt-0.5">대형/특수 물품 — 별도 견적 문의</p>
                <a
                  href="mailto:storage@infront.kr"
                  className="text-xs font-semibold text-brand-600 underline mt-1 inline-block"
                >
                  견적 문의 →
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* 스토리지 이름 */}
        <div>
          <p className="text-xs font-bold text-gray-700 mb-2">스토리지 이름 (선택)</p>
          <input
            value={storageName}
            onChange={(e) => setStorageName(e.target.value)}
            placeholder="예: 겨울옷 보관, 유학 짐"
            maxLength={30}
            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-brand-400"
          />
        </div>

        {/* 요금 안내 */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-xs font-bold text-blue-700 mb-2">요금 안내</p>
          <ul className="space-y-1">
            {mode === "short_term" ? [
              "수거비: 3,000원 (별도)",
              "보관료: 출고 시 사용 주수 × 주간 요금",
              "보관 기간 중 최대 사용 플랜 기준 과금",
              "출고 처리비: 1,000원 (별도)",
            ] : [
              "수거비: 3,000원 (별도)",
              "보관료: 선택 플랜 월정액 자동결제",
              "최초 1개월 선납 후 매월 자동 갱신",
              "출고 처리비: 1,000원 (별도)",
            ].map((t) => (
              <li key={t} className="flex items-start gap-1.5">
                <span className="text-blue-400 mt-0.5">•</span>
                <span className="text-xs text-blue-700">{t}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 신청 버튼 */}
        <button
          onClick={submit}
          disabled={loading || !selectedPlan}
          className="w-full bg-brand-600 text-white text-sm font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
        >
          {loading ? "처리 중..." : (
            <>
              보관 서비스 신청하기
              <ChevronRight size={16} />
            </>
          )}
        </button>

        <p className="text-xs text-gray-400 text-center pb-2">
          신청 완료 후 수거 일정을 별도 안내해 드립니다.
        </p>
      </div>
    </div>
  );
}
