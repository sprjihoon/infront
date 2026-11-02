"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const SIZES = [
  { code: "MINI", label: "파인트" },
  { code: "STANDARD", label: "싱글" },
  { code: "LONG", label: "더블" },
  { code: "XL", label: "패밀리" },
];

function BoxInner() {
  const router = useRouter();
  const params = useSearchParams();
  const purpose = params.get("purpose") === "storage" ? "storage" : "shipping";
  const storageId = params.get("storage_id");
  const [sizeCode, setSizeCode] = useState("STANDARD");
  const [qty, setQty] = useState(1);
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const tail = new URLSearchParams({ purpose });
  if (storageId) tail.set("storage_id", storageId);

  async function submit() {
    if (address.trim().length < 2 || phone.trim().length < 8) {
      alert("받을 주소와 연락처를 입력해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/inbound/box", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose,
          size_code: sizeCode,
          qty,
          address: address.trim(),
          address_detail: addressDetail.trim(),
          zipcode: zipcode.trim(),
          phone: phone.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error ?? "신청에 실패했습니다.");
        return;
      }
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 py-3.5 sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-900">박스가 필요해요</h1>
          <p className="text-xs text-gray-400 mt-0.5">빈 박스를 보낼 주소입니다</p>
        </div>
      </div>

      <div className="px-4 py-5 max-w-[600px] mx-auto space-y-4">
        {done ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <p className="text-sm font-bold text-gray-900">박스 신청을 받았습니다</p>
            <p className="text-sm text-gray-500">박스가 도착하면 물건을 담은 뒤, 수거를 맡기거나 직접 보내 주세요.</p>
            <button
              type="button"
              onClick={() => router.push(`/pickup?${tail}`)}
              className="w-full bg-brand-600 text-white text-sm font-bold py-3 rounded-xl"
            >
              수거해 주세요
            </button>
            <button
              type="button"
              onClick={() => router.push(`/register-parcel?${tail}`)}
              className="w-full bg-white border border-gray-200 text-sm font-bold py-3 rounded-xl"
            >
              직접 보냈어요
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap">
              {SIZES.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => setSizeCode(s.code)}
                  className={`px-3 py-2 rounded-xl text-sm font-semibold border ${
                    sizeCode === s.code ? "bg-brand-600 text-white border-brand-600" : "bg-white text-gray-700 border-gray-200"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <label className="block text-xs font-bold text-gray-600">
              개수
              <input
                type="number"
                min={1}
                max={20}
                value={qty}
                onChange={(e) => setQty(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm"
              />
            </label>
            <label className="block text-xs font-bold text-gray-600">
              받을 주소
              <input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm" />
            </label>
            <label className="block text-xs font-bold text-gray-600">
              상세 주소
              <input value={addressDetail} onChange={(e) => setAddressDetail(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm" />
            </label>
            <label className="block text-xs font-bold text-gray-600">
              우편번호
              <input value={zipcode} onChange={(e) => setZipcode(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm" />
            </label>
            <label className="block text-xs font-bold text-gray-600">
              연락처
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-3 text-sm" />
            </label>
            <button
              type="button"
              disabled={loading}
              onClick={submit}
              className="w-full bg-brand-600 text-white text-sm font-bold py-4 rounded-2xl disabled:opacity-50"
            >
              {loading ? "신청 중..." : "박스 신청"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function BoxRequestPage() {
  return (
    <Suspense>
      <BoxInner />
    </Suspense>
  );
}
