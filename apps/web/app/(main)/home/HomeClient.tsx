"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, ChevronRight, Bell, Copy, Truck, Calculator } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Customer {
  name: string;
  customer_code: string;
  personal_address: string;
}

interface Parcel {
  id: string;
  tracking_no: string | null;
  status: string;
  created_at: string;
  sender_name: string | null;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING_PICKUP: { label: "수거 신청", color: "text-yellow-600 bg-yellow-50" },
  PICKED_UP: { label: "수거 완료", color: "text-blue-600 bg-blue-50" },
  INBOUND: { label: "입고 완료", color: "text-green-600 bg-green-50" },
  INSPECTION: { label: "검품 중", color: "text-purple-600 bg-purple-50" },
  HOLD: { label: "보류", color: "text-red-600 bg-red-50" },
  DONE: { label: "처리 완료", color: "text-gray-600 bg-gray-100" },
};

export default function HomeClient() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("customers")
        .select("name, customer_code, personal_address")
        .eq("id", user.id)
        .single()
        .then(({ data }) => setCustomer(data));

      supabase
        .from("parcels")
        .select("id, tracking_no, status, created_at, sender_name")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5)
        .then(({ data }) => setParcels(data ?? []));
    });
  }, []);

  function copyAddress() {
    if (!customer?.personal_address) return;
    navigator.clipboard.writeText(customer.personal_address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="px-4 py-6 space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            안녕하세요 {customer?.name ?? ""}님 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            고객번호: {customer?.customer_code ?? "—"}
          </p>
        </div>
        <button className="relative p-2">
          <Bell size={22} className="text-gray-700" />
        </button>
      </div>

      {/* 개인 입고주소 카드 */}
      <div className="bg-blue-600 rounded-2xl p-5 text-white">
        <p className="text-blue-200 text-xs font-medium mb-2">📦 내 개인 입고주소</p>
        <p className="text-sm font-medium leading-relaxed">
          {customer?.personal_address ?? "주소 로딩 중..."}
        </p>
        <button
          onClick={copyAddress}
          className="mt-3 flex items-center gap-1.5 bg-white/20 rounded-lg px-3 py-1.5 text-xs font-medium active:bg-white/30 transition-colors"
        >
          <Copy size={13} />
          {copied ? "복사됨!" : "주소 복사"}
        </button>
      </div>

      {/* 빠른 서비스 */}
      <div className="grid grid-cols-2 gap-3 [&>*:last-child:nth-child(odd)]:col-span-2">
        <Link
          href="/pickup"
          className="bg-blue-600 rounded-2xl p-4 flex flex-col gap-2 shadow-sm active:scale-[0.97] transition-transform"
        >
          <Truck size={24} className="text-white" />
          <div>
            <p className="text-sm font-semibold text-white">수거 신청</p>
            <p className="text-xs text-blue-200">우체국 방문수거</p>
          </div>
        </Link>
        <Link
          href="/warehouse"
          className="bg-white rounded-2xl p-4 flex flex-col gap-2 shadow-sm active:scale-[0.97] transition-transform"
        >
          <Package size={24} className="text-blue-600" />
          <div>
            <p className="text-sm font-semibold text-gray-900">마이창고</p>
            <p className="text-xs text-gray-500">입고 현황 확인</p>
          </div>
        </Link>
        <Link
          href="/orders"
          className="bg-white rounded-2xl p-4 flex flex-col gap-2 shadow-sm active:scale-[0.97] transition-transform"
        >
          <Package size={24} className="text-green-600" />
          <div>
            <p className="text-sm font-semibold text-gray-900">배송현황</p>
            <p className="text-xs text-gray-500">해외배송 추적</p>
          </div>
        </Link>
        <Link
          href="/shipping-calc"
          className="bg-white rounded-2xl p-4 flex flex-col gap-2 shadow-sm active:scale-[0.97] transition-transform"
        >
          <Calculator size={24} className="text-violet-600" />
          <div>
            <p className="text-sm font-semibold text-gray-900">요금 계산기</p>
            <p className="text-xs text-gray-500">EMS · K-Packet</p>
          </div>
        </Link>
      </div>

      {/* 최근 입고 현황 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900">최근 입고 현황</h2>
          <Link href="/warehouse" className="text-xs text-blue-600 font-medium flex items-center gap-0.5">
            전체보기 <ChevronRight size={14} />
          </Link>
        </div>

        {parcels.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <Package size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">아직 입고된 물품이 없어요</p>
            <p className="text-gray-400 text-xs mt-1">
              개인 입고주소로 쇼핑몰 주문을 해보세요
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {parcels.map((parcel) => {
              const statusInfo = STATUS_LABEL[parcel.status] ?? {
                label: parcel.status,
                color: "text-gray-600 bg-gray-100",
              };
              return (
                <div
                  key={parcel.id}
                  className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {parcel.tracking_no ?? "송장번호 미등록"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {parcel.sender_name ?? "발송인 미확인"} ·{" "}
                      {new Date(parcel.created_at).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
