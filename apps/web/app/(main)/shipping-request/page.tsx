"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Package, Globe, Shield, Box,
  Plus, Trash2, CheckCircle, Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import OverseasAddressPicker, { OverseasAddressValue, COUNTRIES } from "@/components/ui/OverseasAddressPicker";

// ── 타입 ────────────────────────────────────────────────────
interface PreInvoiceItem {
  name_en: string;
  quantity: number;
  unit_price_usd: number;
  hs_code?: string;
  origin_country: string;
}

interface Parcel {
  id: string;
  tracking_no: string | null;
  sender_name: string | null;
  sender_address: string | null;
  status: string;
  weight_actual: number | null;
  notes: string | null;
  pre_invoice_items: PreInvoiceItem[] | null;
}

// 아이템 선택 단위 (parcel 내 개별 내품)
interface SelectableItem {
  key: string;           // `${parcelId}__${itemIndex}`
  parcelId: string;
  itemIndex: number;
  parcelTracking: string | null;
  parcelSender: string | null;
  name_en: string;
  quantity: number;
  unit_price_usd: number;
  hs_code: string;
  origin_country: string;
}

interface InvoiceItem {
  key: string;
  name_en: string;
  quantity: number;
  unit_price_usd: number;
  hs_code: string;
  origin_country: string;
}

// 박스별 구성 (Step 0.5)
interface BoxSetup {
  id: number;
  address: OverseasAddressValue | null;
  itemKeys: string[];
}

// ── 상수 ────────────────────────────────────────────────────
const SHIPPING_METHODS = [
  { code: "EMS",         name: "EMS",         desc: "일반 국제우편 · 3-7일",  premiumcd: "31", em_ee: "em", badge: "bg-blue-600" },
  { code: "EMS_PREMIUM", name: "EMS 프리미엄", desc: "빠른 국제우편 · 2-4일", premiumcd: "32", em_ee: "em", badge: "bg-violet-600" },
  { code: "KPACKET",     name: "K-Packet",    desc: "소형 경량 · 7-15일 · 2kg 이하", premiumcd: "14", em_ee: "rl", badge: "bg-emerald-600" },
] as const;

const PACKAGING_OPTS = [
  { code: "safe_pack",  name: "안전포장",  desc: "에어캡, 완충재 추가",      price: 3000 },
  { code: "repack",     name: "재포장",    desc: "새 박스로 교체",            price: 2000 },
  { code: "consolidate",name: "합포장",    desc: "선택 물품을 하나로 합치기", price: 2000 },
] as const;

const STEP_LABELS = ["물품 확인", "배송 옵션", "해외 배송지", "인보이스", "견적 확인"];

function newItem(): InvoiceItem {
  return { key: Math.random().toString(36).slice(2), name_en: "", quantity: 1, unit_price_usd: 0, hs_code: "", origin_country: "KR" };
}

// 출고 가능 상태
const SHIPPABLE_STATUSES = ["INBOUND", "INSPECTION"];

// ── 메인 컴포넌트 ─────────────────────────────────────────────
function ShippingRequestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlParcelIds = useMemo(() => searchParams.get("parcels")?.split(",").filter(Boolean) ?? [], [searchParams]);

  // Step 0: 내품 선택 (URL에 parcels 없을 때)
  const [step0Done, setStep0Done] = useState(urlParcelIds.length > 0);
  const [selectedItemKeys, setSelectedItemKeys] = useState<Set<string>>(new Set());
  const [shippableParcels, setShippableParcels] = useState<Parcel[]>([]);
  const [step0Loading, setStep0Loading] = useState(false);

  // Step 0.5: 박스 구성
  const [step05Active, setStep05Active] = useState(false);
  const [boxes, setBoxes] = useState<BoxSetup[]>([{ id: 1, address: null, itemKeys: [] }]);
  const [expandedBoxAddress, setExpandedBoxAddress] = useState<number | null>(null);
  const [defaultOverseasAddress, setDefaultOverseasAddress] = useState<OverseasAddressValue | null>(null);

  // URL로 들어온 경우 parcelIds 직접 사용, Step 0 거친 경우 선택된 아이템의 parcelId 집합
  const parcelIds = useMemo(() => {
    if (urlParcelIds.length > 0) return urlParcelIds;
    if (!step0Done) return [];
    const ids = new Set<string>();
    for (const b of boxes) {
      for (const key of b.itemKeys) {
        ids.add(key.split("__")[0]);
      }
    }
    return Array.from(ids);
  }, [urlParcelIds, step0Done, boxes]);

  const [step, setStep] = useState(1);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);

  // Step 2
  const [shippingMethod, setShippingMethod] = useState<"EMS" | "EMS_PREMIUM" | "KPACKET">("EMS");
  const [packOpts, setPackOpts] = useState({ safe_pack: false, repack: false, consolidate: false });
  const [packNote, setPackNote] = useState("");

  // Step 3 — OverseasAddressPicker
  const [overseasAddress, setOverseasAddress] = useState<OverseasAddressValue | null>(null);

  // Step 4
  const [items, setItems] = useState<InvoiceItem[]>([newItem()]);

  // Step 5
  const [estimatedFee, setEstimatedFee] = useState<number | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Step 0: 출고 가능 물품 목록 + 기본 해외배송지 로드
  useEffect(() => {
    if (step0Done) return;
    setStep0Loading(true);
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setCustomerId(user.id);

      const [{ data: parcelData }, { data: addrData }] = await Promise.all([
        supabase
          .from("parcels")
          .select("id, tracking_no, sender_name, sender_address, status, weight_actual, notes, pre_invoice_items")
          .eq("customer_id", user.id)
          .in("status", SHIPPABLE_STATUSES)
          .order("inbound_at", { ascending: false }),
        supabase
          .from("customer_addresses")
          .select("id, label, name, phone, country_code, overseas_addr1, overseas_addr2, overseas_addr3, overseas_zip, email, is_default")
          .eq("customer_id", user.id)
          .eq("type", "overseas")
          .order("is_default", { ascending: false })
          .limit(5),
      ]);

      setShippableParcels(parcelData ?? []);

      // 기본 해외 배송지 설정
      const defaultAddr = (addrData ?? []).find((a) => a.is_default) ?? addrData?.[0];
      if (defaultAddr) {
        setDefaultOverseasAddress({
          savedId: defaultAddr.id,
          label: defaultAddr.label,
          name: defaultAddr.name,
          phone: defaultAddr.phone ?? "",
          countryCode: defaultAddr.country_code,
          addr1: defaultAddr.overseas_addr1 ?? "",
          addr2: defaultAddr.overseas_addr2 ?? "",
          addr3: defaultAddr.overseas_addr3 ?? "",
          zip: defaultAddr.overseas_zip ?? "",
          email: defaultAddr.email ?? "",
        });
      }

      setStep0Loading(false);
    });
  }, [step0Done]);

  // parcel 목록 → 개별 내품 아이템 목록으로 플랫화 (Step 0 완료 버튼보다 먼저 선언)
  const selectableItems = useMemo<SelectableItem[]>(() => {
    const result: SelectableItem[] = [];
    for (const p of shippableParcels) {
      const items = p.pre_invoice_items;
      if (items && items.length > 0) {
        items.forEach((item, idx) => {
          result.push({
            key: `${p.id}__${idx}`,
            parcelId: p.id,
            itemIndex: idx,
            parcelTracking: p.tracking_no,
            parcelSender: p.sender_address ?? p.sender_name,
            name_en: item.name_en,
            quantity: item.quantity,
            unit_price_usd: item.unit_price_usd,
            hs_code: item.hs_code ?? "",
            origin_country: item.origin_country,
          });
        });
      } else {
        // pre_invoice_items 없으면 parcel 자체를 하나의 아이템으로 표시
        result.push({
          key: `${p.id}__0`,
          parcelId: p.id,
          itemIndex: 0,
          parcelTracking: p.tracking_no,
          parcelSender: p.sender_address ?? p.sender_name,
          name_en: p.notes ?? p.tracking_no ?? "\ubb3c\ud488",
          quantity: 1,
          unit_price_usd: 0,
          hs_code: "",
          origin_country: "KR",
        });
      }
    }
    return result;
  }, [shippableParcels]);

  // Step 0 → Step 0.5: 선택된 아이템을 박스 1로 초기화, 기본 해외배송지 적용
  const handleStep0Confirm = useCallback(() => {
    const keys = Array.from(selectedItemKeys);
    setBoxes([{ id: 1, address: defaultOverseasAddress, itemKeys: keys }]);
    setStep05Active(true);
  }, [selectedItemKeys, defaultOverseasAddress]);

  // Step 0.5: 박스 개수 변경 (새 박스는 기본 해외배송지 적용)
  const handleBoxCountChange = useCallback((count: number) => {
    setBoxes((prev) => {
      const allKeys = prev.flatMap((b) => b.itemKeys);
      const newBoxes: BoxSetup[] = Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        address: prev[i]?.address ?? defaultOverseasAddress,
        itemKeys: prev[i]?.itemKeys ?? [],
      }));
      // 줄어든 박스의 아이템을 박스 1로 이동
      if (count < prev.length) {
        const keepKeys = new Set(newBoxes.flatMap((b) => b.itemKeys));
        const overflow = allKeys.filter((k) => !keepKeys.has(k));
        newBoxes[0].itemKeys = [...newBoxes[0].itemKeys, ...overflow];
      }
      return newBoxes;
    });
  }, [defaultOverseasAddress]);

  // Step 0.5: 아이템을 다른 박스로 이동
  const moveItemToBox = useCallback((itemKey: string, targetBoxId: number) => {
    setBoxes((prev) =>
      prev.map((b) => ({
        ...b,
        itemKeys:
          b.id === targetBoxId
            ? b.itemKeys.includes(itemKey) ? b.itemKeys : [...b.itemKeys, itemKey]
            : b.itemKeys.filter((k) => k !== itemKey),
      }))
    );
  }, []);

  // Step 0.5 완료 → 실제 Step 1 시작
  const handleStep05Confirm = useCallback(() => {
    // 인보이스 초기화: 박스 1의 아이템 기준 (다중 박스는 각자 처리)
    const allSelectedKeys = boxes.flatMap((b) => b.itemKeys);
    const preItems = selectableItems
      .filter((it) => allSelectedKeys.includes(it.key))
      .map((it) => ({
        key: it.key,
        name_en: it.name_en,
        quantity: it.quantity,
        unit_price_usd: it.unit_price_usd,
        hs_code: it.hs_code,
        origin_country: it.origin_country,
      }));
    if (preItems.length > 0) setItems(preItems);
    // Step 3 주소를 박스 1 주소로 초기화
    if (boxes[0]?.address) setOverseasAddress(boxes[0].address);
    setStep05Active(false);
    setStep0Done(true);
  }, [boxes, selectableItems]);

  // 물품 로드 (Step 0 완료 후)
  useEffect(() => {
    if (!step0Done || parcelIds.length === 0) return;
    setLoading(true);
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCustomerId(user.id);
    });
    supabase
      .from("parcels")
      .select("id, tracking_no, sender_name, sender_address, status, weight_actual, notes, pre_invoice_items")
      .in("id", parcelIds)
      .then(({ data }) => {
        setParcels((data ?? []) as Parcel[]);
        setLoading(false);
      });
  }, [step0Done, parcelIds]);

  // EMS 견적 조회
  const fetchQuote = useCallback(async () => {
    const countrycd = overseasAddress?.countryCode;
    if (!countrycd) return;

    const totalWeightG = parcels.reduce((sum, p) => sum + (p.weight_actual ?? 500), 0);
    const method = SHIPPING_METHODS.find((m) => m.code === shippingMethod)!;

    setQuoteLoading(true);
    try {
      const res = await fetch(
        `/api/ems/quote?premiumcd=${method.premiumcd}&em_ee=${method.em_ee}&countrycd=${countrycd}&totweight=${totalWeightG}`
      );
      const data = await res.json();
      setEstimatedFee(data.fee ? parseInt(data.fee, 10) : null);
    } catch {
      setEstimatedFee(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [overseasAddress, parcels, shippingMethod]);

  useEffect(() => {
    if (step === 5) fetchQuote();
  }, [step, fetchQuote]);

  // ── 계산 ──────────────────────────────────────────────────
  const packagingFee = PACKAGING_OPTS.filter((o) => packOpts[o.code as keyof typeof packOpts]).reduce((s, o) => s + o.price, 0);
  const totalAmount = (estimatedFee ?? 0) + packagingFee;
  const customsValue = items.reduce((s, i) => s + i.unit_price_usd * i.quantity, 0);
  const totalWeightKg = parcels.reduce((s, p) => s + (p.weight_actual ?? 0), 0) / 1000;

  const country = overseasAddress
    ? COUNTRIES.find((c) => c.code === overseasAddress.countryCode)
    : null;

  // ── 유효성 검사 ───────────────────────────────────────────
  function canProceed(): boolean {
    if (step === 3) {
      return !!(overseasAddress?.name?.trim() && overseasAddress?.addr3?.trim());
    }
    if (step === 4) {
      return items.every((i) => i.name_en.trim() && i.quantity > 0 && i.unit_price_usd >= 0);
    }
    return true;
  }

  // ── 주문 제출 ─────────────────────────────────────────────
  async function submit() {
    if (!overseasAddress) return;
    setSubmitting(true);
    setError("");
    try {
      const addr = {
        country_code: overseasAddress.countryCode,
        name: overseasAddress.name,
        phone: overseasAddress.phone || undefined,
        overseas_addr1: overseasAddress.addr1,
        overseas_addr2: overseasAddress.addr2,
        overseas_addr3: overseasAddress.addr3,
        overseas_zip: overseasAddress.zip || undefined,
        email: overseasAddress.email || undefined,
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parcel_ids: parcelIds,
          shipping_method: shippingMethod,
          packaging_options: { ...packOpts, note: packNote },
          overseas_address: addr,
          item_list: items.map(({ key: _k, ...rest }) => rest),
          estimated_shipping_fee: estimatedFee ?? 0,
          packaging_fee: packagingFee,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "주문 생성 실패");
      router.push(`/orders?new=${data.order_no}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step 0.5: 박스 구성 ───────────────────────────────────────
  if (step05Active) {
    const allSelectedItems = selectableItems.filter((it) =>
      boxes.some((b) => b.itemKeys.includes(it.key))
    );

    return (
      <div className="min-h-screen bg-gray-50 pb-40">
        <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="max-w-[600px] mx-auto flex items-center gap-3 px-4 py-3">
            <button onClick={() => setStep05Active(false)} className="p-1 -ml-1">
              <ArrowLeft size={22} className="text-gray-700" />
            </button>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">{"\ubc15\uc2a4 \uad6c\uc131"}</p>
              <p className="text-xs text-gray-400">{"\uba87 \ubc15\uc2a4\ub85c \ub098\ub220\uc11c \ubcf4\ub0bc\uc9c0 \uc124\uc815\ud558\uc138\uc694"}</p>
            </div>
          </div>
        </div>

        <div className="max-w-[600px] mx-auto px-4 pt-5 space-y-5 pb-40">
          {/* 박스 개수 선택 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-bold text-gray-900 mb-3">{"\ubc15\uc2a4 \uac1c\uc218"}</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => handleBoxCountChange(n)}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                    boxes.length === n
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-100 bg-white text-gray-500"
                  }`}
                >
                  {n}{"\ubc15\uc2a4"}
                </button>
              ))}
            </div>
          </div>

          {/* 박스별 설정 */}
          {boxes.map((box) => {
            const boxItems = allSelectedItems.filter((it) => box.itemKeys.includes(it.key));
            const otherBoxIds = boxes.filter((b) => b.id !== box.id).map((b) => b.id);
            const isAddressOpen = expandedBoxAddress === box.id;

            return (
              <div key={box.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                {/* 박스 헤더 */}
                <div className="flex items-center justify-between px-4 py-3 bg-blue-600">
                  <div className="flex items-center gap-2">
                    <Package size={16} className="text-white" />
                    <p className="text-sm font-bold text-white">{box.id}{"\ubc88 \ubc15\uc2a4"}</p>
                    <span className="text-xs text-blue-200">{boxItems.length}{"\uac1c \ub0b4\ud488"}</span>
                  </div>
                  <button
                    onClick={() => setExpandedBoxAddress(isAddressOpen ? null : box.id)}
                    className="flex items-center gap-1 text-xs text-white/80 bg-white/20 px-2.5 py-1 rounded-full"
                  >
                    <Globe size={11} />
                    {box.address
                      ? (box.address.label ?? box.address.name)
                      : defaultOverseasAddress
                      ? `${"\uae30\ubcf8"} (${defaultOverseasAddress.label ?? defaultOverseasAddress.name})`
                      : "\ubc30\uc1a1\uc9c0 \uc124\uc815"}
                  </button>
                </div>

                {/* 주소 피커 (펼침) */}
                {isAddressOpen && (
                  <div className="px-4 py-4 bg-blue-50 border-b border-blue-100">
                    <OverseasAddressPicker
                      value={box.address}
                      onChange={(addr) =>
                        setBoxes((prev) =>
                          prev.map((b) => b.id === box.id ? { ...b, address: addr } : b)
                        )
                      }
                      customerId={customerId}
                    />
                  </div>
                )}

                {/* 내품 목록 */}
                <div className="divide-y divide-gray-50">
                  {boxItems.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-5">{"\uc774 \ubc15\uc2a4\uc5d0 \ubc30\uc815\ub41c \ub0b4\ud488\uc774 \uc5c6\uc5b4\uc694"}</p>
                  ) : (
                    boxItems.map((item) => (
                      <div key={item.key} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.name_en}</p>
                          <p className="text-xs text-gray-400">
                            {item.quantity}{"\uac1c"}
                            {item.unit_price_usd > 0 ? ` \u00b7 $${item.unit_price_usd}` : ""}
                          </p>
                        </div>
                        {/* 다른 박스로 이동 */}
                        {otherBoxIds.length > 0 && (
                          <div className="flex gap-1 shrink-0">
                            {otherBoxIds.map((bid) => (
                              <button
                                key={bid}
                                onClick={() => moveItemToBox(item.key, bid)}
                                className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg"
                              >
                                {"\u2192"}{bid}{"\ubc15\uc2a4"}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 확인 버튼 */}
        <div className="fixed bottom-20 left-0 right-0 px-4 z-40">
          <div className="max-w-[600px] mx-auto">
            <button
              onClick={handleStep05Confirm}
              disabled={boxes.every((b) => b.itemKeys.length === 0)}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 disabled:opacity-40 active:scale-[0.98] transition-transform"
            >
              <CheckCircle size={16} />
              {boxes.length}{"\ubc15\uc2a4 \uad6c\uc131 \uc644\ub8cc"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 0: 내품 선택 ─────────────────────────────────────────
  if (!step0Done) {
    // parcel별로 아이템 그룹화 (표시용)
    const parcelGroups = shippableParcels.map((p) => ({
      parcel: p,
      items: selectableItems.filter((it) => it.parcelId === p.id),
    }));

    const totalSelected = selectedItemKeys.size;
    const allKeys = selectableItems.map((it) => it.key);
    const allSelected = allKeys.length > 0 && allKeys.every((k) => selectedItemKeys.has(k));

    return (
      <div className="min-h-screen bg-gray-50 pb-32">
        {/* 헤더 */}
        <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="max-w-[600px] mx-auto flex items-center gap-3 px-4 py-3">
            <button onClick={() => router.back()} className="p-1 -ml-1">
              <ArrowLeft size={22} className="text-gray-700" />
            </button>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">{"\ucd9c\uace0\uc2e0\uccad"}</p>
              <p className="text-xs text-gray-400">{"\ud574\uc678\ub85c \ubcf4\ub0bc \ub0b4\ud488\uc744 \uc120\ud0dd\ud574\uc8fc\uc138\uc694"}</p>
            </div>
            {selectableItems.length > 0 && (
              <button
                onClick={() =>
                  setSelectedItemKeys(
                    allSelected ? new Set() : new Set(allKeys)
                  )
                }
                className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-all ${
                  allSelected
                    ? "text-blue-600 bg-blue-50 border-blue-300"
                    : "text-gray-500 bg-white border-gray-200"
                }`}
              >
                {allSelected ? "\uc120\ud0dd\ud574\uc81c" : "\uc804\uccb4\uc120\ud0dd"}
              </button>
            )}
            {totalSelected > 0 && (
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                {totalSelected}{"\uac1c"}
              </span>
            )}
          </div>
        </div>

        <div className="max-w-[600px] mx-auto px-4 pt-4 space-y-4 pb-32">
          {step0Loading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={28} className="animate-spin text-blue-500" />
            </div>
          ) : shippableParcels.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
              <Package size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-500">{"\ucd9c\uace0 \uac00\ub2a5\ud55c \ubb3c\ud488\uc774 \uc5c6\uc2b5\ub2c8\ub2e4"}</p>
              <p className="text-xs text-gray-400 mt-1">{"\uc785\uace0 \uc644\ub8cc\ub41c \ubb3c\ud488\uc774 \uc5c6\uc73c\uba74 \ucd9c\uace0\uc2e0\uccad\uc744 \ud560 \uc218 \uc5c6\uc5b4\uc694"}</p>
              <button
                onClick={() => router.push("/warehouse")}
                className="mt-5 bg-blue-600 text-white text-sm font-bold px-6 py-3 rounded-2xl"
              >
                {"\ub9c8\uc774\ucc3d\uace0 \ubcf4\uae30"}
              </button>
            </div>
          ) : (
            parcelGroups.map(({ parcel: p, items }) => {
              const allChecked = items.every((it) => selectedItemKeys.has(it.key));
              const someChecked = items.some((it) => selectedItemKeys.has(it.key));

              return (
                <div key={p.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                  {/* 택배 박스 헤더 */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <button
                      onClick={() =>
                        setSelectedItemKeys((prev) => {
                          const next = new Set(prev);
                          if (allChecked) {
                            items.forEach((it) => next.delete(it.key));
                          } else {
                            items.forEach((it) => next.add(it.key));
                          }
                          return next;
                        })
                      }
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                        allChecked
                          ? "bg-blue-600 border-blue-600"
                          : someChecked
                          ? "bg-blue-200 border-blue-400"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      {(allChecked || someChecked) && (
                        <span className="text-white text-xs font-bold">{allChecked ? "✓" : "–"}</span>
                      )}
                    </button>
                    <Package size={15} className="text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700 truncate">
                        {p.tracking_no ?? "\uc1a1\uc7a5\ubc88\ud638 \ubbf8\ub4f1\ub85d"}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {p.sender_address ?? p.sender_name ?? "\ubc1c\uc1a1\uc778 \ubbf8\ud655\uc778"}
                        {p.weight_actual ? ` \u00b7 ${(p.weight_actual / 1000).toFixed(2)}kg` : ""}
                      </p>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                      p.status === "INSPECTION"
                        ? "text-purple-700 bg-purple-50 border-purple-200"
                        : "text-green-700 bg-green-50 border-green-200"
                    }`}>
                      {p.status === "INSPECTION" ? "\uac80\ud488\uc911" : "\uc785\uace0\uc644\ub8cc"}
                    </span>
                  </div>

                  {/* 내품 목록 */}
                  <div className="divide-y divide-gray-50">
                    {items.map((item) => {
                      const checked = selectedItemKeys.has(item.key);
                      return (
                        <button
                          key={item.key}
                          onClick={() =>
                            setSelectedItemKeys((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.key)) next.delete(item.key);
                              else next.add(item.key);
                              return next;
                            })
                          }
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                            checked ? "bg-blue-50" : "bg-white hover:bg-gray-50"
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                            checked ? "bg-blue-600 border-blue-600" : "border-gray-300"
                          }`}>
                            {checked && <span className="text-white text-xs font-bold">✓</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{item.name_en}</p>
                            <p className="text-xs text-gray-400">
                              {item.quantity}{"\uac1c"}
                              {item.unit_price_usd > 0 ? ` \u00b7 $${item.unit_price_usd}` : ""}
                              {item.origin_country && item.origin_country !== "KR" ? ` \u00b7 ${item.origin_country}` : ""}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 하단 확인 버튼 */}
        {totalSelected > 0 && (
          <div className="fixed bottom-20 left-0 right-0 px-4 z-40">
            <div className="max-w-[600px] mx-auto">
              <button
                onClick={handleStep0Confirm}
                className="w-full flex items-center justify-center gap-2.5 bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 text-sm active:scale-[0.98] transition-transform"
              >
                <Globe size={16} />
                {totalSelected}{"\uac1c \ub0b4\ud488 \ucd9c\uace0\uc2e0\uccad\ud558\uae30"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-[600px] mx-auto flex items-center gap-3 px-4 py-3">
          <button onClick={() => (step === 1 ? router.back() : setStep(step - 1))} className="p-1 -ml-1">
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <div className="flex-1">
            <p className="text-xs text-gray-400">Step {step} / {STEP_LABELS.length}</p>
            <p className="text-sm font-bold text-gray-900">{STEP_LABELS[step - 1]}</p>
          </div>
        </div>
        {/* 진행 바 */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${(step / STEP_LABELS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="max-w-[600px] mx-auto px-4 pt-5 space-y-4">

        {/* ── Step 1: 물품 확인 ─────────────────────────────── */}
        {step === 1 && (
          <>
            <div className="bg-blue-50 rounded-2xl p-4">
              <p className="text-xs text-blue-700 font-semibold mb-1">선택한 물품 {parcels.length}개</p>
              {totalWeightKg > 0 ? (
                <p className="text-xs text-blue-600">총 예상 무게: {totalWeightKg.toFixed(2)}kg (실측 후 확정)</p>
              ) : (
                <p className="text-xs text-blue-600">무게는 창고 검수 후 확정됩니다</p>
              )}
            </div>
            <div className="space-y-2">
              {parcels.map((p) => (
                <div key={p.id} className="bg-white rounded-xl p-4 flex items-center gap-3 shadow-sm">
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                    <Package size={18} className="text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {p.tracking_no ?? "송장번호 미등록"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {p.sender_name ?? "발송인 미확인"}
                      {p.notes ? ` · ${p.notes}` : ""}
                    </p>
                  </div>
                  {p.weight_actual ? (
                    <span className="text-xs text-gray-500 shrink-0">{(p.weight_actual / 1000).toFixed(2)}kg</span>
                  ) : (
                    <span className="text-xs text-gray-300 shrink-0">미측정</span>
                  )}
                </div>
              ))}
            </div>
            <div className="bg-amber-50 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-700 leading-relaxed">
                실제 배송비는 물품 입고 후 실측 무게 기준으로 확정됩니다.
                지금 입력하는 정보를 바탕으로 사전 견적을 안내해드립니다.
              </p>
            </div>
          </>
        )}

        {/* ── Step 2: 배송 옵션 ─────────────────────────────── */}
        {step === 2 && (
          <>
            <p className="text-sm font-bold text-gray-800">배송 방법 선택</p>
            <div className="space-y-2">
              {SHIPPING_METHODS.map((m) => (
                <button
                  key={m.code}
                  onClick={() => setShippingMethod(m.code)}
                  className={`w-full text-left flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                    shippingMethod === m.code
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-100 bg-white"
                  }`}
                >
                  <span className={`text-xs text-white font-bold px-2.5 py-1 rounded-lg ${m.badge}`}>
                    {m.name}
                  </span>
                  <p className="text-xs text-gray-500">{m.desc}</p>
                  {shippingMethod === m.code && <CheckCircle size={16} className="text-blue-500 ml-auto shrink-0" />}
                </button>
              ))}
            </div>

            <p className="text-sm font-bold text-gray-800 pt-2">포장 옵션 (선택)</p>
            <div className="space-y-2">
              {PACKAGING_OPTS.map((o) => {
                const checked = packOpts[o.code as keyof typeof packOpts];
                return (
                  <button
                    key={o.code}
                    onClick={() => setPackOpts((p) => ({ ...p, [o.code]: !p[o.code as keyof typeof packOpts] }))}
                    className={`w-full text-left flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                      checked ? "border-blue-500 bg-blue-50" : "border-gray-100 bg-white"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                      checked ? "bg-blue-600 border-blue-600" : "border-gray-300"
                    }`}>
                      {checked && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">{o.name}</p>
                      <p className="text-xs text-gray-400">{o.desc}</p>
                    </div>
                    <span className="text-xs font-semibold text-blue-600 shrink-0">
                      +{o.price.toLocaleString()}원
                    </span>
                  </button>
                );
              })}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">요청 메모 (선택)</label>
              <textarea
                value={packNote}
                onChange={(e) => setPackNote(e.target.value)}
                rows={3}
                placeholder="포장 관련 특별 요청사항을 입력해주세요"
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </>
        )}

        {/* ── Step 3: 해외 배송지 ───────────────────────────── */}
        {step === 3 && (
          <>
            <p className="text-sm text-gray-500">수취인 주소를 선택하거나 새로 입력해주세요</p>
            <OverseasAddressPicker
              value={overseasAddress}
              onChange={setOverseasAddress}
              customerId={customerId}
            />
          </>
        )}

        {/* ── Step 4: 인보이스 ──────────────────────────────── */}
        {step === 4 && (
          <>
            <div className="bg-amber-50 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-700 leading-relaxed">
                세관 신고를 위한 물품 내역입니다. <strong>영문으로</strong> 입력해주세요.
                실제 가격을 정확히 기재해주세요 (USD 기준).
              </p>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={item.key} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-gray-500">물품 {idx + 1}</span>
                    {items.length > 1 && (
                      <button
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">품목명 (영문) *</label>
                      <input
                        value={item.name_en}
                        onChange={(e) => setItems((p) => p.map((it, i) => i === idx ? { ...it, name_en: e.target.value } : it))}
                        placeholder="e.g. Clothing, Cosmetics, Electronics"
                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">수량 *</label>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => setItems((p) => p.map((it, i) => i === idx ? { ...it, quantity: parseInt(e.target.value) || 1 } : it))}
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">단가 (USD) *</label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.unit_price_usd}
                          onChange={(e) => setItems((p) => p.map((it, i) => i === idx ? { ...it, unit_price_usd: parseFloat(e.target.value) || 0 } : it))}
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">HS코드 (선택)</label>
                        <input
                          value={item.hs_code}
                          onChange={(e) => setItems((p) => p.map((it, i) => i === idx ? { ...it, hs_code: e.target.value } : it))}
                          placeholder="6단위"
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">원산지 (선택)</label>
                        <input
                          value={item.origin_country}
                          onChange={(e) => setItems((p) => p.map((it, i) => i === idx ? { ...it, origin_country: e.target.value } : it))}
                          placeholder="KR"
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setItems((p) => [...p, newItem()])}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              <Plus size={15} /> 물품 추가
            </button>

            <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-600">총 신고 금액</span>
              <span className="text-sm font-bold text-gray-900">USD {customsValue.toFixed(2)}</span>
            </div>
          </>
        )}

        {/* ── Step 5: 견적 확인 ─────────────────────────────── */}
        {step === 5 && (
          <>
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
              <p className="text-sm font-bold text-gray-800">주문 요약</p>

              {/* 물품 */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 flex items-center gap-1.5"><Package size={14} /> 물품</span>
                <span className="font-semibold text-gray-800">{parcels.length}개</span>
              </div>

              {/* 배송 방법 */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 flex items-center gap-1.5"><Globe size={14} /> 배송 방법</span>
                <span className="font-semibold text-gray-800">
                  {SHIPPING_METHODS.find((m) => m.code === shippingMethod)?.name}
                </span>
              </div>

              {/* 배송지 */}
              <div className="flex items-start justify-between text-sm gap-4">
                <span className="text-gray-500 shrink-0">수취인</span>
                <div className="text-right">
                  <p className="font-semibold text-gray-800">
                    {country?.flag} {overseasAddress?.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {overseasAddress?.addr3}
                  </p>
                </div>
              </div>

              {/* 포장 옵션 */}
              {Object.entries(packOpts).some(([, v]) => v) && (
                <div className="flex items-start justify-between text-sm gap-4">
                  <span className="text-gray-500 flex items-center gap-1.5 shrink-0"><Box size={14} /> 포장 옵션</span>
                  <div className="text-right">
                    {PACKAGING_OPTS.filter((o) => packOpts[o.code as keyof typeof packOpts]).map((o) => (
                      <p key={o.code} className="text-xs text-gray-600">{o.name}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* 인보이스 */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 flex items-center gap-1.5"><Shield size={14} /> 세관 신고액</span>
                <span className="font-semibold text-gray-800">USD {customsValue.toFixed(2)}</span>
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">예상 배송비</span>
                  {quoteLoading ? (
                    <Loader2 size={14} className="animate-spin text-gray-400" />
                  ) : (
                    <span className="font-semibold text-gray-800">
                      {estimatedFee != null ? `${estimatedFee.toLocaleString()}원` : "확인 중..."}
                    </span>
                  )}
                </div>
                {packagingFee > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">포장 서비스</span>
                    <span className="font-semibold text-gray-800">+{packagingFee.toLocaleString()}원</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-sm font-bold text-gray-900">예상 합계</span>
                  <span className="text-base font-bold text-blue-600">
                    {totalAmount > 0 ? `${totalAmount.toLocaleString()}원` : "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-700 leading-relaxed">
                실제 요금은 창고 입고 후 실측 무게 기준으로 확정되며, 견적 확인 후 결제하실 수 있습니다.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 rounded-xl px-4 py-3">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 z-30">
        <div className="max-w-[600px] mx-auto">
          {step < 5 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-4 rounded-2xl disabled:opacity-40 transition-opacity"
            >
              다음 단계 <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-4 rounded-2xl disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              {submitting ? "신청 중..." : "해외배송 신청하기"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShippingRequestPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    }>
      <ShippingRequestContent />
    </Suspense>
  );
}
