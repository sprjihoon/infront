"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CreditCard, Loader2, LogIn, Package, Check } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import {
  getOneTimeProduct,
  getOrderTotal,
  getBundledShippingFee,
  formatKrw,
  INTL_TRACKING_NOTE_KO,
  INTL_TRACKING_NOTE_EN,
  CUSTOMER_TYPE_LABEL,
  type PaymentMethodId,
  type CustomerType,
} from "@/lib/shop/products";
import { PaymentMethodSelector, sanitizePaymentMethod } from "../components/PaymentMethodSelector";
import { useLanguage } from "../useLanguage";
import { t, type Lang } from "../translations";
import { AddressSearchButton } from "@/components/ui/AddressSearchButton";

type TxType = (typeof t)[Lang];

interface AddressForm {
  name: string;
  phone: string;
  zipcode: string;
  address: string;
  addressDetail: string;
  addr1: string;
  addr2: string;
}

const EMPTY_ADDRESS: AddressForm = {
  name: "",
  phone: "",
  zipcode: "",
  address: "",
  addressDetail: "",
  addr1: "",
  addr2: "",
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
  onAddressSelect: (zipcode: string, address: string, sido?: string, sigungu?: string) => void;
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

function LoginGate({ lang, redirectPath }: { lang: Lang; redirectPath: string }) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <div className="w-16 h-16 bg-[#de2910]/10 rounded-full flex items-center justify-center mb-4">
        <LogIn size={32} className="text-[#de2910]" />
      </div>
      <h1 className="text-lg font-bold text-gray-900 mb-2">
        {lang === "ko" ? "로그인이 필요합니다" : "Login Required"}
      </h1>
      <p className="text-sm text-gray-600 text-center leading-relaxed mb-2">
        {lang === "ko"
          ? "해외카드 결제는 회원 주문에서만 이용 가능합니다. 로그인 또는 회원가입 후 이용해주세요."
          : "International card payments are available for member orders only. Please log in or sign up."}
      </p>
      <p className="text-xs text-gray-500 text-center leading-relaxed mb-6">
        {lang === "ko"
          ? "회원가입 시 이메일 인증을 통해 계정 확인 후 결제 서비스를 이용할 수 있습니다."
          : "After email verification at signup, you can use payment services."}
      </p>
      <button
        onClick={() => router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`)}
        className="bg-[#de2910] text-white font-bold px-8 py-3 rounded-xl text-sm"
      >
        {lang === "ko" ? "로그인하기" : "Log in"}
      </button>
      <button
        onClick={() => router.push("/shop")}
        className="mt-3 text-sm text-gray-500 underline"
      >
        {lang === "ko" ? "서비스 목록으로" : "Back to shop"}
      </button>
    </div>
  );
}

export default function ShopCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-gray-300" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang, mounted } = useLanguage();
  const tx = t[lang];

  const [authState, setAuthState] = useState<"loading" | "guest" | "logged_in">("loading");
  const [customerType, setCustomerType] = useState<CustomerType>("domestic");
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [sender, setSender] = useState<AddressForm>(EMPTY_ADDRESS);
  const [recipient, setRecipient] = useState<AddressForm>(EMPTY_ADDRESS);
  const [sameAsSender, setSameAsSender] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>("card");
  const quantity = 1;

  const [payParams, setPayParams] = useState<Record<string, string> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const sdkScriptRef = useRef<HTMLScriptElement | null>(null);

  const product = productId ? getOneTimeProduct(productId) : undefined;

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        setAuthState("guest");
        return;
      }
      setAuthState("logged_in");
      setEmailConfirmed(Boolean(user.email_confirmed_at));
      if (user.email) setEmail(user.email);
      const meta = user.user_metadata as {
        name?: string;
        phone?: string;
        customer_type?: string;
      };
      if (meta.name || meta.phone) {
        setSender((prev) => ({
          ...prev,
          name: meta.name ?? prev.name,
          phone: meta.phone ?? prev.phone,
        }));
      }
      const { data: customer } = await supabase
        .from("customers")
        .select("customer_type")
        .eq("id", user.id)
        .maybeSingle();
      const ctype: CustomerType =
        customer?.customer_type === "foreigner" || meta.customer_type === "foreigner"
          ? "foreigner"
          : "domestic";
      setCustomerType(ctype);
      setPaymentMethod((prev) => sanitizePaymentMethod(prev, ctype));
    });

    const fromQuery = searchParams.get("product");
    const fromSession = sessionStorage.getItem("shop_product_id");
    const id = fromQuery ?? fromSession;
    if (!id || !getOneTimeProduct(id)) {
      router.replace("/shop");
      return;
    }
    sessionStorage.setItem("shop_product_id", id);
    setProductId(id);
  }, [router, searchParams]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      document.querySelectorAll('img[src*="ds-cdn.inicis.com"]').forEach((img) => {
        const table = img.closest("table");
        if (table) table.remove();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

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

  function deriveAddrParts(address: string, sido: string, sigungu: string) {
    const prefix = [sido, sigungu].filter(Boolean).join(" ");
    const street = prefix && address.startsWith(prefix) ? address.slice(prefix.length).trim() : address;
    return { addr1: sido, addr2: sigungu, street };
  }

  function handleSenderAddressSelect(zipcode: string, address: string, sido?: string, sigungu?: string) {
    const { addr1, addr2 } = deriveAddrParts(address, sido ?? "", sigungu ?? "");
    setSender((prev) => {
      const next = { ...prev, zipcode, address, addressDetail: "", addr1, addr2 };
      if (sameAsSender) setRecipient(next);
      return next;
    });
  }

  function handleRecipientAddressSelect(zipcode: string, address: string, sido?: string, sigungu?: string) {
    const { addr1, addr2 } = deriveAddrParts(address, sido ?? "", sigungu ?? "");
    setRecipient((prev) => ({ ...prev, zipcode, address, addressDetail: "", addr1, addr2 }));
  }

  const effectiveRecipient = sameAsSender ? sender : recipient;

  function buildAddr3(form: AddressForm): string {
    const { addr1, addr2, address, addressDetail } = form;
    const prefix = [addr1, addr2].filter(Boolean).join(" ");
    const street = prefix && address.startsWith(prefix) ? address.slice(prefix.length).trim() : address;
    return [street, addressDetail].filter(Boolean).join(" ");
  }

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

    const total = getOrderTotal(product) * quantity;
    const productName = lang === "ko" ? product.name : product.nameEn;
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

    try {
      const payload = {
        productId: product.id,
        goodname: productName,
        buyername: sender.name,
        buyertel: sender.phone.replace(/-/g, ""),
        buyeremail: email,
        paymentMethod,
        sender: { ...sender },
        recipient: {
          ...effectiveRecipient,
          addr3: buildAddr3(effectiveRecipient),
        },
      };

      if (isMobile) {
        const res = await fetch("/api/inicis/mobile-prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as Record<string, string>;
        if (!res.ok || data.error) {
          alert(data.error ?? tx.payError);
          setLoading(false);
          return;
        }
        const form = document.createElement("form");
        form.method = "POST";
        form.action = data.payUrl;
        form.acceptCharset = "euc-kr";
        const fields = { ...data };
        delete fields.payUrl;
        Object.entries(fields).forEach(([k, v]) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = k;
          input.value = v;
          form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
        return;
      }

      const res = await fetch("/api/inicis/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as Record<string, string>;
      if (!res.ok || data.error) {
        alert(data.error ?? tx.payError);
        setLoading(false);
        return;
      }

      setPayParams(data);
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

  if (authState === "loading" || !product || !mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (authState === "guest") {
    const redirectPath = productId ? `/shop/checkout?product=${productId}` : "/shop/checkout";
    return <LoginGate lang={lang} redirectPath={redirectPath} />;
  }

  const productName = lang === "ko" ? product.name : product.nameEn;
  const unitPrice = product.price;
  const subtotal = unitPrice * quantity;
  const shippingFee = getBundledShippingFee(product) * quantity;
  const total = subtotal + shippingFee;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
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
          <input type="hidden" name="acceptmethod" value="centerCd(Y):HPP(2)" />
          <input type="hidden" name="charset" value="UTF-8" />
        </form>
      )}

      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1 -ml-1">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="text-base font-bold text-gray-900">{tx.checkoutTitle}</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* 회원 구분 표시 (결제 화면에서는 변경 불가) */}
        <section className="bg-white rounded-xl border border-gray-100 px-4 py-3.5 space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-gray-500">
                {lang === "ko" ? "고객 유형" : "Customer type"}
              </p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">
                {CUSTOMER_TYPE_LABEL[customerType]}
              </p>
            </div>
            <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md shrink-0">
              {lang === "ko" ? "회원 정보 기준" : "From profile"}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            {lang === "ko"
              ? customerType === "foreigner"
                ? "외국인/해외고객 회원만 해외카드·글로벌 결제수단을 이용할 수 있습니다. 결제 화면에서는 변경할 수 없습니다."
                : "내국인 회원은 국내 결제수단만 이용 가능합니다. 해외카드 이용 시 마이페이지에서 고객 구분을 변경해 주세요."
              : customerType === "foreigner"
                ? "Global payment methods are available for foreign/overseas members only. You cannot change this on the checkout page."
                : "Domestic members can use domestic payment methods only. Change your customer type in My Page to use international cards."}
          </p>
          <Link
            href="/mypage"
            className="inline-block text-[11px] text-[#de2910] font-medium underline"
          >
            {lang === "ko" ? "마이페이지에서 고객 구분 변경" : "Change customer type in My Page"}
          </Link>
          {customerType === "foreigner" && !emailConfirmed && (
            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
              {lang === "ko"
                ? "해외카드 결제는 이메일 인증이 완료된 회원만 이용 가능합니다. 가입 시 발송된 인증 메일을 확인해 주세요."
                : "International card payments require a verified email address."}
            </p>
          )}
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 mb-3">{tx.orderProduct}</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#de2910]/10 rounded-xl flex items-center justify-center shrink-0">
              <Package size={20} className="text-[#de2910]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">{productName}</p>
              <p className="text-xs text-gray-400">
                {lang === "ko" ? product.description : product.descriptionEn}
              </p>
            </div>
          </div>
        </section>

        {(product.category === "intl" || product.intlTrackingNote) && (
          <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3">
            <p className="text-xs text-purple-800 leading-relaxed">
              {lang === "ko"
                ? product.intlTrackingNote ?? INTL_TRACKING_NOTE_KO
                : product.intlTrackingNoteEn ?? INTL_TRACKING_NOTE_EN}
            </p>
          </div>
        )}

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 mb-4">{tx.senderSection}</p>
          <AddressFields
            values={sender}
            onChange={handleSender}
            onAddressSelect={handleSenderAddressSelect}
            tx={tx}
          />
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
            onAddressSelect={handleRecipientAddressSelect}
            disabled={sameAsSender}
            tx={tx}
          />
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 mb-3">{tx.paymentSummary}</p>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">
              {productName} × {quantity}
            </span>
            <span className="text-sm text-gray-900">{formatKrw(subtotal)}</span>
          </div>
          {shippingFee > 0 && (
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">
                {lang === "ko" ? "왕복배송비" : "Round-trip shipping fee"}
              </span>
              <span className="text-sm text-gray-900">{formatKrw(shippingFee)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-3">
            <span className="text-sm font-bold text-gray-900">{tx.totalAmount}</span>
            <span className="text-lg font-bold text-[#de2910]">{formatKrw(total)}</span>
          </div>
          <p className="mt-2 text-[10px] text-gray-500 leading-relaxed">
            {lang === "ko"
              ? `결제 통화: 원화(KRW) · KG이니시스 결제창에 ${total.toLocaleString("ko-KR")}원으로 동일 표시됩니다.`
              : `Currency: KRW · The same amount (${total.toLocaleString("ko-KR")} KRW) will appear in the KG Inicis payment window.`}
          </p>
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <PaymentMethodSelector
            lang={lang}
            value={paymentMethod}
            onChange={setPaymentMethod}
            customerType={customerType}
          />
        </section>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={termsAgreed}
            onChange={(e) => setTermsAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#de2910] shrink-0"
          />
          <span className="text-xs text-gray-600 leading-relaxed">
            <a href="/shop/terms" target="_blank" className="underline text-gray-700 hover:text-[#de2910]">
              {lang === "ko" ? "이용약관" : "Terms"}
            </a>
            {lang === "ko" ? ", " : ", "}
            <a href="/shop/privacy" target="_blank" className="underline text-gray-700 hover:text-[#de2910]">
              {lang === "ko" ? "개인정보처리방침" : "Privacy"}
            </a>
            {lang === "ko" ? ", " : ", "}
            <a href="/shop/refund-policy" target="_blank" className="underline text-gray-700 hover:text-[#de2910]">
              {lang === "ko" ? "취소/환불 정책" : "Refund Policy"}
            </a>
            {lang === "ko" ? "에 동의합니다. (필수)" : " (Required)"}
          </span>
        </label>

        <button
          onClick={handlePayment}
          disabled={loading || !isFormValid()}
          className="w-full bg-[#de2910] text-white font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-40 active:opacity-80 transition-opacity"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
          {formatKrw(total)} {lang === "ko" ? "결제하기" : "Pay"}
        </button>

        <p className="text-center text-[10px] text-gray-400">{tx.paymentNotice}</p>
      </div>
    </div>
  );
}
