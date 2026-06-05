"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Package, CreditCard, Loader2, Check } from "lucide-react";
import { SHOP_PRODUCTS } from "../page";

declare global {
  interface Window {
    EXIMBAY?: {
      request_pay: (params: object) => void;
    };
  }
}

type Product = (typeof SHOP_PRODUCTS)[number];

interface AddressForm {
  name: string;
  phone: string;
  zipcode: string;
  address: string;
  addressDetail: string;
}

const EMPTY_ADDRESS: AddressForm = { name: "", phone: "", zipcode: "", address: "", addressDetail: "" };

function AddressFields({
  prefix,
  values,
  onChange,
  disabled,
}: {
  prefix: string;
  values: AddressForm;
  onChange: (field: keyof AddressForm, value: string) => void;
  disabled?: boolean;
}) {
  const cls = `w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#de2910] transition-colors ${disabled ? "bg-gray-50 text-gray-400" : ""}`;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            이름 <span className="text-red-500">*</span>
          </label>
          <input type="text" value={values.name} onChange={(e) => onChange("name", e.target.value)}
            placeholder="홍길동" disabled={disabled} className={cls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            연락처 <span className="text-red-500">*</span>
          </label>
          <input type="tel" value={values.phone} onChange={(e) => onChange("phone", e.target.value)}
            placeholder="010-1234-5678" disabled={disabled} className={cls} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">우편번호</label>
        <input type="text" value={values.zipcode} onChange={(e) => onChange("zipcode", e.target.value)}
          placeholder="12345" disabled={disabled} className={cls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          주소 <span className="text-red-500">*</span>
        </label>
        <input type="text" value={values.address} onChange={(e) => onChange("address", e.target.value)}
          placeholder="서울특별시 강남구 테헤란로 123" disabled={disabled} className={cls} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">상세주소</label>
        <input type="text" value={values.addressDetail} onChange={(e) => onChange("addressDetail", e.target.value)}
          placeholder="101동 202호" disabled={disabled} className={cls} />
      </div>
    </div>
  );
}

export default function ShopCheckoutPage() {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [email, setEmail] = useState("");
  const [sender, setSender] = useState<AddressForm>(EMPTY_ADDRESS);
  const [recipient, setRecipient] = useState<AddressForm>(EMPTY_ADDRESS);
  const [sameAsSender, setSameAsSender] = useState(false);

  useEffect(() => {
    const id = sessionStorage.getItem("shop_product_id");
    const found = SHOP_PRODUCTS.find((p) => p.id === id) ?? null;
    if (!found) { router.replace("/shop"); return; }
    setProduct(found);
  }, [router]);

  /* Eximbay SDK를 동적으로 로드 */
  useEffect(() => {
    if (document.querySelector('script[data-eximbay]')) { setSdkReady(true); return; }
    const script = document.createElement("script");
    script.src = "https://api-test.eximbay.com/v2/javascriptSDK.js";
    script.setAttribute("data-eximbay", "1");
    script.onload = () => setSdkReady(true);
    script.onerror = () => console.error("Eximbay SDK 로드 실패");
    document.head.appendChild(script);
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

  const effectiveRecipient = sameAsSender ? sender : recipient;

  function isFormValid() {
    return (
      sender.name.trim() &&
      sender.phone.trim() &&
      sender.address.trim() &&
      email.trim() &&
      effectiveRecipient.name.trim() &&
      effectiveRecipient.phone.trim() &&
      effectiveRecipient.address.trim()
    );
  }

  async function handlePayment() {
    if (!product || !isFormValid()) return;
    if (!sdkReady || !window.EXIMBAY) {
      alert("결제 모듈을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const orderId = `SHOP-${Date.now()}`;

      const res = await fetch("/api/eximbay/ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          amount: product.price,
          buyer_name: sender.name,
          buyer_email: email,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.fgkey) {
        alert(data.error ?? "결제 준비에 실패했습니다.");
        return;
      }

      window.EXIMBAY.request_pay({
        fgkey: data.fgkey,
        ...data.payload,
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
            <p className="text-sm font-bold text-gray-900">{product.price.toLocaleString()}원</p>
          </div>
        </section>

        {/* 보내는 분 (수거 주소) */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 mb-4">보내는 분 (수거 주소)</p>
          <AddressFields prefix="sender" values={sender} onChange={handleSender} />
          <div className="mt-3 pt-3 border-t border-gray-50">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              이메일 <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#de2910] transition-colors"
            />
          </div>
        </section>

        {/* 받는 분 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-gray-500">받는 분</p>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => toggleSameAsSender(!sameAsSender)}
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  sameAsSender ? "bg-[#de2910] border-[#de2910]" : "border-gray-300"
                }`}
              >
                {sameAsSender && <Check size={11} className="text-white" strokeWidth={3} />}
              </div>
              <span className="text-xs text-gray-600">보내는 분과 동일</span>
            </label>
          </div>
          <AddressFields
            prefix="recipient"
            values={sameAsSender ? sender : recipient}
            onChange={handleRecipient}
            disabled={sameAsSender}
          />
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
            <span className="text-lg font-bold text-[#de2910]">{product.price.toLocaleString()}원</span>
          </div>
        </section>

        {/* 결제 버튼 */}
        <button
          onClick={handlePayment}
          disabled={loading || !isFormValid() || !sdkReady}
          className="w-full bg-[#de2910] text-white font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-40 active:opacity-80 transition-opacity"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
          {product.price.toLocaleString()}원 결제하기
        </button>

        <p className="text-center text-[10px] text-gray-400">
          결제는 엑심베이(Eximbay)를 통해 안전하게 처리됩니다
        </p>

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
            <a href="/terms" className="text-[10px] text-gray-400 underline">이용약관</a>
            <a href="/privacy" className="text-[10px] text-gray-400 underline">개인정보처리방침</a>
          </div>
        </div>
      </div>
    </div>
  );
}
