"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin, Calendar, CheckCircle, Info, Truck, ArrowLeft, ArrowRight, Plus, Trash2, ChevronDown, ScanSearch, Package,
} from "lucide-react";
import { normalizeEpostZip, normalizeEpostAddr1 } from "@/lib/epost/client";
import { createClient } from "@/lib/supabase/client";
import PickupAddressPicker, { PickupAddressValue } from "@/components/ui/PickupAddressPicker";
import ItemCategoryPicker from "@/components/ui/ItemCategoryPicker";
import type { ItemCategory } from "@/lib/item-categories";
import {
  PICKUP_BOX_SIZES,
  PICKUP_DEFAULT_SIZE,
  type PickupBoxSizeCode,
} from "@/lib/epost/pickup-boxes";
import { useFlowMode } from "@/lib/flow-mode";

const STEP_LABELS = ["수거 정보", "물품 내역", "확인 및 신청"] as const;

interface InvoiceItem {
  key: string;
  product_name?: string;
  name_en: string;
  quantity: number;
  unit_price_usd: number;
  origin_country: string;
  hs_code: string;
  _isCustom?: boolean;
  inspection?: string;
  specials?: string[];
}

function newItem(): InvoiceItem {
  return { key: Math.random().toString(36).slice(2), product_name: "", name_en: "", quantity: 1, unit_price_usd: 0, origin_country: "KR", hs_code: "", _isCustom: false };
}

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

const KR_HOLIDAYS = new Set([
  "2026-01-01","2026-02-16","2026-02-17","2026-02-18",
  "2026-03-01","2026-05-05","2026-05-24","2026-06-06",
  "2026-08-15","2026-08-16","2026-09-24","2026-09-25","2026-09-26",
  "2026-10-03","2026-10-09","2026-12-25",
]);

function isUnavailable(date: Date): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return true;
  return KR_HOLIDAYS.has(date.toISOString().split("T")[0]);
}

function getNextWeekday(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (isUnavailable(d)) d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function getMaxDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 21);
  return d.toISOString().split("T")[0];
}

function formatDateLabel(iso: string): string {
  if (!iso || iso.length < 10) return iso || "-";
  const [y, m, d] = iso.split("-");
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}

export default function PickupPage() {
  const router = useRouter();
  const minDate = getNextWeekday();
  const maxDate = getMaxDate();

  const { mode: formMode, isSimple } = useFlowMode();
  const [step, setStep] = useState(1);
  const prevFormMode = useRef(formMode);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [pickupAddress, setPickupAddress] = useState<PickupAddressValue | null>(null);
  const [pickupDate, setPickupDate]     = useState(minDate);
  const [notes, setNotes]               = useState("");
  const [agreed, setAgreed]             = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");

  const [itemsOpen, setItemsOpen]       = useState(true);
  const [itemCondition, setItemCondition] = useState<"NEW" | "USED">("NEW");
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([newItem()]);
  const [specialsOpenKeys, setSpecialsOpenKeys] = useState<Set<string>>(new Set());
  const [boxSize, setBoxSize]           = useState<PickupBoxSizeCode>(PICKUP_DEFAULT_SIZE);

  const [result, setResult]             = useState<{
    parcel_id: string;
    parcel_ids: string[];
    tracking_no: string;
    tracking_nos: string[];
    box_count: number;
    pickup_date: string;
    post_office: string;
    is_test: boolean;
  } | null>(null);

  const disabledDates = Array.from({ length: 21 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  }).filter(isUnavailable).map((d) => d.toISOString().split("T")[0]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCustomerId(user.id);
    });
  }, []);

  const validateStep1 = useCallback((): string | null => {
    if (!pickupAddress) return "수거 주소를 선택해주세요.";
    if (normalizeEpostAddr1(pickupAddress.address).length < 2) {
      return "수거 주소를 선택해주세요. 주소 검색으로 도로명 주소가 채워져야 합니다.";
    }
    if (normalizeEpostZip(pickupAddress.zipcode).length !== 5) {
      return "우편번호가 없습니다. 주소 검색으로 다시 선택해주세요.";
    }
    if (!pickupAddress.phone) return "수거지 연락처를 입력해주세요.";
    if (!/^[0-9\-\s]{9,}$/.test(pickupAddress.phone)) {
      return "연락처 형식을 확인해주세요. (예: 010-1234-5678)";
    }
    if ((pickupAddress.addressDetail ?? "").trim().length < 2) {
      return pickupAddress.savedId
        ? "주소록에 상세주소가 없습니다. 마이페이지 → 주소록 관리에서 수거배송지 상세주소를 저장하거나, 아래 칸에 입력해주세요."
        : "수거지 상세주소(동·호수, 층 등)를 입력해주세요.";
    }
    if (disabledDates.includes(pickupDate)) return "토·일요일 및 공휴일은 수거가 불가합니다.";
    return null;
  }, [pickupAddress, pickupDate, disabledDates]);

  const validateStep2 = useCallback((): string | null => {
    const filled = invoiceItems.filter(i => i.name_en.trim());
    if (filled.length === 0) return "품목을 하나 이상 선택해주세요.";
    const missingCategory = invoiceItems.find(i => !i.name_en.trim());
    if (missingCategory) return "모든 품목의 품목 선택을 완료해주세요.";
    const missingHs = filled.find(i => !i.hs_code.trim());
    if (missingHs) return "모든 품목의 HS 코드를 입력해주세요. (인보이스·마이창고 전달에 필수)";
    return null;
  }, [invoiceItems]);

  function inferStep(): 1 | 2 | 3 {
    if (validateStep1()) return 1;
    if (validateStep2()) return 2;
    return 3;
  }

  async function resolvePickupAddress(addr: PickupAddressValue): Promise<PickupAddressValue> {
    if (!addr.savedId || !customerId) return addr;
    const supabase = createClient();
    const { data } = await supabase
      .from("customer_addresses")
      .select("id, label, name, phone, zipcode, address, address_detail")
      .eq("id", addr.savedId)
      .eq("customer_id", customerId)
      .eq("type", "pickup")
      .maybeSingle();
    if (!data) return addr;
    const zip = normalizeEpostZip(data.zipcode);
    const address = normalizeEpostAddr1(data.address) || normalizeEpostAddr1(addr.address);
    return {
      savedId: data.id,
      label: data.label ?? addr.label,
      name: data.name ?? addr.name,
      phone: data.phone ?? addr.phone,
      zipcode: zip.length === 5 ? zip : addr.zipcode,
      address,
      addressDetail:
        (data.address_detail ?? '').trim() ||
        (addr.addressDetail ?? '').trim(),
    };
  }

  useEffect(() => {
    if (prevFormMode.current === "advanced" && formMode === "simple") {
      setStep(inferStep());
      setItemsOpen(true);
      setError("");
    }
    prevFormMode.current = formMode;
  }, [formMode, validateStep1, validateStep2]);

  function handleBack() {
    if (isSimple && step > 1) {
      setStep(s => s - 1);
      setError("");
    } else {
      router.back();
    }
  }

  function handleNext() {
    setError("");
    if (step === 1) {
      const err = validateStep1();
      if (err) { setError(err); return; }
      setStep(2);
      setItemsOpen(true);
    } else if (step === 2) {
      const err = validateStep2();
      if (err) { setError(err); setItemsOpen(true); return; }
      setStep(3);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const step1Err = validateStep1();
    if (step1Err) { setError(step1Err); if (isSimple) setStep(1); return; }

    const step2Err = validateStep2();
    if (step2Err) { setError(step2Err); setItemsOpen(true); if (isSimple) setStep(2); return; }

    if (!agreed) { setError("서비스 안내에 동의해주세요."); if (isSimple) setStep(3); return; }

    setLoading(true);
    try {
      const resolved = await resolvePickupAddress(pickupAddress!);
      const zip = normalizeEpostZip(resolved.zipcode);
      const address = normalizeEpostAddr1(resolved.address);
      if (zip.length !== 5) {
        throw new Error("우편번호가 없습니다. 주소록에서 저장 후 수거지를 다시 선택해주세요.");
      }
      if (address.length < 2) {
        throw new Error("도로명/지번 주소가 없습니다. 주소록에서 주소 검색 후 다시 저장해주세요.");
      }

      const resp = await fetch("/api/pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_address: address,
          pickup_address_detail: resolved.addressDetail.trim(),
          pickup_zipcode: zip,
          pickup_phone: resolved.phone,
          pickup_name: resolved.name,
          pickup_address_id: resolved.savedId,
          pickup_date: pickupDate,
          pickup_notes: notes.trim() || undefined,
          box_count: 1,
          box_size: boxSize,
          item_condition: itemCondition,
          pre_invoice_items: invoiceItems
            .filter(i => i.name_en.trim())
            .map(({ key: _k, _isCustom: _c, inspection: _i, specials: _s, ...rest }) => rest),
        }),
      });

      let data: {
        error?: string;
        success?: boolean;
        parcel_id?: string | number;
        parcel_ids?: string[];
        tracking_no?: string;
        tracking_nos?: string[];
        box_count?: number;
        pickup_date?: string;
        post_office?: string;
        is_test?: boolean;
      } = {};
      try {
        data = await resp.json();
      } catch {
        throw new Error(`서버 오류 (${resp.status}). 잠시 후 다시 시도해주세요.`);
      }
      if (!resp.ok) throw new Error(data.error || `수거 신청에 실패했습니다. (${resp.status})`);

      if (data.parcel_id) {
        const services: { service_code: string; service_name: string; price: number; note?: string }[] = [];

        const inspMap = new Map<string, { name: string; price: number; items: string[] }>();
        invoiceItems.filter(i => i.name_en.trim() && i.inspection).forEach(item => {
          const opt = PER_ITEM_INSPECTION.find(o => o.code === item.inspection);
          if (!opt) return;
          if (!inspMap.has(opt.code)) inspMap.set(opt.code, { name: opt.name, price: opt.price, items: [] });
          inspMap.get(opt.code)!.items.push(item.product_name || item.name_en);
        });
        inspMap.forEach(({ name, price, items }, code) => {
          services.push({ service_code: code, service_name: name, price, note: `${items.length}건: ${items.join(", ")}` });
        });

        const specialsMap = new Map<string, { name: string; price: number; items: string[] }>();
        invoiceItems.filter(i => i.name_en.trim() && i.specials?.length).forEach(item => {
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
          await fetch(`/api/parcels/${data.parcel_id}/service-requests`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ services }),
          }).catch(() => {});
        }
      }

      const parcelIds: string[] = data.parcel_ids ?? (data.parcel_id ? [String(data.parcel_id)] : []);
      const trackingNos: string[] = data.tracking_nos ?? (data.tracking_no ? [data.tracking_no] : []);

      setResult({
        parcel_id: parcelIds[0] ?? "",
        parcel_ids: parcelIds,
        tracking_no: trackingNos[0] ?? "",
        tracking_nos: trackingNos,
        box_count: data.box_count ?? parcelIds.length,
        pickup_date: data.pickup_date ?? "",
        post_office: data.post_office ?? "",
        is_test: data.is_test ?? false,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "수거 신청 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const selectedBox = PICKUP_BOX_SIZES.find(s => s.code === boxSize);
  const filledItemCount = invoiceItems.filter(i => i.name_en.trim()).length;
  const showStep = (n: number) => !isSimple || step === n;

  if (result) {
    const dateStr = result.pickup_date.length >= 8
      ? `${result.pickup_date.substring(0,4)}-${result.pickup_date.substring(4,6)}-${result.pickup_date.substring(6,8)}`
      : "-";

    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mb-5">
          <CheckCircle className="w-9 h-9 text-brand-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">수거 예약 완료!</h2>
        {result.is_test && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-3">
            테스트 모드 — 실제 수거가 예약되지 않았습니다.
          </p>
        )}
        <div className="w-full bg-gray-50 rounded-2xl p-5 mb-6 text-left space-y-3">
          <div>
            <p className="text-xs text-gray-400">운송장번호</p>
            <p className="text-base font-bold text-brand-600 tracking-widest">{result.tracking_no}</p>
          </div>
          {result.post_office && (
            <div>
              <p className="text-xs text-gray-400">접수 우체국</p>
              <p className="text-sm font-medium text-gray-800">{result.post_office}</p>
            </div>
          )}
          {dateStr !== "-" && (
            <div>
              <p className="text-xs text-gray-400">수거 예정일</p>
              <p className="text-sm font-medium text-gray-800">{dateStr}</p>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-6 leading-relaxed">
          우체국 집배원이 지정하신 주소로 방문하여 물품을 수거합니다.<br />
          입고 완료 후 검수 결과를 알려드리겠습니다.
        </p>
        <button
          type="button"
          onClick={() => router.push("/warehouse")}
          className="w-full py-3.5 bg-brand-600 text-white font-bold rounded-xl text-sm"
        >
          마이창고에서 확인
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* 헤더 */}
      <div
        className="sticky bg-white border-b border-gray-100 z-10"
        style={{ top: "var(--sat, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <button type="button" onClick={handleBack}>
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            {isSimple ? (
              <>
                <p className="text-xs text-gray-400">Step {step} / {STEP_LABELS.length}</p>
                <h1 className="text-sm font-bold text-gray-900 truncate">{STEP_LABELS[step - 1]}</h1>
              </>
            ) : (
              <h1 className="text-base font-bold text-gray-900">우체국 수거 신청</h1>
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

      <form onSubmit={handleSubmit} className="px-4 py-5 space-y-6">

        {/* 안내 배너 — 1단계 또는 고급모드 */}
        {(showStep(1) || !isSimple) && (
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 flex gap-3">
            <Truck className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-brand-800">우체국 반품 수거</p>
              <p className="text-xs text-brand-600 mt-0.5 leading-relaxed">
                우체국이 방문하여 물품을 수거합니다. 신청 1회당 박스 1개·운송장 1장이며, 박스가 여러 개면 각각 수거 신청해 주세요.
              </p>
            </div>
          </div>
        )}

        {/* Step 1: 수거 정보 */}
        {showStep(1) && (
          <>
            <div>
              <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 mb-2">
                <MapPin className="w-4 h-4 text-brand-600" />
                수거 주소 <span className="text-red-500">*</span>
              </label>
              <PickupAddressPicker
                value={pickupAddress}
                onChange={setPickupAddress}
                customerId={customerId}
              />
              {pickupAddress && (
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    상세주소 (동·호수, 층) <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={pickupAddress.addressDetail}
                    onChange={(e) =>
                      setPickupAddress({ ...pickupAddress, addressDetail: e.target.value })
                    }
                    placeholder="예: 101동 1203호, 3층"
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    우체국 수거 기사가 방문할 상세 위치입니다. 저장된 주소에 없으면 여기서 입력하세요.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 mb-2">
                <Calendar className="w-4 h-4 text-brand-600" />
                수거 희망일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={pickupDate}
                min={minDate}
                max={maxDate}
                onChange={(e) => {
                  const v = e.target.value;
                  if (disabledDates.includes(v)) {
                    alert("토·일요일 및 공휴일은 수거가 불가합니다.");
                    return;
                  }
                  setPickupDate(v);
                }}
                className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-500 transition-colors"
              />
              <p className="text-xs text-gray-400 mt-1">
                희망일은 참고용이며 실제 수거일은 우체국 일정에 따릅니다.{" "}
                <span className="text-red-400">토·일·공휴일 수거 불가</span>
              </p>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3.5 bg-white border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-brand-600" />
                  <span className="text-sm font-bold text-gray-800">박스 크기</span>
                  <span className="text-red-500 text-xs font-semibold">*필수</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                  극소형~특대형(2/5/10/20/30kg · 세변의 합). 여러 박스는 각각 따로 신청해 주세요.
                </p>
              </div>
              <div className="px-4 py-4 bg-gray-50">
                <div className="grid grid-cols-1 gap-2">
                  {PICKUP_BOX_SIZES.map((s) => (
                    <button
                      key={s.code}
                      type="button"
                      onClick={() => setBoxSize(s.code)}
                      className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                        boxSize === s.code ? "border-brand-500 bg-brand-50" : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                        boxSize === s.code ? "border-brand-500 bg-brand-500" : "border-gray-300"
                      }`}>
                        {boxSize === s.code && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${boxSize === s.code ? "text-brand-700" : "text-gray-800"}`}>
                          {s.label}
                          <span className="ml-1.5 text-[10px] font-normal text-gray-500">
                            {s.weight}kg · {s.volume}cm
                          </span>
                        </p>
                        <p className="text-[11px] text-gray-500">{s.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 mb-2">
                요청사항 <span className="text-gray-400 font-normal text-xs">(선택)</span>
              </label>
              <textarea
                placeholder={"예) 공용현관 비번: #1234*\n부재 시 경비실에 맡겨주세요"}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-brand-500 transition-colors resize-none"
              />
            </div>
          </>
        )}

        {/* Step 2: 물품 내역 */}
        {showStep(2) && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {isSimple ? (
              <div className="px-4 py-3.5 bg-white border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-800">물품 내역</span>
                  <span className="text-red-500 text-xs font-semibold">*필수</span>
                  <span className="text-xs text-gray-400 font-normal">· 인보이스·마이창고 자동 반영</span>
                  {filledItemCount > 0 && (
                    <span className="text-xs bg-brand-100 text-brand-700 font-medium px-2 py-0.5 rounded-full">
                      {filledItemCount}종
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setItemsOpen(!itemsOpen)}
                className="w-full flex items-center justify-between px-4 py-3.5 bg-white text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-800">물품 내역</span>
                  <span className="text-red-500 text-xs font-semibold">*필수</span>
                  <span className="text-xs text-gray-400 font-normal">· 인보이스·마이창고 자동 반영</span>
                  {itemsOpen && filledItemCount > 0 && (
                    <span className="text-xs bg-brand-100 text-brand-700 font-medium px-2 py-0.5 rounded-full">
                      {filledItemCount}종
                    </span>
                  )}
                </div>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${itemsOpen ? "rotate-180" : ""}`} />
              </button>
            )}

            {(isSimple || itemsOpen) && (
              <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50">
                <div className="grid grid-cols-2 gap-2">
                  {[{ v: "NEW", l: "새 제품", s: "신품·미사용" }, { v: "USED", l: "중고품", s: "사용품·유학생 짐" }].map(opt => (
                    <button key={opt.v} type="button" onClick={() => setItemCondition(opt.v as "NEW" | "USED")}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 transition-all text-left ${
                        itemCondition === opt.v ? "border-brand-500 bg-brand-50" : "border-gray-200 bg-white"}`}>
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        itemCondition === opt.v ? "border-brand-500 bg-brand-500" : "border-gray-300"}`}>
                        {itemCondition === opt.v && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <p className={`text-xs font-semibold ${itemCondition === opt.v ? "text-brand-700" : "text-gray-800"}`}>{opt.l}</p>
                        <p className="text-[10px] text-gray-400">{opt.s}</p>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  {invoiceItems.map((item, idx) => (
                    <div key={item.key} className="bg-white rounded-xl p-3 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-500">품목 {idx + 1}</span>
                        {invoiceItems.length > 1 && (
                          <button type="button" onClick={() => setInvoiceItems(p => p.filter((_, i) => i !== idx))}
                            className="p-1 text-gray-300 hover:text-red-400"><Trash2 size={13} /></button>
                        )}
                      </div>
                      <div className="mb-2 space-y-1.5">
                        <div>
                          <label className="text-[10px] text-gray-400 font-semibold">제품명</label>
                          <input
                            value={item.product_name ?? ""}
                            onChange={e => setInvoiceItems(p => p.map((it, i) => i === idx ? { ...it, product_name: e.target.value } : it))}
                            placeholder="예: 나이키 운동화, 화장품 세트 (선택)"
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 font-semibold">품목 선택 <span className="text-red-400">*</span></label>
                          <ItemCategoryPicker
                            value={item._isCustom ? "Other Goods" : item.name_en}
                            onChange={(cat: ItemCategory) => setInvoiceItems(p => p.map((it, i) =>
                              i === idx ? { ...it, name_en: cat.id === "other" ? "" : cat.name_en, hs_code: cat.hs_code ?? "", _isCustom: cat.id === "other" } : it
                            ))}
                          />
                          {item._isCustom && (
                            <input
                              value={item.name_en}
                              onChange={e => setInvoiceItems(p => p.map((it, i) => i === idx ? { ...it, name_en: e.target.value } : it))}
                              placeholder="품목명 직접 입력 (영문)"
                              className="mt-1.5 w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                              autoFocus
                            />
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-400 font-semibold">수량</label>
                          <div className="flex items-center bg-gray-50 border border-gray-100 rounded-xl overflow-hidden">
                            <button type="button" onClick={() => setInvoiceItems(p => p.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it))}
                              className="px-3 py-2 text-gray-500 font-bold">−</button>
                            <span className="flex-1 text-center text-sm font-semibold">{item.quantity}</span>
                            <button type="button" onClick={() => setInvoiceItems(p => p.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it))}
                              className="px-3 py-2 text-gray-500 font-bold">+</button>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 font-semibold">단가 (USD)</label>
                          <div className="flex items-center bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                            <span className="text-gray-400 text-xs mr-1">$</span>
                            <input type="number" min={0} step={0.01} value={item.unit_price_usd || ""}
                              onChange={e => setInvoiceItems(p => p.map((it, i) => i === idx ? { ...it, unit_price_usd: parseFloat(e.target.value) || 0 } : it))}
                              placeholder="0.00"
                              className="flex-1 bg-transparent text-sm focus:outline-none min-w-0" />
                          </div>
                        </div>
                      </div>
                      <div className="mt-2">
                        <label className="text-[10px] font-semibold flex items-center gap-1">
                          <span className="text-gray-400">HS 코드</span>
                          <span className="text-red-400">*</span>
                          <span className="text-gray-300 font-normal">· 6자리 숫자</span>
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={8}
                          value={item.hs_code}
                          onChange={e => setInvoiceItems(p => p.map((it, i) => i === idx ? { ...it, hs_code: e.target.value.replace(/\D/g, "") } : it))}
                          placeholder="예: 630900"
                          className={`w-full bg-gray-50 border rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-200 ${
                            item.name_en && !item.hs_code ? "border-red-300 bg-red-50" : "border-gray-100"
                          }`}
                        />
                      </div>

                      <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
                        <div>
                          <p className="text-[10px] text-gray-400 font-semibold mb-1.5 flex items-center gap-1">
                            <ScanSearch size={10} className="text-violet-400" /> 검품
                            {isSimple && <span className="text-gray-300 font-normal">· 선택</span>}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {PER_ITEM_INSPECTION.map(opt => {
                              const isActive = item.inspection === opt.code;
                              return (
                                <button
                                  key={opt.code}
                                  type="button"
                                  onClick={() => setInvoiceItems(p => p.map((it, i) =>
                                    i === idx ? { ...it, inspection: isActive ? undefined : opt.code } : it
                                  ))}
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
                                    onClick={() => setInvoiceItems(p => p.map((it, i) => {
                                      if (i !== idx) return it;
                                      const cur = it.specials ?? [];
                                      return { ...it, specials: isActive ? cur.filter(c => c !== opt.code) : [...cur, opt.code] };
                                    }))}
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
                <button type="button"
                  onClick={() => setInvoiceItems(p => [...p, newItem()])}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-brand-300 hover:text-brand-500 transition-colors">
                  <Plus size={14} /> 품목 추가
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 3 또는 고급모드: 확인·옵션 */}
        {(showStep(3) || !isSimple) && (
          <>
            {isSimple && showStep(3) && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-bold text-gray-800">입력 내용 확인</p>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold">수거 주소</p>
                    <p className="text-gray-800">{pickupAddress?.address}</p>
                    {pickupAddress?.addressDetail && (
                      <p className="text-xs text-gray-500">{pickupAddress.addressDetail}</p>
                    )}
                    <p className="text-xs text-gray-500">{pickupAddress?.phone}</p>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <p className="text-[10px] text-gray-400 font-semibold">수거 희망일</p>
                      <p className="text-gray-800">{formatDateLabel(pickupDate)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-semibold">박스</p>
                      <p className="text-gray-800">{selectedBox?.label ?? boxSize}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold">물품</p>
                    <p className="text-gray-800">
                      {itemCondition === "NEW" ? "새 제품" : "중고품"} · {filledItemCount}종
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {invoiceItems.filter(i => i.name_en.trim()).map(item => (
                        <li key={item.key} className="text-xs text-gray-600">
                          · {item.product_name || item.name_en} × {item.quantity}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {notes.trim() && (
                    <div>
                      <p className="text-[10px] text-gray-400 font-semibold">요청사항</p>
                      <p className="text-xs text-gray-600 whitespace-pre-wrap">{notes}</p>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-brand-600 font-semibold"
                >
                  수정하기
                </button>
              </div>
            )}

            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Info className="w-4 h-4 text-gray-500 shrink-0" />
                <p className="text-xs font-bold text-gray-600">서비스 안내</p>
              </div>
              <ul className="space-y-1.5">
                {[
                  "수거 후 물품이 인프론트 물류센터로 입고됩니다.",
                  "입고 후 검수(사진·영상)를 진행하고 결과를 알려드립니다.",
                  "국제 배송비는 실측 무게 확인 후 견적을 안내해드립니다.",
                  "발송 불가 물품(위험물, 반출금지 등)은 입고 거절될 수 있습니다.",
                  "수거 취소는 수거 전날까지 고객센터로 요청해주세요.",
                ].map((txt, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-500">
                    <span className="mt-0.5 w-1 h-1 rounded-full bg-gray-400 shrink-0" />
                    {txt}
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={() => setAgreed(!agreed)}
              className={`flex items-start gap-3 w-full text-left p-4 rounded-xl border-2 transition-colors ${
                agreed ? "border-brand-600 bg-brand-50" : "border-gray-200 bg-white"
              }`}
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                agreed ? "bg-brand-600 border-brand-600" : "border-gray-300"
              }`}>
                {agreed && <CheckCircle className="w-3.5 h-3.5 text-white" />}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">
                위 서비스 안내 내용을 확인하였으며,{" "}
                <span className="font-bold text-brand-600">입고 후 국제 배송비 결제</span>에 동의합니다.
                <span className="text-red-400 ml-1">*필수</span>
              </p>
            </button>
          </>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </form>

      {/* 하단 버튼 */}
      <div className="sticky bg-white border-t border-gray-100 px-4 py-3" style={{ bottom: "calc(60px + var(--sab, 0px))" }}>
        {isSimple && step < 3 ? (
          <div className="flex gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => { setStep(s => s - 1); setError(""); }}
                className="flex-1 py-4 rounded-xl text-sm font-bold border border-gray-200 text-gray-700 active:bg-gray-50"
              >
                이전
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              className={`${step > 1 ? "flex-[2]" : "w-full"} flex items-center justify-center gap-1.5 py-4 rounded-xl text-sm font-bold bg-brand-600 text-white active:opacity-80`}
            >
              다음
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="submit"
            form=""
            disabled={loading || !agreed}
            onClick={handleSubmit}
            className={`w-full py-4 rounded-xl text-sm font-bold transition-colors ${
              agreed && !loading
                ? "bg-brand-600 text-white active:opacity-80"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            {loading ? "수거 신청 중..." : "수거 신청하기"}
          </button>
        )}
      </div>
    </div>
  );
}
