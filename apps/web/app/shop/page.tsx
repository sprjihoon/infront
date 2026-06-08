"use client";

import { useRouter } from "next/navigation";
import { Package, Home, Globe } from "lucide-react";
import { useLanguage } from "./useLanguage";
import { t } from "./translations";

export const SHOP_PRODUCTS = [
  {
    id: "BOX_S",
    name: { ko: "S박스 포장대행", en: "S Box Packaging" },
    desc: { ko: "20×15×10cm · 1kg 이하 소형 물품", en: "20×15×10cm · up to 1kg" },
    price: 5000,
    badge: { ko: "소형", en: "Small" },
    badgeColor: "bg-emerald-100 text-emerald-700",
  },
  {
    id: "BOX_M",
    name: { ko: "M박스 포장대행", en: "M Box Packaging" },
    desc: { ko: "30×25×20cm · 3kg 이하 중형 물품", en: "30×25×20cm · up to 3kg" },
    price: 8000,
    badge: { ko: "중형", en: "Medium" },
    badgeColor: "bg-blue-100 text-blue-700",
  },
  {
    id: "BOX_L",
    name: { ko: "L박스 포장대행", en: "L Box Packaging" },
    desc: { ko: "40×35×25cm · 5kg 이하 대형 물품", en: "40×35×25cm · up to 5kg" },
    price: 12000,
    badge: { ko: "대형", en: "Large" },
    badgeColor: "bg-orange-100 text-orange-700",
  },
  {
    id: "BOX_XL",
    name: { ko: "XL박스 포장대행", en: "XL Box Packaging" },
    desc: { ko: "50×45×35cm · 10kg 이하 특대형 물품", en: "50×45×35cm · up to 10kg" },
    price: 18000,
    badge: { ko: "특대형", en: "X-Large" },
    badgeColor: "bg-purple-100 text-purple-700",
  },
] as const;

export default function ShopPage() {
  const router = useRouter();
  const { lang, toggle, mounted } = useLanguage();
  const tx = t[lang];

  function handleBuy(productId: string) {
    sessionStorage.setItem("shop_product_id", productId);
    router.push("/shop/checkout");
  }

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
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors px-3 py-2 rounded-xl hover:bg-gray-50"
            >
              <Home size={14} />
              {tx.home}
            </button>
            {mounted && (
              <button
                onClick={toggle}
                className="flex items-center gap-1 text-xs font-semibold text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Globe size={12} />
                {tx.langLabel}
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* 서비스 정의 안내 */}
        <div className="bg-[#de2910]/5 border border-[#de2910]/20 rounded-xl px-4 py-4">
          <p className="text-sm font-semibold text-[#de2910] mb-2">{tx.serviceTitle}</p>
          <p className="text-xs text-gray-600 leading-relaxed">{tx.serviceDesc}</p>
          <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-[#de2910]/10 leading-relaxed">
            {tx.serviceNote}
          </p>
        </div>

        {/* 취급 금지 물품 안내 */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 space-y-1.5">
          <p className="text-xs font-bold text-gray-700">{tx.prohibitedTitle}</p>
          <p className="text-xs text-gray-500 leading-relaxed">{tx.prohibitedDesc}</p>
          <ul className="text-xs text-gray-600 leading-relaxed space-y-0.5 list-disc list-inside">
            {tx.prohibitedItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        {/* 상품 목록 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SHOP_PRODUCTS.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2 ${product.badgeColor}`}>
                    {product.badge[lang]}
                  </span>
                  <h2 className="text-sm font-bold text-gray-900">{product.name[lang]}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{product.desc[lang]}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                <span className="text-lg font-bold text-gray-900">
                  {product.price.toLocaleString()}
                  <span className="text-sm font-normal text-gray-500 ml-0.5">원</span>
                </span>
                <button
                  onClick={() => handleBuy(product.id)}
                  className="bg-[#de2910] text-white text-xs font-bold px-4 py-2 rounded-xl active:opacity-80 transition-opacity"
                >
                  {tx.buyBtn}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 서비스 안내 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
          <p className="text-xs font-bold text-gray-700 mb-2">{tx.includesTitle}</p>
          {tx.includesItems.map((item) => (
            <div key={item} className="flex items-center gap-2">
              <span className="text-sm">✅</span>
              <span className="text-xs text-gray-600">{item}</span>
            </div>
          ))}
        </div>

        {/* 환불 정책 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-1">
          <p className="text-xs font-bold text-amber-800">{tx.refundTitle}</p>
          <ul className="text-xs text-amber-700 leading-relaxed space-y-0.5 list-disc list-inside">
            {tx.refundItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </main>

      {/* 사업자 정보 Footer */}
      <footer className="border-t border-gray-200 bg-white mt-8 px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-3">
          <p className="text-xs font-bold text-gray-700">인프론트</p>
          <div className="text-[11px] text-gray-500 leading-relaxed space-y-0.5">
            <p><span className="text-gray-400">상호명</span> 틸리언 &nbsp;|&nbsp; <span className="text-gray-400">대표자</span> 장지훈</p>
            <p><span className="text-gray-400">사업자등록번호</span> 766-55-00323</p>
            <p><span className="text-gray-400">통신판매업신고</span> 제 2022-대구동구-1034 호</p>
            <p><span className="text-gray-400">주소</span> 대구시 동구 안심로188 2층, 3층</p>
            <p><span className="text-gray-400">고객센터</span> 010-2723-9490 &nbsp;|&nbsp; <span className="text-gray-400">이메일</span> info@tillion.kr</p>
            <p><span className="text-gray-400">개인정보관리책임자</span> 장지훈</p>
          </div>
          <div className="flex gap-3 pt-1">
            <a href="/terms" className="text-[11px] text-gray-500 underline underline-offset-2 hover:text-gray-700">이용약관</a>
            <a href="/privacy" className="text-[11px] text-gray-500 underline underline-offset-2 hover:text-gray-700">개인정보처리방침</a>
          </div>
          <p className="text-[10px] text-gray-400">© 2026 틸리언. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
