"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Package, Plus, Trash2,
  CheckCircle, AlertCircle, ChevronDown, Truck, Tag, ScanSearch,
} from "lucide-react";import ItemCategoryPicker from "@/components/ui/ItemCategoryPicker";
import type { ItemCategory } from "@/lib/item-categories";
import { useFlowMode } from "@/lib/flow-mode";

const STEP_LABELS = ["발송 정보", "물품 내역"] as const;

type ShipmentType = "parcel" | "freight";

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
  inspection?: string;
  specials?: string[];
}

function newItem(): InvoiceItem {
  return {
    key: Math.random().toString(36).slice(2),
    name_en: "", quantity: 1, unit_price_usd: 0,
    origin_country: "KR", hs_code: "",
  };
}

// 품목별 검품 (각 품목 카드에서 선택)
const PER_ITEM_INSPECTION = [
  { code: "BASIC_INSPECT",    name: "기본검수",  price: 0    },
  { code: "CLOTHING_INSPECT", name: "의류검수",  price: 1000 },
  { code: "DETAIL_INSPECT",   name: "제품검수",  price: 2000 },
];

const SPECIAL_INSPECTION_SERVICES = [
  { code: "STEAM_IRON",    name: "스팀다리미",   desc: "의류 구김·주름 제거",      price: 1000 },
  { code: "AIR_DRESSER",   name: "에어드레서",   desc: "의류 먼지·냄새 케어",      price: 1000 },
  { code: "THREAD_REMOVE", name: "실밥제거",     desc: "의류 실밥 정리",           price: 1000 },
  { code: "PP_BAG",        name: "PP봉투포장",   desc: "PP봉투 개별 포장",         price: 1000 },
  { code: "FUNC_CHECK",    name: "제품기능검수",  desc: "제품 작동·기능 여부 확인", price: 1000 },
];

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
  const { isSimple, isAdvanced, mode: flowMode } = useFlowMode();
  const [step, setStep] = useState(1);
  const prevFlowMode = useRef(flowMode);

  // Step 1: 발송 정보
  const [shipmentType, setShipmentType] = useState<ShipmentType>("parcel"); // 택배 or 화물
  const [trackingNo, setTrackingNo] = useState("");
  const [senderPhone, setSenderPhone] = useState("");  // 화물 시 주 식별자
  const [senderName, setSenderName] = useState("");
  const [senderAddress, setSenderAddress] = useState("");
  const [notes, setNotes] = useState("");

  // Step 2: 물품 내역
  const [condition, setCondition] = useState<"NEW" | "USED" | "SEALED">("NEW");
  const [items, setItems] = useState<InvoiceItem[]>([newItem()]);

  const [specialsOpenKeys, setSpecialsOpenKeys] = useState<Set<string>>(new Set());

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
    if (shipmentType === "parcel") return trackingNo.trim().length > 0;
    return senderPhone.trim().length > 0;
  }

  function canStep2() {
    return items.length > 0 && items.every(
      (it) => it.name_en.trim() && it.quantity >= 1 && it.unit_price_usd >= 0
    );
  }

  function inferStep(): 1 | 2 {
    if (!canStep1()) return 1;
    if (!canStep2()) return 2;
    return 2;
  }

  useEffect(() => {
    if (prevFlowMode.current === "advanced" && flowMode === "simple") {
      setStep(inferStep());
    }
    prevFlowMode.current = flowMode;
  }, [flowMode, trackingNo, items]);

  function handleBack() {
    if (isSimple && step > 1) {
      setStep(1);
      setError("");
    } else {
      router.back();
    }
  }

  function handleNext() {
    setError("");
    if (shipmentType === "parcel" && !trackingNo.trim()) {
      setError("국내 운송장 번호를 입력해주세요.");
      return;
    }
    if (shipmentType === "freight" && !senderPhone.trim()) {
      setError("발송인 전화번호를 입력해주세요.");
      return;
    }
    setStep(2);
  }

  const showStep = (n: number) => isAdvanced || step === n;

  async function handleSubmit() {
    setError("");
    if (shipmentType === "parcel" && !trackingNo.trim()) {
      setError("국내 운송장 번호를 입력해주세요.");
      if (isSimple) setStep(1);
      return;
    }
    if (shipmentType === "freight" && !senderPhone.trim()) {
      setError("발송인 전화번호를 입력해주세요.");
      if (isSimple) setStep(1);
      return;
    }
    if (!canStep2()) {
      setError("모든 물품의 품목·수량·단가를 입력해주세요.");
      if (isSimple) setStep(2);
      return;
    }

    // 화물의 경우 전화번호를 운송장 번호 식별자로 사용
    const resolvedTrackingNo = shipmentType === "freight"
      ? `화물-${senderPhone.trim()}`
      : trackingNo.trim();

    setSubmitting(true);
    try {
      const res = await fetch("/api/parcels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracking_no: resolvedTrackingNo,
          courier: shipmentType === "freight" ? "화물" : undefined,
          sender_name: senderName || undefined,
          sender_phone: senderPhone || undefined,
          sender_address: senderAddress || undefined,
          notes: notes || undefined,
          item_condition: condition,
          pre_invoice_items: items
            .filter((it) => it.name_en.trim() || it.product_name?.trim())
            .map(({ key: _k, _isCustom: _c, _categoryLabel: _l, inspection: _i, specials: _s, ...rest }) => rest),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "오류가 발생했습니다"); return; }

      // 검품·특수옵션 서비스 신청
      const parcelId = json.data?.id;
      if (parcelId) {
        const services: { service_code: string; service_name: string; price: number; note?: string }[] = [];

        // 품목별 검품 집계
        const inspMap = new Map<string, { name: string; price: number; items: string[] }>();
        items.filter(i => i.name_en.trim() && i.inspection).forEach(item => {
          const opt = PER_ITEM_INSPECTION.find(o => o.code === item.inspection);
          if (!opt) return;
          if (!inspMap.has(opt.code)) inspMap.set(opt.code, { name: opt.name, price: opt.price, items: [] });
          inspMap.get(opt.code)!.items.push(item.product_name || item.name_en);
        });
        inspMap.forEach(({ name, price, items: iNames }, code) => {
          services.push({ service_code: code, service_name: name, price, note: `${iNames.length}건: ${iNames.join(", ")}` });
        });

        // 품목별 특수 처리 집계
        const specialsMap = new Map<string, { name: string; price: number; items: string[] }>();
        items.filter(i => i.name_en.trim() && i.specials?.length).forEach(item => {
          (item.specials ?? []).forEach(code => {
            const opt = SPECIAL_INSPECTION_SERVICES.find(o => o.code === code);
            if (!opt) return;
            if (!specialsMap.has(code)) specialsMap.set(code, { name: opt.name, price: opt.price, items: [] });
            specialsMap.get(code)!.items.push(item.product_name || item.name_en);
          });
        });
        specialsMap.forEach(({ name, price, items: iNames }, code) => {
          services.push({ service_code: code, service_name: name, price, note: `${iNames.length}건: ${iNames.join(", ")}` });
        });

        if (services.length > 0) {
          await fetch(`/api/parcels/${parcelId}/service-requests`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ services }),
          }).catch(() => {});
        }
      }

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
          운송장 <span className="font-semibold text-gray-800">{shipmentType === "freight" ? senderPhone : trackingNo}</span>{wasMerged ? "에\n물품이 추가되었습니다." : "이\n스토리지에 등록되었습니다."}
        </p>
        <p className="text-xs text-gray-400 mb-8">
          센터에 도착하면 입고 처리 후 알려드릴게요.
        </p>
        <button
          onClick={() => router.push("/storage")}
          className="w-full bg-brand-600 text-white font-bold py-4 rounded-2xl"
        >
          스토리지에서 확인
        </button>
        <button
          onClick={() => {
            setDone(false); setStep(1);
            setShipmentType("parcel");
            setTrackingNo(""); setSenderName("");
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
      <div
        className="sticky bg-white border-b border-gray-100 z-10"
        style={{ top: "var(--sat, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <button type="button" onClick={handleBack} className="p-1 -ml-1">
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <div className="flex-1 min-w-0">
            {isSimple ? (
              <>
                <p className="text-xs text-gray-400">Step {step} / {STEP_LABELS.length}</p>
                <p className="text-sm font-bold text-gray-900 truncate">{STEP_LABELS[step - 1]}</p>
              </>
            ) : (
              <h1 className="text-base font-bold text-gray-900">직접 보내기</h1>
            )}
          </div>
        </div>
        {isSimple && (
          <div className="flex gap-1.5 px-4 pb-3">
            {STEP_LABELS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${i + 1 <= step ? "bg-brand-600" : "bg-gray-200"}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-5 pb-28 space-y-5 max-w-[600px] mx-auto">

        {/* ── Step 1: 발송 정보 ── */}
        {showStep(1) && (
          <>
            {/* 안내 */}
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 flex gap-3">
              <Truck size={18} className="text-brand-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-brand-800">직접 보내기</p>
                <p className="text-xs text-brand-600 mt-0.5 leading-relaxed">
                  쇼핑몰 등에서 인프론트 창고 주소로 직접 발송한 물품을 미리 등록하세요.<br />
                  운송장 번호로 도착한 물품을 빠르게 처리할 수 있어요.
                </p>
              </div>
            </div>

            {/* 배송 유형 선택 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">배송 유형</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: "parcel" as const,  label: "일반택배", sub: "운송장 번호 있음" },
                  { value: "freight" as const, label: "화물",     sub: "운송장 번호 없음" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setShipmentType(opt.value); setTrackingNo(""); setSenderPhone(""); }}
                    className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                      shipmentType === opt.value
                        ? "border-brand-500 bg-brand-50"
                        : "border-gray-200 bg-white hover:border-brand-200"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                      shipmentType === opt.value ? "border-brand-500 bg-brand-500" : "border-gray-300"
                    }`}>
                      {shipmentType === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${shipmentType === opt.value ? "text-brand-700" : "text-gray-800"}`}>{opt.label}</p>
                      <p className="text-xs text-gray-400">{opt.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 운송장 번호 (택배) 또는 발송인 전화번호 (화물) */}
            {shipmentType === "parcel" ? (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  국내 운송장 번호 <span className="text-red-500">*</span>
                </label>
                <input
                  value={trackingNo}
                  onChange={(e) => setTrackingNo(e.target.value)}
                  placeholder="123456789012"
                  className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white font-mono"
                />
                <p className="text-xs text-gray-400 mt-1.5">쇼핑몰 주문내역 또는 택배사 앱에서 확인할 수 있어요</p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  발송인 전화번호 <span className="text-red-500">*</span>
                </label>
                <input
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  type="tel"
                  className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                />
                <p className="text-xs text-gray-400 mt-1.5">화물 도착 시 전화번호로 물품을 식별합니다</p>
              </div>
            )}

            {/* 발송인 / 쇼핑몰 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                발송인 / 쇼핑몰명 <span className="text-gray-400 font-normal text-xs">(선택)</span>
              </label>
              <input
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="예: Zara, 무신사, 홍길동"
                className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              />
            </div>

            {/* 발송인 연락처 — 화물 타입에서는 위에서 이미 입력함 */}
            {shipmentType === "parcel" && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                발송인 연락처 <span className="text-gray-400 font-normal text-xs">(선택)</span>
              </label>
              <input
                value={senderPhone}
                onChange={(e) => setSenderPhone(e.target.value)}
                placeholder="010-0000-0000"
                type="tel"
                className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              />
            </div>
            )}

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
                className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              />
            </div>

          </>
        )}

        {/* ── Step 2: 물품 내역 ── */}
        {showStep(2) && (
          <>
            {/* 발송 정보 요약 — 일반모드 2단계 */}
            {isSimple && (
            <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center shrink-0">
                <Truck size={15} className="text-brand-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 font-mono">{trackingNo}</p>
                <p className="text-xs text-gray-400">{shipmentType === "freight" ? `화물 · ${senderPhone}` : trackingNo}{senderName ? ` · ${senderName}` : ""}</p>
              </div>
              <button type="button" onClick={() => setStep(1)} className="text-xs text-brand-600 font-medium shrink-0">수정</button>
            </div>
            )}

            {/* 물품 상태 선택 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                <Tag size={14} className="inline mr-1.5 text-gray-500" />
                물품 상태
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "NEW",    label: "새 제품",  sub: "신품 · 미사용" },
                  { value: "SEALED", label: "미개봉",   sub: "박스 봉인 상태" },
                  { value: "USED",   label: "중고품",   sub: "사용품 · 유학생 짐" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCondition(opt.value as "NEW" | "USED" | "SEALED")}
                    className={`flex flex-col gap-1 px-3 py-3 rounded-xl border-2 transition-all text-left ${
                      condition === opt.value
                        ? "border-brand-500 bg-brand-50"
                        : "border-gray-200 bg-white hover:border-brand-200"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        condition === opt.value ? "border-brand-500 bg-brand-500" : "border-gray-300"
                      }`}>
                        {condition === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <p className={`text-sm font-semibold ${condition === opt.value ? "text-brand-700" : "text-gray-800"}`}>{opt.label}</p>
                    </div>
                    <p className="text-[10px] text-gray-400 pl-5">{opt.sub}</p>
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
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
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
                          className="mt-1.5 w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
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
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
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
                            className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 font-mono ${
                              item.hs_code && !item._isCustom
                                ? "bg-brand-50 border-brand-100 text-brand-700"
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

                    {/* 검품 + 특수 처리 */}
                    <div className="mt-2.5 pt-2.5 border-t border-gray-100 space-y-2">
                      {/* 검품 선택 */}
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                          <ScanSearch size={12} className="text-violet-400" /> 검품
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {PER_ITEM_INSPECTION.map(opt => {
                            const isActive = item.inspection === opt.code;
                            return (
                              <button
                                key={opt.code}
                                type="button"
                                onClick={() => updateItem(idx, { inspection: isActive ? undefined : opt.code })}
                                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                                  isActive
                                    ? "bg-violet-500 border-violet-500 text-white"
                                    : "bg-white border-gray-200 text-gray-500 hover:border-violet-300 hover:text-brand-600"
                                }`}
                              >
                                {opt.name}
                                <span className={`ml-1 ${isActive ? "text-violet-200" : "text-gray-400"}`}>
                                  {opt.price === 0 ? "무료" : `₩${opt.price.toLocaleString()}`}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 특수 처리 — 품목별 접이식 */}
                      <div>
                        <button
                          type="button"
                          onClick={() => setSpecialsOpenKeys(prev => {
                            const next = new Set(prev);
                            next.has(item.key) ? next.delete(item.key) : next.add(item.key);
                            return next;
                          })}
                          className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-amber-500 transition-colors"
                        >
                          <span>✨</span>
                          <span className="font-semibold">특수 처리</span>
                          {(item.specials?.length ?? 0) > 0 && (
                            <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{item.specials!.length}</span>
                          )}
                          <ChevronDown size={11} className={`transition-transform ${specialsOpenKeys.has(item.key) ? "rotate-180" : ""}`} />
                        </button>
                        {specialsOpenKeys.has(item.key) && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {SPECIAL_INSPECTION_SERVICES.map(opt => {
                              const isActive = item.specials?.includes(opt.code);
                              return (
                                <button
                                  key={opt.code}
                                  type="button"
                                  onClick={() => updateItem(idx, {
                                    specials: isActive
                                      ? (item.specials ?? []).filter(c => c !== opt.code)
                                      : [...(item.specials ?? []), opt.code],
                                  })}
                                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                                    isActive
                                      ? "bg-amber-500 border-amber-500 text-white"
                                      : "bg-white border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-600"
                                  }`}
                                >
                                  {opt.name}
                                  <span className={`ml-1 ${isActive ? "text-amber-200" : "text-gray-400"}`}>
                                    ₩{opt.price.toLocaleString()}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 물품 추가 버튼 */}
              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, newItem()])}
                className="w-full mt-3 flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-brand-300 hover:text-brand-600 transition-colors"
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

          </>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* 하단 버튼 */}
      <div
        className="sticky bg-white border-t border-gray-100 px-4 py-3 max-w-[600px] mx-auto"
        style={{ bottom: "calc(60px + var(--sab, 0px))" }}
      >
        {isSimple && step < 2 ? (
          <button
            type="button"
            disabled={!canStep1()}
            onClick={handleNext}
            className="w-full bg-brand-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-transform"
          >
            다음 <ArrowRight size={16} />
          </button>
        ) : (
          <div className={`flex gap-2 ${isSimple ? "" : ""}`}>
            {isSimple && (
              <button
                type="button"
                onClick={() => { setStep(1); setError(""); }}
                className="flex-1 py-4 rounded-2xl text-sm font-bold border border-gray-200 text-gray-700 active:bg-gray-50"
              >
                이전
              </button>
            )}
            <button
              type="button"
              disabled={submitting || !canStep1() || !canStep2()}
              onClick={handleSubmit}
              className={`${isSimple ? "flex-[2]" : "w-full"} bg-brand-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-transform shadow-md shadow-brand-200`}
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <><CheckCircle size={18} /> 물품 등록 완료</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
