"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Package } from "lucide-react";
import { Suspense } from "react";

interface PlanConfig {
  plan_type: string;
  label_ko: string;
  description_ko: string | null;
  capacity_score: number | null;
  monthly_amount: number | null;
  weekly_rate: number | null;
}

function StorageNewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPlan = searchParams.get("plan");

  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(preselectedPlan);
  const [storageName, setStorageName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/storage/plans")
      .then((r) => r.json())
      .then((d) => {
        const filtered: PlanConfig[] = (d.plans ?? []).filter(
          (p: PlanConfig) => p.plan_type !== "XL"
        );
        setPlans(filtered);
        if (!selectedPlan && filtered.length > 0) {
          setSelectedPlan(filtered[0].plan_type);
        }
      });
  }, []);

  async function handleApply() {
    if (!selectedPlan) return;
    setLoading(true);
    try {
      const res = await fetch("/api/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storage_mode: "long_term",
          plan_type: selectedPlan,
          storage_name: storageName.trim() || undefined,
          status: "ACTIVE",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.storage) {
        alert(json.error ?? "스토리지 생성에 실패했습니다.");
        return;
      }
      router.replace("/storage");
    } catch {
      alert("오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  const selectedConfig = plans.find((p) => p.plan_type === selectedPlan);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-1 -ml-1 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-900">장기보관 신청</h1>
          <p className="text-xs text-gray-400 mt-0.5">월정액 플랜으로 안정적인 장기 보관</p>
        </div>
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* 안내 */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-700 space-y-1">
          <p className="font-bold text-blue-800">📦 장기보관 서비스 안내</p>
          <ul className="space-y-0.5">
            {[
              "수거 신청 시 함께 신청하면 수거 완료 후 바로 보관 시작",
              "월정액 플랜 · 자동결제 (최초 1개월 선납)",
              "단기보관: 입고 후 3일 무료, 4일차부터 주 단위 자동 정산 (별도 신청 불필요)",
            ].map((t) => (
              <li key={t} className="flex items-start gap-1.5">
                <span className="mt-0.5">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 플랜 선택 */}
        <section>
          <p className="text-xs font-bold text-gray-700 mb-2">플랜 선택</p>
          <div className="space-y-2">
            {plans.map((plan) => (
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
                    {plan.capacity_score != null && (
                      <span className="text-xs text-gray-400">최대 {plan.capacity_score}개</span>
                    )}
                  </div>
                  {plan.description_ko && (
                    <p className="text-xs text-gray-500 mt-0.5">{plan.description_ko}</p>
                  )}
                  {plan.monthly_amount != null && (
                    <span className="text-xs font-bold text-brand-700 mt-1 block">
                      {plan.monthly_amount.toLocaleString()}원/월
                    </span>
                  )}
                </div>
                {selectedPlan === plan.plan_type && (
                  <div className="w-5 h-5 bg-brand-600 rounded-full flex items-center justify-center shrink-0">
                    <Check size={12} className="text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* 스토리지 이름 */}
        <section>
          <label className="text-xs font-bold text-gray-700 mb-2 block">
            스토리지 이름 <span className="font-normal text-gray-400">(선택)</span>
          </label>
          <input
            value={storageName}
            onChange={(e) => setStorageName(e.target.value)}
            placeholder="예: 내 여름옷 보관함"
            maxLength={30}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-400"
          />
        </section>

        {/* 합계 */}
        {selectedConfig?.monthly_amount != null && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">첫 달 결제 금액</span>
              <span className="text-lg font-black text-brand-600">
                {selectedConfig.monthly_amount.toLocaleString()}원
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">이후 매월 자동결제됩니다</p>
          </div>
        )}

        {/* 수거 신청 연계 안내 */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-start gap-3">
          <Package size={16} className="text-gray-400 mt-0.5 shrink-0" />
          <div className="text-xs text-gray-500 space-y-1">
            <p className="font-semibold text-gray-700">수거 신청과 함께 신청하는 방법</p>
            <p>수거 신청 3단계에서 <strong>장기보관 연계</strong>를 선택하면<br />수거와 보관을 한 번에 신청할 수 있습니다.</p>
          </div>
        </div>

        <button
          onClick={handleApply}
          disabled={!selectedPlan || loading}
          className="w-full bg-brand-600 text-white text-sm font-bold py-4 rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? "신청 중..." : "장기보관 신청하기"}
        </button>
      </div>
    </div>
  );
}

export default function StorageNewPage() {
  return (
    <Suspense>
      <StorageNewInner />
    </Suspense>
  );
}
