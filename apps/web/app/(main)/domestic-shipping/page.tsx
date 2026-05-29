"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Package, Truck, MapPin,
  CheckCircle, Loader2, Plus, Check, Star, ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AddressSearchButton } from "@/components/ui/AddressSearchButton";

// ── 타입 ──────────────────────────────────────────────────────
interface Parcel {
  id: string;
  tracking_no: string | null;
  sender_name: string | null;
  weight_actual: number | null;
  is_shippable: boolean | null;
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
const PACKAGING_OPTS = [
  { code: "SAFE_PACK",   name: "안전포장",  desc: "에어캡·완충재 추가",       price: 3000 },
  { code: "REPACK",      name: "재포장",    desc: "새 박스로 교체",            price: 2000 },
  { code: "CONSOLIDATE", name: "합포장",    desc: "선택 물품을 하나로 합치기", price: 2000 },
] as const;

const ADDON_SERVICES = [
  { code: "RECEIPT_DISPOSE",  name: "영수증 폐기",   desc: "영수증·인보이스 제거", badge: "무료" },
  { code: "PRICE_TAG_REMOVE", name: "가격표 제거",   desc: "태그·스티커 가격 표시 제거", badge: "무료" },
  { code: "OVERPACK_REMOVE",  name: "과포장 제거",   desc: "불필요한 박스·완충재 제거", badge: "무료" },
];

const STEP_LABELS = ["물품 선택", "포장·서비스", "수취인 주소", "최종 확인"];
const TOTAL_STEPS = STEP_LABELS.length;

// ── 헬퍼 ──────────────────────────────────────────────────────
function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
      {STEP_LABELS.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              i < step ? "bg-blue-600 text-white" :
              i === step ? "bg-blue-600 text-white ring-4 ring-blue-100" :
              "bg-gray-200 text-gray-400"
            }`}>
              {i < step ? <Check size={14} /> : i + 1}
            </div>
            <span className={`text-[9px] mt-1 font-medium ${i === step ? "text-blue-600" : "text-gray-400"}`}>
              {label}
            </span>
          </div>
          {i < TOTAL_STEPS - 1 && (
            <div className={`w-8 h-0.5 mx-1 mb-4 ${i < step ? "bg-blue-600" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────
export default function DomesticShippingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // Step 0: 물품 선택
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loadingParcels, setLoadingParcels] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [itemsDesc, setItemsDesc] = useState("의류");

  // Step 1: 포장·서비스
  const [packOpts, setPackOpts] = useState<Record<string, boolean>>({ SAFE_PACK: false, REPACK: false, CONSOLIDATE: false });
  const [addonSet, setAddonSet] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");

  // Step 2: 수취인 주소
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

  // ── 데이터 로드 ────────────────────────────────────────────
  const loadParcels = useCallback(async () => {
    const res = await fetch("/api/parcels?shippable=true");
    if (res.ok) {
      const json = await res.json();
      setParcels(json.parcels ?? []);
    }
    setLoadingParcels(false);
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
    const def = list.find(a => a.is_default);
    if (def) setSelectedAddrId(def.id);
    setLoadingAddresses(false);
  }, [supabase]);

  useEffect(() => {
    const checkLogin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      loadParcels();
    };
    checkLogin();
  }, [supabase, router, loadParcels]);

  useEffect(() => {
    if (step === 2) loadAddresses();
  }, [step, loadAddresses]);

  // ── 계산 ──────────────────────────────────────────────────
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

  // ── 네비게이션 ─────────────────────────────────────────────
  function goNext() {
    setError("");
    if (step === 0 && selectedIds.length === 0) { setError("배송할 물품을 1개 이상 선택해주세요."); return; }
    if (step === 2) {
      const r = recipientForSubmit;
      if (!r.name || !r.phone || !r.zip || !r.addr1) { setError("수취인 정보를 모두 입력해주세요."); return; }
    }
    setStep(s => s + 1);
  }

  function goBack() { setError(""); setStep(s => s - 1); }

  // ── 제출 ──────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true);
    setError("");

    // 새 주소 저장 옵션
    if (showNewAddr && saveAddr && newName && newZip && newAddr1) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("customer_addresses").insert({
          customer_id:    user.id,
          type:           "pickup",
          label:          newAddr2 ? `${newAddr1} ${newAddr2}` : newAddr1,
          name:           newName,
          phone:          newPhone,
          zipcode:        newZip,
          address:        newAddr1,
          address_detail: newAddr2,
          is_default:     false,
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
    setSubmitting(false);

    if (res.ok) {
      setDone(true);
    } else {
      const json = await res.json();
      setError(json.error ?? "신청에 실패했습니다. 다시 시도해주세요.");
    }
  }

  // ── 완료 화면 ──────────────────────────────────────────────
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
            <button onClick={() => router.push("/orders")} className="w-full py-3 bg-blue-600 text-white font-bold rounded-2xl text-sm">
              배송현황 보기
            </button>
            <button onClick={() => router.push("/warehouse")} className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-2xl text-sm">
              마이창고로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 메인 레이아웃 ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 헤더 */}
      <div className="sticky top-0 z-20 bg-white">
        <div className="px-4 py-3.5 flex items-center gap-3 border-b border-gray-100">
          <button onClick={() => step === 0 ? router.back() : goBack()} className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-gray-900">국내 배송 신청</h1>
            <p className="text-xs text-gray-400">우체국 소포</p>
          </div>
          <Truck size={20} className="text-blue-500" />
        </div>
        <StepIndicator step={step} />
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto pb-32">
        {/* ─── STEP 0: 물품 선택 ─── */}
        {step === 0 && (
          <div className="px-4 py-5 space-y-4 max-w-[600px] mx-auto">
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Package size={16} className="text-blue-500" />
                배송할 물품 선택
              </h2>

              {loadingParcels ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-500" /></div>
              ) : parcels.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Package size={36} className="mx-auto mb-2 text-gray-200" />
                  <p className="text-sm font-medium">출고 가능한 물품이 없습니다</p>
                  <p className="text-xs mt-1">입고 및 검수 완료된 물품만 선택할 수 있습니다</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* 전체 선택 */}
                  <button
                    type="button"
                    onClick={() => setSelectedIds(selectedIds.length === parcels.length ? [] : parcels.map(p => p.id))}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-300 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600"
                  >
                    <Check size={13} />
                    {selectedIds.length === parcels.length ? "전체 해제" : "전체 선택"}
                    <span className="ml-auto text-gray-400">{parcels.length}개</span>
                  </button>

                  {parcels.map(p => {
                    const checked = selectedIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          checked ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300 bg-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setSelectedIds(prev =>
                            prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]
                          )}
                          className="w-4 h-4 accent-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{p.sender_name ?? "발송인 미상"}</p>
                          <p className="text-xs text-gray-400">
                            {p.tracking_no ?? "운송장 미등록"}
                            {p.weight_actual ? ` · ${p.weight_actual.toLocaleString()}g` : ""}
                          </p>
                        </div>
                        {checked && <CheckCircle size={16} className="text-blue-500 shrink-0" />}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 내용품 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-3">내용품 분류</h2>
              <div className="flex flex-wrap gap-2">
                {["의류", "신발", "가방", "전자제품", "화장품", "식품", "도서", "기타"].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setItemsDesc(opt)}
                    className={`px-3.5 py-1.5 rounded-full text-sm border transition-all ${
                      itemsDesc === opt ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 1: 포장·서비스 ─── */}
        {step === 1 && (
          <div className="px-4 py-5 space-y-4 max-w-[600px] mx-auto">
            {/* 포장 옵션 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-1">포장 옵션</h2>
              <p className="text-xs text-gray-400 mb-3">중복 선택 가능 (무선택 시 현재 포장 그대로 발송)</p>
              <div className="space-y-2">
                {PACKAGING_OPTS.map(o => {
                  const checked = packOpts[o.code];
                  return (
                    <label
                      key={o.code}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        checked ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setPackOpts(p => ({ ...p, [o.code]: !p[o.code] }))}
                        className="w-4 h-4 accent-blue-600"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{o.name}</p>
                        <p className="text-xs text-gray-500">{o.desc}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        checked ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                      }`}>
                        +{o.price.toLocaleString()}원
                      </span>
                    </label>
                  );
                })}
              </div>
              {packagingFee > 0 && (
                <p className="mt-3 text-right text-sm font-bold text-blue-600">
                  포장 서비스 합계: {packagingFee.toLocaleString()}원
                </p>
              )}
            </div>

            {/* 부가 서비스 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-1">부가 서비스</h2>
              <p className="text-xs text-gray-400 mb-3">모두 무료로 제공됩니다</p>
              <div className="space-y-2">
                {ADDON_SERVICES.map(o => {
                  const checked = addonSet.has(o.code);
                  return (
                    <label
                      key={o.code}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        checked ? "border-teal-500 bg-teal-50" : "border-gray-200 hover:border-teal-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setAddonSet(s => {
                          const ns = new Set(s);
                          ns.has(o.code) ? ns.delete(o.code) : ns.add(o.code);
                          return ns;
                        })}
                        className="w-4 h-4 accent-teal-600"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{o.name}</p>
                        <p className="text-xs text-gray-500">{o.desc}</p>
                      </div>
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-teal-100 text-teal-700">{o.badge}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 요청 메모 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-2">요청 메모</h2>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="포장 시 주의사항이나 기타 요청사항을 입력해주세요"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
        )}

        {/* ─── STEP 2: 수취인 주소 ─── */}
        {step === 2 && (
          <div className="px-4 py-5 space-y-4 max-w-[600px] mx-auto">
            {loadingAddresses ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-500" /></div>
            ) : (
              <>
                {/* 저장된 국내 주소 */}
                {savedAddresses.length > 0 && !showNewAddr && (
                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <MapPin size={16} className="text-blue-500" /> 저장된 국내 주소
                    </h2>
                    <div className="space-y-2">
                      {savedAddresses.map(addr => (
                        <label
                          key={addr.id}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            selectedAddrId === addr.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name="addr"
                            checked={selectedAddrId === addr.id}
                            onChange={() => setSelectedAddrId(addr.id)}
                            className="mt-0.5 w-4 h-4 accent-blue-600"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <p className="text-sm font-semibold text-gray-900">{addr.label}</p>
                              {addr.is_default && <Star size={11} className="text-amber-400 fill-amber-400" />}
                            </div>
                            <p className="text-xs text-gray-700">{addr.name} · {addr.phone}</p>
                            <p className="text-xs text-gray-500 truncate">
                              [{addr.zipcode}] {addr.address} {addr.address_detail}
                            </p>
                          </div>
                          {selectedAddrId === addr.id && (
                            <CheckCircle size={16} className="text-blue-500 shrink-0 mt-0.5" />
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
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
                  <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <h2 className="font-semibold text-gray-900">새 수취인 주소</h2>
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
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">이름 *</label>
                        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="홍길동" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">연락처 *</label>
                        <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="01012345678" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
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
                          onSelect={({ zipcode, address }) => { setNewZip(zipcode); setNewAddr1(address); }}
                          className="px-3 py-2.5 bg-blue-600 text-white text-sm rounded-xl whitespace-nowrap"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">상세주소</label>
                      <input value={newAddr2} onChange={e => setNewAddr2(e.target.value)} placeholder="아파트 동호수 등" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-600 pt-1">
                      <input type="checkbox" checked={saveAddr} onChange={e => setSaveAddr(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                      이 주소를 국내 주소록에 저장
                    </label>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ─── STEP 3: 최종 확인 ─── */}
        {step === 3 && (
          <div className="px-4 py-5 space-y-4 max-w-[600px] mx-auto">
            {/* 물품 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-500 mb-2">📦 배송 물품 ({selectedIds.length}개)</h3>
              {parcels.filter(p => selectedIds.includes(p.id)).map(p => (
                <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                  <Package size={14} className="text-gray-400 shrink-0" />
                  <p className="text-sm text-gray-800 flex-1 truncate">{p.sender_name ?? "발송인 미상"}</p>
                  <p className="text-xs text-gray-400">{p.tracking_no ?? "-"}</p>
                </div>
              ))}
              <p className="text-xs text-gray-400 mt-2">내용품: {itemsDesc}</p>
            </div>

            {/* 포장·서비스 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-500 mb-2">🎁 포장·서비스</h3>
              {activePackaging.length === 0 && activeAddons.length === 0 ? (
                <p className="text-sm text-gray-400">선택 없음 (현재 포장 그대로)</p>
              ) : (
                <div className="space-y-1">
                  {activePackaging.map(o => (
                    <div key={o.code} className="flex justify-between text-sm">
                      <span className="text-gray-700">{o.name}</span>
                      <span className="text-blue-600 font-medium">+{o.price.toLocaleString()}원</span>
                    </div>
                  ))}
                  {activeAddons.map(o => (
                    <div key={o.code} className="flex justify-between text-sm">
                      <span className="text-gray-700">{o.name}</span>
                      <span className="text-teal-600 font-medium">무료</span>
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
              <h3 className="text-sm font-semibold text-gray-500 mb-2">📍 수취인</h3>
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
          </div>
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] z-20">
        <div className="max-w-[600px] mx-auto flex gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={goBack}
              className="px-5 py-3.5 bg-gray-100 text-gray-700 font-semibold rounded-2xl text-sm"
            >
              이전
            </button>
          )}
          {step < TOTAL_STEPS - 1 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={step === 0 && selectedIds.length === 0}
              className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              다음 <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 text-sm disabled:opacity-60 transition-all"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <><Truck size={18} /> 국내 배송 신청하기</>}
            </button>
          )}
        </div>
        {error && step < TOTAL_STEPS - 1 && (
          <p className="max-w-[600px] mx-auto mt-2 text-xs text-red-500 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
