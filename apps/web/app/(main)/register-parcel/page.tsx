"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Package, Plus, Trash2,
  CheckCircle, AlertCircle, ChevronDown, Truck, Tag,
} from "lucide-react";
import ItemCategoryPicker from "@/components/ui/ItemCategoryPicker";
import type { ItemCategory } from "@/lib/item-categories";

interface InvoiceItem {
  key: string;
  product_name?: string;
  name_en: string;
  quantity: number;
  unit_price_usd: number;
  origin_country: string;
  hs_code: string;
  _isCustom?: boolean;
  _categoryLabel?: string;
}

const COURIERS = [
  "CJ대한통운", "한진택배", "롯데택배", "우체국택배", "로젠택배",
  "GS25편의점택배", "컬리", "쿠팡", "네이버도착보장", "기타",
];

function newItem(): InvoiceItem {
  return {
    key: Math.random().toString(36).slice(2),
    name_en: "", quantity: 1, unit_price_usd: 0,
    origin_country: "KR", hs_code: "",
  };
}

const ORIGIN_OPTIONS = [
  { code: "KR", label: "한국 (KR)" },
  { code: "CN", label: "중국 (CN)" },
  { code: "JP", label: "일본 (JP)" },
  { code: "US", label: "미국 (US)" },
  { code: "IT", label: "이탈리아 (IT)" },
  { code: "FR", label: "프랑스 (FR)" },
  { code: "DE", label: "독일 (DE)" },
  { code: "GB", label: "영국 (GB)" },
];

export default function RegisterParcelPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1: 발송 정보
  const [trackingNo, setTrackingNo] = useState("");
  const [courier, setCourier] = useState("");
  const [courierOpen, setCourierOpen] = useState(false);
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [senderAddress, setSenderAddress] = useState("");
  const [notes, setNotes] = useState("");

  // Step 2: 물품 내역
  const [condition, setCondition] = useState<"NEW" | "USED">("NEW");
  const [items, setItems] = useState<InvoiceItem[]>([newItem()]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [wasMerged, setWasMerged] = useState(false);

  const totalUSD = items.reduce((s, i) => s + i.unit_price_usd * i.quantity, 0);

  function updateItem(idx: number, patch: Partial<InvoiceItem>) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  function selectCategory(idx: number, cat: ItemCategory) {
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? {
              ...it,
              name_en: cat.id === "other" ? "" : cat.name_en,
              hs_code: cat.hs_code ?? "",
              _isCustom: cat.id === "other",
              _categoryLabel: cat.id === "other" ? "" : cat.name_ko,
            }
          : it
      )
    );
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function canStep1() {
    return trackingNo.trim().length > 0;
  }

  function canStep2() {
    return items.length > 0 && items.every(
      (it) => it.name_en.trim() && it.quantity >= 1 && it.unit_price_usd >= 0
    );
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/parcels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracking_no: trackingNo.trim(),
          courier: courier || undefined,
          sender_name: senderName || undefined,
          sender_phone: senderPhone || undefined,
          sender_address: senderAddress || undefined,
          notes: notes || undefined,
          item_condition: condition,
          pre_invoice_items: items.map(({ key: _k, _isCustom: _c, _categoryLabel: _l, ...rest }) => rest),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "오류가 발생했습니다"); return; }
      setWasMerged(json.merged === true);
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  // 완료
  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-5">
          <CheckCircle size={32} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {wasMerged ? "물품 추가 완료!" : "물품 등록 완료!"}
        </h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-1">
          운송장 <span className="font-semibold text-gray-800">{trackingNo}</span>{wasMerged ? "에\n물품이 추가되었습니다." : "이\n마이창고에 등록되었습니다."}
        </p>
        <p className="text-xs text-gray-400 mb-8">
          센터에 도착하면 입고 처리 후 알려드릴게요.
        </p>
        <button
          onClick={() => router.push("/warehouse")}
          className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl"
        >
          마이창고에서 확인
        </button>
        <button
          onClick={() => {
            setDone(false); setStep(1);
            setTrackingNo(""); setCourier(""); setSenderName("");
            setSenderPhone(""); setSenderAddress(""); setNotes("");
            setCondition("NEW"); setItems([newItem()]);
          }}
          className="w-full mt-2 py-3 text-sm text-gray-500"
        >
          다른 물품 추가 등록
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={() => step === 1 ? router.back() : setStep(1)} className="p-1 -ml-1">
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <div className="flex-1">
          <p className="text-xs text-gray-400">Step {step} / 2</p>
          <p className="text-sm font-bold text-gray-900">
            {step === 1 ? "발송 정보 입력" : "물품 내역 입력"}
          </p>
        </div>
      </div>

      {/* 진행 바 */}
      <div className="h-1 bg-gray-100">
        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${step * 50}%` }} />
      </div>

      <div className="px-4 py-5 space-y-5 max-w-[600px] mx-auto">

        {/* ── Step 1: 발송 정보 ── */}
        {step === 1 && (
          <>
            {/* 안내 */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
              <Truck size={18} className="text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-blue-800">직접 발송 물품 등록</p>
                <p className="text-xs text-blue-600 mt-0.5 leading-relaxed">
                  쇼핑몰 등에서 인프론트 창고 주소로 직접 발송한 물품을 미리 등록하세요.<br />
                  운송장 번호로 도착한 물품을 빠르게 처리할 수 있어요.
                </p>
              </div>
            </div>

            {/* 국내 운송장 번호 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                국내 운송장 번호 <span className="text-red-500">*</span>
              </label>
              <input
                value={trackingNo}
                onChange={(e) => setTrackingNo(e.target.value)}
                placeholder="123456789012"
                className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                쇼핑몰 주문내역 또는 택배사 앱에서 확인할 수 있어요
              </p>
            </div>

            {/* 택배사 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                택배사 <span className="text-gray-400 font-normal text-xs">(선택)</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCourierOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3.5 border border-gray-200 rounded-xl text-sm bg-white text-left"
                >
                  <span className={courier ? "text-gray-900" : "text-gray-400"}>
                    {courier || "택배사 선택"}
                  </span>
                  <ChevronDown size={15} className="text-gray-400" />
                </button>
                {courierOpen && (
                  <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {COURIERS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => { setCourier(c); setCourierOpen(false); }}
                        className={`w-full text-left px-4 py-3 text-sm hover:bg-blue-50 transition-colors ${
                          courier === c ? "text-blue-600 font-semibold bg-blue-50" : "text-gray-700"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 발송인 / 쇼핑몰 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                발송인 / 쇼핑몰명 <span className="text-gray-400 font-normal text-xs">(선택)</span>
              </label>
              <input
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="예: Zara, 무신사, 홍길동"
                className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* 발송인 연락처 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                발송인 연락처 <span className="text-gray-400 font-normal text-xs">(선택)</span>
              </label>
              <input
                value={senderPhone}
                onChange={(e) => setSenderPhone(e.target.value)}
                placeholder="010-0000-0000"
                type="tel"
                className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                메모 <span className="text-gray-400 font-normal text-xs">(선택)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="예: 의류 5벌, 조심히 취급 부탁드려요"
                rows={2}
                className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <button
              disabled={!canStep1()}
              onClick={() => setStep(2)}
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-transform"
            >
              다음 — 물품 내역 입력 <ArrowRight size={16} />
            </button>
          </>
        )}

        {/* ── Step 2: 물품 내역 ── */}
        {step === 2 && (
          <>
            {/* 발송 정보 요약 */}
            <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                <Truck size={15} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 font-mono">{trackingNo}</p>
                <p className="text-xs text-gray-400">{courier || "택배사 미선택"}{senderName ? ` · ${senderName}` : ""}</p>
              </div>
              <button onClick={() => setStep(1)} className="text-xs text-blue-600 font-medium shrink-0">수정</button>
            </div>

            {/* 물품 상태 선택 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                <Tag size={14} className="inline mr-1.5 text-gray-500" />
                물품 상태
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "NEW",  label: "새 제품",  sub: "신품 · 미사용" },
                  { value: "USED", label: "중고품",   sub: "사용품 · 유학생 짐" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCondition(opt.value as "NEW" | "USED")}
                    className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                      condition === opt.value
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-blue-200"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                      condition === opt.value ? "border-blue-500 bg-blue-500" : "border-gray-300"
                    }`}>
                      {condition === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${condition === opt.value ? "text-blue-700" : "text-gray-800"}`}>{opt.label}</p>
                      <p className="text-xs text-gray-400">{opt.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 물품 목록 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                물품 내역 <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-400 mb-3">
                세관 신고용 정보입니다. <strong className="text-gray-600">영문</strong>으로 입력하고 실제 가격을 기재해주세요.
              </p>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={item.key} className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
                        <Package size={12} /> 물품 {idx + 1}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {/* 제품명 (메모) */}
                    <div className="mb-2.5">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">제품명</label>
                      <input
                        value={item.product_name ?? ""}
                        onChange={(e) => updateItem(idx, { product_name: e.target.value })}
                        placeholder="예: 나이키 운동화, 화장품 세트 (선택)"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>

                    {/* 품목 선택 */}
                    <div className="mb-2.5">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        품목 선택 <span className="text-red-400">*</span>
                      </label>                      <ItemCategoryPicker
                        value={item._isCustom ? "Other Goods" : item.name_en}
                        onChange={(cat) => selectCategory(idx, cat)}
                      />
                      {item._isCustom && (
                        <input
                          value={item.name_en}
                          onChange={(e) => updateItem(idx, { name_en: e.target.value })}
                          placeholder="품목명 직접 입력 (영문)"
                          className="mt-1.5 w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                          autoFocus
                        />
                      )}
                    </div>

                    {/* 수량 + 단가 */}
                    <div className="grid grid-cols-2 gap-2 mb-2.5">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                          수량 <span className="text-red-400">*</span>
                        </label>
                        <div className="flex items-center bg-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                          <button
                            type="button"
                            onClick={() => updateItem(idx, { quantity: Math.max(1, item.quantity - 1) })}
                            className="px-3 py-2.5 text-gray-500 hover:bg-gray-100 font-bold text-lg"
                          >−</button>
                          <span className="flex-1 text-center text-sm font-semibold text-gray-900">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateItem(idx, { quantity: item.quantity + 1 })}
                            className="px-3 py-2.5 text-gray-500 hover:bg-gray-100 font-bold text-lg"
                          >+</button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                          단가 (USD) <span className="text-red-400">*</span>
                        </label>
                        <div className="flex items-center bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                          <span className="text-gray-400 text-xs mr-1">$</span>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={item.unit_price_usd || ""}
                            onChange={(e) => updateItem(idx, { unit_price_usd: parseFloat(e.target.value) || 0 })}
                            placeholder="0.00"
                            className="flex-1 bg-transparent text-sm focus:outline-none min-w-0"
                          />
                        </div>
                      </div>
                    </div>

                    {/* 원산지 + HS코드 */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">원산지</label>
                        <select
                          value={item.origin_country}
                          onChange={(e) => updateItem(idx, { origin_country: e.target.value })}
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        >
                          {ORIGIN_OPTIONS.map((o) => (
                            <option key={o.code} value={o.code}>{o.label}</option>
                          ))}
                          <option value="OTHER">기타</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                          HS 코드 <span className="text-gray-400 font-normal">(자동입력)</span>
                        </label>
                        <div className="relative">
                          <input
                            value={item.hs_code}
                            onChange={(e) => updateItem(idx, { hs_code: e.target.value })}
                            placeholder="자동 입력"
                            className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono ${
                              item.hs_code && !item._isCustom
                                ? "bg-blue-50 border-blue-100 text-blue-700"
                                : "bg-gray-50 border-gray-100"
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 소계 */}
                    {item.unit_price_usd > 0 && (
                      <div className="mt-2.5 pt-2.5 border-t border-gray-50 flex justify-between text-xs">
                        <span className="text-gray-400">{item.quantity}개 × ${item.unit_price_usd}</span>
                        <span className="font-semibold text-gray-700">${(item.quantity * item.unit_price_usd).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 물품 추가 버튼 */}
              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, newItem()])}
                className="w-full mt-3 flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
              >
                <Plus size={15} /> 물품 추가
              </button>
            </div>

            {/* 총 신고 금액 */}
            {totalUSD > 0 && (
              <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex justify-between items-center">
                <span className="text-sm text-gray-600">총 신고 금액</span>
                <span className="text-base font-bold text-gray-900">USD {totalUSD.toFixed(2)}</span>
              </div>
            )}

            {/* 안내 메시지 */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 leading-relaxed">
              <p className="font-semibold mb-1">📋 인보이스 안내</p>
              <ul className="space-y-0.5 list-disc list-inside">
                <li>실제 구매 가격을 정확히 기재해주세요</li>
                <li>중고품은 현재 중고 시세 기준으로 기재하시면 됩니다</li>
                <li>품목명은 세관 심사에 사용되므로 영문으로 입력해주세요</li>
              </ul>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            {/* 등록 버튼 */}
            <button
              type="button"
              disabled={submitting || !canStep2()}
              onClick={handleSubmit}
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-transform shadow-md shadow-blue-200"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <><CheckCircle size={18} /> 물품 등록 완료</>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
