"use client";

import { Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";

function MethodInner() {
  const router = useRouter();
  const params = useSearchParams();
  const purpose = params.get("purpose") === "storage" ? "storage" : "shipping";
  const storageId = params.get("storage_id");
  const q = new URLSearchParams({ purpose });
  if (storageId) q.set("storage_id", storageId);
  const tail = q.toString();
  const title = purpose === "storage" ? "보관 신청" : "배송 신청";

  return (
    <div className="min-h-screen bg-gray-50 pb-[calc(60px+var(--sab,0px))]">
      <div className="bg-white border-b border-gray-100 px-4 py-3.5 sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => router.push("/inbound")} className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-900">{title}</h1>
          <p className="text-xs text-gray-400 mt-0.5">물건을 어떻게 센터로 보낼까요?</p>
        </div>
      </div>

      <div className="px-4 py-6 space-y-3 max-w-[600px] mx-auto">
        <button
          type="button"
          onClick={() => router.push(`/pickup?${tail}`)}
          className="w-full bg-white rounded-2xl border border-gray-100 text-left"
        >
          <div className="flex items-center gap-4 px-5 py-5">
            <Image src="/icons/inbound-pickup.png" alt="" width={72} height={72} className="object-contain shrink-0" />
            <div className="flex-1">
              <p className="text-base font-bold text-gray-900">수거해 주세요</p>
              <p className="text-sm text-gray-500 mt-1">주소와 희망일을 정합니다</p>
            </div>
            <ChevronRight size={18} className="text-gray-300" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => router.push(`/register-parcel?${tail}`)}
          className="w-full bg-white rounded-2xl border border-gray-100 text-left"
        >
          <div className="flex items-center gap-4 px-5 py-5">
            <Image src="/icons/inbound-direct.png" alt="" width={72} height={72} className="object-contain shrink-0" />
            <div className="flex-1">
              <p className="text-base font-bold text-gray-900">직접 보냈어요</p>
              <p className="text-sm text-gray-500 mt-1">운송장과 발송 정보를 등록합니다</p>
            </div>
            <ChevronRight size={18} className="text-gray-300" />
          </div>
        </button>
      </div>
    </div>
  );
}

export default function InboundMethodPage() {
  return (
    <Suspense>
      <MethodInner />
    </Suspense>
  );
}
