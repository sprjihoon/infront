"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer, CheckCircle, Loader2, Package } from "lucide-react";

interface DomesticOrder {
  id: string;
  status: string;
  customer_id: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_zip: string;
  recipient_addr1: string;
  recipient_addr2: string;
  parcel_ids: string[];
  items_desc: string | null;
  weight_g: number | null;
  vol_length: number | null;
  vol_width: number | null;
  vol_height: number | null;
  epost_regi_no: string | null;
  epost_req_no: string | null;
  epost_price: number | null;
  epost_regi_po: string | null;
  delivery_msg: string | null;
  created_at: string;
  customers: { name: string; customer_code: string; email: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING:    "접수 대기",
  BOOKED:     "우체국 접수",
  IN_TRANSIT: "배송 중",
  DELIVERED:  "배달 완료",
  CANCELLED:  "취소됨",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING:    "bg-yellow-100 text-yellow-800 border-yellow-200",
  BOOKED:     "bg-blue-100 text-blue-800 border-blue-200",
  IN_TRANSIT: "bg-indigo-100 text-indigo-800 border-indigo-200",
  DELIVERED:  "bg-green-100 text-green-800 border-green-200",
  CANCELLED:  "bg-gray-100 text-gray-500 border-gray-200",
};

export default function DomesticOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [order, setOrder] = useState<DomesticOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [msg, setMsg] = useState("");
  const [isError, setIsError] = useState(false);

  const [weightG, setWeightG] = useState("");
  const [volL, setVolL] = useState("");
  const [volW, setVolW] = useState("");
  const [volH, setVolH] = useState("");
  const [testYn, setTestYn] = useState<"Y" | "N">("N");

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/domestic-orders/${id}`);
    if (!res.ok) { router.push("/domestic-orders"); return; }
    const json = await res.json();
    const o = json.order as DomesticOrder;
    setOrder(o);
    if (o.weight_g) setWeightG(String(o.weight_g));
    if (o.vol_length) setVolL(String(o.vol_length));
    if (o.vol_width)  setVolW(String(o.vol_width));
    if (o.vol_height) setVolH(String(o.vol_height));
    setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  async function handleBook() {
    if (!weightG) { setMsg("총중량(g)을 입력하세요"); setIsError(true); return; }
    if (!confirm("우체국 소포를 접수하시겠습니까?")) return;
    setBooking(true);
    setMsg("");
    setIsError(false);

    const res = await fetch("/api/admin/epost/book-domestic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domestic_order_id: id,
        weight_g: parseInt(weightG),
        vol_length: volL ? parseFloat(volL) : undefined,
        vol_width:  volW ? parseFloat(volW) : undefined,
        vol_height: volH ? parseFloat(volH) : undefined,
        test_yn: testYn,
      }),
    });
    setBooking(false);

    const json = await res.json();
    if (res.ok) {
      // 접수 완료 즉시 라벨 출력 페이지로 이동
      router.push(`/domestic-orders/${id}/label`);
    } else {
      setMsg(json.error ?? "접수 실패");
      setIsError(true);
    }
  }

  if (loading || !order) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/domestic-orders" className="p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} className="text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">
            국내 배송 신청 — {order.recipient_name}
          </h1>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLOR[order.status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
            {STATUS_LABEL[order.status] ?? order.status}
          </span>
        </div>
        {order.epost_regi_no && (
          <Link
            href={`/domestic-orders/${id}/label`}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg"
          >
            <Printer size={14} /> 라벨 출력
          </Link>
        )}
      </div>

      {msg && (
        <div className={`flex items-center gap-2 rounded-xl p-3 text-sm ${isError ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"}`}>
          {!isError && <CheckCircle size={16} />}
          {msg}
        </div>
      )}

      {/* 고객 정보 */}
      {order.customers && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-2 text-sm">고객</h2>
          <p className="font-medium">{order.customers.name}</p>
          <p className="text-xs text-gray-400">{order.customers.email} · {order.customers.customer_code}</p>
        </div>
      )}

      {/* 수령인 정보 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-3 text-sm">수령인 정보</h2>
        <div className="space-y-1 text-sm">
          <p><span className="text-gray-400 w-20 inline-block">이름</span>{order.recipient_name}</p>
          <p><span className="text-gray-400 w-20 inline-block">연락처</span>{order.recipient_phone}</p>
          <p><span className="text-gray-400 w-20 inline-block">우편번호</span>{order.recipient_zip}</p>
          <p><span className="text-gray-400 w-20 inline-block">주소</span>{order.recipient_addr1}</p>
          {order.recipient_addr2 && (
            <p><span className="text-gray-400 w-20 inline-block">상세주소</span>{order.recipient_addr2}</p>
          )}
          {order.delivery_msg && (
            <p><span className="text-gray-400 w-20 inline-block">배송메시지</span>{order.delivery_msg}</p>
          )}
        </div>
      </div>

      {/* 내용품 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-3 text-sm">내용품 · 물품 정보</h2>
        <div className="space-y-1 text-sm">
          <p><span className="text-gray-400 w-20 inline-block">내용품</span>{order.items_desc ?? "-"}</p>
          <p><span className="text-gray-400 w-20 inline-block">소포 수</span>{order.parcel_ids?.length ?? 0}개</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">실측 무게 (g)</label>
            <input
              type="number"
              value={weightG}
              onChange={(e) => setWeightG(e.target.value)}
              placeholder="예: 1500"
              className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div className="flex gap-1 items-end">
            <div className="flex-1">
              <label className="text-xs text-gray-500">가로(cm)</label>
              <input type="number" value={volL} onChange={(e) => setVolL(e.target.value)} placeholder="L" className="w-full mt-1 px-2 py-2 border rounded-lg text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500">세로</label>
              <input type="number" value={volW} onChange={(e) => setVolW(e.target.value)} placeholder="W" className="w-full mt-1 px-2 py-2 border rounded-lg text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500">높이</label>
              <input type="number" value={volH} onChange={(e) => setVolH(e.target.value)} placeholder="H" className="w-full mt-1 px-2 py-2 border rounded-lg text-sm" />
            </div>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-500 mt-3">
          <input type="checkbox" checked={testYn === "Y"} onChange={(e) => setTestYn(e.target.checked ? "Y" : "N")} className="w-3.5 h-3.5" />
          테스트 모드 (실제 접수 안 됨)
        </label>
      </div>

      {/* 우체국 접수 결과 */}
      {order.epost_regi_no ? (
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
          <h2 className="font-semibold text-blue-900 mb-3 text-sm flex items-center gap-2">
            <Package size={16} /> 우체국 접수 완료
          </h2>
          <div className="space-y-1 text-sm">
            <p><span className="text-blue-400 w-24 inline-block">운송장번호</span><span className="font-mono font-bold">{order.epost_regi_no}</span></p>
            {order.epost_regi_po && <p><span className="text-blue-400 w-24 inline-block">접수우체국</span>{order.epost_regi_po}</p>}
            {order.epost_price != null && <p><span className="text-blue-400 w-24 inline-block">요금</span>{order.epost_price.toLocaleString()}원</p>}
          </div>
        </div>
      ) : (
        order.status === "PENDING" && (
          <button
            onClick={handleBook}
            disabled={booking}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {booking ? <Loader2 size={18} className="animate-spin" /> : <Package size={18} />}
            우체국 소포 접수
          </button>
        )
      )}
    </div>
  );
}
