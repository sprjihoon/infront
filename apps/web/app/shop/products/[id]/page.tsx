"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Archive, Box, Globe, Package, Truck } from "lucide-react";
import {
  getShopProduct,
  formatKrw,
  getBundledShippingFee,
  getOrderTotal,
  INTL_TRACKING_NOTE_KO,
  INTL_TRACKING_NOTE_EN,
} from "@/lib/shop/products";
import { useLanguage } from "../../useLanguage";

const ICONS = {
  archive: Archive,
  truck: Truck,
  globe: Globe,
  package: Package,
  box: Box,
} as const;

export default function ShopProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { lang, mounted } = useLanguage();

  const product = getShopProduct(params.id);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!product) {
      router.replace("/shop");
      return;
    }
    setChecking(false);
  }, [product, router]);

  if (!product || checking || !mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  const Icon = ICONS[product.icon];
  const name = lang === "ko" ? product.name : product.nameEn;
  const desc = lang === "ko" ? product.description : product.descriptionEn;
  const delivery = lang === "ko" ? product.deliveryMethod : product.deliveryMethodEn;
  const period = lang === "ko" ? product.servicePeriod : product.servicePeriodEn;
  const refund = lang === "ko" ? product.refundNote : product.refundNoteEn;
  const isRecurring = product.billingType === "recurring";
  const priceLabel = isRecurring
    ? `${formatKrw(product.price)}/${product.unit ?? "월"}`
    : formatKrw(product.price);
  const shippingFee = getBundledShippingFee(product);
  const orderTotal = getOrderTotal(product);

  function handleOrder() {
    if (!product) return;
    sessionStorage.setItem("shop_product_id", product.id);
    router.push(`/shop/checkout?product=${product.id}`);
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.push("/shop")} className="p-1 -ml-1">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="text-base font-bold text-gray-900">
            {lang === "ko" ? "서비스 상세" : "Service Detail"}
          </h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="h-40 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
            <div className="w-20 h-20 bg-[#de2910]/10 rounded-3xl flex items-center justify-center">
              <Icon size={40} className="text-[#de2910]" />
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{name}</h2>
              <p className="text-2xl font-bold text-[#de2910] mt-2">{priceLabel}</p>
              {shippingFee > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {lang === "ko"
                    ? `+ 왕복배송비 ${formatKrw(shippingFee)} 별도 청구 (결제 시 합산 ${formatKrw(orderTotal)})`
                    : `+ Round-trip shipping fee ${formatKrw(shippingFee)} (total at checkout: ${formatKrw(orderTotal)})`}
                </p>
              )}
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>

            <dl className="text-sm space-y-3 border-t border-gray-100 pt-4">
              <div>
                <dt className="text-xs font-bold text-gray-500 mb-1">
                  {lang === "ko" ? "제공 방식" : "Delivery method"}
                </dt>
                <dd className="text-gray-800">{delivery}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-gray-500 mb-1">
                  {lang === "ko" ? "서비스 제공기간" : "Service period"}
                </dt>
                <dd className="text-gray-800">{period}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold text-gray-500 mb-1">
                  {lang === "ko" ? "취소/환불 안내" : "Cancel/refund"}
                </dt>
                <dd className="text-gray-800">{refund}</dd>
              </div>
            </dl>

            {(product.category === "intl" || product.intlTrackingNote) && (
              <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3">
                <p className="text-xs text-purple-800 leading-relaxed">
                  {lang === "ko"
                    ? product.intlTrackingNote ?? INTL_TRACKING_NOTE_KO
                    : product.intlTrackingNoteEn ?? INTL_TRACKING_NOTE_EN}
                </p>
              </div>
            )}

          </div>
        </div>

        <button
          onClick={handleOrder}
          className="w-full bg-[#de2910] text-white font-bold py-4 rounded-2xl text-sm active:opacity-80 transition-opacity"
        >
          {lang === "ko" ? "주문하기" : "Order"}
        </button>

        {isRecurring && (
          <section className="bg-white rounded-2xl border border-gray-100 px-4 py-4 space-y-2">
            <p className="text-sm font-bold text-gray-900">
              {lang === "ko" ? "멤버십 해지 및 환불" : "Membership cancel & refund"}
            </p>
            <ul className="text-[11px] text-gray-600 leading-relaxed space-y-1.5 list-disc list-inside">
              <li>
                {lang === "ko"
                  ? "월 단위 선불 자동결제이며, 매월 1일 9,900원이 청구됩니다."
                  : "Monthly prepaid auto-billing; ₩9,900 charged on the 1st."}
              </li>
              <li>
                {lang === "ko"
                  ? "해지 신청 익월부터 청구가 중단됩니다."
                  : "Billing stops from the month after you cancel."}
              </li>
              <li>
                {lang === "ko"
                  ? "이미 결제된 당월 요금은 환불되지 않습니다."
                  : "The current month fee already paid is non-refundable."}
              </li>
              <li>
                {lang === "ko"
                  ? "해지: 고객센터(010-2723-9490) 또는 서비스 내 해지"
                  : "Cancel via customer center (010-2723-9490) or in-app."}
              </li>
            </ul>
            <p className="text-[10px] text-gray-400 leading-relaxed pt-1">
              {lang === "ko" ? (
                <>
                  ※ 상세 규정은{" "}
                  <a href="/shop/refund-policy" target="_blank" className="underline hover:text-[#de2910]">
                    취소/환불 정책
                  </a>
                  을 확인해 주세요.
                </>
              ) : (
                <>
                  ※ See full{" "}
                  <a href="/shop/refund-policy" target="_blank" className="underline hover:text-[#de2910]">
                    refund policy
                  </a>
                  .
                </>
              )}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
