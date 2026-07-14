"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, LogIn, Package } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import {
  ONE_TIME_PRODUCTS,
  RECURRING_PRODUCTS,
  SERVICE_INTRO_KO,
  SERVICE_INTRO_EN,
  FOREIGN_CARD_SCOPE_NOTICE_KO,
  FOREIGN_CARD_SCOPE_NOTICE_EN,
} from "@/lib/shop/products";
import { ShopProductCard } from "./components/ShopProductCard";
import { useLanguage } from "./useLanguage";
import { t } from "./translations";

export default function ShopPage() {
  const router = useRouter();
  const { lang, toggle, mounted } = useLanguage();
  const tx = t[lang];

  const [userEmail, setUserEmail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null);
    });
  }, []);

  const serviceIntro = lang === "ko" ? SERVICE_INTRO_KO : SERVICE_INTRO_EN;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#de2910] rounded-lg flex items-center justify-center">
              <Package size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">{tx.headerTitle}</h1>
              <p className="text-xs text-gray-400">{tx.headerSub}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mounted && (
              <button
                onClick={toggle}
                className="flex items-center gap-1 text-xs font-semibold text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Globe size={12} />
                {tx.langLabel}
              </button>
            )}
            {userEmail === null ? (
              <button
                onClick={() => router.push("/login?redirect=/shop")}
                className="flex items-center gap-1 text-xs font-bold text-white bg-[#de2910] px-2.5 py-1.5 rounded-lg active:opacity-80 transition-opacity"
              >
                <LogIn size={12} />
                {lang === "ko" ? "로그인" : "Login"}
              </button>
            ) : userEmail ? (
              <button
                onClick={async () => {
                  const sb = createBrowserClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                  );
                  await sb.auth.signOut();
                  setUserEmail(null);
                }}
                className="flex items-center gap-1 text-xs font-semibold text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <LogIn size={12} className="rotate-180" />
                {lang === "ko" ? "로그아웃" : "Logout"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* 서비스 정의 */}
        <div className="bg-[#de2910]/5 border border-[#de2910]/20 rounded-xl px-4 py-4">
          <p className="text-sm font-semibold text-[#de2910] mb-2">{tx.serviceTitle}</p>
          <p className="text-xs text-gray-600 leading-relaxed">{serviceIntro}</p>
          <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-[#de2910]/10 leading-relaxed">
            {tx.serviceNote}
          </p>
        </div>

        {/* 결제수단 구조 안내 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          <p className="text-xs font-bold text-gray-700">
            {lang === "ko" ? "결제수단 안내" : "Payment Methods"}
          </p>
          <div className="text-[11px] text-gray-600 space-y-2">
            <p>
              <span className="font-semibold text-gray-800">
                {lang === "ko" ? "[일회성 결제]" : "[One-time]"}
              </span>{" "}
              {lang === "ko"
                ? "신용카드 · 계좌이체 · 가상계좌 · 간편결제 · 해외카드 · Alipay · WeChat Pay"
                : "Credit card · Bank transfer · Virtual account · Easy pay · Intl card · Alipay · WeChat Pay"}
            </p>
            <p>
              <span className="font-semibold text-gray-800">
                {lang === "ko" ? "[정기결제]" : "[Recurring]"}
              </span>{" "}
              {lang === "ko"
                ? "신용카드 자동결제(빌링) — 스토리지 보관 서비스 전용"
                : "Card auto-billing — storage subscription only"}
            </p>
            <p className="text-gray-500">
              {lang === "ko"
                ? FOREIGN_CARD_SCOPE_NOTICE_KO
                : FOREIGN_CARD_SCOPE_NOTICE_EN}
            </p>
          </div>
        </div>

        {/* 일회성 서비스 */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-3">
            {lang === "ko" ? "일회성 서비스" : "One-time Services"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ONE_TIME_PRODUCTS.map((product) => (
              <ShopProductCard
                key={product.id}
                product={product}
                lang={lang}
                actionLabel={lang === "ko" ? "상세보기" : "Details"}
                onAction={() => router.push(`/shop/products/${product.id}`)}
              />
            ))}
          </div>
        </section>

        {/* 정기 구독 (스토리지) */}
        <section>
          <h2 className="text-sm font-bold text-gray-900 mb-3">
            {lang === "ko" ? "스토리지 보관 (월 정기결제)" : "Storage (Monthly Billing)"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {RECURRING_PRODUCTS.map((product) => (
              <ShopProductCard
                key={product.id}
                product={product}
                lang={lang}
                actionLabel={lang === "ko" ? "구독 상세" : "Subscribe"}
                onAction={() => router.push(`/shop/products/${product.id}`)}
              />
            ))}
          </div>
        </section>

        {/* 로그인 안내 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs font-bold text-amber-800 mb-1">
            {lang === "ko" ? "회원 로그인 후 결제" : "Login required for payment"}
          </p>
          <p className="text-xs text-amber-700 leading-relaxed">
            {lang === "ko"
              ? "해외카드 결제는 회원 주문에서만 이용 가능합니다. 로그인 또는 회원가입 후 이용해주세요. 회원가입 시 이메일 인증을 통해 계정 확인 후 결제 서비스를 이용할 수 있습니다."
              : "International card payments require member login. Please sign up with email verification to use payment services."}
          </p>
        </div>
      </main>
    </div>
  );
}
