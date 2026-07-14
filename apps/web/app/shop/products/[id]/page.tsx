"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Archive, Box, Globe, Package, Truck } from "lucide-react";
import {
  getShopProduct,
  formatKrw,
  INTL_TRACKING_NOTE_KO,
  INTL_TRACKING_NOTE_EN,
  FOREIGN_CARD_SCOPE_NOTICE_KO,
  FOREIGN_CARD_SCOPE_NOTICE_EN,
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
  const priceLabel =
    product.billingType === "recurring"
      ? `${formatKrw(product.price)}/${product.unit ?? "월"}`
      : formatKrw(product.price);

  function handleOrder() {
    if (!product) return;
    if (product.billingType === "recurring") {
      router.push(`/shop/billing/register?plan=${product.id}`);
      return;
    }
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

            {product.billingType === "one_time" && (
              <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
                {lang === "ko" ? FOREIGN_CARD_SCOPE_NOTICE_KO : FOREIGN_CARD_SCOPE_NOTICE_EN}
              </p>
            )}

            {product.billingType === "recurring" && (
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                {lang === "ko"
                  ? "장기보관 월 이용료는 신용카드 자동결제(빌링)로 결제됩니다. 해외카드 결제 대상이 아닙니다."
                  : "Monthly storage fees use card auto-billing. International cards are not accepted."}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleOrder}
          className="w-full bg-[#de2910] text-white font-bold py-4 rounded-2xl text-sm active:opacity-80 transition-opacity"
        >
          {product.billingType === "recurring"
            ? lang === "ko"
              ? "구독 신청하기"
              : "Subscribe"
            : lang === "ko"
              ? "주문하기"
              : "Order"}
        </button>
      </div>
    </div>
  );
}
