"use client";

import { useRouter } from "next/navigation";
import { Package, ShoppingBag } from "lucide-react";
import { SHOP_PRODUCTS } from "@/app/shop/page";

export default function SampleHomePage() {
  const router = useRouter();

  function handleBuy(productId: string) {
    sessionStorage.setItem("shop_product_id", productId);
    router.push("/shop/checkout");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-[#de2910] rounded-lg flex items-center justify-center">
            <Package size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">인프론트 포장대행</h1>
            <p className="text-xs text-gray-400">박스 사이즈별 포장 서비스</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
            <ShoppingBag size={14} />
            <span>스토어</span>
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* 서비스 배너 */}
        <div className="bg-gradient-to-r from-[#de2910] to-[#b52208] rounded-2xl px-5 py-5 text-white">
          <p className="text-white/70 text-xs font-medium mb-1">인프론트 해외배송 대행</p>
          <p className="text-lg font-bold leading-snug">안전한 포장으로 해외까지</p>
          <p className="text-white/80 text-sm mt-1.5">EMS · EMS 프리미엄 · K-Packet 지원</p>
        </div>

        {/* 안내 */}
        <div className="bg-[#de2910]/5 border border-[#de2910]/20 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-[#de2910] mb-1">📦 포장대행 서비스란?</p>
          <p className="text-xs text-gray-600 leading-relaxed">
            국내에서 수령한 상품을 에어캡·완충재로 안전하게 재포장하여
            해외 배송 준비를 도와드리는 서비스입니다.
          </p>
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
                    {product.badge}
                  </span>
                  <h2 className="text-sm font-bold text-gray-900">{product.name}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{product.desc}</p>
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
                  구매하기
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 서비스 포함 내용 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
          <p className="text-xs font-bold text-gray-700 mb-2">서비스 포함 내용</p>
          {[
            { icon: "✅", text: "박스 규격에 맞는 안전 포장" },
            { icon: "✅", text: "에어캡·완충재 보강" },
            { icon: "✅", text: "포장 완료 사진 제공" },
            { icon: "✅", text: "해외 배송 준비 완료" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-2">
              <span className="text-sm">{item.icon}</span>
              <span className="text-xs text-gray-600">{item.text}</span>
            </div>
          ))}
        </div>

        <p className="text-center text-[10px] text-gray-400">
          결제는 토스페이먼츠를 통해 안전하게 처리됩니다
        </p>
      </main>
    </div>
  );
}
