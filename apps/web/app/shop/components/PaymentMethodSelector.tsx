"use client";

import {
  DOMESTIC_PAYMENT_METHODS,
  isGlobalPaymentMethod,
  type CustomerType,
  type PaymentMethodId,
} from "@/lib/shop/products";
import type { Lang } from "../translations";

interface PaymentMethodSelectorProps {
  lang: Lang;
  value: PaymentMethodId;
  onChange: (id: PaymentMethodId) => void;
  /** @deprecated 해외결제 오픈 불가로 미사용 — 시그니처 호환용 */
  customerType?: CustomerType;
  showForeignCardNotice?: boolean;
}

export function PaymentMethodSelector({
  lang,
  value,
  onChange,
}: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-bold text-gray-500">
        {lang === "ko" ? "결제수단 선택" : "Payment method"}
      </p>

      <div className="grid grid-cols-2 gap-2">
        {DOMESTIC_PAYMENT_METHODS.map((m) => (
          <MethodOption
            key={m.id}
            id={m.id}
            label={lang === "ko" ? m.label : m.labelEn}
            checked={value === m.id}
            onSelect={() => onChange(m.id)}
          />
        ))}
      </div>

      <p className="text-[10px] text-gray-400 leading-relaxed">
        {lang === "ko"
          ? "선택하신 결제수단은 KG이니시스 결제창에서 최종 확인됩니다."
          : "Your selected payment method will be confirmed in the KG Inicis payment window."}
      </p>
    </div>
  );
}

function MethodOption({
  id,
  label,
  checked,
  onSelect,
}: {
  id: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`flex items-center gap-2 border rounded-xl px-3 py-2.5 cursor-pointer text-xs transition-colors ${
        checked
          ? "border-[#de2910] bg-[#de2910]/5 text-[#de2910] font-semibold"
          : "border-gray-200 text-gray-700 hover:border-gray-300"
      }`}
    >
      <input
        type="radio"
        name="paymentMethod"
        value={id}
        checked={checked}
        onChange={onSelect}
        className="accent-[#de2910]"
      />
      {label}
    </label>
  );
}

/** 글로벌 결제수단이 선택됐으면 국내 카드로 되돌림 */
export function sanitizePaymentMethod(method: PaymentMethodId): PaymentMethodId {
  if (isGlobalPaymentMethod(method)) return "card";
  return method;
}
