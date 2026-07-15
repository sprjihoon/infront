"use client";

import { Archive, Box, Globe, Package, Truck } from "lucide-react";
import type { ShopProduct } from "@/lib/shop/products";
import { formatKrw, getBundledShippingFee } from "@/lib/shop/products";
import type { Lang } from "../translations";

const ICONS = {
  archive: Archive,
  truck: Truck,
  globe: Globe,
  package: Package,
  box: Box,
} as const;

interface ShopProductCardProps {
  product: ShopProduct;
  lang: Lang;
  onAction: () => void;
  actionLabel: string;
}

export function ShopProductCard({ product, lang, onAction, actionLabel }: ShopProductCardProps) {
  const Icon = ICONS[product.icon];
  const name = lang === "ko" ? product.name : product.nameEn;
  const desc = lang === "ko" ? product.description : product.descriptionEn;
  const delivery = lang === "ko" ? product.deliveryMethod : product.deliveryMethodEn;
  const period = lang === "ko" ? product.servicePeriod : product.servicePeriodEn;
  const refund = lang === "ko" ? product.refundNote : product.refundNoteEn;
  const badge = lang === "ko" ? product.badge : product.badgeEn;
  const priceLabel =
    product.billingType === "recurring"
      ? `${formatKrw(product.price)}/${product.unit ?? "월"}`
      : formatKrw(product.price);
  const shippingFee = getBundledShippingFee(product);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
      <div className="h-28 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center border-b border-gray-100">
        <div className="w-14 h-14 bg-[#de2910]/10 rounded-2xl flex items-center justify-center">
          <Icon size={28} className="text-[#de2910]" />
        </div>
      </div>
      <div className="p-4 flex flex-col gap-3 flex-1">
        {badge && product.badgeColor && (
          <span className={`inline-block self-start text-[10px] font-semibold px-2 py-0.5 rounded-full ${product.badgeColor}`}>
            {badge}
          </span>
        )}
        <div>
          <h2 className="text-sm font-bold text-gray-900">{name}</h2>
          <p className="text-lg font-bold text-[#de2910] mt-1">{priceLabel}</p>
          {shippingFee > 0 && (
            <p className="text-[11px] text-gray-500 mt-0.5">
              {lang === "ko"
                ? `+ 왕복배송비 ${formatKrw(shippingFee)} 별도 청구`
                : `+ Round-trip shipping fee ${formatKrw(shippingFee)} charged separately`}
            </p>
          )}
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">{desc}</p>
        <dl className="text-[11px] text-gray-500 space-y-1.5 border-t border-gray-50 pt-3">
          <div>
            <dt className="font-semibold text-gray-600">
              {lang === "ko" ? "제공 방식" : "Delivery method"}
            </dt>
            <dd>{delivery}</dd>
          </div>
          <div>
            <dt className="font-semibold text-gray-600">
              {lang === "ko" ? "서비스 제공기간" : "Service period"}
            </dt>
            <dd>{period}</dd>
          </div>
          <div>
            <dt className="font-semibold text-gray-600">
              {lang === "ko" ? "취소/환불" : "Cancel/refund"}
            </dt>
            <dd>{refund}</dd>
          </div>
        </dl>
        {product.intlTrackingNote && lang === "ko" && (
          <p className="text-[10px] text-purple-700 bg-purple-50 rounded-lg px-2.5 py-2 leading-relaxed">
            {product.intlTrackingNote}
          </p>
        )}
        {product.intlTrackingNoteEn && lang === "en" && (
          <p className="text-[10px] text-purple-700 bg-purple-50 rounded-lg px-2.5 py-2 leading-relaxed">
            {product.intlTrackingNoteEn}
          </p>
        )}
        <button
          onClick={onAction}
          className="mt-auto w-full bg-[#de2910] text-white text-xs font-bold py-2.5 rounded-xl active:opacity-80 transition-opacity"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
