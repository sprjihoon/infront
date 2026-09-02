"use client";

import {
  DOMESTIC_PAYMENT_METHODS,
  OPEN_GLOBAL_PAYMENT_METHODS,
  FOREIGN_CARD_SCOPE_NOTICE_KO,
  FOREIGN_CARD_SCOPE_NOTICE_EN,
  canShowGlobalPaymentMethods,
  isOpenGlobalPaymentMethod,
  type CustomerType,
  type PaymentMethodId,
} from "@/lib/shop/products";
import type { Lang } from "../translations";

interface PaymentMethodSelectorProps {
  lang: Lang;
  value: PaymentMethodId;
  onChange: (id: PaymentMethodId) => void;
  customerType?: CustomerType;
  showForeignCardNotice?: boolean;
}

export function PaymentMethodSelector({
  lang,
  value,
  onChange,
  customerType,
  showForeignCardNotice = true,
}: PaymentMethodSelectorProps) {
  const showGlobal = canShowGlobalPaymentMethods(customerType);

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold text-gray-500">
        {lang === "ko" ? "결제수단 선택" : "Payment method"}
      </p>

      <div>
        <p className="text-[11px] font-semibold text-gray-600 mb-2">
          {lang === "ko" ? "국내 결제" : "Domestic payment"}
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
      </div>

      {showGlobal ? (
        <div>
          <p className="text-[11px] font-semibold text-gray-600 mb-2">
            {lang === "ko" ? "해외 결제" : "Global payment"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {OPEN_GLOBAL_PAYMENT_METHODS.map((m) => (
              <MethodOption
                key={m.id}
                id={m.id}
                label={lang === "ko" ? m.label : m.labelEn}
                checked={value === m.id}
                onSelect={() => onChange(m.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
          <p className="text-[11px] text-gray-500 leading-relaxed">
            {lang === "ko"
              ? "PayPal·Alipay·WeChat Pay는 외국인/해외고객 회원이 이용할 수 있습니다."
              : "PayPal, Alipay, and WeChat Pay are available for foreign members."}
          </p>
        </div>
      )}

      {showForeignCardNotice && (
        <p className="text-[10px] text-purple-700 bg-purple-50 rounded-lg px-3 py-2 leading-relaxed">
          {lang === "ko" ? FOREIGN_CARD_SCOPE_NOTICE_KO : FOREIGN_CARD_SCOPE_NOTICE_EN}
        </p>
      )}

      <p className="text-[10px] text-gray-400 leading-relaxed">
        {lang === "ko"
          ? value === "paypal"
            ? "PayPal은 USD로 청구됩니다. 해외카드는 PayPal 게스트 결제로 사용할 수 있습니다."
            : "선택하신 결제수단은 KG이니시스 결제창에서 최종 확인됩니다."
          : value === "paypal"
            ? "PayPal charges in USD. You can pay with a card as a guest or a PayPal balance."
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

/** 오픈되지 않은 글로벌 수단이면 국내 카드로 되돌림 */
export function sanitizePaymentMethod(
  method: PaymentMethodId,
  customerType?: CustomerType
): PaymentMethodId {
  if (isOpenGlobalPaymentMethod(method) && canShowGlobalPaymentMethods(customerType)) {
    return method;
  }
  if (method === "alipay" || method === "wechat" || method === "intl_card" || method === "paypal") {
    return "card";
  }
  return method;
}
