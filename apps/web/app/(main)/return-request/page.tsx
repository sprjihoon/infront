"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, RotateCcw, Package, CheckCircle, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Parcel {
  id: string;
  tracking_no: string | null;
  status: string;
  sender_name: string | null;
}

const REASON_OPTIONS = [
  { value: "SIZE_MISMATCH", label: "사이즈 불일치", desc: "주문한 사이즈와 다른 제품이 배송됨" },
  { value: "DEFECT",        label: "불량·파손",     desc: "제품에 결함이 있거나 파손된 상태" },
  { value: "WRONG_ITEM",    label: "오배송",        desc: "주문한 것과 다른 제품이 배송됨" },
  { value: "CHANGE_MIND",   label: "단순 변심",     desc: "사이즈·디자인 등 개인 사유" },
  { value: "OTHER",         label: "기타",          desc: "위 항목에 해당하지 않는 사유" },
];

const STAGE_OPTIONS = [
  { value: "PRE_PICKUP",       label: "수거 전",       desc: "아직 우리 창고에 오지 않은 물품" },
  { value: "POST_INBOUND",     label: "창고 입고 후",  desc: "창고에 도착한 물품" },
  { value: "POST_INSPECTION",  label: "검수 완료 후",  desc: "검수까지 마친 물품" },
];

function ReturnRequestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parcelId = searchParams.get("parcel_id");

  const [step, setStep] = useState(1);
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [reason, setReason] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const [stage, setStage] = useState("POST_INBOUND");
  const [sellerName, setSellerName] = useState("");
  const [sellerAddress, setSellerAddress] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [prepaidLabel, setPrepaidLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!parcelId) return;
    const supabase = createClient();
    supabase
      .from("parcels")
      .select("id, tracking_no, status, sender_name")
      .eq("id", parcelId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setParcel(data);
          if (data.status === "INBOUND" || data.status === "INSPECTION") setStage("POST_INBOUND");
          if (data.status === "INSPECTION") setStage("POST_INSPECTION");
        }
      });
  }, [parcelId]);

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/return-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parcel_id: parcelId,
          request_stage: stage,
          reason,
          reason_note: reasonNote,
          seller_name: sellerName,
          seller_address: sellerAddress,
          seller_phone: sellerPhone,
          prepaid_label_url: prepaidLabel,
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
        <h2 className="text-xl font-bold text-gray-900 mb-2">반품 신청 완료</h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          반품 신청이 접수되었습니다.<br />
          처리 결과는 마이페이지에서 확인할 수 있어요.
        </p>
        <button
          onClick={() => router.push("/warehouse")}
          className="w-full bg-blue-600 text-white font-semibold py-4 rounded-2xl"
        >
          마이창고로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-5">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => step > 1 ? setStep(s => s - 1) : router.back()} className="p-2 -ml-2">
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">반품 신청</h1>
          <p className="text-xs text-gray-400">Step {step} / 3</p>
        </div>
      </div>

      {/* 진행 바 */}
      <div className="flex gap-1.5 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? "bg-blue-600" : "bg-gray-200"}`} />
        ))}
      </div>

      {/* 물품 확인 */}
      {parcel && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
          <Package size={20} className="text-gray-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-900">{parcel.tracking_no ?? "송장번호 미등록"}</p>
            <p className="text-xs text-gray-500">{parcel.sender_name ?? "발송인 미확인"}</p>
          </div>
        </div>
      )}

      {/* Step 1: 반품 사유 */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-1">반품 시점</p>
            <p className="text-xs text-gray-500 mb-3">현재 물품의 상태를 선택해 주세요</p>
            <div className="space-y-2">
              {STAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStage(opt.value)}
                  className={`w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                    stage === opt.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                    stage === opt.value ? "border-blue-500" : "border-gray-300"
                  }`}>
                    {stage === opt.value && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900 mb-3">반품 사유</p>
            <div className="space-y-2">
              {REASON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setReason(opt.value)}
                  className={`w-full flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                    reason === opt.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                    reason === opt.value ? "border-blue-500" : "border-gray-300"
                  }`}>
                    {reason === opt.value && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {reason && (
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                상세 사유 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <textarea
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                placeholder="구체적인 내용을 입력해 주세요"
                rows={3}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <button
            disabled={!reason || !stage}
            onClick={() => setStep(2)}
            className="w-full bg-blue-600 text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
          >
            다음 <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* Step 2: 판매자 정보 */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 -mt-2">
            반품을 받을 판매자 정보를 입력해 주세요
          </p>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">판매자(쇼핑몰) 이름 <span className="text-red-500">*</span></label>
            <input
              value={sellerName}
              onChange={(e) => setSellerName(e.target.value)}
              placeholder="예: Zara, ASOS, 유니클로"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">반품 주소 <span className="text-red-500">*</span></label>
            <textarea
              value={sellerAddress}
              onChange={(e) => setSellerAddress(e.target.value)}
              placeholder="판매자의 반품 접수 주소를 영문으로 입력해 주세요"
              rows={3}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">판매자 연락처</label>
            <input
              value={sellerPhone}
              onChange={(e) => setSellerPhone(e.target.value)}
              placeholder="선택사항"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">
              선불 라벨 URL <span className="text-gray-400 font-normal">(있는 경우)</span>
            </label>
            <input
              value={prepaidLabel}
              onChange={(e) => setPrepaidLabel(e.target.value)}
              placeholder="판매자가 제공한 반품 라벨 URL"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            <p className="font-medium mb-1">안내</p>
            <p>반품 접수 후 실제 발송까지 영업일 기준 1-3일이 소요될 수 있습니다.</p>
          </div>

          <button
            disabled={!sellerName || !sellerAddress}
            onClick={() => setStep(3)}
            className="w-full bg-blue-600 text-white font-semibold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
          >
            다음 <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* Step 3: 최종 확인 */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">신청 내용 확인</h3>
            <div className="space-y-2 text-sm">
              <Row label="반품 시점" value={STAGE_OPTIONS.find(s => s.value === stage)?.label ?? stage} />
              <Row label="반품 사유" value={REASON_OPTIONS.find(r => r.value === reason)?.label ?? reason} />
              {reasonNote && <Row label="상세 사유" value={reasonNote} />}
              <Row label="판매자" value={sellerName} />
              <Row label="반품 주소" value={sellerAddress} />
              {sellerPhone && <Row label="연락처" value={sellerPhone} />}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
            <p className="font-medium mb-1">반품 처리 안내</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>반품 접수 후 담당자가 확인 연락을 드립니다</li>
              <li>반품 배송비는 사유에 따라 달라집니다</li>
              <li>해외 도착 후 반품은 불가합니다 (창고 반품만 가능)</li>
            </ul>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-transform shadow"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <RotateCcw size={18} />
                반품 신청하기
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-500 w-24 shrink-0">{label}</span>
      <span className="text-gray-900 flex-1">{value}</span>
    </div>
  );
}

export default function ReturnRequestPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <ReturnRequestContent />
    </Suspense>
  );
}
