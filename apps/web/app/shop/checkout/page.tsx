"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Package, CreditCard, Loader2, Check } from "lucide-react";
import { SHOP_PRODUCTS } from "../page";
import { useLanguage } from "../useLanguage";
import { t, type Lang } from "../translations";
import { AddressSearchButton } from "@/components/ui/AddressSearchButton";

type Product = (typeof SHOP_PRODUCTS)[number];
type TxType = (typeof t)[Lang];

const SHIPPING_FEE = 3_000; // 기본 배송비

interface AddressForm {
  name: string;
  phone: string;
  zipcode: string;
  address: string;
  addressDetail: string;
}

const EMPTY_ADDRESS: AddressForm = {
  name: "",
  phone: "",
  zipcode: "",
  address: "",
  addressDetail: "",
};

declare global {
  /* eslint-disable no-var */
  var INIStdPay: { pay: (formId: string) => void } | undefined;
}

function AddressFields({
  values,
  onChange,
  onAddressSelect,
  disabled,
  tx,
}: {
  values: AddressForm;
  onChange: (field: keyof AddressForm, value: string) => void;
  onAddressSelect: (zipcode: string, address: string) => void;
  disabled?: boolean;
  tx: TxType;
}) {
  const cls = `w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#de2910] transition-colors ${disabled ? "bg-gray-50 text-gray-400" : ""}`;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {tx.labelName} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={values.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder={tx.placeholderName}
            disabled={disabled}
            className={cls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {tx.labelPhone} <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={values.phone}
            onChange={(e) => onChange("phone", e.target.value.replace(/[^0-9\-]/g, ""))}
            placeholder={tx.placeholderPhone}
            disabled={disabled}
            className={cls}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {tx.labelAddress} <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={values.zipcode ? `(${values.zipcode}) ${values.address}` : values.address}
            readOnly
            placeholder={tx.placeholderAddress}
            className={`${cls} flex-1 bg-gray-50 cursor-default`}
          />
          {!disabled && (
            <AddressSearchButton
              label={tx.searchAddress}
              onSelect={onAddressSelect}
              className="shrink-0 bg-[#de2910] text-white text-xs font-semibold rounded-xl px-3 py-2.5 whitespace-nowrap"
            />
          )}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {tx.labelAddressDetail}
        </label>
        <input
          type="text"
          value={values.addressDetail}
          onChange={(e) => onChange("addressDetail", e.target.value)}
          placeholder={tx.placeholderAddressDetail}
          disabled={disabled}
          className={cls}
        />
      </div>
    </div>
  );
}

export default function ShopCheckoutPage() {
  const router = useRouter();
  const { lang, mounted } = useLanguage();
  const tx = t[lang];

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [sender, setSender] = useState<AddressForm>(EMPTY_ADDRESS);
  const [recipient, setRecipient] = useState<AddressForm>(EMPTY_ADDRESS);
  const [sameAsSender, setSameAsSender] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);

  /* KG이니시스 INIStdPay 파라미터 (숨김 폼에 세팅) */
  const [payParams, setPayParams] = useState<Record<string, string> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const sdkScriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    const id = sessionStorage.getItem("shop_product_id");
    const found = SHOP_PRODUCTS.find((p) => p.id === id) ?? null;
    if (!found) { router.replace("/shop"); return; }
    setProduct(found);
  }, [router]);

  function handleSender(field: keyof AddressForm, value: string) {
    setSender((prev) => {
      const next = { ...prev, [field]: value };
      if (sameAsSender) setRecipient(next);
      return next;
    });
  }

  function handleRecipient(field: keyof AddressForm, value: string) {
    setRecipient((prev) => ({ ...prev, [field]: value }));
  }

  function toggleSameAsSender(checked: boolean) {
    setSameAsSender(checked);
    if (checked) setRecipient(sender);
  }

  const effectiveRecipient = sameAsSender ? sender : recipient;

  function isFormValid() {
    return (
      sender.name.trim() &&
      sender.phone.trim() &&
      sender.address.trim() &&
      email.trim() &&
      effectiveRecipient.name.trim() &&
      effectiveRecipient.phone.trim() &&
      effectiveRecipient.address.trim() &&
      termsAgreed
    );
  }

  /** KG이니시스 SDK를 동적으로 로드한 후 콜백 실행 */
  function loadSdk(jsUrl: string, callback: () => void) {
    if (typeof window !== "undefined" && window.INIStdPay) {
      callback();
      return;
    }
    if (sdkScriptRef.current) {
      sdkScriptRef.current.addEventListener("load", callback, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = jsUrl;
    script.onload = callback;
    script.onerror = () => {
      setLoading(false);
      alert(tx.payError);
    };
    sdkScriptRef.current = script;
    document.head.appendChild(script);
  }

  async function handlePayment() {
    if (!product || !isFormValid()) return;
    setLoading(true);
    try {
      /* 1. 서버에서 서명 파라미터 획득 */
      const res = await fetch("/api/inicis/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price: product.price + SHIPPING_FEE,
          goodname: product.name[lang],
          buyername: sender.name,
          buyertel: sender.phone.replace(/-/g, ""),
          buyeremail: email,
        }),
      });

      const data = await res.json() as Record<string, string>;
      if (!res.ok || data.error) {
        alert(data.error ?? tx.payError);
        return;
      }

      /* 2. 폼 파라미터 세팅 → 렌더 후 SDK 호출 */
      setPayParams(data);

      /* 3. SDK 로드 후 결제창 호출 (setPayParams 렌더 이후 실행) */
      requestAnimationFrame(() => {
        loadSdk(data.jsUrl, () => {
          if (typeof window !== "undefined" && window.INIStdPay && formRef.current) {
            window.INIStdPay.pay(formRef.current.id);
          } else {
            alert(tx.payError);
            setLoading(false);
          }
        });
      });
    } catch (e) {
      console.error(e);
      alert(tx.payError);
      setLoading(false);
    }
  }

  if (!product || !mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  const productName = product.name[lang];

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* KG이니시스 숨김 결제 폼 */}
      {payParams && (
        <form
          id="frmPayment"
          ref={formRef}
          method="POST"
          acceptCharset="UTF-8"
          style={{ display: "none" }}
        >
          <input type="hidden" name="version" value="1.0" />
          <input type="hidden" name="gopaymethod" value="" />
          <input type="hidden" name="mid" value={payParams.mid} />
          <input type="hidden" name="oid" value={payParams.oid} />
          <input type="hidden" name="price" value={payParams.price} />
          <input type="hidden" name="timestamp" value={payParams.timestamp} />
          <input type="hidden" name="use_chkfake" value="Y" />
          <input type="hidden" name="signature" value={payParams.signature} />
          <input type="hidden" name="verification" value={payParams.verification} />
          <input type="hidden" name="mKey" value={payParams.mKey} />
          <input type="hidden" name="currency" value="WON" />
          <input type="hidden" name="goodname" value={payParams.goodname} />
          <input type="hidden" name="buyername" value={payParams.buyername} />
          <input type="hidden" name="buyertel" value={payParams.buyertel} />
          <input type="hidden" name="buyeremail" value={payParams.buyeremail} />
          <input type="hidden" name="returnUrl" value={payParams.returnUrl} />
          <input type="hidden" name="closeUrl" value={payParams.closeUrl} />
          <input type="hidden" name="payViewType" value="overlay" />
          <input type="hidden" name="acceptmethod" value="centerCd(Y)" />
          <input type="hidden" name="charset" value="UTF-8" />
        </form>
      )}

      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1 -ml-1">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="text-base font-bold text-gray-900">{tx.checkoutTitle}</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* 주문 상품 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 mb-3">{tx.orderProduct}</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#de2910]/10 rounded-xl flex items-center justify-center shrink-0">
              <Package size={20} className="text-[#de2910]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">{productName}</p>
              <p className="text-xs text-gray-400">{product.desc[lang]}</p>
            </div>
            <p className="text-sm font-bold text-gray-900">{tx.formatPrice(product.price)}</p>
          </div>
        </section>

        {/* 보내는 분 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 mb-4">{tx.senderSection}</p>
          <AddressFields values={sender} onChange={handleSender} onAddressSelect={(z, a) => setSender(f => ({ ...f, zipcode: z, address: a, addressDetail: "" }))} tx={tx} />
          <div className="mt-3 pt-3 border-t border-gray-50">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {tx.labelEmail} <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={tx.placeholderEmail}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#de2910] transition-colors"
            />
          </div>
        </section>

        {/* 받는 분 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-gray-500">{tx.recipientSection}</p>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => toggleSameAsSender(!sameAsSender)}
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  sameAsSender ? "bg-[#de2910] border-[#de2910]" : "border-gray-300"
                }`}
              >
                {sameAsSender && <Check size={11} className="text-white" strokeWidth={3} />}
              </div>
              <span className="text-xs text-gray-600">{tx.sameAsSender}</span>
            </label>
          </div>
          <AddressFields
            values={sameAsSender ? sender : recipient}
            onChange={handleRecipient}
            onAddressSelect={(z, a) => setRecipient(f => ({ ...f, zipcode: z, address: a, addressDetail: "" }))}
            disabled={sameAsSender}
            tx={tx}
          />
        </section>

        {/* 결제 금액 요약 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 mb-3">{tx.paymentSummary}</p>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">{productName}</span>
            <span className="text-sm text-gray-900">{tx.formatPrice(product.price)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">{tx.shippingFeeLabel}</span>
            <span className="text-sm text-gray-900">{tx.formatPrice(SHIPPING_FEE)}</span>
          </div>
          <div className="flex justify-between items-center pt-3">
            <span className="text-sm font-bold text-gray-900">{tx.totalAmount}</span>
            <span className="text-lg font-bold text-[#de2910]">
              {tx.formatPrice(product.price + SHIPPING_FEE)}
            </span>
          </div>
        </section>

        {/* 약관 동의 */}
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={termsAgreed}
            onChange={(e) => setTermsAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#de2910] shrink-0"
          />
          <span className="text-xs text-gray-600 leading-relaxed">
            <a href="/terms" target="_blank" className="underline text-gray-700 hover:text-[#de2910]">
              {lang === "ko" ? "이용약관" : "Terms of Service"}
            </a>
            {lang === "ko" ? " 및 " : " and "}
            <a href="/privacy" target="_blank" className="underline text-gray-700 hover:text-[#de2910]">
              {lang === "ko" ? "개인정보처리방침" : "Privacy Policy"}
            </a>
            {lang === "ko" ? "에 동의합니다. (필수)" : " (Required)"}
          </span>
        </label>

        {/* 결제 버튼 */}
        <button
          onClick={handlePayment}
          disabled={loading || !isFormValid()}
          className="w-full bg-[#de2910] text-white font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-40 active:opacity-80 transition-opacity"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
          {tx.payBtn((product.price + SHIPPING_FEE).toLocaleString())}
        </button>

        <p className="text-center text-[10px] text-gray-400">{tx.paymentNotice}</p>

        {/* 사업자 정보 */}
        <div className="border-t border-gray-200 pt-4 space-y-1.5">
          <p className="text-[10px] font-bold text-gray-500">인프론트 · 틸리언</p>
          <div className="text-[10px] text-gray-400 leading-relaxed space-y-0.5">
            <p>대표자 장지훈 &nbsp;|&nbsp; 사업자등록번호 766-55-00323</p>
            <p>통신판매업 제 2022-대구동구-1034 호</p>
            <p>대구시 동구 안심로188 2층, 3층</p>
            <p>고객센터 010-2723-9490 &nbsp;|&nbsp; info@tillion.kr</p>
          </div>
          <div className="flex gap-3 pt-0.5">
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-400 underline">이용약관</a>
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-400 underline">개인정보처리방침</a>
          </div>
        </div>
      </div>
    </div>
  );
}
