"use client";

import {
  DOMESTIC_PAYMENT_METHODS,
  GLOBAL_PAYMENT_METHODS,
  FOREIGN_CARD_SCOPE_NOTICE_KO,
  FOREIGN_CARD_SCOPE_NOTICE_EN,
  canShowGlobalPaymentMethods,
  isGlobalPaymentMethod,
  type CustomerType,
  type PaymentMethodId,
} from "@/lib/shop/products";
import type { Lang } from "../translations";

interface PaymentMethodSelectorProps {
  lang: Lang;
  value: PaymentMethodId;
  onChange: (id: PaymentMethodId) => void;
  customerType: CustomerType;
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

      {/* 국내 결제 */}
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

      {/* 해외 결제 — 외국인/해외고객만 */}
      {showGlobal ? (
        <div>
          <p className="text-[11px] font-semibold text-gray-600 mb-2">
            {lang === "ko" ? "해외 결제" : "Global payment"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {GLOBAL_PAYMENT_METHODS.map((m) => (
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
              ? "해외카드·Alipay·WeChat Pay는 외국인/해외고객 회원의 단건 서비스 결제에서만 이용 가능합니다."
              : "International card, Alipay, and WeChat Pay are available for foreign member one-time service payments only."}
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

/** 글로벌 결제수단이 선택됐는데 노출 불가 시 기본값으로 되돌림 */
export function sanitizePaymentMethod(
  method: PaymentMethodId,
  customerType: CustomerType
): PaymentMethodId {
  if (isGlobalPaymentMethod(method) && !canShowGlobalPaymentMethods(customerType)) {
    return "card";
  }
  return method;
}
