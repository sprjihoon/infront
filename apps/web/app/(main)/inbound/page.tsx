"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ChevronRight, Info, Package } from "lucide-react";

export default function InboundPage() {
  const router = useRouter();
  const [opening, setOpening] = useState<"storage" | "shipping" | null>(null);

  async function openStorage() {
    setOpening("storage");
    try {
      const res = await fetch("/api/storage");
      const json = await res.json();
      const longTerm = (json.storages ?? []).find(
        (s: { storage_mode?: string; status?: string }) =>
          s.storage_mode === "long_term" && s.status !== "CANCELLED",
      );
      if (longTerm?.id) {
        router.push(`/inbound/method?purpose=storage&storage_id=${longTerm.id}`);
      } else {
        router.push("/storage/new?next=method");
      }
    } catch {
      router.push("/storage/new?next=method");
    } finally {
      setOpening(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-[calc(60px+var(--sab,0px))]">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-4 py-3.5 sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-900">입고신청</h1>
          <p className="text-xs text-gray-400 mt-0.5">보관, 배송, 박스 구입</p>
        </div>
      </div>

      <div className="px-4 py-6 space-y-4 max-w-[600px] mx-auto">

        {/* 카드 1: 수거 신청 */}
        <button
          type="button"
          disabled={opening !== null}
          onClick={openStorage}
          className="w-full bg-white rounded-2xl border border-gray-100 hover:border-brand-300 active:scale-[0.98] transition-all shadow-sm text-left disabled:opacity-60"
        >
          <div className="flex items-center gap-4 px-5 py-5">
            <Image
              src="/icon-storage.png"
              alt="보관"
              width={88}
              height={88}
              priority
              className="object-contain shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-lg font-bold text-gray-900">보관</p>
                <ChevronRight size={18} className="text-gray-400 shrink-0" />
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">
                맡겨 두는 물건입니다. 한 달 단위로 보관료를 냅니다.
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          disabled={opening !== null}
          onClick={() => router.push("/inbound/method?purpose=shipping")}
          className="w-full bg-white rounded-2xl border border-gray-100 hover:border-gray-300 active:scale-[0.98] transition-all shadow-sm text-left"
        >
          <div className="flex items-center gap-4 px-5 py-5">
            <Image
              src="/icons/shipping-overseas.png"
              alt="배송"
              width={88}
              height={88}
              priority
              className="object-contain shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-lg font-bold text-gray-900">배송</p>
                <ChevronRight size={18} className="text-gray-400 shrink-0" />
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">
                보내려고 센터로 들이는 물건입니다. 국내·해외는 출고할 때 고릅니다.
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          disabled={opening !== null}
          onClick={() => router.push("/inbound/box")}
          className="w-full bg-white rounded-2xl border border-gray-100 hover:border-amber-300 active:scale-[0.98] transition-all shadow-sm text-left disabled:opacity-60"
        >
          <div className="flex items-center gap-4 px-5 py-5">
            <div className="w-[88px] h-[88px] rounded-2xl bg-amber-50 flex items-center justify-center shrink-0">
              <Package size={36} className="text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-lg font-bold text-gray-900">박스가 필요해요</p>
                <ChevronRight size={18} className="text-gray-400 shrink-0" />
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">
                우체국 박스 1호~5호를 구입합니다. 포장이 끝나면 보관이나 배송으로 다시 접수합니다.
              </p>
            </div>
          </div>
        </button>

        {/* 하단 안내 */}
        <div className="flex gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
          <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            보관이나 배송은 수거·직접 발송으로 접수합니다. 빈 박스는 여기서 구입하고, 포장이 끝나면 다시 접수합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
