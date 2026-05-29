"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Package, CheckCircle, Loader2, MapPin, Truck } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Parcel {
  id: string;
  tracking_no: string | null;
  sender_name: string | null;
  weight_actual: number | null;
  status: string;
  is_shippable: boolean | null;
}

const ITEMS_OPTIONS = [
  "의류", "신발", "가방", "전자제품", "화장품", "식품", "도서", "기타",
];

export default function DomesticShippingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // 수령인 폼
  const [name, setName]       = useState("");
  const [phone, setPhone]     = useState("");
  const [zip, setZip]         = useState("");
  const [addr1, setAddr1]     = useState("");
  const [addr2, setAddr2]     = useState("");
  const [itemsDesc, setItemsDesc] = useState("의류");
  const [delivMsg, setDelivMsg]   = useState("");

  const loadParcels = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const res = await fetch("/api/parcels?shippable=true");
    if (res.ok) {
      const json = await res.json();
      setParcels(json.parcels ?? []);
    }
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { loadParcels(); }, [loadParcels]);

  const toggleParcel = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!selectedIds.length) { setError("배송할 물품을 1개 이상 선택해주세요."); return; }
    if (!name || !phone || !zip || !addr1) { setError("수령인 정보를 모두 입력해주세요."); return; }

    setSubmitting(true);
    const res = await fetch("/api/domestic-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient_name:  name,
        recipient_phone: phone,
        recipient_zip:   zip,
        recipient_addr1: addr1,
        recipient_addr2: addr2,
        parcel_ids:      selectedIds,
        items_desc:      itemsDesc,
        delivery_msg:    delivMsg,
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

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={36} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">국내 배송 신청 완료</h2>
          <p className="text-sm text-gray-500">
            관리자가 확인 후 우체국 소포를 접수합니다.<br />
            접수 완료 시 운송장번호로 알림을 보내드립니다.
          </p>
          <Link
            href="/mypage"
            className="block w-full py-3 bg-blue-600 text-white font-semibold rounded-2xl text-sm"
          >
            마이페이지로 이동
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-900">국내 배송 신청</h1>
          <p className="text-xs text-gray-400">우체국 소포로 국내 주소에 배달</p>
        </div>
        <Truck size={20} className="text-blue-500" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="px-4 py-5 space-y-5 max-w-[600px] mx-auto pb-32">

          {/* 물품 선택 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Package size={16} className="text-blue-500" />
              배송할 물품 선택
            </h2>
            {parcels.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <Package size={32} className="mx-auto mb-2 text-gray-200" />
                <p className="text-sm">출고 가능한 물품이 없습니다</p>
                <p className="text-xs mt-1">물품이 창고에 입고·검수 완료되어야 선택할 수 있습니다</p>
              </div>
            ) : (
              <div className="space-y-2">
                {parcels.map((p) => (
                  <label
                    key={p.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedIds.includes(p.id)
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(p.id)}
                      onChange={() => toggleParcel(p.id)}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {p.sender_name ?? "발송인 미상"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {p.tracking_no ?? "운송장 미등록"}
                        {p.weight_actual ? ` · ${p.weight_actual}g` : ""}
                      </p>
                    </div>
                    {selectedIds.includes(p.id) && (
                      <CheckCircle size={16} className="text-blue-500 shrink-0" />
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 내용품 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-3">내용품</h2>
            <div className="flex flex-wrap gap-2">
              {ITEMS_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setItemsDesc(opt)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                    itemsDesc === opt
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* 수령인 정보 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <MapPin size={16} className="text-blue-500" />
              수령인 정보
            </h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">수령인 이름 *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="홍길동"
                    required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">연락처 *</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01012345678"
                    required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">우편번호 *</label>
                <input
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="12345"
                  required
                  maxLength={5}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">주소 *</label>
                <input
                  value={addr1}
                  onChange={(e) => setAddr1(e.target.value)}
                  placeholder="서울시 강남구 테헤란로 123"
                  required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">상세주소</label>
                <input
                  value={addr2}
                  onChange={(e) => setAddr2(e.target.value)}
                  placeholder="아파트 동호수 등"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">배송 메시지</label>
                <input
                  value={delivMsg}
                  onChange={(e) => setDelivMsg(e.target.value)}
                  placeholder="경비실에 맡겨주세요"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          {/* 안내 */}
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 text-sm text-blue-800 space-y-1.5">
            <p className="font-semibold">📦 국내 배송 안내</p>
            <p>· 우체국 계약소포로 발송됩니다</p>
            <p>· 접수 완료 후 운송장번호를 알림으로 보내드립니다</p>
            <p>· 배송비는 실측 무게에 따라 청구됩니다</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">
              {error}
            </div>
          )}

          {/* 제출 버튼 */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="max-w-[600px] mx-auto">
              <button
                type="submit"
                disabled={submitting || selectedIds.length === 0}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {submitting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <Truck size={18} />
                    국내 배송 신청하기 {selectedIds.length > 0 ? `(${selectedIds.length}개)` : ""}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
