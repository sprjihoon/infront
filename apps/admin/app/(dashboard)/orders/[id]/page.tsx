"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Package, User, MapPin, Send, Truck,
  CheckCircle, AlertCircle, ChevronDown, DollarSign,
} from "lucide-react";

interface Order {
  id: string;
  order_no: string;
  status: string;
  shipping_method: string;
  recipient_name: string;
  recipient_country: string;
  recipient_address: string;
  recipient_phone: string | null;
  item_list: Array<{ name: string; qty: number; price: number; origin: string }>;
  est_shipping_fee: number | null;
  shipping_fee: number | null;
  packaging_fee: number | null;
  total_amount: number;
  tracking_no: string | null;
  carrier: string | null;
  created_at: string;
  customers: { name: string; email: string; customer_code: string } | null;
}

interface OrderParcel {
  parcel_id: string;
  parcels: { tracking_no: string | null; weight_actual: number | null; vol_length: number | null; vol_width: number | null; vol_height: number | null } | null;
}

interface OrderService {
  id: string;
  total_price: number;
  services: { code: string; name: string; category: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT:         "초안",
  PENDING_QUOTE: "견적 대기",
  QUOTE_SENT:    "견적 발송",
  PAYMENT_WAIT:  "결제 대기",
  PAID:          "결제 완료",
  PACKING:       "포장 중",
  IN_TRANSIT:    "배송 중",
  DELIVERED:     "배송 완료",
  CANCELLED:     "취소",
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT:         "bg-gray-100 text-gray-700",
  PENDING_QUOTE: "bg-yellow-100 text-yellow-700",
  QUOTE_SENT:    "bg-blue-100 text-blue-700",
  PAYMENT_WAIT:  "bg-amber-100 text-amber-700",
  PAID:          "bg-green-100 text-green-700",
  PACKING:       "bg-orange-100 text-orange-700",
  IN_TRANSIT:    "bg-blue-200 text-blue-800",
  DELIVERED:     "bg-gray-200 text-gray-700",
  CANCELLED:     "bg-red-100 text-red-700",
};

export default function OrderDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [orderParcels, setOrderParcels] = useState<OrderParcel[]>([]);
  const [orderServices, setOrderServices] = useState<OrderService[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(false);
  const [msg, setMsg] = useState("");

  // 견적 확정 폼
  const [finalFee, setFinalFee] = useState("");
  const [quoteNote, setQuoteNote] = useState("");
  const [showQuoteForm, setShowQuoteForm] = useState(false);

  // 발송 처리 폼
  const [trackingNo, setTrackingNo] = useState("");
  const [carrier, setCarrier] = useState("EMS");
  const [showShipForm, setShowShipForm] = useState(false);

  useEffect(() => { loadOrder(); }, [id]);

  async function loadOrder() {
    const res = await fetch(`/api/admin/orders/${id}`);
    if (!res.ok) { router.push("/orders"); return; }
    const json = await res.json();
    setOrder(json.order);
    setOrderParcels(json.orderParcels);
    setOrderServices(json.orderServices);
    if (json.order.est_shipping_fee) setFinalFee(String(json.order.est_shipping_fee));
    setLoading(false);
  }

  async function handleQuote() {
    setActioning(true);
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm_quote", final_shipping_fee: finalFee, note: quoteNote }),
    });
    setActioning(false);
    if (res.ok) {
      setMsg("견적이 고객에게 발송되었습니다");
      setShowQuoteForm(false);
      loadOrder();
    }
  }

  async function handleShip() {
    if (!trackingNo) return;
    setActioning(true);
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ship", tracking_no: trackingNo, carrier }),
    });
    setActioning(false);
    if (res.ok) {
      setMsg("발송 처리 완료");
      setShowShipForm(false);
      loadOrder();
    }
  }

  if (loading || !order) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const customer = order.customers;
  const canQuote = ["PENDING_QUOTE", "DRAFT"].includes(order.status);
  const canShip  = ["PAID", "PACKING"].includes(order.status);

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/orders" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft size={18} className="text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">주문 상세</h1>
          <p className="text-xs text-gray-400">{order.order_no}</p>
        </div>
        <span className={`text-sm font-medium px-3 py-1.5 rounded-full ${STATUS_COLOR[order.status] ?? "bg-gray-100 text-gray-700"}`}>
          {STATUS_LABEL[order.status] ?? order.status}
        </span>
      </div>

      {msg && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
          <CheckCircle size={16} /> {msg}
        </div>
      )}

      {/* 고객 정보 */}
      {customer && (
        <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <User size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{customer.name}</p>
            <p className="text-xs text-gray-400">{customer.email} · {customer.customer_code}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* 배송지 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm col-span-2 lg:col-span-1">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
            <MapPin size={15} className="text-gray-400" /> 수취인 정보
          </h2>
          <div className="space-y-1.5 text-sm">
            <Row label="이름" value={order.recipient_name} />
            <Row label="국가" value={order.recipient_country} />
            <Row label="주소" value={order.recipient_address} />
            {order.recipient_phone && <Row label="연락처" value={order.recipient_phone} />}
          </div>
        </div>

        {/* 금액 정보 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm col-span-2 lg:col-span-1">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
            <DollarSign size={15} className="text-gray-400" /> 결제 정보
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">배송방법</span>
              <span className="font-medium">{order.shipping_method}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">포장 수수료</span>
              <span>{(order.packaging_fee ?? 0).toLocaleString()}원</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">국제 배송비 (견적)</span>
              <span>{order.est_shipping_fee ? `${order.est_shipping_fee.toLocaleString()}원` : "-"}</span>
            </div>
            {order.shipping_fee && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">국제 배송비 (확정)</span>
                <span className="font-semibold text-blue-600">{order.shipping_fee.toLocaleString()}원</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold border-t pt-2">
              <span className="text-gray-900">총 결제 금액</span>
              <span className="text-gray-900">{order.total_amount.toLocaleString()}원</span>
            </div>
            {order.tracking_no && (
              <div className="flex justify-between text-sm pt-1">
                <span className="text-gray-500">운송장 ({order.carrier ?? ""})</span>
                <span className="font-mono text-xs">{order.tracking_no}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 물품 목록 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
          <Package size={15} className="text-gray-400" /> 포함 물품
        </h2>
        <div className="space-y-2">
          {orderParcels.map((op) => (
            <div key={op.parcel_id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <Package size={14} className="text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{op.parcels?.tracking_no ?? "미등록"}</p>
                {op.parcels?.weight_actual && (
                  <p className="text-xs text-gray-400">{op.parcels.weight_actual}g</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 인보이스 */}
      {order.item_list && order.item_list.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-3">인보이스 품목</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b">
                <th className="text-left py-1.5 font-medium">품명</th>
                <th className="text-center py-1.5 font-medium">수량</th>
                <th className="text-right py-1.5 font-medium">단가</th>
                <th className="text-right py-1.5 font-medium">원산지</th>
              </tr>
            </thead>
            <tbody>
              {order.item_list.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-50 last:border-0">
                  <td className="py-2">{item.name}</td>
                  <td className="py-2 text-center">{item.qty}</td>
                  <td className="py-2 text-right">${item.price}</td>
                  <td className="py-2 text-right text-gray-500">{item.origin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="space-y-3">
        {/* 견적 확정 */}
        {canQuote && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <button
              onClick={() => setShowQuoteForm(!showQuoteForm)}
              className="w-full flex items-center justify-between text-sm font-semibold text-blue-600"
            >
              <span className="flex items-center gap-2"><Send size={15} /> 견적 확정 후 고객에게 발송</span>
              <ChevronDown size={15} className={showQuoteForm ? "rotate-180" : ""} />
            </button>

            {showQuoteForm && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">실제 국제 배송비 (원)</label>
                  <input
                    type="number"
                    value={finalFee}
                    onChange={(e) => setFinalFee(e.target.value)}
                    placeholder="예: 25000"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">메모 (선택)</label>
                  <input
                    value={quoteNote}
                    onChange={(e) => setQuoteNote(e.target.value)}
                    placeholder="예: 실측 무게 기준 2.1kg"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={handleQuote}
                  disabled={actioning || !finalFee}
                  className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {actioning ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Send size={14} /> 견적 발송하기</>}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 발송 처리 */}
        {canShip && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <button
              onClick={() => setShowShipForm(!showShipForm)}
              className="w-full flex items-center justify-between text-sm font-semibold text-green-600"
            >
              <span className="flex items-center gap-2"><Truck size={15} /> 발송 처리 (운송장 등록)</span>
              <ChevronDown size={15} className={showShipForm ? "rotate-180" : ""} />
            </button>

            {showShipForm && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">운송업체</label>
                  <select
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="EMS">EMS</option>
                    <option value="EMS_PREMIUM">EMS 프리미엄</option>
                    <option value="K_PACKET">K-Packet</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">운송장 번호</label>
                  <input
                    value={trackingNo}
                    onChange={(e) => setTrackingNo(e.target.value)}
                    placeholder="국제 운송장 번호"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={handleShip}
                  disabled={actioning || !trackingNo}
                  className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {actioning ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Truck size={14} /> 발송 완료 처리</>}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 w-16 shrink-0">{label}</span>
      <span className="text-gray-800 flex-1 break-all">{value}</span>
    </div>
  );
}
