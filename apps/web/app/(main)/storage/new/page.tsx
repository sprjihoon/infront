"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronRight, CreditCard, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface PlanConfig {
  plan_type: string;
  label_ko: string;
  description_ko: string | null;
  capacity_score: number;
  monthly_amount: number | null;
  weekly_rate: number | null;
}

interface CustomerProfile {
  name: string | null;
  phone: string | null;
  email: string;
}

const SHIPPING_FEE = 3000; // 수거비 고정

export default function StorageNewPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [mode, setMode] = useState<"short_term" | "long_term">("short_term");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [storageName, setStorageName] = useState("");
  const [loading, setLoading] = useState(false);
  const [payParams, setPayParams] = useState<Record<string, string> | null>(null);
  const [jsUrl, setJsUrl] = useState("");

  useEffect(() => {
    fetch("/api/storage/plans")
      .then((r) => r.json())
      .then((d) => setPlans(d.plans ?? []));

    // 고객 프로필 (이름, 연락처, 이메일)
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("customers")
        .select("name, phone, email")
        .eq("id", user.id)
        .single();
      setProfile(data);
    });
  }, []);

  // payParams 세팅 후 KG Inicis 스크립트 로드 및 결제 팝업 실행
  useEffect(() => {
    if (!payParams || !jsUrl) return;

    // 기존 스크립트 제거
    const prev = document.getElementById("inicis-script");
    if (prev) prev.remove();

    const script = document.createElement("script");
    script.id = "inicis-script";
    script.src = jsUrl;
    script.onload = () => {
      const INIStdPay = (window as Window & { INIStdPay?: { pay: (id: string) => void } }).INIStdPay;
      if (INIStdPay?.pay) {
        INIStdPay.pay("frmPayment");
      }
    };
    document.head.appendChild(script);
  }, [payParams, jsUrl]);

  async function handleApply() {
    if (!selectedPlan) return;
    setLoading(true);

    try {
      // 1. 스토리지 생성 (PENDING_PAYMENT 상태)
      const storageRes = await fetch("/api/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storage_mode: mode,
          plan_type: selectedPlan,
          storage_name: storageName.trim() || undefined,
          status: "PENDING_PAYMENT",
        }),
      });
      const storageJson = await storageRes.json();
      if (!storageRes.ok || !storageJson.storage) {
        alert(storageJson.error ?? "스토리지 생성에 실패했습니다.");
        return;
      }

      // 2. 결제 준비
      const payRes = await fetch("/api/storage/pay/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storage_id: storageJson.storage.id,
          payment_type: "PICKUP_FEE",
          buyername: profile?.name ?? "고객",
          buyertel: (profile?.phone ?? "").replace(/[^0-9\-]/g, "") || "010-0000-0000",
          buyeremail: profile?.email ?? "",
        }),
      });
      const payJson = await payRes.json();
      if (!payRes.ok || payJson.error) {
        alert(payJson.error ?? "결제 준비에 실패했습니다.");
        return;
      }

      setJsUrl(payJson.jsUrl);
      setPayParams(payJson);

    } catch (e) {
      console.error(e);
      alert("오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
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
          <p className="text-xs text-gray-400 mt-0.5">플랜 선택 후 수거비(3,000원) 결제</p>
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
                <p className={`text-[11px] whitespace-pre-line leading-relaxed ${
                  mode === opt.value ? "text-brand-600" : "text-gray-500"
                }`}>
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
                  selectedPlan === plan.plan_type
                    ? "bg-brand-600 text-white"
                    : "bg-gray-100 text-gray-600"
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

            {/* XL — 별도 견적 */}
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

        {/* 요금 요약 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
          <p className="text-xs font-bold text-gray-700 mb-3">결제 요약</p>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">수거비 (최초 1회)</span>
            <span className="font-bold text-gray-900">3,000원</span>
          </div>
          {selectedPlan && (
            <div className="flex justify-between text-xs text-gray-400">
              <span>
                {mode === "short_term"
                  ? `보관료 (출고 시 주단위 정산)`
                  : `보관료 (월정액)`}
              </span>
              <span>
                {mode === "short_term"
                  ? `${(plans.find((p) => p.plan_type === selectedPlan)?.weekly_rate ?? 0).toLocaleString()}원/주`
                  : `${(plans.find((p) => p.plan_type === selectedPlan)?.monthly_amount ?? 0).toLocaleString()}원/월`}
              </span>
            </div>
          )}
          <div className="border-t border-gray-100 pt-2 flex justify-between">
            <span className="text-sm font-bold text-gray-800">지금 결제</span>
            <span className="text-base font-black text-brand-600">3,000원</span>
          </div>
        </div>

        {/* 신청 버튼 */}
        <button
          onClick={handleApply}
          disabled={loading || !selectedPlan}
          className="w-full bg-brand-600 text-white text-sm font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              처리 중...
            </>
          ) : (
            <>
              <CreditCard size={16} />
              신청 및 수거비 결제 (3,000원)
              <ChevronRight size={16} />
            </>
          )}
        </button>

        <p className="text-xs text-gray-400 text-center pb-2">
          수거비 결제 완료 후 1~2 영업일 내 수거 일정을 안내드립니다.
        </p>
      </div>

      {/* KG Inicis 결제 폼 (숨김) */}
      {payParams && (
        <form
          id="frmPayment"
          ref={formRef}
          method="POST"
          acceptCharset="UTF-8"
          style={{ display: "none" }}
        >
          <input type="hidden" name="version"       value="1.0" />
          <input type="hidden" name="gopaymethod"   value="Card" />
          <input type="hidden" name="mid"           value={payParams.mid} />
          <input type="hidden" name="oid"           value={payParams.oid} />
          <input type="hidden" name="price"         value={payParams.price} />
          <input type="hidden" name="timestamp"     value={payParams.timestamp} />
          <input type="hidden" name="signature"     value={payParams.signature} />
          <input type="hidden" name="verification"  value={payParams.verification} />
          <input type="hidden" name="mKey"          value={payParams.mKey} />
          <input type="hidden" name="goodname"      value={payParams.goodname} />
          <input type="hidden" name="buyername"     value={payParams.buyername} />
          <input type="hidden" name="buyertel"      value={payParams.buyertel} />
          <input type="hidden" name="buyeremail"    value={payParams.buyeremail} />
          <input type="hidden" name="currency"      value="WON" />
          <input type="hidden" name="langWallet"    value="ko" />
          <input type="hidden" name="returnUrl"     value={payParams.returnUrl} />
          <input type="hidden" name="closeUrl"      value={payParams.closeUrl} />
          <input type="hidden" name="acceptmethod"  value="centerCd(Y):HPP(2)" />
        </form>
      )}
    </div>
  );
}
