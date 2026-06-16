"use client";

import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Package, Truck, MapPin,
  CheckCircle, Loader2, Plus, Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AddressSearchButton } from "@/components/ui/AddressSearchButton";
import { useFlowMode } from "@/lib/flow-mode";
import { CARD_THEME_MAP } from "@/app/(main)/storage/constants";

// ── 타입 ──────────────────────────────────────────────────────
interface PreInvoiceItem { name_en: string; quantity: number; unit_price_usd: number; }

interface Parcel {
  id: string;
  tracking_no: string | null;
  sender_name: string | null;
  sender_address: string | null;
  weight_actual: number | null;
  status: string;
  pre_invoice_items: PreInvoiceItem[] | null;
  customer_storage_id?: string | null;
}

// 아이템 선택 단위 (parcel 내 개별 내품) — 국제 배송과 동일 구조
interface SelectableItem {
  key: string;        // `${parcelId}__${itemIndex}`
  parcelId: string;
  name_en: string;
  quantity: number;
  unit_price_usd: number;
}

interface BoxItem { key: string; qty: number; }

interface DomesticAddress {
  id: string;
  label: string;
  name: string;
  phone: string | null;
  zipcode: string | null;
  address: string | null;
  address_detail: string | null;
  is_default: boolean;
}

interface BoxSetup {
  id: number;
  address: DomesticAddress | null;
  items: BoxItem[];   // 국제와 동일: 아이템키+수량 배열
}

// ── 상수 ──────────────────────────────────────────────────────
const STEP_LABELS = ["박스 구성", "포장·서비스", "수취인 주소", "최종 확인"] as const;
const TOTAL_STEPS = STEP_LABELS.length;

const PACKAGING_OPTS = [
  { code: "SAFE_PACK",   name: "안전포장",  desc: "에어캡·완충재 추가",       price: 3000 },
  { code: "REPACK",      name: "재포장",    desc: "새 박스로 교체",            price: 2000 },
  { code: "CONSOLIDATE", name: "합포장",    desc: "선택 물품을 하나로 합치기", price: 2000 },
] as const;

const ADDON_SERVICES = [
  { code: "RECEIPT_DISPOSE",  name: "영수증 폐기",  desc: "영수증·인보이스 제거",       badge: "무료" },
  { code: "PRICE_TAG_REMOVE", name: "가격표 제거",  desc: "태그·스티커 가격 표시 제거", badge: "무료" },
  { code: "OVERPACK_REMOVE",  name: "과포장 제거",  desc: "불필요한 박스·완충재 제거",  badge: "무료" },
];

const ITEMS_DESC_OPTS = ["의류", "신발", "가방", "전자제품", "화장품", "식품", "도서", "기타"];

// ── 메인 ──────────────────────────────────────────────────────
function DomesticShippingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { isSimple, isAdvanced } = useFlowMode();

  const urlParcelIds = useMemo(
    () => searchParams.get("parcels")?.split(",").filter(Boolean) ?? [],
    [searchParams],
  );
  const hasBoxSetupStep = urlParcelIds.length === 0;

  const [flowStep, setFlowStep] = useState(() => (urlParcelIds.length > 0 ? 2 : 1));
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // Step 1: 박스 구성
  const [shippableParcels, setShippableParcels] = useState<Parcel[]>([]);
  const [storageMap, setStorageMap] = useState<Map<string, { storage_name: string; card_color: string | null }>>(new Map());
  const [loadingParcels, setLoadingParcels] = useState(true);
  const [boxes, setBoxes] = useState<BoxSetup[]>([{ id: 1, address: null, items: [] }]);
  const [selectingForBoxId, setSelectingForBoxId] = useState<number | null>(null);
  const [tempQty, setTempQty] = useState<Map<string, number>>(new Map());
  const [expandedBoxAddress, setExpandedBoxAddress] = useState<number | null>(null);
  const [itemsDesc, setItemsDesc] = useState("의류");

  // 주소 데이터
  const [savedAddresses, setSavedAddresses] = useState<DomesticAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [defaultAddress, setDefaultAddress] = useState<DomesticAddress | null>(null);

  // 새 주소 입력 (Step 3 fallback)
  const [showNewAddr, setShowNewAddr] = useState(false);
  const [newName, setNewName]   = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newZip, setNewZip]     = useState("");
  const [newAddr1, setNewAddr1] = useState("");
  const [newAddr2, setNewAddr2] = useState("");
  const [saveAddr, setSaveAddr] = useState(false);

  // Step 2
  const [packOpts, setPackOpts] = useState<Record<string, boolean>>({ SAFE_PACK: false, REPACK: false, CONSOLIDATE: false });
  const [addonSet, setAddonSet] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");

  const loadingRef = useRef(false);

  // ── 데이터 로드 ───────────────────────────────────────────────
  const loadParcels = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const supabaseClient = createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();
    const [parcelRes, { data: storageData }] = await Promise.all([
      fetch("/api/parcels?shippable=true"),
      user ? supabaseClient.from("customer_storages").select("id, storage_name, card_color").eq("user_id", user.id) : Promise.resolve({ data: [] }),
    ]);
    if (parcelRes.ok) {
      const parcels: Parcel[] = (await parcelRes.json()).parcels ?? [];
      const sMap = new Map<string, { storage_name: string; card_color: string | null }>();
      for (const s of storageData ?? []) sMap.set(s.id, { storage_name: s.storage_name, card_color: s.card_color });
      setStorageMap(sMap);
      setShippableParcels(parcels);
    }
    setLoadingParcels(false);
    loadingRef.current = false;
  }, []);

  // URL parcels 직접 진입: 해당 파셀 fetch + 기본 주소 세팅
  useEffect(() => {
    if (urlParcelIds.length === 0) return;
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: parcelData }, { data: addrData }] = await Promise.all([
        supabase
          .from("parcels")
          .select("id, tracking_no, sender_name, sender_address, status, weight_actual, pre_invoice_items")
          .in("id", urlParcelIds)
          .eq("customer_id", user.id),
        supabase
          .from("customer_addresses")
          .select("id, label, name, phone, zipcode, address, address_detail, is_default")
          .eq("customer_id", user.id)
          .eq("type", "pickup")
          .order("is_default", { ascending: false }),
      ]);
      if (parcelData) setShippableParcels(parcelData);
      setLoadingParcels(false);
      const defAddr = (addrData ?? []).find((a) => a.is_default) ?? addrData?.[0];
      if (defAddr) {
        setDefaultAddress(defAddr);
        setBoxes([{ id: 1, address: defAddr, items: [] }]);
      }
    };
    run();
  }, [urlParcelIds]);

  const loadAddresses = useCallback(async () => {
    setLoadingAddresses(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingAddresses(false); return; }
    const { data } = await supabase
      .from("customer_addresses")
      .select("id, label, name, phone, zipcode, address, address_detail, is_default")
      .eq("customer_id", user.id).eq("type", "pickup")
      .order("is_default", { ascending: false }).order("created_at", { ascending: false });
    const list = (data ?? []) as DomesticAddress[];
    setSavedAddresses(list);
    const def = list.find(a => a.is_default) ?? list[0] ?? null;
    setDefaultAddress(def);
    // 박스에 기본 주소 세팅 (아직 없는 경우)
    if (def) setBoxes(prev => prev.map(b => b.address ? b : { ...b, address: def }));
    setLoadingAddresses(false);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      loadParcels();
      loadAddresses();
    });
  }, [supabase, router, loadParcels, loadAddresses]);

  // parcel → 개별 내품 아이템 플랫화 (국제 배송과 동일 구조)
  const selectableItems = useMemo<SelectableItem[]>(() => {
    const result: SelectableItem[] = [];
    for (const p of shippableParcels) {
      const items = p.pre_invoice_items;
      if (items && items.length > 0) {
        items.forEach((item, idx) => {
          result.push({ key: `${p.id}__${idx}`, parcelId: p.id, name_en: item.name_en, quantity: item.quantity, unit_price_usd: item.unit_price_usd });
        });
      } else {
        result.push({ key: `${p.id}__0`, parcelId: p.id, name_en: p.sender_name ?? p.tracking_no ?? "물품", quantity: 1, unit_price_usd: 0 });
      }
    }
    return result;
  }, [shippableParcels]);

  // ── 계산 ─────────────────────────────────────────────────────
  const packagingFee = useMemo(
    () => PACKAGING_OPTS.filter(o => packOpts[o.code]).reduce((s, o) => s + o.price, 0),
    [packOpts],
  );
  const activePackaging = PACKAGING_OPTS.filter(o => packOpts[o.code]);
  const activeAddons    = ADDON_SERVICES.filter(o => addonSet.has(o.code));
  // 선택된 총 아이템 수 (모든 박스의 qty 합산)
  const totalItems = boxes.reduce((s, b) => s + b.items.reduce((ss, bi) => ss + bi.qty, 0), 0);
  // 선택된 고유 소포 수 (박스 전체 기준)
  const totalParcels = useMemo(() => {
    const ids = new Set<string>();
    for (const b of boxes) for (const bi of b.items) ids.add(bi.key.split("__")[0]);
    return ids.size;
  }, [boxes]);

  // ── 박스 관리 ─────────────────────────────────────────────────
  function addBox() {
    const nextId = boxes.length > 0 ? Math.max(...boxes.map(b => b.id)) + 1 : 1;
    setBoxes(prev => [...prev, { id: nextId, address: defaultAddress, items: [] }]);
  }

  function removeBox(boxId: number) {
    if (boxes.length <= 1) return;
    const target = boxes.find(b => b.id === boxId);
    if (!target) return;
    const remaining = boxes.filter(b => b.id !== boxId);
    // 다른 박스에 없는 고아 아이템을 박스1로 병합 (국제와 동일)
    const keepKeys = new Set(remaining.flatMap(b => b.items.map(bi => bi.key)));
    const orphans = target.items.filter(bi => !keepKeys.has(bi.key));
    if (orphans.length > 0) remaining[0] = { ...remaining[0], items: [...remaining[0].items, ...orphans] };
    setBoxes(remaining);
  }

  // 다른 박스들에서 해당 아이템키의 총 수량 (국제와 동일)
  const getOtherBoxQty = useCallback((itemKey: string, excludeBoxId: number): number => {
    return boxes.filter(b => b.id !== excludeBoxId)
      .reduce((sum, b) => sum + (b.items.find(bi => bi.key === itemKey)?.qty ?? 0), 0);
  }, [boxes]);

  // ── 담기 모드 (국제와 동일 로직) ────────────────────────────────
  const openItemSelect = useCallback((boxId: number) => {
    const box = boxes.find(b => b.id === boxId);
    const initMap = new Map<string, number>();
    (box?.items ?? []).forEach(bi => initMap.set(bi.key, bi.qty));
    setTempQty(initMap);
    setSelectingForBoxId(boxId);
    setExpandedBoxAddress(null);
  }, [boxes]);

  const confirmItemSelect = useCallback(() => {
    if (selectingForBoxId === null) return;
    const newItems: BoxItem[] = [];
    tempQty.forEach((qty, key) => { if (qty > 0) newItems.push({ key, qty }); });
    setBoxes(prev => prev.map(b => b.id === selectingForBoxId ? { ...b, items: newItems } : b));
    setSelectingForBoxId(null);
  }, [selectingForBoxId, tempQty]);

  // ── 네비게이션 ────────────────────────────────────────────────
  function handleBack() {
    setError("");
    if (selectingForBoxId !== null) { setSelectingForBoxId(null); return; }
    if (expandedBoxAddress !== null) { setExpandedBoxAddress(null); return; }
    if (flowStep <= 1) { router.back(); return; }
    setFlowStep(s => s - 1);
  }

  function handleNext() {
    setError("");
    if (flowStep === 1 && totalItems === 0) { setError("배송할 물품을 1개 이상 선택해주세요."); return; }
    if (flowStep === 3) {
      const allHaveAddr = boxes.every(b => b.address?.name && b.address?.zipcode);
      if (!allHaveAddr && !showNewAddr) { setError("모든 박스의 수취인 주소를 설정해주세요."); return; }
      if (showNewAddr && (!newName || !newPhone || !newZip || !newAddr1)) { setError("수취인 정보를 모두 입력해주세요."); return; }
    }
    setFlowStep(s => s + 1);
  }

  // ── 제출 ─────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      // 새 주소 저장
      if (showNewAddr && saveAddr && newName && newZip && newAddr1) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("customer_addresses").insert({
            customer_id: user.id, type: "pickup",
            label: newAddr2 ? `${newAddr1} ${newAddr2}` : newAddr1,
            name: newName, phone: newPhone, zipcode: newZip,
            address: newAddr1, address_detail: newAddr2, is_default: false,
          });
        }
      }

      for (const box of boxes) {
        // URL 직접 진입이면 urlParcelIds 전체, 아니면 박스에 담긴 parcelIds
        const parcelIds = urlParcelIds.length > 0
          ? urlParcelIds
          : (box.items.length === 0 ? [] : [...new Set(box.items.map(bi => bi.key.split("__")[0]))]);
        if (parcelIds.length === 0) continue;
        const addr = box.address ?? (showNewAddr
          ? { name: newName, phone: newPhone, zipcode: newZip, address: newAddr1, address_detail: newAddr2 } as DomesticAddress
          : null);
        if (!addr) continue;
        const res = await fetch("/api/domestic-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient_name:  addr.name,
            recipient_phone: addr.phone ?? "",
            recipient_zip:   addr.zipcode ?? "",
            recipient_addr1: addr.address ?? "",
            recipient_addr2: addr.address_detail ?? "",
            parcel_ids:      parcelIds,
            items_desc:      itemsDesc,
            packaging_type:  activePackaging.map(o => o.code).join(",") || "NONE",
            packaging_fee:   packagingFee,
            add_services:    activeAddons.map(o => o.code),
            notes:           notes || null,
            delivery_msg:    null,
          }),
        });
        if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? "신청에 실패했습니다."); }
      }
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "신청 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── 플로우 헤더 ───────────────────────────────────────────────
  function renderFlowHeader(subtitle?: string) {
    const label = selectingForBoxId !== null
      ? `${selectingForBoxId}번 박스에 담기`
      : STEP_LABELS[flowStep - 1];
    const displayStep = selectingForBoxId !== null ? 1 : flowStep;

    return (
      <div className="bg-white border-b border-gray-100 sticky z-10" style={{ top: "var(--sat, 0px)" }}>
        <div className="max-w-[600px] mx-auto flex items-center gap-3 px-4 py-3">
          <button type="button" onClick={handleBack} className="p-1 -ml-1">
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <div className="flex-1 min-w-0">
            {isSimple ? (
              <>
                <p className="text-xs text-gray-400">Step {displayStep} / {TOTAL_STEPS}</p>
                <p className="text-sm font-bold text-gray-900 truncate">{label}</p>
                {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
              </>
            ) : (
              <>
                <p className="text-base font-bold text-gray-900">국내 배송 신청</p>
                <p className="text-xs text-gray-400">고급모드 · 한 페이지에 입력</p>
              </>
            )}
          </div>
          <Truck size={18} className="text-blue-500 shrink-0" />
        </div>
        {isSimple && (
          <div className="max-w-[600px] mx-auto flex gap-1.5 px-4 pb-3">
            {STEP_LABELS.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
                i + 1 <= (selectingForBoxId !== null ? 1 : flowStep) ? "bg-blue-600" : "bg-gray-200"
              }`} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── 완료 화면 ────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={44} className="text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">국내 배송 신청 완료 🎉</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            관리자가 확인 후 우체국 소포를 접수합니다.<br />운송장번호 발행 시 알림을 보내드립니다.
          </p>
          {packagingFee > 0 && (
            <div className="bg-blue-50 rounded-2xl p-3 text-sm text-blue-800">
              포장 서비스 요금 <span className="font-bold">{packagingFee.toLocaleString()}원</span>이 추가됩니다.
            </div>
          )}
          <div className="space-y-2 pt-2">
            <button onClick={() => router.push("/orders")} className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-2xl text-sm">배송현황 보기</button>
            <button onClick={() => router.push("/storage")} className="w-full py-3.5 bg-gray-100 text-gray-700 font-semibold rounded-2xl text-sm">스토리지로 돌아가기</button>
          </div>
        </div>
      </div>
    );
  }

  // ── 담기 모드 (국제 배송과 동일 구조) ───────────────────────────
  if (selectingForBoxId !== null) {
    const parcelGroups = shippableParcels.map(p => ({
      parcel: p,
      items: selectableItems.filter(it => it.parcelId === p.id),
    }));
    const totalSelected = Array.from(tempQty.values()).reduce((s, v) => s + v, 0);

    return (
      <div className="min-h-screen bg-gray-50 pb-[160px]">
        {renderFlowHeader("수량을 설정해주세요 — 같은 품목을 여러 박스에 나눠 담을 수 있어요")}
        <div className="max-w-[600px] mx-auto px-4 pt-4 space-y-4 pb-40">
          {loadingParcels ? (
            <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
          ) : shippableParcels.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
              <Package size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-500">출고 가능한 물품이 없습니다</p>
            </div>
          ) : parcelGroups.map(({ parcel: p, items: pItems }) => (
            <div key={p.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                <Package size={15} className="text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700 truncate">{p.tracking_no ?? "운송장번호 미등록"}</p>
                  <p className="text-[10px] text-gray-400">
                    {p.sender_address ?? p.sender_name ?? "발송인 미확인"}
                    {p.weight_actual ? ` · ${(p.weight_actual / 1000).toFixed(2)}kg` : ""}
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
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border text-green-700 bg-green-50 border-green-200 shrink-0">입고완료</span>
              </div>
              <div className="divide-y divide-gray-50">
                {pItems.map(item => {
                  const currentQty = tempQty.get(item.key) ?? 0;
                  const otherQty = getOtherBoxQty(item.key, selectingForBoxId!);
                  const maxQty = item.quantity - otherQty;
                  const isActive = currentQty > 0;
                  return (
                    <div key={item.key} className={`flex items-center gap-3 px-4 py-3 transition-colors ${isActive ? "bg-blue-50" : "bg-white"}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.name_en}</p>
                        <p className="text-xs text-gray-400">
                          재고 {item.quantity}개
                          {otherQty > 0 ? ` · 다른 박스 ${otherQty}개` : ""}
                          {item.unit_price_usd > 0 ? ` · $${item.unit_price_usd}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setTempQty(prev => { const next = new Map(prev); const v = (next.get(item.key) ?? 0) - 1; if (v <= 0) next.delete(item.key); else next.set(item.key, v); return next; })}
                          disabled={currentQty === 0}
                          className="w-8 h-8 rounded-lg border-2 border-gray-200 flex items-center justify-center text-gray-500 font-bold text-lg disabled:opacity-30 active:scale-90 transition-transform"
                        >–</button>
                        <span className={`w-8 text-center text-sm font-bold ${isActive ? "text-blue-600" : "text-gray-300"}`}>{currentQty}</span>
                        <button
                          type="button"
                          onClick={() => setTempQty(prev => { const next = new Map(prev); next.set(item.key, Math.min((next.get(item.key) ?? 0) + 1, maxQty)); return next; })}
                          disabled={currentQty >= maxQty}
                          className="w-8 h-8 rounded-lg border-2 border-blue-300 bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-lg disabled:opacity-30 active:scale-90 transition-transform"
                        >+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="fixed left-0 right-0 px-4 z-[60]" style={{ bottom: "calc(60px + var(--sab, 0px) + 12px)" }}>
          <div className="max-w-[600px] mx-auto">
            <button onClick={confirmItemSelect} disabled={totalSelected === 0}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 disabled:opacity-40 active:scale-[0.98] transition-transform"
            >
              <CheckCircle size={16} />
              {totalSelected > 0 ? `${totalSelected}개 담기 완료` : "물품을 선택해주세요"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 고급모드: 한 페이지 전체 렌더링 ─────────────────────────
  if (isAdvanced && selectingForBoxId === null) {
    const allItemCount = boxes.reduce((s, b) => s + b.items.reduce((ss, bi) => ss + bi.qty, 0), 0);
    return (
      <div className="min-h-screen bg-gray-50 pb-32">
        {renderFlowHeader()}
        <div className="max-w-[600px] mx-auto px-4 pt-5 space-y-6">

          {/* 박스 구성 */}
          <section className="space-y-4">
            <p className="text-sm font-bold text-gray-800">박스 구성</p>
            {loadingParcels ? (
              <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
            ) : shippableParcels.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                <p className="text-sm text-gray-500">출고 가능한 물품이 없습니다</p>
              </div>
            ) : (
              <>
                {boxes.map(box => {
                  const isAddrOpen = expandedBoxAddress === box.id;
                  return (
                    <div key={box.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                      <div className="flex items-center justify-between px-4 py-3 bg-blue-600">
                        <div className="flex items-center gap-2">
                          <Package size={15} className="text-white" />
                          <p className="text-sm font-bold text-white">{box.id}번 박스 {box.items.length > 0 ? `· ${box.items.reduce((s,bi)=>s+bi.qty,0)}개` : ""}</p>
                        </div>
                        <button type="button" onClick={() => setExpandedBoxAddress(isAddrOpen ? null : box.id)}
                          className="text-xs text-white/90 bg-white/20 px-2 py-1 rounded-full flex items-center gap-1">
                          <MapPin size={10} /> {box.address ? (box.address.label || box.address.name) : "배송지"}
                        </button>
                      </div>
                      {isAddrOpen && (
                        <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 space-y-2">
                          {savedAddresses.map(addr => (
                            <button key={addr.id} type="button"
                              onClick={() => { setBoxes(prev => prev.map(b => b.id === box.id ? { ...b, address: addr } : b)); setExpandedBoxAddress(null); }}
                              className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border-2 transition-all ${box.address?.id === addr.id ? "border-blue-500 bg-white" : "border-transparent bg-white hover:border-blue-200"}`}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900">{addr.name} <span className="text-xs text-gray-400">· {addr.label}</span></p>
                                <p className="text-xs text-gray-400">[{addr.zipcode}] {addr.address}</p>
                              </div>
                              {box.address?.id === addr.id && <CheckCircle size={14} className="text-blue-500 shrink-0 mt-0.5" />}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="p-4">
                        {box.items.map(bi => {
                          const item = selectableItems.find(it => it.key === bi.key);
                          if (!item) return null;
                          return (
                            <div key={bi.key} className="flex items-center gap-2 py-1.5 text-sm">
                              <p className="flex-1 text-gray-800 truncate">{item.name_en}</p>
                              <p className="text-xs text-gray-400">{bi.qty}개</p>
                            </div>
                          );
                        })}
                        <button type="button" onClick={() => openItemSelect(box.id)}
                          className="mt-2 w-full border-2 border-dashed border-blue-300 text-blue-600 text-sm font-bold py-3 rounded-xl">
                          + {box.items.length > 0 ? "내품 수정" : "박스에 담기"}
                        </button>
                      </div>
                    </div>
                  );
                })}
                <button type="button" onClick={addBox}
                  className="w-full border-2 border-dashed border-gray-200 text-gray-500 text-sm font-bold py-3 rounded-2xl hover:border-blue-300 hover:text-blue-600">
                  + 박스 추가
                </button>
              </>
            )}
          </section>

          {/* 포장 옵션 */}
          <section className="space-y-3">
            <p className="text-sm font-bold text-gray-800">포장 옵션 (선택)</p>
            {PACKAGING_OPTS.map(o => {
              const checked = packOpts[o.code];
              return (
                <button key={o.code} type="button" onClick={() => setPackOpts(p => ({ ...p, [o.code]: !p[o.code] }))}
                  className={`w-full text-left flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${checked ? "border-blue-500 bg-blue-50" : "border-gray-100 bg-white"}`}>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${checked ? "bg-blue-600 border-blue-600" : "border-gray-300"}`}>
                    {checked && <span className="text-white text-xs font-bold">✓</span>}
                  </div>
                  <div className="flex-1"><p className="text-sm font-semibold text-gray-800">{o.name}</p><p className="text-xs text-gray-400">{o.desc}</p></div>
                  <span className="text-xs font-semibold text-blue-600 shrink-0">+{o.price.toLocaleString()}원</span>
                </button>
              );
            })}
          </section>

          {/* 부가 서비스 */}
          <section className="space-y-3">
            <p className="text-sm font-bold text-gray-800">부가 서비스 (선택)</p>
            {ADDON_SERVICES.map(o => {
              const checked = addonSet.has(o.code);
              return (
                <button key={o.code} type="button" onClick={() => setAddonSet(prev => { const n = new Set(prev); checked ? n.delete(o.code) : n.add(o.code); return n; })}
                  className={`w-full text-left flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${checked ? "border-teal-500 bg-teal-50" : "border-gray-100 bg-white"}`}>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${checked ? "bg-teal-500 border-teal-500" : "border-gray-300"}`}>
                    {checked && <span className="text-white text-xs font-bold">✓</span>}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5"><span className="text-sm font-semibold text-gray-800">{o.name}</span><span className="text-[10px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">{o.badge}</span></div>
                    <p className="text-xs text-gray-400">{o.desc}</p>
                  </div>
                  <span className="text-xs font-semibold text-green-600 shrink-0">무료</span>
                </button>
              );
            })}
          </section>

          {/* 요청 메모 */}
          <section>
            <label className="block text-sm font-bold text-gray-800 mb-2">요청 메모 (선택)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="포장·처리 관련 특별 요청사항을 입력해주세요"
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </section>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">{error}</div>}
        </div>

        {/* 하단 신청 버튼 */}
        <div className="fixed left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 z-[60]" style={{ bottom: "calc(60px + var(--sab, 0px))" }}>
          <div className="max-w-[600px] mx-auto">
            <button type="button" onClick={() => {
              if (allItemCount === 0) { setError("배송할 물품을 1개 이상 선택해주세요."); return; }
              const allHaveAddr = boxes.every(b => b.items.length === 0 || b.address?.name);
              if (!allHaveAddr) { setError("모든 박스의 수취인 주소를 설정해주세요."); return; }
              handleSubmit();
            }} disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-4 rounded-2xl disabled:opacity-60">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle size={16} /> 국내 배송 신청하기</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP 1: 박스 구성 ────────────────────────────────────────
  if (flowStep === 1) {
    return (
      <div className="min-h-screen bg-gray-50 pb-[160px]">
        {renderFlowHeader("박스 개수를 정하고 내품을 담아주세요")}
        <div className="max-w-[600px] mx-auto px-4 pt-5 space-y-5 pb-40">
          {loadingParcels ? (
            <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
          ) : shippableParcels.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
              <Package size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-500">출고 가능한 물품이 없습니다</p>
              <p className="text-xs text-gray-400 mt-1">입고 완료된 물품이 없으면 출고신청을 할 수 없어요</p>
              <button onClick={() => router.push("/storage")} className="mt-5 bg-blue-600 text-white text-sm font-bold px-6 py-3 rounded-2xl">스토리지 보기</button>
            </div>
          ) : (
            <>
              {boxes.map(box => {
                const isAddrOpen = expandedBoxAddress === box.id;
                return (
                  <div key={box.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                    {/* 박스 헤더 */}
                    <div className="flex items-center justify-between px-4 py-3 bg-blue-600">
                      <div className="flex items-center gap-2">
                        <Package size={16} className="text-white" />
                        <p className="text-sm font-bold text-white">{box.id}번 박스</p>
                        {box.items.length > 0 && <span className="text-xs text-blue-200">{box.items.reduce((s,bi)=>s+bi.qty,0)}개</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedBoxAddress(isAddrOpen ? null : box.id)}
                          className="flex items-center gap-1 text-xs text-white/80 bg-white/20 px-2.5 py-1 rounded-full"
                        >
                          <MapPin size={11} />
                          {box.address ? (box.address.label || box.address.name) : "배송지 설정"}
                        </button>
                        {boxes.length > 1 && (
                          <button onClick={() => removeBox(box.id)}
                            className="w-6 h-6 flex items-center justify-center rounded-full bg-white/20 text-white/80 hover:bg-white/30 text-sm leading-none"
                          >×</button>
                        )}
                      </div>
                    </div>

                    {/* 인라인 주소 피커 */}
                    {isAddrOpen && (
                      <div className="px-4 py-4 bg-blue-50 border-b border-blue-100 space-y-2">
                        {loadingAddresses ? (
                          <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-blue-500" /></div>
                        ) : savedAddresses.length === 0 ? (
                          <p className="text-xs text-gray-500 text-center py-2">저장된 국내 주소가 없습니다</p>
                        ) : (
                          savedAddresses.map(addr => (
                            <button
                              key={addr.id}
                              type="button"
                              onClick={() => {
                                setBoxes(prev => prev.map(b => b.id === box.id ? { ...b, address: addr } : b));
                                setExpandedBoxAddress(null);
                              }}
                              className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border-2 transition-all ${
                                box.address?.id === addr.id ? "border-blue-500 bg-white" : "border-transparent bg-white hover:border-blue-200"
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <p className="text-sm font-semibold text-gray-900 truncate">{addr.label}</p>
                                  {addr.is_default && <Star size={11} className="text-amber-400 fill-amber-400 shrink-0" />}
                                </div>
                                <p className="text-xs text-gray-600">{addr.name} · {addr.phone}</p>
                                <p className="text-xs text-gray-400 truncate">[{addr.zipcode}] {addr.address}</p>
                              </div>
                              {box.address?.id === addr.id && <CheckCircle size={16} className="text-blue-500 shrink-0 mt-0.5" />}
                            </button>
                          ))
                        )}
                      </div>
                    )}

                    {/* 담긴 물품 목록 (아이템 기준) */}
                    <div className="divide-y divide-gray-50">
                      {box.items.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-4">아직 담은 내품이 없어요</p>
                      ) : box.items.map(bi => {
                        const item = selectableItems.find(it => it.key === bi.key);
                        if (!item) return null;
                        return (
                          <div key={bi.key} className="flex items-center gap-3 px-4 py-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{item.name_en}</p>
                              <p className="text-xs text-gray-400">{bi.qty}개{item.unit_price_usd > 0 ? ` · $${item.unit_price_usd}` : ""}</p>
                            </div>
                            <button type="button" onClick={() => setBoxes(prev => prev.map(b => b.id === box.id ? { ...b, items: b.items.filter(i => i.key !== bi.key) } : b))}
                              className="text-gray-300 hover:text-red-400 transition-colors p-1 text-lg leading-none">×</button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="px-4 pb-4 pt-2">
                      <button type="button" onClick={() => openItemSelect(box.id)}
                        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-blue-300 text-blue-600 text-sm font-bold py-3 rounded-xl hover:bg-blue-50 active:scale-[0.98] transition-all"
                      >
                        <span className="text-lg leading-none">+</span>
                        {box.items.length > 0 ? "내품 수정" : "박스에 담기"}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* 박스 추가 */}
              <button type="button" onClick={addBox}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 text-gray-500 text-sm font-bold py-4 rounded-2xl hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 active:scale-[0.98] transition-all"
              >
                <span className="text-lg leading-none">+</span> 박스 추가
              </button>

            </>
          )}
        </div>

        <div className="fixed left-0 right-0 px-4 z-[60]" style={{ bottom: "calc(60px + var(--sab, 0px) + 12px)" }}>
          <div className="max-w-[600px] mx-auto space-y-2">
            {error && <p className="text-xs text-red-500 text-center">{error}</p>}
            <button type="button" onClick={handleNext} disabled={totalItems === 0}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 disabled:opacity-40 active:scale-[0.98] transition-transform"
            >
              {totalItems > 0 ? `${totalItems}개 물품 — ` : ""}다음 <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP 2~4 공통 레이아웃 ────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {renderFlowHeader()}
      <div className="max-w-[600px] mx-auto px-4 pt-5 space-y-6">

        {/* ─── STEP 2: 포장·서비스 ─── */}
        {flowStep === 2 && (
          <>
            <p className="text-sm font-bold text-gray-800">포장 옵션 (선택)</p>
            <div className="space-y-2">
              {PACKAGING_OPTS.map(o => {
                const checked = packOpts[o.code];
                return (
                  <button key={o.code} type="button" onClick={() => setPackOpts(p => ({ ...p, [o.code]: !p[o.code] }))}
                    className={`w-full text-left flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${checked ? "border-blue-500 bg-blue-50" : "border-gray-100 bg-white"}`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${checked ? "bg-blue-600 border-blue-600" : "border-gray-300"}`}>
                      {checked && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">{o.name}</p>
                      <p className="text-xs text-gray-400">{o.desc}</p>
                    </div>
                    <span className="text-xs font-semibold text-blue-600 shrink-0">+{o.price.toLocaleString()}원</span>
                  </button>
                );
              })}
            </div>

            <p className="text-sm font-bold text-gray-800 pt-2">부가 서비스 (선택)</p>
            <div className="space-y-2">
              {ADDON_SERVICES.map(o => {
                const checked = addonSet.has(o.code);
                return (
                  <button key={o.code} type="button" onClick={() => setAddonSet(prev => { const n = new Set(prev); checked ? n.delete(o.code) : n.add(o.code); return n; })}
                    className={`w-full text-left flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${checked ? "border-teal-500 bg-teal-50" : "border-gray-100 bg-white"}`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${checked ? "bg-teal-500 border-teal-500" : "border-gray-300"}`}>
                      {checked && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-gray-800">{o.name}</span>
                        <span className="text-[10px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">{o.badge}</span>
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
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                placeholder="포장·처리 관련 특별 요청사항을 입력해주세요"
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </>
        )}

        {/* ─── STEP 3: 수취인 주소 ─── */}
        {flowStep === 3 && (
          <>
            {boxes.length === 1 ? (
              <>
                <p className="text-sm text-gray-500">수취인 주소를 선택하거나 새로 입력해주세요</p>
                {loadingAddresses ? (
                  <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
                ) : (
                  <>
                    {savedAddresses.length > 0 && !showNewAddr && (
                      <div className="space-y-2">
                        {savedAddresses.map(addr => (
                          <button key={addr.id} type="button" onClick={() => setBoxes(prev => prev.map((b, i) => i === 0 ? { ...b, address: addr } : b))}
                            className={`w-full text-left flex items-start gap-3 p-4 rounded-2xl border-2 transition-all ${
                              boxes[0].address?.id === addr.id ? "border-blue-500 bg-blue-50" : "border-gray-100 bg-white"
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${boxes[0].address?.id === addr.id ? "bg-blue-600 border-blue-600" : "border-gray-300"}`}>
                              {boxes[0].address?.id === addr.id && <span className="text-white text-[10px] font-bold">✓</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <p className="text-sm font-semibold text-gray-900 truncate">{addr.label}</p>
                                {addr.is_default && <Star size={11} className="text-amber-400 fill-amber-400 shrink-0" />}
                              </div>
                              <p className="text-xs text-gray-700">{addr.name} · {addr.phone}</p>
                              <p className="text-xs text-gray-500 truncate">[{addr.zipcode}] {addr.address} {addr.address_detail}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {!showNewAddr ? (
                      <button type="button" onClick={() => { setShowNewAddr(true); setBoxes(prev => prev.map((b, i) => i === 0 ? { ...b, address: null } : b)); }}
                        className="w-full flex items-center justify-center gap-2 py-3.5 border-2 border-dashed border-gray-300 rounded-2xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-all"
                      ><Plus size={16} /> 새 주소 직접 입력</button>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-gray-800">새 수취인 주소</p>
                          {savedAddresses.length > 0 && (
                            <button type="button" onClick={() => { setShowNewAddr(false); setBoxes(prev => prev.map((b, i) => i === 0 ? { ...b, address: savedAddresses[0] } : b)); }}
                              className="text-xs text-blue-600">저장된 주소 선택</button>
                          )}
                        </div>
                        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-xs text-gray-500 mb-1 block">이름 *</label>
                              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="홍길동" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-200" /></div>
                            <div><label className="text-xs text-gray-500 mb-1 block">연락처 *</label>
                              <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="01012345678" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-200" /></div>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">주소 검색 *</label>
                            <div className="flex gap-2">
                              <input value={newZip ? `[${newZip}] ${newAddr1}` : ""} readOnly placeholder="주소 검색 버튼을 클릭하세요"
                                className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50" />
                              <AddressSearchButton onSelect={(z, a) => { setNewZip(z); setNewAddr1(a); }}
                                className="px-3 py-2.5 bg-blue-600 text-white text-sm rounded-xl whitespace-nowrap" />
                            </div>
                          </div>
                          <div><label className="text-xs text-gray-500 mb-1 block">상세주소</label>
                            <input value={newAddr2} onChange={e => setNewAddr2(e.target.value)} placeholder="아파트 동호수 등"
                              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-200" /></div>
                          <label className="flex items-center gap-2 text-sm text-gray-600 pt-1">
                            <input type="checkbox" checked={saveAddr} onChange={e => setSaveAddr(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                            이 주소를 국내 주소록에 저장
                          </label>
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              /* 다중 박스 — 박스별 주소 확인 */
              <div className="space-y-4">
                <p className="text-sm text-gray-500">박스별 수취인 주소를 확인·수정해주세요</p>
                {boxes.map(box => (
                  <div key={box.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                    <div className="flex items-center gap-2 px-4 py-3 bg-blue-600">
                      <MapPin size={14} className="text-white" />
                      <p className="text-sm font-bold text-white">{box.id}번 박스 배송지</p>
                      {box.address?.name && <span className="text-xs text-blue-200 ml-1">— {box.address.name}</span>}
                    </div>
                    <div className="px-4 py-4 space-y-2">
                      {savedAddresses.map(addr => (
                        <button key={addr.id} type="button" onClick={() => setBoxes(prev => prev.map(b => b.id === box.id ? { ...b, address: addr } : b))}
                          className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border-2 transition-all ${box.address?.id === addr.id ? "border-blue-500 bg-blue-50" : "border-gray-100"}`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 ${box.address?.id === addr.id ? "bg-blue-600 border-blue-600" : "border-gray-300"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{addr.name} <span className="text-gray-400 font-normal text-xs">· {addr.label}</span></p>
                            <p className="text-xs text-gray-400 truncate">[{addr.zipcode}] {addr.address}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
          </>
        )}

        {/* ─── STEP 4: 최종 확인 ─── */}
        {flowStep === 4 && (
          <>
            {boxes.filter(b => b.items.length > 0).map(box => (
              <div key={box.id} className="space-y-3">
                {boxes.length > 1 && (
                  <div className="flex items-center gap-2 pt-1">
                    <Package size={14} className="text-blue-500 shrink-0" />
                    <p className="text-sm font-bold text-gray-800">{box.id}번 박스</p>
                    {box.address?.name && <span className="text-xs text-gray-400">— {box.address.name}</span>}
                  </div>
                )}
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <p className="text-sm font-bold text-gray-500 mb-3">📦 배송 물품 ({box.items.length}종)</p>
                  {box.items.map(bi => {
                    const item = selectableItems.find(it => it.key === bi.key);
                    if (!item) return null;
                    return (
                      <div key={bi.key} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                        <Package size={13} className="text-gray-400 shrink-0" />
                        <p className="text-sm text-gray-800 flex-1 truncate">{item.name_en}</p>
                        <p className="text-xs text-gray-400">{bi.qty}개</p>
                      </div>
                    );
                  })}
                  <p className="text-xs text-gray-400 mt-2">내용품: {itemsDesc}</p>
                </div>
                {box.address && (
                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <p className="text-sm font-bold text-gray-500 mb-3">📍 수취인</p>
                    <div className="space-y-1 text-sm">
                      <p className="font-semibold text-gray-900">{box.address.name}</p>
                      <p className="text-gray-600">{box.address.phone}</p>
                      <p className="text-gray-600">[{box.address.zipcode}] {box.address.address}</p>
                      {box.address.address_detail && <p className="text-gray-500">{box.address.address_detail}</p>}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* 포장·서비스 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-sm font-bold text-gray-500 mb-3">🎁 포장·서비스</p>
              {activePackaging.length === 0 && activeAddons.length === 0 ? (
                <p className="text-sm text-gray-400">선택 없음</p>
              ) : (
                <div className="space-y-1.5">
                  {activePackaging.map(o => (
                    <div key={o.code} className="flex justify-between text-sm">
                      <span className="text-gray-700">{o.name}</span>
                      <span className="text-blue-600 font-semibold">+{o.price.toLocaleString()}원</span>
                    </div>
                  ))}
                  {activeAddons.map(o => (
                    <div key={o.code} className="flex justify-between text-sm">
                      <span className="text-gray-700">{o.name}</span>
                      <span className="text-teal-600 font-semibold">무료</span>
                    </div>
                  ))}
                </div>
              )}
              {notes && <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-2">메모: {notes}</p>}
              {packagingFee > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between font-bold text-sm">
                  <span>포장 서비스 합계</span><span className="text-blue-600">{packagingFee.toLocaleString()}원</span>
                </div>
              )}
            </div>

            {/* 배송 수단 */}
            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 flex items-center gap-3">
              <Truck size={20} className="text-blue-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-blue-900">우체국 소포</p>
                <p className="text-xs text-blue-600">배송비는 실측 무게에 따라 청구됩니다</p>
              </div>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">{error}</div>}
          </>
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="fixed left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 z-[60]" style={{ bottom: "calc(60px + var(--sab, 0px))" }}>
        <div className="max-w-[600px] mx-auto">
          {flowStep < TOTAL_STEPS ? (
            <div className="flex gap-2">
              {flowStep > 1 && (
                <button type="button" onClick={() => { setFlowStep(s => s - 1); setError(""); }}
                  className="flex-1 py-4 rounded-2xl text-sm font-bold border border-gray-200 text-gray-700">이전</button>
              )}
              <button type="button" onClick={handleNext}
                className={`${flowStep > 1 ? "flex-[2]" : "w-full"} flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-4 rounded-2xl`}
              >다음 <ArrowRight size={16} /></button>
            </div>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-4 rounded-2xl disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle size={16} /> 국내 배송 신청하기</>}
            </button>
          )}
        </div>
        {error && flowStep < TOTAL_STEPS && (
          <p className="max-w-[600px] mx-auto mt-2 text-xs text-red-500 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}

export default function DomesticShippingPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><Loader2 size={32} className="animate-spin text-blue-500" /></div>}>
      <DomesticShippingContent />
    </Suspense>
  );
}
