"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CreditCard, Loader2, LogIn } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

declare global {
  /* eslint-disable no-var */
  var INIStdPay: { pay: (formId: string) => void } | undefined;
}

const PLAN = {
  id:     "STORAGE_BASIC",
  name:   "보관함 기본 구독",
  amount: 9900,
};

export default function ShopBillingRegisterPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email?: string } | null | undefined>(undefined);
  const [name, setName]   = useState("");
  const [tel, setTel]     = useState("");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [agreedPay, setAgreedPay] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formParams, setFormParams] = useState<Record<string, string> | null>(null);
  const formRef      = useRef<HTMLFormElement>(null);
  const sdkScriptRef = useRef<HTMLScriptElement | null>(null);

  /* 로그인 상태 확인 */
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user ? { email: user.email } : null);
      if (user?.email) setEmail(user.email);
    });
  }, []);

  /* SDK 동적 로드 */
  function loadSdk(jsUrl: string, callback: () => void) {
    if (typeof window !== "undefined" && window.INIStdPay) { callback(); return; }
    if (sdkScriptRef.current) {
      sdkScriptRef.current.addEventListener("load", callback, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = jsUrl;
    script.onload = callback;
    script.onerror = () => { setLoading(false); alert("결제 모듈 로드에 실패했습니다."); };
    sdkScriptRef.current = script;
    document.head.appendChild(script);
  }

  async function handleRegister() {
    if (!name.trim() || !tel.trim() || !email.trim() || !agreed) return;
    setLoading(true);
    try {
      const res = await fetch("/api/shop/billing/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyername:  name.trim(),
          buyertel:   tel.replace(/-/g, ""),
          buyeremail: email.trim(),
          planId:     PLAN.id,
        }),
      });
      const data = await res.json() as Record<string, string>;
      if (!res.ok || data.error) {
        alert(data.error ?? "카드 등록 초기화에 실패했습니다.");
        setLoading(false);
        return;
      }

      setFormParams(data);
      requestAnimationFrame(() => {
        loadSdk(data.jsUrl, () => {
          if (typeof window !== "undefined" && window.INIStdPay && formRef.current) {
            window.INIStdPay.pay(formRef.current.id);
          } else {
            alert("결제 모듈 초기화에 실패했습니다.");
            setLoading(false);
          }
        });
      });
    } catch (e) {
      console.error(e);
      alert("오류가 발생했습니다. 다시 시도해 주세요.");
      setLoading(false);
    }
  }

  const isValid = name.trim() && tel.trim() && email.trim() && agreed && agreedPay && agreedPrivacy;

  /* 로딩 중 */
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  /* 미로그인 */
  if (user === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-white border-b border-gray-100 px-4 py-4">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <button onClick={() => router.back()} className="p-1 -ml-1">
              <ArrowLeft size={20} className="text-gray-700" />
            </button>
            <h1 className="text-base font-bold text-gray-900">구독 신청</h1>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
          <div className="w-16 h-16 bg-[#de2910]/10 rounded-2xl flex items-center justify-center">
            <LogIn size={28} className="text-[#de2910]" />
          </div>
          <p className="text-base font-bold text-gray-900 text-center">로그인이 필요합니다</p>
          <p className="text-sm text-gray-500 text-center">
            구독 서비스를 이용하려면 먼저 로그인해 주세요.
          </p>
          <button
            onClick={() => router.push(`/login?redirect=/shop/billing/register`)}
            className="bg-[#de2910] text-white font-bold px-8 py-3 rounded-2xl text-sm"
          >
            로그인하기
          </button>
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-400 underline"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* 숨김 빌링 폼 */}
      {formParams && (
        <form
          id="frmBillIssue"
          ref={formRef}
          method="POST"
          acceptCharset="UTF-8"
          style={{ display: "none" }}
        >
          <input type="hidden" name="version"      value="1.0" />
          <input type="hidden" name="mid"          value={formParams.mid} />
          <input type="hidden" name="oid"          value={formParams.oid} />
          <input type="hidden" name="price"        value={formParams.price} />
          <input type="hidden" name="timestamp"    value={formParams.timestamp} />
          <input type="hidden" name="signature"    value={formParams.signature} />
          <input type="hidden" name="use_chkfake"  value="Y" />
          <input type="hidden" name="verification" value={formParams.verification} />
          <input type="hidden" name="mKey"         value={formParams.mKey} />
          <input type="hidden" name="goodname"     value={formParams.goodname} />
          <input type="hidden" name="buyername"    value={formParams.buyername} />
          <input type="hidden" name="buyertel"     value={formParams.buyertel} />
          <input type="hidden" name="buyeremail"   value={formParams.buyeremail} />
          <input type="hidden" name="billtype"     value={formParams.billtype} />
          <input type="hidden" name="gopaymethod"  value={formParams.gopaymethod} />
          <input type="hidden" name="returnUrl"    value={formParams.returnUrl} />
          <input type="hidden" name="closeUrl"     value={formParams.closeUrl} />
          <input type="hidden" name="custom_data"  value={formParams.custom_data} />
          <input type="hidden" name="payViewType"  value="overlay" />
          <input type="hidden" name="charset"      value="UTF-8" />
          <input type="hidden" name="currency"     value="WON" />
        </form>
      )}

      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1 -ml-1">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="text-base font-bold text-gray-900">구독 카드 등록</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* 플랜 요약 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 mb-3">선택한 구독 플랜</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#de2910]/10 rounded-xl flex items-center justify-center shrink-0">
              <CreditCard size={20} className="text-[#de2910]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">{PLAN.name}</p>
              <p className="text-xs text-gray-400">매월 자동 결제</p>
            </div>
            <p className="text-base font-bold text-[#de2910]">
              {PLAN.amount.toLocaleString()}원<span className="text-xs font-normal text-gray-400">/월</span>
            </p>
          </div>
        </div>

        {/* 구매자 정보 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          <p className="text-xs font-bold text-gray-500">결제자 정보</p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#de2910] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              연락처 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={tel}
              onChange={(e) => setTel(e.target.value.replace(/[^0-9\-]/g, ""))}
              placeholder="010-1234-5678"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#de2910] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              이메일 <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#de2910] transition-colors"
            />
          </div>
        </div>

        {/* 자동결제 고지 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-2">
          <p className="text-xs font-bold text-amber-800">📋 자동결제(정기결제) 고지사항</p>
          <p className="text-[11px] text-amber-700 leading-relaxed">
            정기결제는 신용카드 자동결제(빌링)만 지원합니다. 해외카드·Alipay·WeChat Pay는 장기보관 월 이용료 결제에 사용할 수 없습니다.
          </p>
          <table className="w-full text-xs text-amber-800 border-collapse">
            <tbody>
              <tr className="border-b border-amber-200">
                <td className="py-1 pr-3 font-semibold whitespace-nowrap">상품명</td>
                <td className="py-1">보관함 기본 구독 (STORAGE_BASIC)</td>
              </tr>
              <tr className="border-b border-amber-200">
                <td className="py-1 pr-3 font-semibold whitespace-nowrap">결제 금액</td>
                <td className="py-1 font-bold">9,900원 / 월</td>
              </tr>
              <tr className="border-b border-amber-200">
                <td className="py-1 pr-3 font-semibold whitespace-nowrap">결제 주기</td>
                <td className="py-1">매월 1일 자동 청구</td>
              </tr>
              <tr className="border-b border-amber-200">
                <td className="py-1 pr-3 font-semibold whitespace-nowrap">최초 결제</td>
                <td className="py-1">카드 등록 즉시 9,900원 청구</td>
              </tr>
              <tr className="border-b border-amber-200">
                <td className="py-1 pr-3 font-semibold whitespace-nowrap">해지 방법</td>
                <td className="py-1">서비스 내 해지 또는 고객센터(010-2723-9490) 문의</td>
              </tr>
              <tr>
                <td className="py-1 pr-3 font-semibold whitespace-nowrap">환불 정책</td>
                <td className="py-1">결제일 기준 7일 이내 전액 환불, 이후 잔여일수 비례 환불</td>
              </tr>
            </tbody>
          </table>
          <p className="text-[10px] text-amber-700 leading-relaxed">
            ※ 전자상거래법 제17조에 따라 서비스 이용 개시 전 청약 철회가 가능합니다.<br />
            ※ 결제 실패 시 3일 이내 재청구되며, 반복 실패 시 구독이 일시 중단됩니다.
          </p>
        </div>

        {/* 개인정보 제3자 제공 동의 */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 space-y-1.5">
          <p className="text-xs font-bold text-gray-700">개인정보 제3자 제공 내용</p>
          <table className="w-full text-xs text-gray-600 border-collapse">
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-1 pr-3 font-semibold whitespace-nowrap">제공받는 자</td>
                <td className="py-1">KG이니시스(주)</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-1 pr-3 font-semibold whitespace-nowrap">제공 항목</td>
                <td className="py-1">이름, 연락처, 이메일, 카드 결제 정보</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-1 pr-3 font-semibold whitespace-nowrap">제공 목적</td>
                <td className="py-1">자동결제(빌링) 서비스 처리</td>
              </tr>
              <tr>
                <td className="py-1 pr-3 font-semibold whitespace-nowrap">보유 기간</td>
                <td className="py-1">구독 해지 후 5년</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 약관 동의 목록 */}
        <div className="space-y-2.5">
          {/* 전체 동의 */}
          <label className="flex items-start gap-2.5 cursor-pointer bg-gray-50 rounded-xl px-3 py-2.5">
            <input
              type="checkbox"
              checked={agreed && agreedPay && agreedPrivacy}
              onChange={(e) => {
                setAgreed(e.target.checked);
                setAgreedPay(e.target.checked);
                setAgreedPrivacy(e.target.checked);
              }}
              className="mt-0.5 w-4 h-4 accent-[#de2910] shrink-0"
            />
            <span className="text-xs font-bold text-gray-800">아래 약관에 모두 동의합니다</span>
          </label>

          {/* 이용약관 */}
          <label className="flex items-start gap-2.5 cursor-pointer pl-2">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#de2910] shrink-0"
            />
            <span className="text-xs text-gray-600 leading-relaxed">
              <span className="text-[#de2910] font-semibold">[필수]</span>{" "}
              <a href="/shop/terms" target="_blank" className="underline text-gray-700 hover:text-[#de2910]">서비스 이용약관</a> 동의
            </span>
          </label>

          {/* 자동결제 약관 */}
          <label className="flex items-start gap-2.5 cursor-pointer pl-2">
            <input
              type="checkbox"
              checked={agreedPay}
              onChange={(e) => setAgreedPay(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#de2910] shrink-0"
            />
            <span className="text-xs text-gray-600 leading-relaxed">
              <span className="text-[#de2910] font-semibold">[필수]</span>{" "}
              자동결제(정기결제) 서비스 약관 및 위 고지사항 확인·동의
            </span>
          </label>

          {/* 개인정보 제3자 제공 */}
          <label className="flex items-start gap-2.5 cursor-pointer pl-2">
            <input
              type="checkbox"
              checked={agreedPrivacy}
              onChange={(e) => setAgreedPrivacy(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#de2910] shrink-0"
            />
            <span className="text-xs text-gray-600 leading-relaxed">
              <span className="text-[#de2910] font-semibold">[필수]</span>{" "}
              개인정보 제3자 제공(KG이니시스) 동의
            </span>
          </label>
        </div>

        {/* 카드 등록 버튼 */}
        <button
          onClick={handleRegister}
          disabled={loading || !isValid}
          className="w-full bg-[#de2910] text-white font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-40 active:opacity-80 transition-opacity"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
          카드 등록하기
        </button>

        <p className="text-center text-[10px] text-gray-400">
          결제는 KG이니시스를 통해 안전하게 처리됩니다
        </p>

        {/* 사업자 정보 */}
        <div className="border-t border-gray-200 pt-4 space-y-1">
          <p className="text-[10px] font-bold text-gray-500">인프론트 · 틸리언</p>
          <div className="text-[10px] text-gray-400 leading-relaxed space-y-0.5">
            <p>대표자 장지훈 &nbsp;|&nbsp; 사업자등록번호 766-55-00323</p>
            <p>통신판매업 제 2022-대구동구-1034 호</p>
          </div>
        </div>
      </div>
    </div>
  );
}
