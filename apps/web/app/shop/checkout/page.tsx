"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Package, CreditCard, Loader2 } from "lucide-react";
import { SHOP_PRODUCTS } from "../page";

type Product = (typeof SHOP_PRODUCTS)[number];

export default function ShopCheckoutPage() {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    zipcode: "",
    address: "",
    addressDetail: "",
  });

  useEffect(() => {
    const id = sessionStorage.getItem("shop_product_id");
    const found = SHOP_PRODUCTS.find((p) => p.id === id) ?? null;
    if (!found) {
      router.replace("/shop");
      return;
    }
    setProduct(found);
  }, [router]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function isFormValid() {
    return (
      form.name.trim() &&
      form.phone.trim() &&
      form.email.trim() &&
      form.address.trim()
    );
  }

  async function handlePayment() {
    if (!product || !isFormValid()) return;
    setLoading(true);
    try {
      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!clientKey) {
        alert("결제 설정이 완료되지 않았습니다.");
        return;
      }
      const toss = await loadTossPayments(clientKey);
      const payment = toss.payment({ customerKey: crypto.randomUUID() });

      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: product.price },
        orderId: `SHOP-${Date.now()}`,
        orderName: product.name,
        customerName: form.name,
        customerEmail: form.email,
        customerMobilePhone: form.phone.replace(/-/g, ""),
        successUrl: `${window.location.origin}/shop/payment/success?productId=${product.id}`,
        failUrl: `${window.location.origin}/shop/payment/fail`,
      });
    } catch (e) {
      console.error(e);
      alert("결제 초기화에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1 -ml-1">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="text-base font-bold text-gray-900">주문 / 결제</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* 주문 상품 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 mb-3">주문 상품</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#de2910]/10 rounded-xl flex items-center justify-center shrink-0">
              <Package size={20} className="text-[#de2910]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">{product.name}</p>
              <p className="text-xs text-gray-400">{product.desc}</p>
            </div>
            <p className="text-sm font-bold text-gray-900">
              {product.price.toLocaleString()}원
            </p>
          </div>
        </section>

        {/* 배송 정보 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 mb-4">받는 분 정보</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
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
                name="phone"
                value={form.phone}
                onChange={handleChange}
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
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="example@email.com"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#de2910] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                우편번호
              </label>
              <input
                type="text"
                name="zipcode"
                value={form.zipcode}
                onChange={handleChange}
                placeholder="12345"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#de2910] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                주소 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="서울특별시 강남구 테헤란로 123"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#de2910] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                상세주소
              </label>
              <input
                type="text"
                name="addressDetail"
                value={form.addressDetail}
                onChange={handleChange}
                placeholder="101동 202호"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#de2910] transition-colors"
              />
            </div>
          </div>
        </section>

        {/* 결제 금액 요약 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 mb-3">결제 금액</p>
          <div className="flex justify-between items-center py-2 border-b border-gray-50">
            <span className="text-sm text-gray-600">{product.name}</span>
            <span className="text-sm text-gray-900">{product.price.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between items-center pt-3">
            <span className="text-sm font-bold text-gray-900">최종 결제금액</span>
            <span className="text-lg font-bold text-[#de2910]">
              {product.price.toLocaleString()}원
            </span>
          </div>
        </section>

        {/* 결제 버튼 */}
        <button
          onClick={handlePayment}
          disabled={loading || !isFormValid()}
          className="w-full bg-[#de2910] text-white font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-40 active:opacity-80 transition-opacity"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <CreditCard size={16} />
          )}
          {product.price.toLocaleString()}원 결제하기
        </button>

        <p className="text-center text-[10px] text-gray-400">
          결제는 토스페이먼츠를 통해 안전하게 처리됩니다
        </p>
      </div>
    </div>
  );
}
