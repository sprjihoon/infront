"use client";

import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Package, Truck, MapPin,
  CheckCircle, Loader2, Plus, Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AddressSearchButton } from "@/components/ui/AddressSearchButton";

// ── 타입 ──────────────────────────────────────────────────────
interface Parcel {
  id: string;
  tracking_no: string | null;
  sender_name: string | null;
  sender_address: string | null;
  weight_actual: number | null;
  status: string;
}

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
  const supabase = createClient();

  const [flowStep, setFlowStep] = useState(1); // 1~4
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // Step 1: 배송 물품 구성
  const [shippableParcels, setShippableParcels] = useState<Parcel[]>([]);
  const [loadingParcels, setLoadingParcels] = useState(true);
  // parcel selection: tempSelected during selection mode, selectedIds confirmed
  const [selectingMode, setSelectingMode] = useState(false);
  const [tempSelected, setTempSelected] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [itemsDesc, setItemsDesc] = useState("의류");

  // Step 2: 포장·서비스
  const [packOpts, setPackOpts] = useState<Record<string, boolean>>({ SAFE_PACK: false, REPACK: false, CONSOLIDATE: false });
  const [addonSet, setAddonSet] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");

  // Step 3: 수취인 주소
  const [savedAddresses, setSavedAddresses] = useState<DomesticAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [selectedAddrId, setSelectedAddrId] = useState<string | null>(null);
  const [showNewAddr, setShowNewAddr] = useState(false);
  const [newName, setNewName]   = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newZip, setNewZip]     = useState("");
  const [newAddr1, setNewAddr1] = useState("");
  const [newAddr2, setNewAddr2] = useState("");
  const [saveAddr, setSaveAddr] = useState(false);

  const loadingRef = useRef(false);

  // ── 데이터 로드 ──────────────────────────────────────────────
  const loadParcels = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const res = await fetch("/api/parcels?shippable=true");
    if (res.ok) {
      const json = await res.json();
      setShippableParcels(json.parcels ?? []);
    }
    setLoadingParcels(false);
    loadingRef.current = false;
  }, []);

  const loadAddresses = useCallback(async () => {
    setLoadingAddresses(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("customer_addresses")
      .select("id, label, name, phone, zipcode, address, address_detail, is_default")
      .eq("customer_id", user.id)
      .eq("type", "pickup")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    const list = data ?? [];
    setSavedAddresses(list);
    if (!selectedAddrId) {
      const def = list.find(a => a.is_default) ?? list[0];
      if (def) setSelectedAddrId(def.id);
    }
    setLoadingAddresses(false);
  }, [supabase, selectedAddrId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/login"); return; }
      loadParcels();
    });
  }, [supabase, router, loadParcels]);

  useEffect(() => {
    if (flowStep === 3) loadAddresses();
  }, [flowStep, loadAddresses]);

  // ── 계산 ─────────────────────────────────────────────────────
  const packagingFee = useMemo(
    () => PACKAGING_OPTS.filter(o => packOpts[o.code]).reduce((s, o) => s + o.price, 0),
    [packOpts],
  );
  const activePackaging = PACKAGING_OPTS.filter(o => packOpts[o.code]);
  const activeAddons    = ADDON_SERVICES.filter(o => addonSet.has(o.code));

  const selectedAddr = savedAddresses.find(a => a.id === selectedAddrId);
  const recipientForSubmit = useMemo(() => {
    if (showNewAddr || !selectedAddr) {
      return { name: newName, phone: newPhone, zip: newZip, addr1: newAddr1, addr2: newAddr2 };
    }
    return {
      name:  selectedAddr.name,
      phone: selectedAddr.phone ?? "",
      zip:   selectedAddr.zipcode ?? "",
      addr1: selectedAddr.address ?? "",
      addr2: selectedAddr.address_detail ?? "",
    };
  }, [showNewAddr, selectedAddr, newName, newPhone, newZip, newAddr1, newAddr2]);

  // ── 물품 선택 모드 ────────────────────────────────────────────
  function openSelectMode() {
    const init = new Set(selectedIds);
    setTempSelected(init);
    setSelectingMode(true);
  }

  function confirmSelectMode() {
    setSelectedIds(Array.from(tempSelected));
    setSelectingMode(false);
  }

  function toggleTemp(id: string) {
    setTempSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── 네비게이션 ────────────────────────────────────────────────
  function handleBack() {
    setError("");
    if (selectingMode) { setSelectingMode(false); return; }
    if (flowStep <= 1) { router.back(); return; }
    setFlowStep(s => s - 1);
  }

  function handleNext() {
    setError("");
    if (flowStep === 1 && selectedIds.length === 0) {
      setError("배송할 물품을 1개 이상 선택해주세요.");
      return;
    }
    if (flowStep === 3) {
      const r = recipientForSubmit;
      if (!r.name || !r.phone || !r.zip || !r.addr1) {
        setError("수취인 정보를 모두 입력해주세요.");
        return;
      }
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

      const r = recipientForSubmit;
      const res = await fetch("/api/domestic-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_name:  r.name,
          recipient_phone: r.phone,
          recipient_zip:   r.zip,
          recipient_addr1: r.addr1,
          recipient_addr2: r.addr2,
          parcel_ids:      selectedIds,
          items_desc:      itemsDesc,
          packaging_type:  activePackaging.map(o => o.code).join(",") || "NONE",
          packaging_fee:   packagingFee,
          add_services:    activeAddons.map(o => o.code),
          notes:           notes || null,
          delivery_msg:    null,
        }),
      });
      if (res.ok) {
        setDone(true);
      } else {
        const json = await res.json();
        throw new Error(json.error ?? "신청에 실패했습니다.");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "신청 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── 플로우 헤더 ───────────────────────────────────────────────
  function renderFlowHeader(subtitle?: string) {
    const label = selectingMode
      ? "박스에 담기"
      : STEP_LABELS[flowStep - 1];
    const displayStep = selectingMode ? 1 : flowStep;

    return (
      <div className="bg-white border-b border-gray-100 sticky z-10" style={{ top: "var(--sat, 0px)" }}>
        <div className="max-w-[600px] mx-auto flex items-center gap-3 px-4 py-3">
          <button type="button" onClick={handleBack} className="p-1 -ml-1">
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400">Step {displayStep} / {TOTAL_STEPS}</p>
            <p className="text-sm font-bold text-gray-900 truncate">{label}</p>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          <Truck size={18} className="text-blue-500 shrink-0" />
        </div>
        <div className="max-w-[600px] mx-auto flex gap-1.5 px-4 pb-3">
          {STEP_LABELS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i + 1 <= (selectingMode ? 1 : flowStep) ? "bg-blue-600" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
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
            관리자가 확인 후 우체국 소포를 접수합니다.<br />
            운송장번호 발행 시 알림을 보내드립니다.
          </p>
          {packagingFee > 0 && (
            <div className="bg-blue-50 rounded-2xl p-3 text-sm text-blue-800">
              포장 서비스 요금 <span className="font-bold">{packagingFee.toLocaleString()}원</span>이 추가됩니다.
            </div>
          )}
          <div className="space-y-2 pt-2">
            <button onClick={() => router.push("/orders")} className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-2xl text-sm">
              배송현황 보기
            </button>
            <button onClick={() => router.push("/warehouse")} className="w-full py-3.5 bg-gray-100 text-gray-700 font-semibold rounded-2xl text-sm">
              마이창고로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 물품 선택 모드 (담기 화면) ────────────────────────────────
  if (selectingMode) {
    const totalSelected = tempSelected.size;
    return (
      <div className="min-h-screen bg-gray-50 pb-[160px]">
        {renderFlowHeader("수량을 설정해주세요 — 담을 물품을 선택해주세요")}
        <div className="max-w-[600px] mx-auto px-4 pt-4 space-y-3 pb-40">
          {shippableParcels.map(p => {
            const checked = tempSelected.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleTemp(p.id)}
                className={`w-full text-left rounded-2xl shadow-sm overflow-hidden border-2 transition-all ${
                  checked ? "border-blue-500 bg-blue-50" : "border-transparent bg-white"
                }`}
              >
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <Package size={15} className="text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 truncate">
                      {p.tracking_no ?? "운송장번호 미등록"}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {p.sender_address ?? p.sender_name ?? "발송인 미확인"}
                      {p.weight_actual ? ` · ${(p.weight_actual / 1000).toFixed(2)}kg` : ""}
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    checked ? "bg-blue-600 border-blue-600" : "border-gray-300"
                  }`}>
                    {checked && <span className="text-white text-xs font-bold">✓</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="fixed left-0 right-0 px-4 z-[60]" style={{ bottom: "calc(60px + var(--sab, 0px) + 12px)" }}>
          <div className="max-w-[600px] mx-auto">
            <button
              onClick={confirmSelectMode}
              disabled={totalSelected === 0}
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

  // ── STEP 1: 배송 물품 구성 ────────────────────────────────────
  if (flowStep === 1) {
    const selectedParcels = shippableParcels.filter(p => selectedIds.includes(p.id));
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
              <button onClick={() => router.push("/warehouse")} className="mt-5 bg-blue-600 text-white text-sm font-bold px-6 py-3 rounded-2xl">
                마이창고 보기
              </button>
            </div>
          ) : (
            <>
              {/* 배송 물품 카드 */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                <div className="flex items-center justify-between px-4 py-3 bg-blue-600">
                  <div className="flex items-center gap-2">
                    <Truck size={16} className="text-white" />
                    <p className="text-sm font-bold text-white">배송 묶음</p>
                    {selectedIds.length > 0 && (
                      <span className="text-xs text-blue-200">{selectedIds.length}개 소포</span>
                    )}
                  </div>
                </div>

                {/* 선택된 물품 목록 */}
                <div className="divide-y divide-gray-50">
                  {selectedParcels.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-5">아직 담은 물품이 없어요</p>
                  ) : (
                    selectedParcels.map(p => (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {p.sender_name ?? "발송인 미상"}
                          </p>
                          <p className="text-xs text-gray-400">
                            {p.tracking_no ?? "운송장 미등록"}
                            {p.weight_actual ? ` · ${(p.weight_actual / 1000).toFixed(2)}kg` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedIds(prev => prev.filter(id => id !== p.id))}
                          className="text-gray-300 hover:text-red-400 transition-colors p-1"
                          title="제거"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* 물품 담기 버튼 */}
                <div className="px-4 pb-4 pt-2">
                  <button
                    type="button"
                    onClick={openSelectMode}
                    className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-blue-300 text-blue-600 text-sm font-bold py-3 rounded-xl hover:bg-blue-50 active:scale-[0.98] transition-all"
                  >
                    <span className="text-lg leading-none">+</span>
                    {selectedIds.length > 0 ? "물품 수정" : "물품 담기"}
                  </button>
                </div>
              </div>

              {/* 내용품 분류 */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-sm font-bold text-gray-800 mb-3">내용품 분류</p>
                <div className="flex flex-wrap gap-2">
                  {ITEMS_DESC_OPTS.map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setItemsDesc(opt)}
                      className={`px-3.5 py-1.5 rounded-full text-sm border transition-all ${
                        itemsDesc === opt ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="fixed left-0 right-0 px-4 z-[60]" style={{ bottom: "calc(60px + var(--sab, 0px) + 12px)" }}>
          <div className="max-w-[600px] mx-auto space-y-2">
            {error && <p className="text-xs text-red-500 text-center">{error}</p>}
            <button
              type="button"
              onClick={handleNext}
              disabled={selectedIds.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 disabled:opacity-40 active:scale-[0.98] transition-transform"
            >
              {selectedIds.length > 0 ? `${selectedIds.length}개 물품 — ` : ""}다음
              <ArrowRight size={15} />
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
                  <button
                    key={o.code}
                    type="button"
                    onClick={() => setPackOpts(p => ({ ...p, [o.code]: !p[o.code] }))}
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
                  <button
                    key={o.code}
                    type="button"
                    onClick={() => setAddonSet(prev => {
                      const next = new Set(prev);
                      checked ? next.delete(o.code) : next.add(o.code);
                      return next;
                    })}
                    className={`w-full text-left flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                      checked ? "border-teal-500 bg-teal-50" : "border-gray-100 bg-white"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                      checked ? "bg-teal-500 border-teal-500" : "border-gray-300"
                    }`}>
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
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="포장·처리 관련 특별 요청사항을 입력해주세요"
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </>
        )}

        {/* ─── STEP 3: 수취인 주소 ─── */}
        {flowStep === 3 && (
          <>
            {loadingAddresses ? (
              <div className="flex justify-center py-10"><Loader2 size={28} className="animate-spin text-blue-500" /></div>
            ) : (
              <>
                {/* 저장된 국내 주소 */}
                {savedAddresses.length > 0 && !showNewAddr && (
                  <>
                    <p className="text-sm font-bold text-gray-800">저장된 국내 주소</p>
                    <div className="space-y-2">
                      {savedAddresses.map(addr => (
                        <button
                          key={addr.id}
                          type="button"
                          onClick={() => setSelectedAddrId(addr.id)}
                          className={`w-full text-left flex items-start gap-3 p-4 rounded-2xl border-2 transition-all ${
                            selectedAddrId === addr.id ? "border-blue-500 bg-blue-50" : "border-gray-100 bg-white"
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                            selectedAddrId === addr.id ? "bg-blue-600 border-blue-600" : "border-gray-300"
                          }`}>
                            {selectedAddrId === addr.id && <span className="text-white text-[10px] font-bold">✓</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <p className="text-sm font-semibold text-gray-900 truncate">{addr.label}</p>
                              {addr.is_default && <Star size={11} className="text-amber-400 fill-amber-400 shrink-0" />}
                            </div>
                            <p className="text-xs text-gray-700">{addr.name} · {addr.phone}</p>
                            <p className="text-xs text-gray-500 truncate">
                              [{addr.zipcode}] {addr.address} {addr.address_detail}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* 새 주소 입력 토글 */}
                {!showNewAddr ? (
                  <button
                    type="button"
                    onClick={() => { setShowNewAddr(true); setSelectedAddrId(null); }}
                    className="w-full flex items-center justify-center gap-2 py-3.5 border-2 border-dashed border-gray-300 rounded-2xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-all"
                  >
                    <Plus size={16} /> 새 주소 직접 입력
                  </button>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-gray-800">새 수취인 주소</p>
                      {savedAddresses.length > 0 && (
                        <button
                          type="button"
                          onClick={() => { setShowNewAddr(false); setSelectedAddrId(savedAddresses.find(a => a.is_default)?.id ?? savedAddresses[0]?.id ?? null); }}
                          className="text-xs text-blue-600"
                        >
                          저장된 주소 선택
                        </button>
                      )}
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">이름 *</label>
                          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="홍길동"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-200" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">연락처 *</label>
                          <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="01012345678"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-200" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">주소 검색 *</label>
                        <div className="flex gap-2">
                          <input
                            value={newZip ? `[${newZip}] ${newAddr1}` : ""}
                            readOnly
                            placeholder="주소 검색 버튼을 클릭하세요"
                            className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50"
                          />
                          <AddressSearchButton
                            onSelect={(zipcode, address) => { setNewZip(zipcode); setNewAddr1(address); }}
                            className="px-3 py-2.5 bg-blue-600 text-white text-sm rounded-xl whitespace-nowrap"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">상세주소</label>
                        <input value={newAddr2} onChange={e => setNewAddr2(e.target.value)} placeholder="아파트 동호수 등"
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-200" />
                      </div>
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
        )}

        {/* ─── STEP 4: 최종 확인 ─── */}
        {flowStep === 4 && (
          <>
            {/* 배송 물품 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-sm font-bold text-gray-500 mb-3">📦 배송 물품 ({selectedIds.length}개)</p>
              {shippableParcels.filter(p => selectedIds.includes(p.id)).map(p => (
                <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                  <Package size={13} className="text-gray-400 shrink-0" />
                  <p className="text-sm text-gray-800 flex-1 truncate">{p.sender_name ?? "발송인 미상"}</p>
                  <p className="text-xs text-gray-400">{p.tracking_no ?? "-"}</p>
                </div>
              ))}
              <p className="text-xs text-gray-400 mt-2">내용품: {itemsDesc}</p>
            </div>

            {/* 포장·서비스 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-sm font-bold text-gray-500 mb-3">🎁 포장·서비스</p>
              {activePackaging.length === 0 && activeAddons.length === 0 ? (
                <p className="text-sm text-gray-400">선택 없음 (현재 포장 그대로)</p>
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
                  <span>포장 서비스 합계</span>
                  <span className="text-blue-600">{packagingFee.toLocaleString()}원</span>
                </div>
              )}
            </div>

            {/* 수취인 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-sm font-bold text-gray-500 mb-3">📍 수취인</p>
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-gray-900">{recipientForSubmit.name}</p>
                <p className="text-gray-600">{recipientForSubmit.phone}</p>
                <p className="text-gray-600">[{recipientForSubmit.zip}] {recipientForSubmit.addr1}</p>
                {recipientForSubmit.addr2 && <p className="text-gray-500">{recipientForSubmit.addr2}</p>}
              </div>
            </div>

            {/* 배송 수단 */}
            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 flex items-center gap-3">
              <Truck size={20} className="text-blue-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-blue-900">우체국 소포</p>
                <p className="text-xs text-blue-600">배송비는 실측 무게에 따라 청구됩니다</p>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">{error}</div>
            )}
          </>
        )}

      </div>

      {/* 하단 버튼 */}
      <div className="fixed left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 z-[60]" style={{ bottom: "calc(60px + var(--sab, 0px))" }}>
        <div className="max-w-[600px] mx-auto">
          {flowStep < TOTAL_STEPS ? (
            <div className="flex gap-2">
              {flowStep > 1 && (
                <button
                  type="button"
                  onClick={() => { setFlowStep(s => s - 1); setError(""); }}
                  className="flex-1 py-4 rounded-2xl text-sm font-bold border border-gray-200 text-gray-700"
                >
                  이전
                </button>
              )}
              <button
                type="button"
                onClick={handleNext}
                className={`${flowStep > 1 ? "flex-[2]" : "w-full"} flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-4 rounded-2xl disabled:opacity-40`}
              >
                다음 <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
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
