"use client";

import { useEffect, useState, useMemo, useCallback, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Package, Globe,
  Plus, Trash2, CheckCircle, Loader2, ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isParcelShippable } from "@/lib/parcel-shippable";
import { CARD_THEME_MAP } from "@/app/(main)/storage/constants";
import OverseasAddressPicker, { OverseasAddressValue } from "@/components/ui/OverseasAddressPicker";
import { useFlowMode } from "@/lib/flow-mode";
import { parcelIdsInActiveOrders } from "@/lib/order-reservation";
import { usdToBoprcKrw } from "@/lib/ems/insurance";
import { useEmsExchangeRate } from "@/lib/hooks/useEmsExchangeRate";
import {
  EMS_PREMIUM_CARRIER,
  EMS_PREMIUM_INSURANCE_NOTE,
  EMS_PREMIUM_LIMITS,
} from "@/lib/ems/premium-config";
import {
  calculateDutyDeposit,
  isDdpCountry,
  getDdpCountryLabel,
  requiresUsEmsPremium,
  isDdpEligibleForShipment,
  US_POSTAL_DDP_MAX_USD,
} from "@/lib/duty-deposit";

const MAIN_FLOW_STEP_LABELS = ["배송 옵션", "해외 배송지", "인보이스"] as const;
const MAIN_FLOW_STEP_COUNT = MAIN_FLOW_STEP_LABELS.length;
const BOX_FLOW_STEP_LABEL = "박스 구성";

// ── 타입 ────────────────────────────────────────────────────
interface PreInvoiceItem {
  name_en: string;
  quantity: number;
  unit_price_usd: number;
  hs_code?: string;
  origin_country: string;
  is_sealed?: boolean;
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
  is_shippable?: boolean | null;
  customer_storage_id?: string | null;
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

// 박스별 구성
interface BoxItem { key: string; qty: number; }
interface BoxSetup {
  id: number;
  address: OverseasAddressValue | null;
  items: BoxItem[];
}

// ── 상수 ────────────────────────────────────────────────────
const SHIPPING_METHODS = [
  { code: "EMS",         name: "EMS",         desc: "일반 국제우편 · 3-7일",  premiumcd: "31", em_ee: "em", badge: "bg-brand-600" },
  { code: "EMS_PREMIUM", name: "EMS 프리미엄", desc: `FedEx 특송 · 2-4일 · 최대 70kg`, premiumcd: "32", em_ee: "em", badge: "bg-violet-600" },
  { code: "KPACKET",     name: "K-Packet",    desc: "소형 경량 · 7-15일 · 2kg 이하", premiumcd: "14", em_ee: "rl", badge: "bg-emerald-600" },
] as const;

const PACKAGING_OPTS = [
  { code: "safe_pack",  name: "안전포장",  desc: "에어캡, 완충재 추가",      price: 3000 },
  { code: "repack",     name: "재포장",    desc: "새 박스로 교체",            price: 2000 },
  { code: "consolidate",name: "합포장",    desc: "선택 물품을 하나로 합치기", price: 2000 },
] as const;

const ADDON_SERVICES = [
  { code: "RECEIPT_DISPOSE",  name: "영수증/인보이스 폐기", desc: "세관 신고 가격 노출 방지",             price: 0, badge: "무료" },
  { code: "PRICE_TAG_REMOVE", name: "가격표 제거",          desc: "태그·스티커 등 가격 표시 제거",        price: 0, badge: "무료" },
  { code: "OVERPACK_REMOVE",  name: "과포장 제거",          desc: "불필요한 박스·완충재 제거 (무게 절감)", price: 0, badge: "무료" },
];

function newItem(): InvoiceItem {
  return { key: Math.random().toString(36).slice(2), name_en: "", quantity: 1, unit_price_usd: 0, hs_code: "", origin_country: "KR" };
}

// 출고 가능 상태
// ── 메인 컴포넌트 ─────────────────────────────────────────────
function ShippingRequestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlParcelIds = useMemo(() => searchParams.get("parcels")?.split(",").filter(Boolean) ?? [], [searchParams]);
  const { isSimple, isAdvanced, mode: flowMode } = useFlowMode();
  const hasBoxSetupStep = urlParcelIds.length === 0;
  const flowStepLabels = useMemo(
    () => (hasBoxSetupStep ? [BOX_FLOW_STEP_LABEL, ...MAIN_FLOW_STEP_LABELS] : [...MAIN_FLOW_STEP_LABELS]),
    [hasBoxSetupStep],
  );
  const totalFlowSteps = flowStepLabels.length;

  const [flowStep, setFlowStep] = useState(1);
  const prevFlowMode = useRef(flowMode);
  const [shippableParcels, setShippableParcels] = useState<Parcel[]>([]);
  const [storageMap, setStorageMap] = useState<Map<string, { storage_name: string; card_color: string | null }>>(new Map());
  const [preflowLoading, setPreflowLoading] = useState(false);
  const [defaultOverseasAddress, setDefaultOverseasAddress] = useState<OverseasAddressValue | null>(null);

  // 박스 구성
  const [boxes, setBoxes] = useState<BoxSetup[]>([{ id: 1, address: null, items: [] }]);
  const [expandedBoxAddress, setExpandedBoxAddress] = useState<number | null>(null);

  // 아이템 담기 모드 — 어느 박스에 담는지, 임시 수량 Map
  const [selectingForBoxId, setSelectingForBoxId] = useState<number | null>(null);
  const [tempQty, setTempQty] = useState<Map<string, number>>(new Map());

  const isBoxFlowStep = hasBoxSetupStep && flowStep === 1;
  const mainFlowStep = hasBoxSetupStep ? flowStep - 1 : flowStep;
  const inMainFlowContent = !isBoxFlowStep && mainFlowStep >= 1;

  // parcelIds: URL 직접 or 박스 구성 완료 후
  const parcelIds = useMemo(() => {
    if (urlParcelIds.length > 0) return urlParcelIds;
    if (!inMainFlowContent && !(isAdvanced && hasBoxSetupStep)) return [];
    const ids = new Set<string>();
    for (const b of boxes) {
      for (const bi of b.items) ids.add(bi.key.split("__")[0]);
    }
    return Array.from(ids);
  }, [urlParcelIds, inMainFlowContent, isAdvanced, hasBoxSetupStep, boxes]);
  const [customerId, setCustomerId] = useState<string | null>(null);

  // 배송 옵션
  const [shippingMethod, setShippingMethod] = useState<"EMS" | "EMS_PREMIUM" | "KPACKET">("EMS");
  const [packOpts, setPackOpts] = useState({ safe_pack: false, repack: false, consolidate: false });
  const [packNote, setPackNote] = useState("");
  const [addonServiceSet, setAddonServiceSet] = useState<Set<string>>(new Set());
  const [insuranceEnabled, setInsuranceEnabled] = useState(false);
  const [dutyPrepaid, setDutyPrepaid] = useState(true);
  const { rate: emsUsdKrwRate, info: emsExchangeInfo } = useEmsExchangeRate();

  // 해외 배송지 — boxes[i].address

  // 인보이스 (boxes 배열과 인덱스 동기)
  const [boxInvoices, setBoxInvoices] = useState<InvoiceItem[][]>([[newItem()]]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // URL parcels 직접 진입: 파셀 fetch → 기본 주소 + 인보이스 자동 채움
  useEffect(() => {
    if (urlParcelIds.length === 0) return;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setCustomerId(user.id);
      const [{ data: parcelData }, { data: addrData }] = await Promise.all([
        supabase
          .from("parcels")
          .select("id, tracking_no, sender_name, sender_address, status, weight_actual, notes, pre_invoice_items, is_shippable")
          .in("id", urlParcelIds)
          .eq("customer_id", user.id),
        supabase
          .from("customer_addresses")
          .select("id, label, name, phone, country_code, overseas_addr1, overseas_addr2, overseas_addr3, overseas_zip, email, is_default")
          .eq("customer_id", user.id),
      ]);

      // 기본 주소 세팅
      const defaultAddr = (addrData ?? []).find((a) => a.is_default) ?? addrData?.[0];
      if (defaultAddr) {
        const addr: OverseasAddressValue = {
          savedId: defaultAddr.id, label: defaultAddr.label,
          name: defaultAddr.name, phone: defaultAddr.phone ?? "",
          countryCode: defaultAddr.country_code,
          addr1: defaultAddr.overseas_addr1 ?? "", addr2: defaultAddr.overseas_addr2 ?? "",
          addr3: defaultAddr.overseas_addr3 ?? "", zip: defaultAddr.overseas_zip ?? "",
          email: defaultAddr.email ?? "",
        };
        setDefaultOverseasAddress(addr);
        setBoxes([{ id: 1, address: addr, items: [] }]);
      }

      // pre_invoice_items → boxInvoices[0] 자동 채움
      const autoInvoice: InvoiceItem[] = [];
      for (const p of (parcelData ?? [])) {
        const declared = Array.isArray(p.pre_invoice_items) ? p.pre_invoice_items : [];
        if (declared.length > 0) {
          declared.forEach((it: { name_en?: string; name?: string; quantity?: number; unit_price_usd?: number; hs_code?: string; origin_country?: string }, idx: number) => {
            autoInvoice.push({
              key: `${p.id}__${idx}`,
              name_en: it.name_en ?? it.name ?? "",
              quantity: it.quantity ?? 1,
              unit_price_usd: it.unit_price_usd ?? 0,
              hs_code: it.hs_code ?? "",
              origin_country: it.origin_country ?? "KR",
            });
          });
        } else {
          autoInvoice.push({
            key: `${p.id}__0`,
            name_en: p.notes ?? p.tracking_no ?? "물품",
            quantity: 1,
            unit_price_usd: 0,
            hs_code: "",
            origin_country: "KR",
          });
        }
      }
      if (autoInvoice.length > 0) setBoxInvoices([autoInvoice]);
    });
  }, [urlParcelIds]);

  // pre-flow: 출고 가능 물품 + 기본 해외배송지 로드 (박스 구성 플로우)
  useEffect(() => {
    if (!hasBoxSetupStep) return;
    setPreflowLoading(true);
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setCustomerId(user.id);
      const [{ data: parcelData }, { data: addrData }, { data: reservedLinks }, { data: storageData }] = await Promise.all([
        supabase
          .from("parcels")
          .select("id, tracking_no, sender_name, sender_address, status, weight_actual, notes, pre_invoice_items, is_shippable, customer_storage_id")
          .eq("customer_id", user.id)
          .eq("is_shippable", true)
          .order("inbound_at", { ascending: false }),
        supabase
          .from("customer_addresses")
          .select("id, label, name, phone, country_code, overseas_addr1, overseas_addr2, overseas_addr3, overseas_zip, email, is_default")
          .eq("customer_id", user.id)
          .eq("type", "overseas")
          .order("is_default", { ascending: false })
          .limit(5),
        supabase
          .from("order_parcels")
          .select("parcel_id, orders!inner(status, customer_id)")
          .eq("orders.customer_id", user.id),
        supabase
          .from("customer_storages")
          .select("id, storage_name, card_color, status")
          .eq("user_id", user.id),
      ]);
      const reserved = parcelIdsInActiveOrders(reservedLinks, user.id);
      // 스토리지 맵 구성: id → { storage_name, card_color }
      const sMap = new Map<string, { storage_name: string; card_color: string | null }>();
      for (const s of storageData ?? []) sMap.set(s.id, { storage_name: s.storage_name, card_color: s.card_color });
      // customer_storage_id가 없는 파셀에 단일 스토리지 자동 매핑 (먼저 처리 후 setState)
      let filtered = (parcelData ?? []).filter((p) => !reserved.has(p.id));
      if (sMap.size === 1) {
        const singleId = [...sMap.keys()][0];
        filtered = filtered.map((p) => p.customer_storage_id ? p : { ...p, customer_storage_id: singleId });
      }
      setShippableParcels(filtered);
      setStorageMap(sMap);
      const defaultAddr = (addrData ?? []).find((a) => a.is_default) ?? addrData?.[0];
      if (defaultAddr) {
        const addr: OverseasAddressValue = {
          savedId: defaultAddr.id, label: defaultAddr.label,
          name: defaultAddr.name, phone: defaultAddr.phone ?? "",
          countryCode: defaultAddr.country_code,
          addr1: defaultAddr.overseas_addr1 ?? "", addr2: defaultAddr.overseas_addr2 ?? "",
          addr3: defaultAddr.overseas_addr3 ?? "", zip: defaultAddr.overseas_zip ?? "",
          email: defaultAddr.email ?? "",
        };
        setDefaultOverseasAddress(addr);
        setBoxes([{ id: 1, address: addr, items: [] }]);
      }
      setPreflowLoading(false);
    });
  }, [hasBoxSetupStep]);

  // parcel 목록 → 개별 내품 아이템 목록으로 플랫화
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

  // 박스 추가
  const handleAddBox = useCallback(() => {
    setBoxes((prev) => [
      ...prev,
      { id: prev.length > 0 ? Math.max(...prev.map((b) => b.id)) + 1 : 1, address: defaultOverseasAddress, items: [] },
    ]);
  }, [defaultOverseasAddress]);

  // 박스 삭제 (담긴 아이템은 박스 1로 병합)
  const handleRemoveBox = useCallback((boxId: number) => {
    setBoxes((prev) => {
      const target = prev.find((b) => b.id === boxId);
      if (!target || prev.length <= 1) return prev;
      const remaining = prev.filter((b) => b.id !== boxId);
      const keepKeys = new Set(remaining.flatMap((b) => b.items.map((bi) => bi.key)));
      const orphans = target.items.filter((bi) => !keepKeys.has(bi.key));
      if (orphans.length > 0) {
        remaining[0] = { ...remaining[0], items: [...remaining[0].items, ...orphans] };
      }
      return remaining;
    });
  }, []);

  // 다른 박스들에 이미 배정된 해당 아이템의 총 수량
  const getOtherBoxQty = useCallback((itemKey: string, excludeBoxId: number): number => {
    return boxes.filter((b) => b.id !== excludeBoxId)
      .reduce((sum, b) => sum + (b.items.find((bi) => bi.key === itemKey)?.qty ?? 0), 0);
  }, [boxes]);

  // "박스에 담기" 버튼 → 아이템 선택 모드 진입
  const openItemSelect = useCallback((boxId: number) => {
    const box = boxes.find((b) => b.id === boxId);
    const initMap = new Map<string, number>();
    (box?.items ?? []).forEach((bi) => initMap.set(bi.key, bi.qty));
    setTempQty(initMap);
    setSelectingForBoxId(boxId);
  }, [boxes]);

  // 아이템 선택 완료 → 박스에 반영 (qty > 0인 것만)
  const confirmItemSelect = useCallback(() => {
    if (selectingForBoxId === null) return;
    const newItems: BoxItem[] = [];
    tempQty.forEach((qty, key) => { if (qty > 0) newItems.push({ key, qty }); });
    setBoxes((prev) =>
      prev.map((b) => {
        if (b.id === selectingForBoxId) return { ...b, items: newItems };
        // 다른 박스에서 동일 key가 있으면 이미 처리됨 — 수량은 각자 관리
        return b;
      })
    );
    setSelectingForBoxId(null);
  }, [selectingForBoxId, tempQty]);

  const prepareMainFlowFromBoxes = useCallback(() => {
    const totalQty = boxes.reduce((s, b) => s + b.items.reduce((q, bi) => q + bi.qty, 0), 0);
    if (totalQty === 0) return false;
    const newBoxInvoices: InvoiceItem[][] = boxes.map((box) => {
      const preItems = box.items
        .map((bi) => {
          const sel = selectableItems.find((it) => it.key === bi.key);
          if (!sel) return null;
          return {
            key: bi.key,
            name_en: sel.name_en,
            quantity: bi.qty,
            unit_price_usd: sel.unit_price_usd,
            hs_code: sel.hs_code,
            origin_country: sel.origin_country,
          } as InvoiceItem;
        })
        .filter((x): x is InvoiceItem => x !== null);
      return preItems.length > 0 ? preItems : [newItem()];
    });
    setBoxInvoices(newBoxInvoices);
    return true;
  }, [boxes, selectableItems]);

  useEffect(() => {
    if (!inMainFlowContent && !isAdvanced) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCustomerId(user.id);
    });
  }, [inMainFlowContent, isAdvanced]);

  // ── 계산 ──────────────────────────────────────────────────
  const packagingFee = PACKAGING_OPTS.filter((o) => packOpts[o.code as keyof typeof packOpts]).reduce((s, o) => s + o.price, 0);
  const customsValue = boxInvoices.flatMap((inv) => inv).reduce((s, i) => s + i.unit_price_usd * i.quantity, 0);
  const hasSealedItems = shippableParcels.some((p) =>
    Array.isArray(p.pre_invoice_items) && p.pre_invoice_items.some((it) => it.is_sealed)
  );

  const ddpBoxSummaries = useMemo(() => {
    return boxes.map((box, i) => {
      const country = box.address?.countryCode ?? "";
      const inv = boxInvoices[i] ?? [];
      const value = inv.reduce((s, item) => s + item.unit_price_usd * item.quantity, 0);
      const result = calculateDutyDeposit({
        countryCode: country,
        customsValueUsd: value,
        dutyPrepaidRequested: dutyPrepaid,
        shippingMethod,
        usdKrwRate: emsUsdKrwRate,
      });
      return { boxId: box.id, country, value, ...result };
    });
  }, [boxes, boxInvoices, dutyPrepaid, shippingMethod, emsUsdKrwRate]);

  const usRequiresEmsPremium = ddpBoxSummaries.some((s) =>
    requiresUsEmsPremium(s.country, s.value),
  );

  const showDdpOption = ddpBoxSummaries.some((s) =>
    isDdpEligibleForShipment(s.country, s.value, shippingMethod),
  );

  useEffect(() => {
    if (usRequiresEmsPremium) {
      setShippingMethod("EMS_PREMIUM");
    }
  }, [usRequiresEmsPremium]);

  useEffect(() => {
    if (showDdpOption) {
      setDutyPrepaid(true);
    }
  }, [showDdpOption]);

  // ── 유효성 검사 ───────────────────────────────────────────
  function canProceedForMainStep(ms: number): boolean {
    if (ms === 2) {
      return boxes.every((b) => !!(b.address?.name?.trim() && b.address?.addr3?.trim()));
    }
    if (ms === 3) {
      return boxInvoices.every((inv) =>
        inv.every((i) => i.name_en.trim() && i.quantity > 0 && i.unit_price_usd > 0)
      );
    }
    return true;
  }

  function canProceed(): boolean {
    if (isBoxFlowStep) {
      return boxes.reduce((s, b) => s + b.items.reduce((q, bi) => q + bi.qty, 0), 0) > 0;
    }
    return canProceedForMainStep(mainFlowStep);
  }

  function handleFlowBack() {
    if (selectingForBoxId !== null) {
      setTempQty(new Map());
      setSelectingForBoxId(null);
      return;
    }
    if (isBoxFlowStep) {
      router.back();
      return;
    }
    if (mainFlowStep <= 1) {
      if (hasBoxSetupStep) setFlowStep(1);
      else router.back();
      return;
    }
    setFlowStep(flowStep - 1);
    setError("");
  }

  function handleFlowNext() {
    setError("");
    if (isBoxFlowStep) {
      if (!prepareMainFlowFromBoxes()) {
        setError("박스에 담을 내품을 선택해주세요.");
        return;
      }
      setFlowStep(2);
      return;
    }
    if (mainFlowStep < MAIN_FLOW_STEP_COUNT) setFlowStep(flowStep + 1);
  }

  function inferFlowStep(): number {
    if (hasBoxSetupStep) {
      const totalQty = boxes.reduce((s, b) => s + b.items.reduce((q, bi) => q + bi.qty, 0), 0);
      if (totalQty === 0) return 1;
      if (!canProceedForMainStep(2)) return 3;
      if (!canProceedForMainStep(3)) return 4;
      return 2;
    }
    if (!canProceedForMainStep(2)) return 2;
    if (!canProceedForMainStep(3)) return 3;
    return 1;
  }

  useEffect(() => {
    if (prevFlowMode.current === "advanced" && flowMode === "simple") {
      setFlowStep(inferFlowStep());
    }
    prevFlowMode.current = flowMode;
  }, [flowMode]);

  useEffect(() => {
    if (isAdvanced && hasBoxSetupStep) prepareMainFlowFromBoxes();
  }, [isAdvanced, hasBoxSetupStep, boxes, prepareMainFlowFromBoxes]);

  function renderFlowHeader(extra?: { subtitle?: string }) {
    const label = selectingForBoxId !== null
      ? `${selectingForBoxId}번 박스에 담기`
      : flowStepLabels[flowStep - 1];

    return (
      <div
        className="bg-white border-b border-gray-100 sticky z-10"
        style={{ top: "var(--sat, 0px)" }}
      >
        <div className="max-w-[600px] mx-auto flex items-center gap-3 px-4 py-3">
          <button type="button" onClick={handleFlowBack} className="p-1 -ml-1">
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <div className="flex-1 min-w-0">
            {isSimple ? (
              <>
                <p className="text-xs text-gray-400">
                  Step {selectingForBoxId !== null ? 1 : flowStep} / {totalFlowSteps}
                </p>
                <p className="text-sm font-bold text-gray-900 truncate">{label}</p>
                {extra?.subtitle && <p className="text-xs text-gray-400 mt-0.5">{extra.subtitle}</p>}
              </>
            ) : (
              <>
                <p className="text-base font-bold text-gray-900">출고신청</p>
                <p className="text-xs text-gray-400">고급모드 · 한 페이지에 입력</p>
              </>
            )}
          </div>
        </div>
        {isSimple && (
          <div className="max-w-[600px] mx-auto flex gap-1.5 px-4 pb-3">
            {flowStepLabels.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i + 1 <= (selectingForBoxId !== null ? 1 : flowStep) ? "bg-brand-600" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── 주문 제출 ─────────────────────────────────────────────
  async function submit() {
    if (boxes.some((b) => !b.address)) return;
    setSubmitting(true);
    setError("");
    try {
      const orderNos: string[] = [];
      for (let i = 0; i < boxes.length; i++) {
        const box = boxes[i];
        const addr = box.address!;
        const inv = boxInvoices[i] ?? [newItem()];
        const boxCustomsValue = inv.reduce((s, item) => s + item.unit_price_usd * item.quantity, 0);
        const dutyResult = calculateDutyDeposit({
          countryCode: addr.countryCode,
          customsValueUsd: boxCustomsValue,
          dutyPrepaidRequested: dutyPrepaid,
          shippingMethod,
          usdKrwRate: emsUsdKrwRate,
        });
        if (dutyPrepaid && isDdpCountry(addr.countryCode) && dutyResult.ineligibleReason) {
          throw new Error(dutyResult.ineligibleReason);
        }
        if (requiresUsEmsPremium(addr.countryCode, boxCustomsValue) && shippingMethod !== "EMS_PREMIUM") {
          throw new Error(
            `미국 신고가액 USD ${US_POSTAL_DDP_MAX_USD} 초과는 EMS 프리미엄만 선택할 수 있습니다.`,
          );
        }
        // URL 직접 진입(단일박스) → parcelIds 전체, 박스구성 진입 → 해당 박스의 parcel만
        const boxParcelIds =
          urlParcelIds.length > 0
            ? parcelIds
            : [...new Set(box.items.map((bi) => bi.key.split("__")[0]))];

        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parcel_ids: boxParcelIds,
            shipping_method: shippingMethod,
            packaging_options: { ...packOpts, note: packNote },
            overseas_address: {
              country_code: addr.countryCode,
              name: addr.name,
              phone: addr.phone || undefined,
              overseas_addr1: addr.addr1,
              overseas_addr2: addr.addr2,
              overseas_addr3: addr.addr3,
              overseas_zip: addr.zip || undefined,
              email: addr.email || undefined,
            },
            item_list: inv.map(({ key: _k, ...rest }) => rest),
            estimated_shipping_fee: 0,
            packaging_fee: packagingFee,
            insurance_enabled: insuranceEnabled,
            insurance_amount: insuranceEnabled ? boxCustomsValue : 0,
            duty_prepaid: dutyResult.dutyPrepaid,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `${i + 1}번 박스 주문 생성 실패`);
        orderNos.push(data.order_no);

        // 부가서비스 신청 (폐기/제거 등)
        if (addonServiceSet.size > 0) {
          const services = ADDON_SERVICES.filter(s => addonServiceSet.has(s.code))
            .map(s => ({ service_code: s.code, service_name: s.name, price: s.price }));
          for (const pid of boxParcelIds) {
            await fetch(`/api/parcels/${pid}/service-requests`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ services }),
            }).catch(() => {});
          }
        }
      }
      router.push(`/orders?new=${orderNos[0]}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── 박스에 담기 (수량 스테퍼) ─
  if (selectingForBoxId !== null) {
    const parcelGroups = shippableParcels.map((p) => ({
      parcel: p,
      items: selectableItems.filter((it) => it.parcelId === p.id),
    }));
    const totalSelected = Array.from(tempQty.values()).reduce((s, v) => s + v, 0);

    return (
      <div className="min-h-screen bg-gray-50 pb-[160px]">
        {renderFlowHeader({
          subtitle: isSimple
            ? "수량을 설정해주세요 — 같은 품목을 여러 박스에 나눠 담을 수 있어요"
            : undefined,
        })}

        <div className="max-w-[600px] mx-auto px-4 pt-4 space-y-4 pb-40">
          {preflowLoading ? (
            <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-brand-500" /></div>
          ) : shippableParcels.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
              <Package size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-500">{"\ucd9c\uace0 \uac00\ub2a5\ud55c \ubb3c\ud488\uc774 \uc5c6\uc2b5\ub2c8\ub2e4"}</p>
            </div>
          ) : (
            parcelGroups.map(({ parcel: p, items: pItems }) => (
              <div key={p.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                {/* 택배 헤더 */}
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <Package size={15} className="text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 truncate">{p.tracking_no ?? "\uc1a1\uc7a5\ubc88\ud638 \ubbf8\ub4f1\ub85d"}</p>
                    <p className="text-[10px] text-gray-400">
                      {p.sender_address ?? p.sender_name ?? "\ubc1c\uc1a1\uc778 \ubbf8\ud655\uc778"}
                      {p.weight_actual ? ` \u00b7 ${(p.weight_actual / 1000).toFixed(2)}kg` : ""}
                    </p>
                  </div>
                  {(() => {
                    const sid = p.customer_storage_id ?? (storageMap.size === 1 ? [...storageMap.keys()][0] : null);
                    const s = sid ? storageMap.get(sid) : null;
                    if (!s) return null;
                    const TK = Object.keys(CARD_THEME_MAP);
                    const ck = (s.card_color && CARD_THEME_MAP[s.card_color]) ? s.card_color : TK[parseInt((sid ?? "").replace(/-/g,"").slice(0,8),16) % TK.length];
                    const accent = CARD_THEME_MAP[ck]?.accent ?? "#6366f1";
                    return (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded-full shrink-0 max-w-[80px]">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: accent }} />
                        <span className="truncate">{s.storage_name}</span>
                      </span>
                    );
                  })()}
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${
                    p.is_shippable ? "text-green-700 bg-green-50 border-green-200"
                    : p.status === "HOLD" ? "text-orange-700 bg-orange-50 border-orange-200"
                    : "text-indigo-700 bg-indigo-50 border-indigo-200"
                  }`}>{
                    p.is_shippable ? "출고 가능"
                    : p.status === "HOLD" ? "보류"
                    : "입고중"
                  }</span>
                </div>

                {/* 내품 목록 — 수량 스테퍼 */}
                <div className="divide-y divide-gray-50">
                  {pItems.map((item) => {
                    const currentQty = tempQty.get(item.key) ?? 0;
                    const otherQty = getOtherBoxQty(item.key, selectingForBoxId!);
                    const maxQty = item.quantity - otherQty;
                    const isActive = currentQty > 0;

                    return (
                      <div
                        key={item.key}
                        className={`flex items-center gap-3 px-4 py-3 transition-colors ${isActive ? "bg-brand-50" : "bg-white"}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.name_en}</p>
                          <p className="text-xs text-gray-400">
                            {"\uc7ac\uace0 "}{item.quantity}{"\uac1c"}
                            {otherQty > 0 ? ` \u00b7 \ub2e4\ub978 \ubc15\uc2a4 ${otherQty}\uac1c` : ""}
                            {item.unit_price_usd > 0 ? ` \u00b7 $${item.unit_price_usd}` : ""}
                          </p>
                        </div>

                        {/* 수량 스테퍼 */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() =>
                              setTempQty((prev) => {
                                const next = new Map(prev);
                                const v = (next.get(item.key) ?? 0) - 1;
                                if (v <= 0) next.delete(item.key);
                                else next.set(item.key, v);
                                return next;
                              })
                            }
                            disabled={currentQty === 0}
                            className="w-8 h-8 rounded-lg border-2 border-gray-200 flex items-center justify-center text-gray-500 font-bold text-lg disabled:opacity-30 active:scale-90 transition-transform"
                          >
                            –
                          </button>
                          <span className={`w-8 text-center text-sm font-bold ${isActive ? "text-brand-600" : "text-gray-300"}`}>
                            {currentQty}
                          </span>
                          <button
                            onClick={() =>
                              setTempQty((prev) => {
                                const next = new Map(prev);
                                next.set(item.key, Math.min((next.get(item.key) ?? 0) + 1, maxQty));
                                return next;
                              })
                            }
                            disabled={currentQty >= maxQty}
                            className="w-8 h-8 rounded-lg border-2 border-brand-300 bg-brand-50 flex items-center justify-center text-brand-600 font-bold text-lg disabled:opacity-30 active:scale-90 transition-transform"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="fixed left-0 right-0 px-4 z-[60]" style={{ bottom: "calc(60px + var(--sab, 0px) + 12px)" }}>
          <div className="max-w-[600px] mx-auto">
            <button
              onClick={confirmItemSelect}
              disabled={totalSelected === 0}
              className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-brand-200 disabled:opacity-40 active:scale-[0.98] transition-transform"
            >
              <CheckCircle size={16} />
              {totalSelected}{"\uac1c \ub2f4\uae30 \uc644\ub8cc"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 일반모드 Step 1: 박스 구성 ────────────────────────────────
  if (isSimple && isBoxFlowStep && selectingForBoxId === null) {
    const totalAssigned = boxes.reduce((s, b) => s + b.items.reduce((q, bi) => q + bi.qty, 0), 0);
    return (
      <div className="min-h-screen bg-gray-50 pb-[160px]">
        <div className="relative">
          {renderFlowHeader({ subtitle: "박스 개수를 정하고 내품을 담아주세요" })}
          {totalAssigned > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirm("박스 구성을 모두 초기화할까요?\n선택한 내품은 자동으로 원복됩니다.")) {
                  setBoxes(boxes.map((b) => ({ ...b, items: [] })));
                }
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 border border-gray-200 px-2.5 py-1 rounded-full hover:text-red-500 hover:border-red-200 transition-colors z-20"
              style={{ top: "calc(1.5rem + var(--sat, 0px))" }}
            >
              초기화
            </button>
          )}
        </div>

        <div className="max-w-[600px] mx-auto px-4 pt-5 space-y-5 pb-40">
          {preflowLoading ? (
            <div className="flex justify-center py-10"><Loader2 size={28} className="animate-spin text-brand-500" /></div>
          ) : shippableParcels.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
              <Package size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-500">{"\ucd9c\uace0 \uac00\ub2a5\ud55c \ubb3c\ud488\uc774 \uc5c6\uc2b5\ub2c8\ub2e4"}</p>
              <p className="text-xs text-gray-400 mt-1">{"\uc785\uace0 \uc644\ub8cc\ub41c \ubb3c\ud488\uc774 \uc5c6\uc73c\uba74 \ucd9c\uace0\uc2e0\uccad\uc744 \ud560 \uc218 \uc5c6\uc5b4\uc694"}</p>
              <button onClick={() => router.push("/storage")} className="mt-5 bg-brand-600 text-white text-sm font-bold px-6 py-3 rounded-2xl">
                스토리지 보기
              </button>
            </div>
          ) : (
            /* 박스별 카드 */
            boxes.map((box) => {
              const boxItemDetails = box.items
                .map((bi) => ({ bi, item: selectableItems.find((it) => it.key === bi.key) }))
                .filter((x): x is { bi: BoxItem; item: SelectableItem } => !!x.item);
              const totalBoxQty = box.items.reduce((s, bi) => s + bi.qty, 0);
              const isAddressOpen = expandedBoxAddress === box.id;
              return (
                <div key={box.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                  {/* 박스 헤더 */}
                  <div className="flex items-center justify-between px-4 py-3 bg-brand-600">
                    <div className="flex items-center gap-2">
                      <Package size={16} className="text-white" />
                      <p className="text-sm font-bold text-white">{box.id}{"\ubc88 \ubc15\uc2a4"}</p>
                      {totalBoxQty > 0 && (
                        <span className="text-xs text-brand-200">{totalBoxQty}{"\uac1c"}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExpandedBoxAddress(isAddressOpen ? null : box.id)}
                        className="flex items-center gap-1 text-xs text-white/80 bg-white/20 px-2.5 py-1 rounded-full"
                      >
                        <Globe size={11} />
                        {box.address ? (box.address.label ?? box.address.name) : "\ubc30\uc1a1\uc9c0 \uc124\uc815"}
                      </button>
                      {boxes.length > 1 && (
                        <button
                          onClick={() => handleRemoveBox(box.id)}
                          className="w-6 h-6 flex items-center justify-center rounded-full bg-white/20 text-white/80 hover:bg-white/30 text-sm leading-none"
                          title={"\ubc15\uc2a4 \uc0ad\uc81c"}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 주소 피커 (펼침) */}
                  {isAddressOpen && (
                    <div className="px-4 py-4 bg-brand-50 border-b border-brand-100">
                      <OverseasAddressPicker
                        value={box.address}
                        onChange={(addr) => setBoxes((prev) => prev.map((b) => b.id === box.id ? { ...b, address: addr } : b))}
                        customerId={customerId}
                      />
                    </div>
                  )}

                  {/* 내품 목록 */}
                  <div className="divide-y divide-gray-50">
                    {boxItemDetails.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">{"\uc544\uc9c1 \ub2f4\uc740 \ub0b4\ud488\uc774 \uc5c6\uc5b4\uc694"}</p>
                    ) : (
                      boxItemDetails.map(({ bi, item }) => (
                        <div key={bi.key} className="flex items-center gap-3 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{item.name_en}</p>
                            <p className="text-xs text-gray-400">
                              {item.parcelSender}
                              {item.unit_price_usd > 0 ? ` · $${item.unit_price_usd}` : ""}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-brand-600 shrink-0">{bi.qty}{"\uac1c"}</span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* 박스에 담기 버튼 */}
                  <div className="px-4 pb-4 pt-2">
                    <button
                      onClick={() => openItemSelect(box.id)}
                      className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-brand-300 text-brand-600 text-sm font-bold py-3 rounded-xl hover:bg-brand-50 active:scale-[0.98] transition-all"
                    >
                      <span className="text-lg leading-none">+</span>
                      {box.items.length > 0 ? "\ub0b4\ud488 \uc218\uc815" : "\ubc15\uc2a4\uc5d0 \ub2f4\uae30"}
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {/* 박스 추가 버튼 */}
          {!preflowLoading && shippableParcels.length > 0 && (
            <button
              onClick={handleAddBox}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 text-gray-500 text-sm font-bold py-4 rounded-2xl hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50 active:scale-[0.98] transition-all"
            >
              <span className="text-lg leading-none">+</span>
              {"\ubc15\uc2a4 \ucd94\uac00"}
            </button>
          )}
        </div>

        {/* 출고신청 진행 버튼 */}
        <div className="fixed left-0 right-0 px-4 z-[60]" style={{ bottom: "calc(60px + var(--sab, 0px) + 12px)" }}>
          <div className="max-w-[600px] mx-auto">
            <button
              type="button"
              onClick={handleFlowNext}
              disabled={totalAssigned === 0}
              className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-brand-200 disabled:opacity-40 active:scale-[0.98] transition-transform"
            >
              <CheckCircle size={16} />
              {totalAssigned > 0 ? `${totalAssigned}개 내품 — ` : ""}다음
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showMainStep = (n: number) => isAdvanced || mainFlowStep === n;

  if ((!inMainFlowContent && !isAdvanced) || selectingForBoxId !== null) {
    return null;
  }

  const totalAssigned = boxes.reduce((s, b) => s + b.items.reduce((q, bi) => q + bi.qty, 0), 0);
  const showMainSections = !hasBoxSetupStep || isAdvanced || parcelIds.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {renderFlowHeader()}

      <div className="max-w-[600px] mx-auto px-4 pt-5 space-y-6">

        {/* 고급모드: 박스 구성 (Step 1에 해당) */}
        {isAdvanced && hasBoxSetupStep && (
          <section className="space-y-4">
            <p className="text-sm font-bold text-gray-800">박스 구성</p>
            {preflowLoading ? (
              <div className="flex justify-center py-10"><Loader2 size={28} className="animate-spin text-brand-500" /></div>
            ) : shippableParcels.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                <p className="text-sm text-gray-500">출고 가능한 물품이 없습니다</p>
              </div>
            ) : (
              <>
                {boxes.map((box) => {
                  const totalBoxQty = box.items.reduce((s, bi) => s + bi.qty, 0);
                  const isAddressOpen = expandedBoxAddress === box.id;
                  return (
                    <div key={box.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                      <div className="flex items-center justify-between px-4 py-3 bg-brand-600">
                        <p className="text-sm font-bold text-white">{box.id}번 박스 {totalBoxQty > 0 ? `· ${totalBoxQty}개` : ""}</p>
                        <button type="button" onClick={() => setExpandedBoxAddress(isAddressOpen ? null : box.id)} className="text-xs text-white/90 bg-white/20 px-2 py-1 rounded-full">
                          {box.address ? "배송지 ✓" : "배송지"}
                        </button>
                      </div>
                      {isAddressOpen && (
                        <div className="px-4 py-4 bg-brand-50 border-b border-brand-100">
                          <OverseasAddressPicker value={box.address} onChange={(addr) => setBoxes((prev) => prev.map((b) => b.id === box.id ? { ...b, address: addr } : b))} customerId={customerId} />
                        </div>
                      )}
                      <div className="p-4">
                        <button type="button" onClick={() => openItemSelect(box.id)} className="w-full border-2 border-dashed border-brand-300 text-brand-600 text-sm font-bold py-3 rounded-xl">
                          + {box.items.length > 0 ? "내품 수정" : "박스에 담기"}
                        </button>
                      </div>
                    </div>
                  );
                })}
                <button type="button" onClick={handleAddBox} className="w-full border-2 border-dashed border-gray-200 text-gray-500 text-sm font-bold py-3 rounded-2xl">+ 박스 추가</button>
              </>
            )}
          </section>
        )}

        {showMainSections && (
        <>
        {/* ── 배송 옵션 ─────────────────────────────── */}
        {showMainStep(1) && (
          <>
            {hasSealedItems && (
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                <span className="text-amber-500 text-base shrink-0 mt-0.5">⚠</span>
                <div>
                  <p className="text-sm font-bold text-amber-800">미개봉 물품 포함</p>
                  <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                    미개봉 상태로 보관 중인 물품이 포함되어 있습니다.<br />
                    <span className="font-semibold">해외 배송 출고 시에는 세관 신고 및 검수를 위해 개봉 후 처리</span>됩니다.
                  </p>
                </div>
              </div>
            )}
            <p className="text-sm font-bold text-gray-800">배송 방법 선택</p>
            {usRequiresEmsPremium && (
              <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 text-xs text-violet-900 leading-relaxed">
                미국 배송 · 신고가액 USD {US_POSTAL_DDP_MAX_USD} 초과 — 우체국 EMS/K-Packet 관세 선납은 불가합니다.
                <span className="font-semibold"> EMS 프리미엄({EMS_PREMIUM_CARRIER})</span>으로 발송하며,
                {dutyPrepaid ? " FedEx 관세 선납(DDP)이 적용됩니다." : " 관세 선납(DDP)을 선택하면 FedEx 경로로 선납할 수 있습니다."}
              </div>
            )}
            <div className="space-y-2">
              {SHIPPING_METHODS.map((m) => {
                const disabled =
                  usRequiresEmsPremium && m.code !== "EMS_PREMIUM";
                return (
                <button
                  key={m.code}
                  type="button"
                  disabled={disabled}
                  onClick={() => !disabled && setShippingMethod(m.code)}
                  className={`w-full text-left flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                    disabled
                      ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                      : shippingMethod === m.code
                      ? "border-brand-500 bg-brand-50"
                      : "border-gray-100 bg-white"
                  }`}
                >
                  <span className={`text-xs text-white font-bold px-2.5 py-1 rounded-lg ${m.badge}`}>
                    {m.name}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500">{m.desc}</p>
                    {usRequiresEmsPremium && m.code === "EMS_PREMIUM" && (
                      <p className="text-[10px] text-violet-700 font-semibold mt-0.5">미국 $800+ 권장</p>
                    )}
                    {disabled && (
                      <p className="text-[10px] text-gray-400 mt-0.5">미국 $800 초과 시 선택 불가</p>
                    )}
                  </div>
                  {shippingMethod === m.code && !disabled && (
                    <CheckCircle size={16} className="text-brand-500 ml-auto shrink-0" />
                  )}
                </button>
              );})}
            </div>

            {shippingMethod === "EMS_PREMIUM" && (
              <p className="text-[10px] text-violet-700 leading-relaxed px-1">
                EMS 프리미엄은 {EMS_PREMIUM_CARRIER} 네트워크 (2026.4.1~).
                비서류 크기: 최장 {EMS_PREMIUM_LIMITS.nonDocMaxLongestCm}cm ·
                2번째 {EMS_PREMIUM_LIMITS.nonDocMaxMiddleCm}cm ·
                최단 {EMS_PREMIUM_LIMITS.nonDocMaxShortestCm}cm ·
                길이+둘레 {EMS_PREMIUM_LIMITS.nonDocMaxLengthPlusGirthCm}cm 이하.
              </p>
            )}

            <div className="flex items-center gap-2 px-1 py-1">
              <Globe size={13} className="text-gray-400 shrink-0" />
              <p className="text-xs text-gray-400">배송비는 실측 무게에 따라 창고 견적 후 확정됩니다</p>
            </div>

            <p className="text-sm font-bold text-gray-800 pt-2">국제우편 보험 (선택)</p>
            <button
              type="button"
              onClick={() => setInsuranceEnabled((v) => !v)}
              className={`w-full text-left flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                insuranceEnabled ? "border-brand-500 bg-brand-50" : "border-gray-100 bg-white"
              }`}
            >
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                insuranceEnabled ? "bg-brand-600 border-brand-600" : "border-gray-300"
              }`}>
                {insuranceEnabled && <span className="text-white text-xs font-bold">✓</span>}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">보험 가입</p>
                <p className="text-xs text-gray-400">
                  인보이스 신고가액(USD) 합계를 보험가액으로 적용합니다. 실제 보험료는 창고 견적 후 확정됩니다.
                </p>
              </div>
            </button>

            {shippingMethod === "EMS_PREMIUM" && insuranceEnabled && (
              <p className="text-[10px] text-gray-500 leading-relaxed px-1">
                {EMS_PREMIUM_INSURANCE_NOTE}
              </p>
            )}

            <p className="text-sm font-bold text-gray-800 pt-2">포장 옵션 (선택)</p>
            <div className="space-y-2">
              {PACKAGING_OPTS.map((o) => {
                const checked = packOpts[o.code as keyof typeof packOpts];
                return (
                  <button
                    key={o.code}
                    onClick={() => setPackOpts((p) => ({ ...p, [o.code]: !p[o.code as keyof typeof packOpts] }))}
                    className={`w-full text-left flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                      checked ? "border-brand-500 bg-brand-50" : "border-gray-100 bg-white"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                      checked ? "bg-brand-600 border-brand-600" : "border-gray-300"
                    }`}>
                      {checked && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">{o.name}</p>
                      <p className="text-xs text-gray-400">{o.desc}</p>
                    </div>
                    <span className="text-xs font-semibold text-brand-600 shrink-0">
                      +{o.price.toLocaleString()}원
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="text-sm font-bold text-gray-800 pt-2">부가서비스 (선택)</p>
            <div className="space-y-2">
              {ADDON_SERVICES.map((o) => {
                const checked = addonServiceSet.has(o.code);
                return (
                  <button
                    key={o.code}
                    onClick={() => setAddonServiceSet((prev) => {
                      const next = new Set(prev);
                      checked ? next.delete(o.code) : next.add(o.code);
                      return next;
                    })}
                    className={`w-full text-left flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                      checked ? "border-amber-500 bg-amber-50" : "border-gray-100 bg-white"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                      checked ? "bg-amber-500 border-amber-500" : "border-gray-300"
                    }`}>
                      {checked && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-gray-800">{o.name}</span>
                        {o.badge && (
                          <span className="text-[10px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">{o.badge}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{o.desc}</p>
                    </div>
                    <span className="text-xs font-semibold text-green-600 shrink-0">무료</span>
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
                placeholder="포장·처리 관련 특별 요청사항을 입력해주세요"
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
          </>
        )}

        {/* ── 해외 배송지 ───────────────────────────── */}
        {showMainStep(2) && (
          <>
            {boxes.length === 1 ? (
              <>
                <p className="text-sm text-gray-500">수취인 주소를 선택하거나 새로 입력해주세요</p>
                <OverseasAddressPicker
                  value={boxes[0].address}
                  onChange={(addr) =>
                    setBoxes((prev) => prev.map((b, i) => (i === 0 ? { ...b, address: addr } : b)))
                  }
                  customerId={customerId}
                />
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">박스별 수취인 주소를 확인·수정해주세요</p>
                {boxes.map((box) => (
                  <div key={box.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                    <div className="flex items-center gap-2 px-4 py-3 bg-brand-600">
                      <Globe size={14} className="text-white" />
                      <p className="text-sm font-bold text-white">{box.id}번 박스 배송지</p>
                      {box.address?.name && (
                        <span className="text-xs text-brand-200 ml-1">— {box.address.name}</span>
                      )}
                    </div>
                    <div className="px-4 py-4">
                      <OverseasAddressPicker
                        value={box.address}
                        onChange={(addr) =>
                          setBoxes((prev) => prev.map((b) => (b.id === box.id ? { ...b, address: addr } : b)))
                        }
                        customerId={customerId}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── 인보이스 ──────────────────────────────── */}
        {showMainStep(3) && (
          <>
            <div className="bg-amber-50 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-700 leading-relaxed">
                세관 신고를 위한 물품 내역입니다. <strong>영문으로</strong> 입력해주세요.
                실제 가격을 정확히 기재해주세요 (USD 기준).
              </p>
            </div>

            {boxes.map((box, boxIdx) => {
              const inv = boxInvoices[boxIdx] ?? [newItem()];
              const updateItem = (itemIdx: number, patch: Partial<InvoiceItem>) =>
                setBoxInvoices((prev) => {
                  const next = prev.map((arr) => [...arr]);
                  next[boxIdx] = next[boxIdx].map((it, i) => (i === itemIdx ? { ...it, ...patch } : it));
                  return next;
                });
              const removeItem = (itemIdx: number) =>
                setBoxInvoices((prev) => {
                  const next = prev.map((arr) => [...arr]);
                  next[boxIdx] = next[boxIdx].filter((_, i) => i !== itemIdx);
                  return next;
                });
              const addItem = () =>
                setBoxInvoices((prev) => {
                  const next = prev.map((arr) => [...arr]);
                  next[boxIdx] = [...next[boxIdx], newItem()];
                  return next;
                });

              return (
                <div key={box.id} className="space-y-3">
                  {boxes.length > 1 && (
                    <div className="flex items-center gap-2 pt-1">
                      <Package size={14} className="text-brand-500 shrink-0" />
                      <p className="text-sm font-bold text-gray-800">
                        {box.id}번 박스 인보이스
                        {box.address?.name ? (
                          <span className="text-xs font-normal text-gray-400 ml-1.5">— {box.address.name}</span>
                        ) : null}
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {inv.map((item, idx) => (
                      <div key={item.key} className="bg-white rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold text-gray-500">물품 {idx + 1}</span>
                          {inv.length > 1 && (
                            <button
                              onClick={() => removeItem(idx)}
                              className="p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        <div className="space-y-2.5">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">
                              품목명 (영문) <span className="text-red-400">*</span>
                            </label>
                            <input
                              value={item.name_en}
                              onChange={(e) => updateItem(idx, { name_en: e.target.value })}
                              placeholder="e.g. Clothing, Cosmetics, Electronics"
                              className={`w-full bg-gray-50 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 ${
                                !item.name_en.trim() ? "border-red-300 ring-1 ring-red-200" : "border-gray-100"
                              }`}
                            />
                            {!item.name_en.trim() && (
                              <p className="text-[10px] text-red-500 mt-0.5">품목명을 입력해주세요</p>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">수량 *</label>
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => updateItem(idx, { quantity: parseInt(e.target.value) || 1 })}
                                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">
                                단가 (USD) <span className="text-red-400">*</span>
                              </label>
                              <div className={`flex items-center bg-gray-50 border rounded-xl px-3 py-2 ${
                                item.unit_price_usd <= 0 ? "border-red-300 ring-1 ring-red-200" : "border-gray-100"
                              }`}>
                                <span className="text-xs text-gray-400 mr-1.5 shrink-0">$</span>
                                <input
                                  type="number"
                                  min={0.01}
                                  step={0.01}
                                  value={item.unit_price_usd || ""}
                                  placeholder="0.00"
                                  onChange={(e) => updateItem(idx, { unit_price_usd: parseFloat(e.target.value) || 0 })}
                                  className="flex-1 bg-transparent text-sm text-gray-900 outline-none min-w-0"
                                />
                              </div>
                              {item.unit_price_usd <= 0 && (
                                <p className="text-[10px] text-red-500 mt-0.5">금액을 입력해주세요</p>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">HS코드 (선택)</label>
                              <input
                                value={item.hs_code}
                                onChange={(e) => updateItem(idx, { hs_code: e.target.value })}
                                placeholder="6단위"
                                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 mb-1">원산지 (선택)</label>
                              <input
                                value={item.origin_country}
                                onChange={(e) => updateItem(idx, { origin_country: e.target.value })}
                                placeholder="KR"
                                className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={addItem}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-brand-300 hover:text-brand-600 transition-colors"
                  >
                    <Plus size={15} /> {boxes.length > 1 ? `${box.id}번 박스 물품 추가` : "물품 추가"}
                  </button>
                </div>
              );
            })}

            <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-600">총 신고 금액</span>
              <span className="text-sm font-bold text-gray-900">USD {customsValue.toFixed(2)}</span>
            </div>

            {usRequiresEmsPremium && (
              <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 text-xs text-violet-900 leading-relaxed">
                신고가액이 USD {US_POSTAL_DDP_MAX_USD}을 초과해 <span className="font-semibold">EMS 프리미엄({EMS_PREMIUM_CARRIER})</span>으로 자동 전환됩니다.
                {dutyPrepaid
                  ? " FedEx 관세 선납(DDP)이 적용되며, 견적 확정 시 배송비와 함께 결제됩니다."
                  : " 관세 선납(DDP)을 켜면 FedEx 경로로 관세를 미리 납부할 수 있습니다."}
              </div>
            )}

            {showDdpOption && (
              <>
                <div className="w-full text-left flex items-center gap-3 p-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50">
                  <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 bg-emerald-600 border-emerald-600">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-emerald-600" />
                      관세 선납 (DDP)
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">필수</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      미국·영국 — 관세를 미리 납부해 받는 분 추가 부담 없음.
                      {usRequiresEmsPremium && ` 미국 $${US_POSTAL_DDP_MAX_USD}+는 FedEx(${EMS_PREMIUM_CARRIER}) DDP.`}
                      {" "}견적 확정 시 배송비와 함께 결제됩니다.
                    </p>
                  </div>
                </div>

                {dutyPrepaid && ddpBoxSummaries.filter((s) => isDdpEligibleForShipment(s.country, s.value, shippingMethod)).map((s) => (
                  <div
                    key={s.boxId}
                    className={`rounded-xl px-4 py-3 border text-xs ${
                      s.eligible
                        ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                        : "bg-amber-50 border-amber-100 text-amber-800"
                    }`}
                  >
                    {boxes.length > 1 && (
                      <p className="font-semibold mb-1">{s.boxId}번 박스 · {getDdpCountryLabel(s.country)}</p>
                    )}
                    {s.eligible ? (
                      <p>
                        예상 관세 선납 약 <span className="font-bold">{s.depositKrw.toLocaleString()}원</span>
                        {s.estimateUsd > 0 && ` (USD ${s.estimateUsd.toFixed(2)} 환산)`}
                        {s.ddpPath === "premium" && (
                          <span className="text-emerald-600/80"> · FedEx DDP</span>
                        )}
                        {boxes.length === 1 && getDdpCountryLabel(s.country) && s.ddpPath !== "premium" && (
                          <span className="text-emerald-600/80"> · {getDdpCountryLabel(s.country)}</span>
                        )}
                      </p>
                    ) : (
                      <p>{s.ineligibleReason ?? "관세 선납을 적용할 수 없습니다."}</p>
                    )}
                  </div>
                ))}
              </>
            )}

            {insuranceEnabled && (
              <div className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-brand-800">보험 가입 신고가액</span>
                  <span className="text-sm font-bold text-brand-900">USD {customsValue.toFixed(2)}</span>
                </div>
                <p className="text-xs text-brand-700/80">
                  EMS 보험가액(원화 환산): 약 {usdToBoprcKrw(customsValue, emsUsdKrwRate).toLocaleString()}원
                  {emsExchangeInfo?.as_of_date_display
                    ? ` · 1 USD = ${emsUsdKrwRate.toLocaleString()}원 (${emsExchangeInfo.as_of_date_display})`
                    : ""}
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 rounded-xl px-4 py-3">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}
          </>
        )}
        </>
        )}

      </div>

      {/* 하단 버튼 */}
      <div className="fixed left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 z-[60]" style={{ bottom: "calc(60px + var(--sab, 0px))" }}>
        <div className="max-w-[600px] mx-auto">
          {isSimple && mainFlowStep < MAIN_FLOW_STEP_COUNT ? (
            <div className="flex gap-2">
              {mainFlowStep > 1 && (
                <button
                  type="button"
                  onClick={() => { setFlowStep(flowStep - 1); setError(""); }}
                  className="flex-1 py-4 rounded-2xl text-sm font-bold border border-gray-200 text-gray-700"
                >
                  이전
                </button>
              )}
              <button
                type="button"
                onClick={handleFlowNext}
                disabled={!canProceed()}
                className={`${mainFlowStep > 1 ? "flex-[2]" : "w-full"} flex items-center justify-center gap-2 bg-brand-600 text-white font-bold py-4 rounded-2xl disabled:opacity-40`}
              >
                다음 <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (isAdvanced && hasBoxSetupStep && !prepareMainFlowFromBoxes()) {
                  setError("박스에 담을 내품을 선택해주세요.");
                  return;
                }
                if (!canProceedForMainStep(2) || !canProceedForMainStep(3)) {
                  setError("배송지·인보이스 정보를 확인해주세요.");
                  return;
                }
                submit();
              }}
              disabled={submitting || (hasBoxSetupStep && totalAssigned === 0 && isAdvanced)}
              className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white font-bold py-4 rounded-2xl disabled:opacity-60"
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
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    }>
      <ShippingRequestContent />
    </Suspense>
  );
}
