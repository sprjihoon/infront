"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { FileText, Package, Globe, CreditCard, CheckCircle, Clock, Truck, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ShippingBox {
  id: string;
  box_seq: number;
  intl_tracking_no: string | null;
  carrier: string | null;
  status: string;
  weight_kg: number | null;
}

interface Order {
  id: string;
  order_no: string;
  status: string;
  shipping_method: string;
  packaging_type: string;
  packaging_fee: number;
  shipping_fee: number;
  total_amount: number;
  payment_status: string;
  recipient_name: string | null;
  recipient_country: string | null;
  customs_value: number | null;
  item_list: Array<{ name_en: string; quantity: number; unit_price_usd: number }>;
  intl_tracking_no: string | null;
  created_at: string;
  order_parcels: Array<{ parcel_id: string }>;
  shipping_boxes: ShippingBox[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; icon: React.ReactNode }> = {
  DRAFT:               { label: "신청 완료",     color: "text-blue-700 bg-blue-50 border-blue-200",     dot: "bg-blue-400",   icon: <Clock size={12} /> },
  INBOUND:             { label: "입고 대기",     color: "text-yellow-700 bg-yellow-50 border-yellow-200", dot: "bg-yellow-400", icon: <Clock size={12} /> },
  INSPECTION:          { label: "검수 중",       color: "text-purple-700 bg-purple-50 border-purple-200", dot: "bg-purple-400", icon: <Clock size={12} /> },
  PACKAGING_REQUESTED: { label: "포장 요청",     color: "text-orange-700 bg-orange-50 border-orange-200", dot: "bg-orange-400", icon: <Package size={12} /> },
  PACKAGING_DONE:      { label: "포장 완료",     color: "text-teal-700 bg-teal-50 border-teal-200",       dot: "bg-teal-400",   icon: <Package size={12} /> },
  QUOTE_SENT:          { label: "견적 발송",     color: "text-amber-700 bg-amber-50 border-amber-200",    dot: "bg-amber-400",  icon: <CreditCard size={12} /> },
  PENDING_PAYMENT:     { label: "결제 대기",     color: "text-red-700 bg-red-50 border-red-200",          dot: "bg-red-400",    icon: <CreditCard size={12} /> },
  PAID:                { label: "결제 완료",     color: "text-green-700 bg-green-50 border-green-200",    dot: "bg-green-400",  icon: <CheckCircle size={12} /> },
  CUSTOMS_FILING:      { label: "통관 처리 중",  color: "text-indigo-700 bg-indigo-50 border-indigo-200", dot: "bg-indigo-400", icon: <Globe size={12} /> },
  IN_TRANSIT:          { label: "배송 중",       color: "text-sky-700 bg-sky-50 border-sky-200",          dot: "bg-sky-400",    icon: <Truck size={12} /> },
  DELIVERED:           { label: "배송 완료",     color: "text-gray-600 bg-gray-50 border-gray-200",       dot: "bg-gray-400",   icon: <CheckCircle size={12} /> },
  CANCELLED:           { label: "취소됨",        color: "text-gray-400 bg-gray-50 border-gray-200",       dot: "bg-gray-300",   icon: <Clock size={12} /> },
};

const SHIPPING_METHOD_LABELS: Record<string, string> = {
  EMS: "EMS",
  EMS_PREMIUM: "EMS 프리미엄",
  KPACKET: "K-Packet",
};

const COUNTRIES: Record<string, { name: string; flag: string }> = {
  JP: { name: "일본", flag: "🇯🇵" }, CN: { name: "중국", flag: "🇨🇳" },
  US: { name: "미국", flag: "🇺🇸" }, AU: { name: "호주", flag: "🇦🇺" },
  CA: { name: "캐나다", flag: "🇨🇦" }, GB: { name: "영국", flag: "🇬🇧" },
  SG: { name: "싱가포르", flag: "🇸🇬" }, HK: { name: "홍콩", flag: "🇭🇰" },
  TW: { name: "대만", flag: "🇹🇼" }, TH: { name: "태국", flag: "🇹🇭" },
  VN: { name: "베트남", flag: "🇻🇳" }, PH: { name: "필리핀", flag: "🇵🇭" },
  MY: { name: "말레이시아", flag: "🇲🇾" }, ID: { name: "인도네시아", flag: "🇮🇩" },
  DE: { name: "독일", flag: "🇩🇪" }, FR: { name: "프랑스", flag: "🇫🇷" },
};

function PaymentButton({ order }: { order: Order }) {
  const [loading, setLoading] = useState(false);

  async function handlePayment() {
    setLoading(true);
    try {
      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!clientKey) {
        alert("결제 설정이 완료되지 않았습니다. 관리자에게 문의하세요.");
        return;
      }
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const tossPayments = await loadTossPayments(clientKey);
      const payment = tossPayments.payment({ customerKey: user.id });

      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: order.total_amount },
        orderId: order.order_no,
        orderName: `인프론트 해외배송 ${order.order_no}`,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
      });
    } catch (e) {
      console.error(e);
      alert("결제 초기화에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handlePayment}
      disabled={loading}
      className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl disabled:opacity-60"
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <CreditCard size={12} />}
      결제하기
    </button>
  );
}

function OrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const newOrderNo = searchParams.get("new");

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/orders")
      .then((r) => r.json())
      .then(({ orders: data }) => {
        setOrders(data ?? []);
        setLoading(false);
        if (newOrderNo) {
          const found = data?.find((o: Order) => o.order_no === newOrderNo);
          if (found) setExpandedId(found.id);
        }
      })
      .catch(() => setLoading(false));
  }, [newOrderNo]);

  return (
    <div className="px-4 py-6 pb-24">
      <h1 className="text-xl font-bold text-gray-900 mb-4">✈️ 배송현황</h1>

      {newOrderNo && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 mb-4 flex items-start gap-2">
          <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-green-800">해외배송 신청 완료!</p>
            <p className="text-xs text-green-600 mt-0.5">
              주문번호 {newOrderNo}가 접수되었습니다.<br />
              물품 입고 후 견적을 안내해드립니다.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-blue-400" />
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
          <FileText size={44} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">진행 중인 배송이 없어요</p>
          <p className="text-gray-400 text-xs mt-1">마이창고에서 해외배송을 신청해보세요</p>
          <button
            onClick={() => router.push("/warehouse")}
            className="mt-5 bg-blue-600 text-white text-sm font-bold px-6 py-3 rounded-2xl"
          >
            마이창고 가기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.DRAFT;
            const country = COUNTRIES[order.recipient_country ?? ""];
            const isExpanded = expandedId === order.id;

            return (
              <div key={order.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs font-bold text-gray-400 mb-0.5">{order.order_no}</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {country ? `${country.flag} ${country.name}` : order.recipient_country ?? "—"}
                        {order.recipient_name ? ` · ${order.recipient_name}` : ""}
                      </p>
                    </div>
                    <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{SHIPPING_METHOD_LABELS[order.shipping_method] ?? order.shipping_method}</span>
                    <span>·</span>
                    <span>물품 {order.order_parcels?.length ?? 0}개</span>
                    <span>·</span>
                    <span>{new Date(order.created_at).toLocaleDateString("ko-KR")}</span>
                  </div>

                  {/* 결제 대기 상태일 때 버튼 표시 */}
                  {(order.status === "QUOTE_SENT" || order.status === "PENDING_PAYMENT") && (
                    <div className="mt-3 flex items-center justify-between bg-blue-50 rounded-xl px-3 py-2.5">
                      <div>
                        <p className="text-xs font-bold text-blue-800">결제 대기 중</p>
                        <p className="text-xs text-blue-600">{order.total_amount.toLocaleString()}원</p>
                      </div>
                      <PaymentButton order={order} />
                    </div>
                  )}
                </div>

                {/* 펼침 상세 */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-4 space-y-3 bg-gray-50/50">
                    {/* 박스별 운송장 (shipping_boxes 우선) */}
                    {order.shipping_boxes && order.shipping_boxes.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                          <Truck size={12} /> 배송 박스별 운송장
                        </p>
                        <div className="space-y-1.5">
                          {order.shipping_boxes.map((box) => (
                            <div key={box.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-100">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-500">박스 {box.box_seq}</span>
                                {box.weight_kg && <span className="text-xs text-gray-400">{box.weight_kg}kg</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                {box.intl_tracking_no ? (
                                  <>
                                    <span className="text-xs text-gray-400">{box.carrier ?? ""}</span>
                                    <span className="font-mono text-xs font-semibold text-gray-800">{box.intl_tracking_no}</span>
                                  </>
                                ) : (
                                  <span className="text-xs text-gray-300">운송장 준비중</span>
                                )}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                  box.status === "SHIPPED" || box.status === "DELIVERED"
                                    ? "bg-green-100 text-green-600"
                                    : "bg-gray-100 text-gray-500"
                                }`}>
                                  {box.status === "PREPARING" ? "준비중" : box.status === "PACKED" ? "포장완료" : box.status === "SHIPPED" ? "발송됨" : "배달완료"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : order.intl_tracking_no ? (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 flex items-center gap-1.5"><Truck size={13} /> 국제 운송장</span>
                        <span className="font-semibold text-gray-800 font-mono">{order.intl_tracking_no}</span>
                      </div>
                    ) : null}

                    {/* 물품 목록 */}
                    {order.item_list?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2">인보이스 물품</p>
                        <div className="space-y-1.5">
                          {order.item_list.map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="text-gray-700">{item.name_en} × {item.quantity}</span>
                              <span className="text-gray-500">USD {(item.unit_price_usd * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 금액 */}
                    <div className="border-t border-gray-100 pt-3 space-y-1.5">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>배송비</span>
                        <span>{order.shipping_fee.toLocaleString()}원</span>
                      </div>
                      {order.packaging_fee > 0 && (
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>포장 서비스</span>
                          <span>{order.packaging_fee.toLocaleString()}원</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-bold text-gray-900 pt-1">
                        <span>합계</span>
                        <span className={order.payment_status === "PAID" ? "text-green-600" : "text-gray-900"}>
                          {order.total_amount.toLocaleString()}원
                          {order.payment_status === "PAID" ? " (결제완료)" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    }>
      <OrdersContent />
    </Suspense>
  );
}
