"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin, Calendar, Phone, Package,
  CheckCircle, Info, Truck, ArrowLeft,
} from "lucide-react";

// 한국 공휴일 (2026)
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

interface AddressResult {
  zipcode: string;
  address: string;
}

declare global {
  interface Window {
    daum?: {
      Postcode: new (opts: {
        oncomplete: (data: { zonecode: string; roadAddress: string; jibunAddress: string }) => void;
      }) => { open: () => void };
    };
  }
}

function openAddressSearch(onSelect: (r: AddressResult) => void) {
  if (typeof window === "undefined") return;
  if (!window.daum?.Postcode) {
    alert("주소 검색 기능을 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
    return;
  }
  new window.daum.Postcode({
    oncomplete(data) {
      onSelect({ zipcode: data.zonecode, address: data.roadAddress || data.jibunAddress });
    },
  }).open();
}

export default function PickupPage() {
  const router = useRouter();
  const minDate = getNextWeekday();
  const maxDate = getMaxDate();

  const [address, setAddress]           = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [zipcode, setZipcode]           = useState("");
  const [phone, setPhone]               = useState("");
  const [pickupDate, setPickupDate]     = useState(minDate);
  const [goodsName, setGoodsName]       = useState("");
  const [notes, setNotes]               = useState("");
  const [agreed, setAgreed]             = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const [result, setResult]             = useState<{
    tracking_no: string;
    pickup_date: string;
    post_office: string;
    is_test: boolean;
  } | null>(null);

  const disabledDates = Array.from({ length: 21 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  }).filter(isUnavailable).map((d) => d.toISOString().split("T")[0]);

  const handleAddressSearch = useCallback(() => {
    openAddressSearch(({ zipcode: z, address: a }) => {
      setZipcode(z);
      setAddress(a);
      setAddressDetail("");
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!address.trim())    { setError("수거 주소를 입력해주세요."); return; }
    if (!zipcode.trim())    { setError("주소 검색을 통해 우편번호를 입력해주세요."); return; }
    if (!phone.trim())      { setError("수거지 연락처를 입력해주세요."); return; }
    if (!/^[0-9\-\s]{9,}$/.test(phone)) { setError("연락처 형식을 확인해주세요. (예: 010-1234-5678)"); return; }
    if (disabledDates.includes(pickupDate)) { setError("토·일요일 및 공휴일은 수거가 불가합니다."); return; }
    if (!agreed) { setError("서비스 안내에 동의해주세요."); return; }

    setLoading(true);
    try {
      const resp = await fetch("/api/pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_address: address.trim(),
          pickup_address_detail: addressDetail.trim() || undefined,
          pickup_zipcode: zipcode.trim(),
          pickup_phone: phone.trim(),
          pickup_date: pickupDate,
          goods_name: goodsName.trim() || undefined,
          pickup_notes: notes.trim() || undefined,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "수거 신청에 실패했습니다.");

      setResult({
        tracking_no: data.tracking_no,
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

  // 완료 화면
  if (result) {
    const dateStr = result.pickup_date.length >= 8
      ? `${result.pickup_date.substring(0,4)}-${result.pickup_date.substring(4,6)}-${result.pickup_date.substring(6,8)}`
      : "-";

    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-5">
          <CheckCircle className="w-9 h-9 text-blue-600" />
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
            <p className="text-base font-bold text-blue-600 tracking-widest">{result.tracking_no}</p>
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
          className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl text-sm"
        >
          마이창고에서 확인
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* 헤더 */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 z-10">
        <button type="button" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-base font-bold text-gray-900">우체국 수거 신청</h1>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-5 space-y-6">

        {/* 안내 배너 */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <Truck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-blue-800">우체국 방문 수거 서비스</p>
            <p className="text-xs text-blue-600 mt-0.5 leading-relaxed">
              우체국 집배원이 고객님 주소로 직접 방문하여 물품을 수거합니다.
              수거비는 스프링박스가 부담합니다.
            </p>
          </div>
        </div>

        {/* 수거 주소 */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 mb-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            수거 주소 <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              readOnly
              value={address}
              placeholder="주소 검색 후 선택"
              className="flex-1 px-4 py-3.5 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-700 outline-none"
            />
            <button
              type="button"
              onClick={handleAddressSearch}
              className="px-4 py-3.5 bg-blue-600 text-white text-sm font-bold rounded-xl active:opacity-80 whitespace-nowrap"
            >
              검색
            </button>
          </div>
          {zipcode && (
            <p className="text-xs text-blue-600 mb-2">[{zipcode}] {address}</p>
          )}
          <input
            type="text"
            placeholder="상세 주소 (동/호수 등)"
            value={addressDetail}
            onChange={(e) => setAddressDetail(e.target.value)}
            className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* 연락처 */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 mb-2">
            <Phone className="w-4 h-4 text-blue-600" />
            수거지 연락처 <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            inputMode="tel"
            placeholder="010-1234-5678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 transition-colors"
          />
          <p className="text-xs text-gray-400 mt-1">우체국 집배원이 이 번호로 연락드립니다.</p>
        </div>

        {/* 수거 희망일 */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 mb-2">
            <Calendar className="w-4 h-4 text-blue-600" />
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
            className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 transition-colors"
          />
          <p className="text-xs text-gray-400 mt-1">
            희망일은 참고용이며 실제 수거일은 우체국 일정에 따릅니다.{" "}
            <span className="text-red-400">토·일·공휴일 수거 불가</span>
          </p>
        </div>

        {/* 물품 정보 */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 mb-2">
            <Package className="w-4 h-4 text-blue-600" />
            물품 정보 (선택)
          </label>
          <input
            type="text"
            placeholder="예) 의류 5벌, 신발 2켤레"
            value={goodsName}
            onChange={(e) => setGoodsName(e.target.value)}
            className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* 요청사항 */}
        <div>
          <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 mb-2">
            요청사항 (선택)
          </label>
          <textarea
            placeholder={"예) 공용현관 비번: #1234*\n부재 시 경비실에 맡겨주세요"}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 transition-colors resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">공용현관 비번 등 집배원에게 전달할 내용을 입력하세요.</p>
        </div>

        {/* 서비스 안내 */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Info className="w-4 h-4 text-gray-500 shrink-0" />
            <p className="text-xs font-bold text-gray-600">서비스 안내</p>
          </div>
          <ul className="space-y-1.5">
            {[
              "수거 후 물품이 스프링박스 물류센터로 입고됩니다.",
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

        {/* 동의 */}
        <button
          type="button"
          onClick={() => setAgreed(!agreed)}
          className={`flex items-start gap-3 w-full text-left p-4 rounded-xl border-2 transition-colors ${
            agreed ? "border-blue-600 bg-blue-50" : "border-gray-200 bg-white"
          }`}
        >
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
            agreed ? "bg-blue-600 border-blue-600" : "border-gray-300"
          }`}>
            {agreed && <CheckCircle className="w-3.5 h-3.5 text-white" />}
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">
            위 서비스 안내 내용을 확인하였으며,{" "}
            <span className="font-bold text-blue-600">입고 후 국제 배송비 결제</span>에 동의합니다.
            <span className="text-red-400 ml-1">*필수</span>
          </p>
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </form>

      {/* 하단 버튼 */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3">
        <button
          type="submit"
          form=""
          disabled={loading || !agreed}
          onClick={handleSubmit}
          className={`w-full py-4 rounded-xl text-sm font-bold transition-colors ${
            agreed && !loading
              ? "bg-blue-600 text-white active:opacity-80"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          {loading ? "수거 신청 중..." : "수거 신청하기"}
        </button>
      </div>
    </div>
  );
}
