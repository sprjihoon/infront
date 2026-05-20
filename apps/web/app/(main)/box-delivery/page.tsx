"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Package, MapPin, CheckCircle, AlertCircle, ChevronDown } from "lucide-react";

const BOX_OPTIONS = [
  {
    code: "BOX_S",
    name: "소형 박스",
    dims: "20 × 15 × 10 cm",
    price: 3000,
    desc: "소형 의류, 악세서리",
    color: "bg-sky-50 border-sky-200",
    iconColor: "text-sky-500",
  },
  {
    code: "BOX_M",
    name: "중형 박스",
    dims: "30 × 25 × 20 cm",
    price: 4000,
    desc: "신발, 가방, 중형 의류",
    color: "bg-violet-50 border-violet-200",
    iconColor: "text-violet-500",
  },
  {
    code: "BOX_L",
    name: "대형 박스",
    dims: "40 × 35 × 30 cm",
    price: 5000,
    desc: "다수 의류, 부피 큰 제품",
    color: "bg-blue-50 border-blue-200",
    iconColor: "text-blue-500",
  },
];

export default function BoxDeliveryPage() {
  const router = useRouter();

  const [selectedBox, setSelectedBox] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [deliveryName, setDeliveryName] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryZipcode, setDeliveryZipcode] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryAddressDetail, setDeliveryAddressDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);

  const selected = BOX_OPTIONS.find((b) => b.code === selectedBox);
  const totalAmount = selected ? selected.price * quantity : 0;

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/box-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          box_code: selectedBox,
          quantity,
          delivery_name: deliveryName,
          delivery_phone: deliveryPhone,
          delivery_zipcode: deliveryZipcode,
          delivery_address: deliveryAddress,
          delivery_address_detail: deliveryAddressDetail,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "오류가 발생했습니다"); return; }
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle size={32} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">주문 완료!</h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-2">
          빈 박스 주문이 접수되었습니다.<br />
        </p>
        <p className="text-xs text-gray-400 mb-6">
          담당자 확인 후 결제 안내 문자를 드립니다.
        </p>
        <button
          onClick={() => router.push("/home")}
          className="w-full bg-blue-600 text-white font-semibold py-4 rounded-2xl"
        >
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 space-y-5">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <button onClick={() => step > 1 ? setStep(1) : router.back()} className="p-2 -ml-2">
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">빈 박스 신청</h1>
          <p className="text-xs text-gray-400">박스를 구하기 어려울 때 이용해 보세요</p>
        </div>
      </div>

      {/* 안내 배너 */}
      <div className="bg-gradient-to-r from-violet-500 to-blue-500 rounded-2xl p-4 text-white">
        <p className="font-semibold text-sm mb-1">국내 배송비 포함 가격</p>
        <p className="text-xs text-white/80">
          빈 박스를 고객님 주소로 보내드립니다.<br />
          받으신 박스에 물건을 넣어 인프론트로 발송하시면 됩니다.
        </p>
      </div>

      {step === 1 && (
        <>
          {/* 박스 선택 */}
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">박스 사이즈 선택</h2>
            <div className="space-y-3">
              {BOX_OPTIONS.map((opt) => (
                <button
                  key={opt.code}
                  onClick={() => setSelectedBox(opt.code)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                    selectedBox === opt.code
                      ? "border-blue-500 bg-blue-50"
                      : `${opt.color} border`
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0`}>
                    <Package size={24} className={opt.iconColor} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{opt.name}</p>
                    <p className="text-xs text-gray-500">{opt.dims}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-900 text-base">{opt.price.toLocaleString()}원</p>
                    <p className="text-xs text-gray-400">개당</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 수량 선택 */}
          {selectedBox && (
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-3">수량</h2>
              <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 rounded-xl bg-gray-100 text-xl font-bold text-gray-700 flex items-center justify-center active:scale-90 transition-transform"
                >
                  −
                </button>
                <div className="text-center">
                  <span className="text-2xl font-bold text-gray-900">{quantity}</span>
                  <span className="text-gray-400 text-sm ml-1">개</span>
                </div>
                <button
                  onClick={() => setQuantity(Math.min(10, quantity + 1))}
                  className="w-10 h-10 rounded-xl bg-gray-100 text-xl font-bold text-gray-700 flex items-center justify-center active:scale-90 transition-transform"
                >
                  +
                </button>
              </div>
              <div className="flex items-center justify-between mt-3 px-1">
                <span className="text-sm text-gray-500">합계</span>
                <span className="text-lg font-bold text-blue-600">{totalAmount.toLocaleString()}원</span>
              </div>
            </div>
          )}

          <button
            disabled={!selectedBox}
            onClick={() => setStep(2)}
            className="w-full bg-blue-600 text-white font-semibold py-4 rounded-2xl disabled:opacity-40 active:scale-[0.98] transition-transform"
          >
            배송지 입력
          </button>
        </>
      )}

      {step === 2 && (
        <>
          {/* 선택 요약 */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{selected?.name} × {quantity}개</p>
              <p className="text-xs text-gray-500">{selected?.dims}</p>
            </div>
            <p className="text-base font-bold text-blue-600">{totalAmount.toLocaleString()}원</p>
          </div>

          {/* 배송지 입력 */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              <MapPin size={15} className="text-gray-500" />
              배송지 정보
            </h2>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">받는 분 이름 <span className="text-red-500">*</span></label>
              <input
                value={deliveryName}
                onChange={(e) => setDeliveryName(e.target.value)}
                placeholder="홍길동"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">연락처 <span className="text-red-500">*</span></label>
              <input
                value={deliveryPhone}
                onChange={(e) => setDeliveryPhone(e.target.value)}
                placeholder="010-0000-0000"
                type="tel"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-600 block mb-1">우편번호 <span className="text-red-500">*</span></label>
                <input
                  value={deliveryZipcode}
                  onChange={(e) => setDeliveryZipcode(e.target.value)}
                  placeholder="12345"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">도로명 주소 <span className="text-red-500">*</span></label>
              <input
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="서울특별시 강남구 테헤란로 123"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">상세 주소</label>
              <input
                value={deliveryAddressDetail}
                onChange={(e) => setDeliveryAddressDetail(e.target.value)}
                placeholder="101동 202호"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            <p className="font-medium mb-1">결제 안내</p>
            <p>주문 접수 후 담당자가 결제 링크를 문자로 발송해 드립니다.</p>
          </div>

          <button
            disabled={submitting || !deliveryName || !deliveryPhone || !deliveryZipcode || !deliveryAddress}
            onClick={handleSubmit}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-transform shadow"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              `${totalAmount.toLocaleString()}원 주문하기`
            )}
          </button>
        </>
      )}
    </div>
  );
}
