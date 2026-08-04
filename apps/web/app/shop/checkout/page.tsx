"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CreditCard, Loader2, LogIn, Package, Check } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import {
  getShopProduct,
  getBundledShippingFee,
  formatKrw,
  INTL_TRACKING_NOTE_KO,
  INTL_TRACKING_NOTE_EN,
  type PaymentMethodId,
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
  hideIdentity,
}: {
  values: AddressForm;
  onChange: (field: keyof AddressForm, value: string) => void;
  onAddressSelect: (zipcode: string, address: string, sido?: string, sigungu?: string) => void;
  disabled?: boolean;
  tx: TxType;
  /** 로그인 회원: 이름·전화는 프로필 사용, 주소만 입력 */
  hideIdentity?: boolean;
}) {
  const cls = `w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#de2910] transition-colors ${disabled ? "bg-gray-50 text-gray-400" : ""}`;
  return (
    <div className="space-y-3">
      {!hideIdentity && (
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
      )}
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
          ? "결제는 회원 주문에서만 이용 가능합니다. 로그인 또는 회원가입 후 이용해주세요."
          : "Payments are available for member orders only. Please log in or sign up."}
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
  const [productId, setProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [sender, setSender] = useState<AddressForm>(EMPTY_ADDRESS);
  const [recipient, setRecipient] = useState<AddressForm>(EMPTY_ADDRESS);
  const [sameAsSender, setSameAsSender] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [billingAgreed, setBillingAgreed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>("card");
  /** 로그인 회원: DB 회원정보로 결제자 자동 채움 (입력폼 생략) */
  const [payerFromProfile, setPayerFromProfile] = useState(false);
  const quantity = 1;

  const [payParams, setPayParams] = useState<Record<string, string> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const sdkScriptRef = useRef<HTMLScriptElement | null>(null);

  const product = productId ? getShopProduct(productId) : undefined;
  const isRecurring = product?.billingType === "recurring";

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

      const meta = user.user_metadata as { name?: string; phone?: string };
      const { data: customer } = await supabase
        .from("customers")
        .select("name, phone, email")
        .eq("id", user.id)
        .maybeSingle();

      const filledName = (customer?.name ?? meta.name ?? "").trim();
      const filledPhone = (customer?.phone ?? meta.phone ?? "").replace(/[^0-9\-]/g, "");
      const filledEmail = (customer?.email ?? user.email ?? "").trim();

      if (filledEmail) setEmail(filledEmail);
      if (filledName || filledPhone) {
        setSender((prev) => ({
          ...prev,
          name: filledName || prev.name,
          phone: filledPhone || prev.phone,
        }));
      }
      // 이름·전화·이메일이 모두 있으면 결제자 입력란 생략
      setPayerFromProfile(Boolean(filledName && filledPhone && filledEmail));
      setPaymentMethod((prev) => sanitizePaymentMethod(prev));
    });

    const fromQuery = searchParams.get("product");
    const fromSession = sessionStorage.getItem("shop_product_id");
    const id = fromQuery ?? fromSession;
    if (!id || !getShopProduct(id)) {
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

  useEffect(() => {
    if (isRecurring) setPaymentMethod("card");
  }, [isRecurring]);

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
    if (!sender.name.trim() || !sender.phone.trim() || !email.trim() || !termsAgreed) {
      return false;
    }
    if (isRecurring) return billingAgreed;
    return (
      Boolean(sender.address.trim()) &&
      Boolean(effectiveRecipient.name.trim()) &&
      Boolean(effectiveRecipient.phone.trim()) &&
      Boolean(effectiveRecipient.address.trim())
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

    const productName = lang === "ko" ? product.name : product.nameEn;

    try {
      if (isRecurring) {
        const res = await fetch("/api/shop/billing/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            buyername: sender.name.trim(),
            buyertel: sender.phone.replace(/-/g, ""),
            buyeremail: email.trim(),
            planId: product.id,
          }),
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
        return;
      }

      const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
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
  const total = isRecurring ? subtotal : subtotal + shippingFee;
  const isBillingForm = Boolean(payParams?.billtype);

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
          <input type="hidden" name="gopaymethod" value={payParams.gopaymethod ?? ""} />
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
          <input type="hidden" name="charset" value="UTF-8" />
          {isBillingForm ? (
            <>
              <input type="hidden" name="billtype" value={payParams.billtype ?? "1"} />
              <input type="hidden" name="offerPeriod" value={payParams.offerPeriod ?? "M2"} />
              <input
                type="hidden"
                name="acceptmethod"
                value={payParams.acceptmethod ?? "centerCd(Y):BILLAUTH(Card)"}
              />
              <input type="hidden" name="custom_data" value={payParams.custom_data ?? ""} />
              <input type="hidden" name="merchantData" value={payParams.merchantData ?? ""} />
            </>
          ) : (
            <input type="hidden" name="acceptmethod" value="centerCd(Y):HPP(2)" />
          )}
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
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 mb-3">
            {lang === "ko" ? "주문정보" : tx.orderProduct}
          </p>
          {isRecurring ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
                <div className="w-10 h-10 bg-[#de2910]/10 rounded-xl flex items-center justify-center shrink-0">
                  <Package size={20} className="text-[#de2910]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-gray-400 mb-0.5">
                    {lang === "ko" ? "상품정보" : "Product"}
                  </p>
                  <p className="text-sm font-bold text-gray-900">
                    [구독상품] {productName}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{formatKrw(unitPrice)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-[11px] text-gray-400 mb-2">
                    {lang === "ko" ? "주문정보" : "Order details"}
                  </p>
                  <dl className="space-y-1.5 text-gray-800">
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500">구독주기</dt>
                      <dd className="font-medium">1회</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500">정기결제일</dt>
                      <dd className="font-medium">1일</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500">수량</dt>
                      <dd className="font-medium">{quantity}개</dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 mb-2">
                    {lang === "ko" ? "결제금액" : "Amount"}
                  </p>
                  <p className="text-sm font-bold text-gray-900">
                    {formatKrw(unitPrice)}
                    <span className="text-[11px] font-normal text-gray-500 ml-1">(1회차)</span>
                  </p>
                  <p className="mt-2 text-[11px] text-gray-500 leading-relaxed">
                    다음 회차 정기 결제예정액 : {formatKrw(unitPrice)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-[#de2910]/10 rounded-xl flex items-center justify-center shrink-0">
                <Package size={20} className="text-[#de2910]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">{productName}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {lang === "ko" ? product.description : product.descriptionEn}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-gray-900">{formatKrw(unitPrice)}</p>
              </div>
            </div>
          )}
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

        {/* 로그인 회원 + 프로필 완비: 결제자 입력 생략 / 비회원·정보부족만 입력 */}
        {isRecurring ? (
          payerFromProfile ? (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3">
              <p className="text-xs text-gray-500">
                {lang === "ko" ? "결제자" : "Payer"}{" "}
                <span className="font-semibold text-gray-800">
                  {sender.name} · {sender.phone} · {email}
                </span>
              </p>
            </section>
          ) : (
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs font-bold text-gray-500 mb-4">
                {lang === "ko" ? "결제자 정보" : "Payer info"}
              </p>
              <p className="text-[11px] text-amber-700 mb-3 leading-relaxed">
                {lang === "ko"
                  ? "회원정보에 이름·연락처가 없어 입력해 주세요. (비회원·정보 미등록)"
                  : "Name/phone missing from your profile — please enter them."}
              </p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {tx.labelName} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={sender.name}
                      onChange={(e) => handleSender("name", e.target.value)}
                      placeholder={tx.placeholderName}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#de2910] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {tx.labelPhone} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={sender.phone}
                      onChange={(e) =>
                        handleSender("phone", e.target.value.replace(/[^0-9\-]/g, ""))
                      }
                      placeholder={tx.placeholderPhone}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#de2910] transition-colors"
                    />
                  </div>
                </div>
                <div>
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
              </div>
            </section>
          )
        ) : (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs font-bold text-gray-500 mb-4">{tx.senderSection}</p>
            {payerFromProfile && (
              <p className="text-xs text-gray-500 mb-3">
                {lang === "ko" ? "보내는 분" : "Sender"}{" "}
                <span className="font-semibold text-gray-800">
                  {sender.name} · {sender.phone} · {email}
                </span>
              </p>
            )}
            <AddressFields
              values={sender}
              onChange={handleSender}
              onAddressSelect={handleSenderAddressSelect}
              tx={tx}
              hideIdentity={payerFromProfile}
            />
            {!payerFromProfile && (
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
            )}
          </section>
        )}

        {!isRecurring && (
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
              hideIdentity={sameAsSender && payerFromProfile}
            />
          </section>
        )}

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 mb-3">{tx.paymentSummary}</p>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">
              {productName} × {quantity}
              {isRecurring && (
                <span className="text-gray-400 ml-1">
                  {lang === "ko" ? "(1회차)" : "(1st cycle)"}
                </span>
              )}
            </span>
            <span className="text-sm text-gray-900">{formatKrw(subtotal)}</span>
          </div>
          {!isRecurring && shippingFee > 0 && (
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
            {isRecurring
              ? lang === "ko"
                ? `결제 통화: 원화(KRW) · 매월 1일 ${formatKrw(unitPrice)} 자동 청구`
                : `Currency: KRW · Auto-billed ${formatKrw(unitPrice)} on the 1st each month`
              : lang === "ko"
                ? `결제 통화: 원화(KRW) · KG이니시스 결제창에 ${total.toLocaleString("ko-KR")}원으로 동일 표시됩니다.`
                : `Currency: KRW · The same amount (${total.toLocaleString("ko-KR")} KRW) will appear in the KG Inicis payment window.`}
          </p>
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          {isRecurring ? (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-500">
                {lang === "ko" ? "결제수단" : "Payment method"}
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={total.toLocaleString("ko-KR")}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-900 font-semibold"
                />
                <span className="text-xs text-gray-500 shrink-0">원</span>
              </div>
              <select
                disabled
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white text-gray-900"
                value="card"
              >
                <option value="card">
                  {lang === "ko" ? "신용카드" : "Credit Card"}
                </option>
              </select>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                {lang === "ko"
                  ? "주문하기를 누르면 KG이니시스 결제창에서 카드를 등록합니다. (월 자동결제)"
                  : "Card registration opens in the KG Inicis window (monthly auto-billing)."}
              </p>
            </div>
          ) : (
            <PaymentMethodSelector
              lang={lang}
              value={paymentMethod}
              onChange={setPaymentMethod}
            />
          )}
        </section>

        {isRecurring && (
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={billingAgreed}
              onChange={(e) => setBillingAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#de2910] shrink-0"
            />
            <span className="text-xs text-gray-600 leading-relaxed">
              {lang === "ko"
                ? "매월 1일 자동결제(정기결제)에 동의하며, 해지 전까지 동일 금액이 청구됨을 확인합니다. (필수)"
                : "I agree to monthly auto-billing on the 1st until cancellation. (Required)"}
            </span>
          </label>
        )}

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
          {formatKrw(total)} {lang === "ko" ? "주문하기" : "Place order"}
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

        <p className="text-center text-[10px] text-gray-400">{tx.paymentNotice}</p>
      </div>
    </div>
  );
}
