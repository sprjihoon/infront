"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Package, User, MapPin, Send, Truck,
  CheckCircle, ChevronDown, DollarSign, Plus, Trash2,
  Box, Weight, Edit3, X, Check, Mail, Printer,
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
  recipient_addr1: string | null;
  recipient_addr2: string | null;
  recipient_addr3: string | null;
  recipient_zip: string | null;
  recipient_email: string | null;
  item_list: Array<{ name: string; qty: number; price: number; origin: string }>;
  est_shipping_fee: number | null;
  shipping_fee: number | null;
  quote_ems_cost: number | null;
  shipping_margin: number | null;
  packaging_fee: number | null;
  total_amount: number;
  customs_value: number | null;
  insurance_enabled: boolean | null;
  insurance_amount: number | null;
  duty_prepaid: boolean | null;
  duty_deposit_krw: number | null;
  duty_estimate_usd: number | null;
  duty_paid_krw: number | null;
  tracking_no: string | null;
  carrier: string | null;
  created_at: string;
  customers: { name: string; email: string; customer_code: string } | null;
  // EMS 접수 결과
  ems_regino: string | null;
  ems_fee: number | null;
  ems_applied_at: string | null;
  ems_premium_cd: string | null;
}

interface OrderParcel {
  parcel_id: string;
  parcels: {
    id: string;
    tracking_no: string | null;
    weight_actual: number | null;
    vol_length: number | null;
    vol_width: number | null;
    vol_height: number | null;
    pre_invoice_items: InvoiceItem[] | null;
    item_condition: string | null;
  } | null;
}

interface InvoiceItem {
  name_en: string;
  quantity: number;
  unit_price_usd: number;
  origin_country: string;
  hs_code?: string;
}

interface BoxItem {
  id: string;
  parcel_id: string;
  item_index: number;
  name_en: string;
  quantity: number;
  unit_price_usd: number;
  origin_country: string;
  hs_code?: string;
  item_condition?: string;
}

interface ShippingBox {
  id: string;
  box_seq: number;
  weight_kg: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  intl_tracking_no: string | null;
  carrier: string | null;
  shipped_at: string | null;
  status: string;
  shipping_fee: number | null;
  admin_notes: string | null;
  box_items: BoxItem[];
}

interface OrderService {
  id: string;
  total_price: number;
  services: { code: string; name: string; category: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "초안", PENDING_QUOTE: "견적 대기", QUOTE_SENT: "견적 발송",
  PAYMENT_WAIT: "결제 대기", PAID: "결제 완료", PACKING: "포장 중",
  IN_TRANSIT: "배송 중", DELIVERED: "배송 완료", CANCELLED: "취소",
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700", PENDING_QUOTE: "bg-yellow-100 text-yellow-700",
  QUOTE_SENT: "bg-blue-100 text-blue-700", PAYMENT_WAIT: "bg-amber-100 text-amber-700",
  PAID: "bg-green-100 text-green-700", PACKING: "bg-orange-100 text-orange-700",
  IN_TRANSIT: "bg-blue-200 text-blue-800", DELIVERED: "bg-gray-200 text-gray-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const BOX_STATUS_COLOR: Record<string, string> = {
  PREPARING: "bg-yellow-100 text-yellow-700",
  PACKED: "bg-blue-100 text-blue-700",
  SHIPPED: "bg-green-100 text-green-700",
  DELIVERED: "bg-gray-200 text-gray-700",
};
const BOX_STATUS_LABEL: Record<string, string> = {
  PREPARING: "준비중", PACKED: "포장완료", SHIPPED: "발송됨", DELIVERED: "배달완료",
};

export default function OrderDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [orderParcels, setOrderParcels] = useState<OrderParcel[]>([]);
  const [orderServices, setOrderServices] = useState<OrderService[]>([]);
  const [shippingBoxes, setShippingBoxes] = useState<ShippingBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(false);
  const [msg, setMsg] = useState("");

  // 견적 폼
  const [finalFee, setFinalFee] = useState("");
  const [emsCost, setEmsCost] = useState("");
  const [margin, setMargin] = useState("");
  const [quoteNote, setQuoteNote] = useState("");
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [dutyDepositKrw, setDutyDepositKrw] = useState("");
  const [dutyPaidKrw, setDutyPaidKrw] = useState("");

  // 실측값 + EMS 요금 계산
  const [measurements, setMeasurements] = useState({ totweight: "", boxlength: "", boxwidth: "", boxheight: "" });
  const [calcFee, setCalcFee] = useState<number | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState("");

  // EMS 접수 폼
  const [showEmsForm, setShowEmsForm] = useState(false);
  const [emsForm, setEmsForm] = useState({ totweight: "", boxlength: "", boxwidth: "", boxheight: "" });
  const [emsSubmitting, setEmsSubmitting] = useState(false);
  const [emsMsg, setEmsMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // 박스 편집 상태 (box.id → 편집 중 데이터)
  const [editingBox, setEditingBox] = useState<string | null>(null);
  const [boxEdits, setBoxEdits] = useState<Record<string, Partial<ShippingBox>>>({});

  // 품목 배정 패널 (box.id → 열림 여부)
  const [itemPanels, setItemPanels] = useState<Record<string, boolean>>({});

  useEffect(() => { loadOrder(); }, [id]);

  async function loadOrder() {
    const res = await fetch(`/api/admin/orders/${id}`);
    if (!res.ok) { router.push("/orders"); return; }
    const json = await res.json();
    setOrder(json.order);
    setOrderParcels(json.orderParcels);
    setOrderServices(json.orderServices);
    setShippingBoxes(json.shippingBoxes);
    if (json.order.est_shipping_fee) setFinalFee(String(json.order.est_shipping_fee));
    if (json.order.quote_ems_cost) setEmsCost(String(json.order.quote_ems_cost));
    if (json.order.shipping_margin) setMargin(String(json.order.shipping_margin));
    if (json.order.shipping_fee && !json.order.quote_ems_cost) {
      setEmsCost(String(json.order.shipping_fee));
    }
    if (json.order.duty_deposit_krw) {
      setDutyDepositKrw(String(json.order.duty_deposit_krw));
    }
    if (json.order.duty_paid_krw) {
      setDutyPaidKrw(String(json.order.duty_paid_krw));
    }
    setLoading(false);
  }

  async function callApi(body: object) {
    setActioning(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json();
        setMsg(`오류: ${j.error}`);
        return false;
      }
      return true;
    } finally {
      setActioning(false);
    }
  }

  const METHOD_MAP: Record<string, { premiumcd: string; em_ee: string }> = {
    EMS:         { premiumcd: "31", em_ee: "em" },
    EMS_PREMIUM: { premiumcd: "32", em_ee: "em" },
    KPACKET:     { premiumcd: "14", em_ee: "rl" },
  };

  async function handleCalcFee() {
    const { totweight, boxlength, boxwidth, boxheight } = measurements;
    if (!totweight || !boxlength || !boxwidth || !boxheight) {
      setCalcError("무게와 박스 크기를 모두 입력해주세요."); return;
    }
    if (!order) return;
    const method = METHOD_MAP[order.shipping_method];
    if (!method) { setCalcError("배송 방법이 지원되지 않습니다."); return; }

    setCalcLoading(true); setCalcError(""); setCalcFee(null);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "calculate_ems_fee",
          shipping_method: order.shipping_method,
          country: order.recipient_country,
          totweight: Number(totweight),
          boxlength: Number(boxlength),
          boxwidth: Number(boxwidth),
          boxheight: Number(boxheight),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setCalcError(json.error ?? "계산 실패"); return; }
      setCalcFee(json.fee);
      setEmsCost(String(json.fee));
      const m = margin ? parseInt(margin) : 0;
      setFinalFee(String(json.fee + m));
    } catch {
      setCalcError("네트워크 오류");
    } finally {
      setCalcLoading(false);
    }
  }

  async function handleQuote() {
    const { totweight, boxlength, boxwidth, boxheight } = measurements;
    const ok = await callApi({
      action: "confirm_quote",
      final_shipping_fee: finalFee,
      quote_ems_cost: emsCost || calcFee,
      shipping_margin: margin || "0",
      note: quoteNote,
      ...(order?.duty_prepaid && dutyDepositKrw
        ? { duty_deposit_krw: dutyDepositKrw }
        : {}),
      ...(totweight && boxlength && boxwidth && boxheight && {
        totweight: Number(totweight),
        boxlength: Number(boxlength),
        boxwidth: Number(boxwidth),
        boxheight: Number(boxheight),
      }),
    });
    if (ok) { setMsg("견적이 고객에게 발송되었습니다"); setShowQuoteForm(false); loadOrder(); }
  }

  async function handleRecordDutyPaid() {
    if (!dutyPaidKrw) {
      setMsg("관세 납부액을 입력해주세요");
      return;
    }
    const ok = await callApi({
      action: "record_duty_paid",
      duty_paid_krw: dutyPaidKrw,
    });
    if (ok) { setMsg("관세 납부액이 기록되었습니다"); loadOrder(); }
  }

  async function handleAddBox() {
    const ok = await callApi({ action: "add_box" });
    if (ok) loadOrder();
  }

  async function handleSaveBox(boxId: string) {
    const edits = boxEdits[boxId] ?? {};
    const ok = await callApi({ action: "update_box", box_id: boxId, ...edits });
    if (ok) { setEditingBox(null); loadOrder(); }
  }

  async function handleDeleteBox(boxId: string) {
    if (!confirm("박스를 삭제하시겠습니까?")) return;
    const ok = await callApi({ action: "delete_box", box_id: boxId });
    if (ok) loadOrder();
  }

  async function handleEmsApply() {
    const { totweight, boxlength, boxwidth, boxheight } = emsForm;
    if (!totweight || !boxlength || !boxwidth || !boxheight) {
      setEmsMsg({ type: "err", text: "모든 측정값(중량·가로·세로·높이)을 입력해주세요." });
      return;
    }
    setEmsSubmitting(true);
    setEmsMsg(null);
    try {
      const res = await fetch(`/api/admin/ems/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: id,
          totweight: Number(totweight),
          boxlength: Number(boxlength),
          boxwidth:  Number(boxwidth),
          boxheight: Number(boxheight),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setEmsMsg({ type: "err", text: json.error ?? "EMS 접수 실패" });
      } else {
        setEmsMsg({ type: "ok", text: `✅ 등기번호 ${json.regino} · 예상요금 ${json.ems_fee?.toLocaleString()}원` });
        setShowEmsForm(false);
        loadOrder();
      }
    } finally {
      setEmsSubmitting(false);
    }
  }

  async function handleShipAll() {
    const hasTracking = shippingBoxes.some(b => b.intl_tracking_no);
    if (!hasTracking) { setMsg("운송장 번호가 입력된 박스가 없습니다"); return; }
    if (!confirm("전체 발송 처리하시겠습니까?")) return;
    const ok = await callApi({ action: "ship_all" });
    if (ok) { setMsg("발송 처리 완료"); loadOrder(); }
  }

  async function toggleItemAssign(box: ShippingBox, parcelId: string, itemIdx: number, item: InvoiceItem, parcelCondition: string | null) {
    const assigned = box.box_items.some(bi => bi.parcel_id === parcelId && bi.item_index === itemIdx);
    if (assigned) {
      await callApi({ action: "unassign_item", box_id: box.id, parcel_id: parcelId, item_index: itemIdx });
    } else {
      await callApi({
        action: "assign_item", box_id: box.id, parcel_id: parcelId, item_index: itemIdx,
        name_en: item.name_en, quantity: item.quantity, unit_price_usd: item.unit_price_usd,
        origin_country: item.origin_country, hs_code: item.hs_code ?? "",
        item_condition: parcelCondition ?? "NEW",
      });
    }
    loadOrder();
  }

  if (loading || !order) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const customer = order.customers;
  const canQuote = ["PENDING_QUOTE", "DRAFT"].includes(order.status);
  const canManageBoxes = ["PAID", "PACKING", "QUOTE_SENT"].includes(order.status);

  // 전체 품목 목록 (parcel_id + index → item)
  const allItems: Array<{ parcelId: string; parcelTracking: string; idx: number; item: InvoiceItem; condition: string | null }> = [];
  orderParcels.forEach(op => {
    const p = op.parcels;
    if (!p?.pre_invoice_items?.length) return;
    p.pre_invoice_items.forEach((item, idx) => {
      allItems.push({ parcelId: p.id, parcelTracking: p.tracking_no ?? op.parcel_id, idx, item, condition: p.item_condition });
    });
  });

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
        <Link href={`/customers/${encodeURIComponent(customer.customer_code)}`}
          className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:ring-1 hover:ring-blue-200 transition-all">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <User size={18} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">{customer.name}</p>
            <p className="text-xs text-gray-400">{customer.email} · {customer.customer_code}</p>
          </div>
        </Link>
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
            {order.insurance_enabled && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">보험 가입</span>
                <span className="font-medium text-brand-700">
                  USD {(order.insurance_amount ?? order.customs_value ?? 0).toFixed(2)}
                </span>
              </div>
            )}
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
            {order.duty_prepaid && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">관세 선납 (DDP)</span>
                  <span className="font-medium text-emerald-700">
                    {(order.duty_deposit_krw ?? 0).toLocaleString()}원
                  </span>
                </div>
                {order.duty_estimate_usd != null && (
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>관세 예상 (USD)</span>
                    <span>${Number(order.duty_estimate_usd).toFixed(2)}</span>
                  </div>
                )}
                {order.duty_paid_krw != null && order.duty_paid_krw > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">실제 관세 납부</span>
                    <span>{order.duty_paid_krw.toLocaleString()}원</span>
                  </div>
                )}
                {order.duty_paid_krw != null && (order.duty_deposit_krw ?? 0) > order.duty_paid_krw && (
                  <div className="flex justify-between text-xs text-emerald-600">
                    <span>청구−실납부 차액</span>
                    <span>
                      {((order.duty_deposit_krw ?? 0) - order.duty_paid_krw).toLocaleString()}원
                    </span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between text-sm font-bold border-t pt-2">
              <span className="text-gray-900">총 결제 금액</span>
              <span className="text-gray-900">{order.total_amount.toLocaleString()}원</span>
            </div>
          </div>
        </div>
      </div>

      {order.duty_prepaid && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
            <DollarSign size={15} className="text-emerald-600" /> 관세 납부 기록 (DDP)
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            EMS 접수 시 우체국에 납부한 관세·수수료를 기록하세요.
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              value={dutyPaidKrw}
              onChange={(e) => setDutyPaidKrw(e.target.value)}
              placeholder="실제 납부액 (원)"
              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <button
              type="button"
              onClick={handleRecordDutyPaid}
              disabled={actioning || !dutyPaidKrw}
              className="px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
            >
              저장
            </button>
          </div>
        </div>
      )}

      {/* 포함 물품 (parcel 목록) */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
          <Package size={15} className="text-gray-400" /> 포함 소포 ({orderParcels.length}개)
        </h2>
        <div className="space-y-2">
          {orderParcels.map((op) => {
            const p = op.parcels;
            return (
              <div key={op.parcel_id} className="rounded-xl border border-gray-100 p-3">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Package size={13} className="text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{p?.tracking_no ?? "미등록"}</p>
                    {p?.weight_actual && <p className="text-xs text-gray-400">{p.weight_actual}g</p>}
                  </div>
                  {p?.item_condition && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.item_condition === "NEW" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"}`}>
                      {p.item_condition === "NEW" ? "신품" : "중고"}
                    </span>
                  )}
                </div>
                {p?.pre_invoice_items && p.pre_invoice_items.length > 0 && (
                  <div className="ml-10 space-y-0.5">
                    {p.pre_invoice_items.map((item, idx) => (
                      <p key={idx} className="text-xs text-gray-500">
                        • {item.name_en} × {item.quantity} · ${item.unit_price_usd}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 인보이스 품목 */}
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

      {/* ═══════════════════════════════════════════════
          박스 관리 (Phase 1 + 2)
      ═══════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-1.5">
            <Box size={15} className="text-gray-400" />
            배송 박스 관리
            {shippingBoxes.length > 0 && (
              <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{shippingBoxes.length}개</span>
            )}
          </h2>
          <button
            onClick={handleAddBox}
            disabled={actioning}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-40"
          >
            <Plus size={13} /> 박스 추가
          </button>
        </div>

        {shippingBoxes.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            박스가 없습니다. &quot;박스 추가&quot; 버튼으로 추가하세요.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {shippingBoxes.map((box) => {
              const isEditing = editingBox === box.id;
              const edits = boxEdits[box.id] ?? {};
              const edit = <K extends keyof ShippingBox>(k: K) => (edits[k] !== undefined ? edits[k] : box[k]) as string | number | null;
              const setEdit = (k: keyof ShippingBox, v: unknown) =>
                setBoxEdits(p => ({ ...p, [box.id]: { ...p[box.id], [k]: v } }));

              const assignedItems = box.box_items ?? [];
              const showItems = itemPanels[box.id] ?? false;

              return (
                <div key={box.id} className="px-4 py-3">
                  {/* 박스 헤더 */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold text-gray-700">박스 {box.box_seq}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${BOX_STATUS_COLOR[box.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {BOX_STATUS_LABEL[box.status] ?? box.box_seq}
                    </span>
                    {assignedItems.length > 0 && (
                      <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                        {assignedItems.length}종 배정됨
                      </span>
                    )}
                    <div className="flex-1" />
                    {!isEditing ? (
                      <>
                        <button onClick={() => setEditingBox(box.id)} className="p-1 text-gray-400 hover:text-blue-500">
                          <Edit3 size={13} />
                        </button>
                        <button onClick={() => handleDeleteBox(box.id)} className="p-1 text-gray-400 hover:text-red-500">
                          <Trash2 size={13} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleSaveBox(box.id)} disabled={actioning} className="p-1 text-green-500 hover:text-green-600">
                          <Check size={14} />
                        </button>
                        <button onClick={() => setEditingBox(null)} className="p-1 text-gray-400 hover:text-red-500">
                          <X size={14} />
                        </button>
                      </>
                    )}
                  </div>

                  {/* 박스 정보 */}
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-400 font-semibold block mb-0.5">운송업체</label>
                          <select value={(edit("carrier") as string) ?? "EMS"}
                            onChange={e => setEdit("carrier", e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                            <option value="EMS">EMS</option>
                            <option value="EMS_PREMIUM">EMS 프리미엄</option>
                            <option value="K_PACKET">K-Packet</option>
                            <option value="DHL">DHL</option>
                            <option value="FEDEX">FedEx</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 font-semibold block mb-0.5">운송장 번호</label>
                          <input value={(edit("intl_tracking_no") as string) ?? ""}
                            onChange={e => setEdit("intl_tracking_no", e.target.value || null)}
                            placeholder="국제 운송장"
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {[["weight_kg","무게(kg)"],["length_cm","가로"],["width_cm","세로"],["height_cm","높이"]] .map(([k,l]) => (
                          <div key={k}>
                            <label className="text-[10px] text-gray-400 font-semibold block mb-0.5">{l}</label>
                            <input type="number" min={0} step={0.1}
                              value={(edit(k as keyof ShippingBox) as number) ?? ""}
                              onChange={e => setEdit(k as keyof ShippingBox, e.target.value ? parseFloat(e.target.value) : null)}
                              placeholder="-"
                              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                          </div>
                        ))}
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 font-semibold block mb-0.5">상태</label>
                        <select value={(edit("status") as string) ?? "PREPARING"}
                          onChange={e => setEdit("status", e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                          <option value="PREPARING">준비중</option>
                          <option value="PACKED">포장완료</option>
                          <option value="SHIPPED">발송됨</option>
                          <option value="DELIVERED">배달완료</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 font-semibold block mb-0.5">메모</label>
                        <input value={(edit("admin_notes") as string) ?? ""}
                          onChange={e => setEdit("admin_notes", e.target.value || null)}
                          placeholder="어드민 메모"
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 space-y-0.5">
                      <div className="flex gap-4">
                        {box.intl_tracking_no && (
                          <span className="font-mono font-medium text-gray-800">{box.carrier ? `[${box.carrier}] ` : ""}{box.intl_tracking_no}</span>
                        )}
                        {!box.intl_tracking_no && <span className="text-gray-300">운송장 미입력</span>}
                      </div>
                      {(box.weight_kg || box.length_cm) && (
                        <div className="flex items-center gap-3 text-gray-400">
                          {box.weight_kg && <span className="flex items-center gap-1"><Weight size={10} /> {box.weight_kg}kg</span>}
                          {box.length_cm && <span>{box.length_cm}×{box.width_cm}×{box.height_cm} cm</span>}
                        </div>
                      )}
                      {box.admin_notes && <p className="text-gray-400 italic">{box.admin_notes}</p>}
                    </div>
                  )}

                  {/* 품목 배정 (Phase 2) */}
                  {allItems.length > 0 && (
                    <div className="mt-2">
                      <button
                        onClick={() => setItemPanels(p => ({ ...p, [box.id]: !showItems }))}
                        className="flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700"
                      >
                        <ChevronDown size={11} className={showItems ? "rotate-180" : ""} />
                        품목 배정 ({assignedItems.length}/{allItems.length})
                      </button>
                      {showItems && (
                        <div className="mt-1.5 space-y-1 bg-gray-50 rounded-xl p-2">
                          {allItems.map(({ parcelId, parcelTracking, idx, item, condition }) => {
                            const isAssigned = assignedItems.some(bi => bi.parcel_id === parcelId && bi.item_index === idx);
                            return (
                              <button key={`${parcelId}-${idx}`} type="button"
                                onClick={() => toggleItemAssign(box, parcelId, idx, item, condition)}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs text-left transition-colors ${
                                  isAssigned ? "border-indigo-400 bg-indigo-50 text-indigo-800" : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300"}`}>
                                <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${isAssigned ? "border-indigo-500 bg-indigo-500" : "border-gray-300"}`}>
                                  {isAssigned && <Check size={8} className="text-white" />}
                                </div>
                                <span className="font-medium">{item.name_en}</span>
                                <span className="text-gray-400">×{item.quantity}</span>
                                <span className="text-gray-400 ml-auto text-[10px]">{parcelTracking.slice(-6)}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 전체 발송 완료 버튼 */}
        {shippingBoxes.length > 0 && canManageBoxes && (
          <div className="px-4 py-3 border-t border-gray-100">
            <button
              onClick={handleShipAll}
              disabled={actioning || !shippingBoxes.some(b => b.intl_tracking_no)}
              className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {actioning
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><Truck size={15} /> 전체 발송 완료 처리</>
              }
            </button>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════
          EMS 우체국 접수
      ═══════════════════════════════════════════════ */}
      {(() => {
        const canApplyEms = ["PAID", "PACKING", "PACKAGING_DONE", "QUOTE_SENT"].includes(order.status);
        const alreadyApplied = !!order.ems_regino;
        const missingAddr = !order.recipient_addr3;

        if (!canApplyEms && !alreadyApplied) return null;

        return (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-1.5">
                <Send size={15} className="text-blue-500" />
                EMS 우체국 접수
              </h2>
              {alreadyApplied && (
                <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                  접수 완료
                </span>
              )}
            </div>

            {/* 이미 접수된 경우 — 결과 표시 */}
            {alreadyApplied ? (
              <div className="px-4 py-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <CheckCircle size={16} className="text-green-500" />
                  등기번호: <span className="font-mono">{order.ems_regino}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm text-gray-500">
                  {order.ems_fee && (
                    <div>
                      <span className="text-xs text-gray-400 block">예상요금</span>
                      <span className="font-semibold text-gray-800">{order.ems_fee.toLocaleString()}원</span>
                    </div>
                  )}
                  {order.ems_applied_at && (
                    <div>
                      <span className="text-xs text-gray-400 block">접수일시</span>
                      <span className="font-semibold text-gray-800">
                        {new Date(order.ems_applied_at).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                  )}
                  {order.ems_premium_cd && (
                    <div>
                      <span className="text-xs text-gray-400 block">서비스 구분</span>
                      <span className="font-semibold text-gray-800">
                        {{ "31": "EMS", "32": "EMS 프리미엄", "14": "K-Packet" }[order.ems_premium_cd] ?? order.ems_premium_cd}
                      </span>
                    </div>
                  )}
                </div>
                {/* 라벨 인쇄 버튼 */}
                <Link
                  href={`/orders/${id}/label`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors"
                >
                  <Printer size={14} /> EMS 라벨 인쇄
                </Link>
              </div>
            ) : missingAddr ? (
              /* 주소 분리 저장 미완 — 안내 */
              <div className="px-4 py-4 bg-amber-50 text-sm text-amber-700 flex items-start gap-2">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <span>
                  수취인 주소(addr1/2/3)가 분리 저장되지 않았습니다.
                  <br />SQL 마이그레이션(012) 실행 후, 고객이 <strong>새로 주문</strong>해야 EMS 접수가 가능합니다.
                </span>
              </div>
            ) : (
              /* 접수 폼 */
              <div className="px-4 py-4 space-y-3">
                {/* 수취인 미리보기 */}
                <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1 text-gray-600">
                  <p className="font-semibold text-gray-800">{order.recipient_name} · {order.recipient_country}</p>
                  <p>{[order.recipient_addr3, order.recipient_addr2, order.recipient_addr1].filter(Boolean).join(", ")}</p>
                  {order.recipient_zip  && <p>우편번호: {order.recipient_zip}</p>}
                  {order.recipient_phone && <p>전화: {order.recipient_phone}</p>}
                  {order.recipient_email && (
                    <p className="flex items-center gap-1"><Mail size={10} />{order.recipient_email}</p>
                  )}
                </div>

                {emsMsg && (
                  <div className={`rounded-xl px-3 py-2 text-sm ${emsMsg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                    {emsMsg.text}
                  </div>
                )}

                <button
                  onClick={() => setShowEmsForm(!showEmsForm)}
                  className="w-full flex items-center justify-between text-sm font-semibold text-blue-600"
                >
                  <span className="flex items-center gap-2">
                    <Truck size={14} /> 박스 실측값 입력 후 접수
                  </span>
                  <ChevronDown size={14} className={showEmsForm ? "rotate-180" : ""} />
                </button>

                {showEmsForm && (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1">총중량 (g) *</label>
                        <input
                          type="number" min={1}
                          value={emsForm.totweight}
                          onChange={e => setEmsForm(f => ({ ...f, totweight: e.target.value }))}
                          placeholder="예: 1250"
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1">가로 (cm) *</label>
                        <input
                          type="number" min={1} step={0.1}
                          value={emsForm.boxlength}
                          onChange={e => setEmsForm(f => ({ ...f, boxlength: e.target.value }))}
                          placeholder="예: 30"
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1">세로 (cm) *</label>
                        <input
                          type="number" min={1} step={0.1}
                          value={emsForm.boxwidth}
                          onChange={e => setEmsForm(f => ({ ...f, boxwidth: e.target.value }))}
                          placeholder="예: 20"
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1">높이 (cm) *</label>
                        <input
                          type="number" min={1} step={0.1}
                          value={emsForm.boxheight}
                          onChange={e => setEmsForm(f => ({ ...f, boxheight: e.target.value }))}
                          placeholder="예: 15"
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleEmsApply}
                      disabled={emsSubmitting}
                      className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {emsSubmitting
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <><Send size={14} /> EMS 우체국 접수하기</>
                      }
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* 견적 확정 */}
      {canQuote && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <button
            onClick={() => setShowQuoteForm(!showQuoteForm)}
            className="w-full flex items-center justify-between text-sm font-semibold text-blue-600"
          >
            <span className="flex items-center gap-2"><Send size={15} /> 실측 후 견적 확정 · 고객 발송</span>
            <ChevronDown size={15} className={showQuoteForm ? "rotate-180" : ""} />
          </button>
          {showQuoteForm && (
            <div className="mt-4 space-y-4">

              {/* ── 실측값 입력 ── */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                  <Weight size={13} /> 실측값 입력
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-400 font-semibold block mb-0.5">총 중량 (g) *</label>
                    <input
                      type="number" min={1}
                      value={measurements.totweight}
                      onChange={e => setMeasurements(m => ({ ...m, totweight: e.target.value }))}
                      placeholder="예: 1250"
                      className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 font-semibold block mb-0.5">가로 (cm) *</label>
                    <input
                      type="number" min={1} step={0.1}
                      value={measurements.boxlength}
                      onChange={e => setMeasurements(m => ({ ...m, boxlength: e.target.value }))}
                      placeholder="예: 30"
                      className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 font-semibold block mb-0.5">세로 (cm) *</label>
                    <input
                      type="number" min={1} step={0.1}
                      value={measurements.boxwidth}
                      onChange={e => setMeasurements(m => ({ ...m, boxwidth: e.target.value }))}
                      placeholder="예: 20"
                      className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 font-semibold block mb-0.5">높이 (cm) *</label>
                    <input
                      type="number" min={1} step={0.1}
                      value={measurements.boxheight}
                      onChange={e => setMeasurements(m => ({ ...m, boxheight: e.target.value }))}
                      placeholder="예: 15"
                      className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                </div>

                {/* EMS 요금 계산 버튼 */}
                <button
                  onClick={handleCalcFee}
                  disabled={calcLoading || !measurements.totweight || !measurements.boxlength}
                  className="w-full flex items-center justify-center gap-1.5 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg disabled:opacity-40"
                >
                  {calcLoading
                    ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <><DollarSign size={12} /> EMS 배송비 자동 계산</>
                  }
                </button>
                {calcError && <p className="text-xs text-red-500">{calcError}</p>}
                {calcFee !== null && (
                  <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                    <span className="text-xs text-indigo-700 font-semibold">EMS 예상 배송비</span>
                    <span className="text-sm font-bold text-indigo-700">{calcFee.toLocaleString()}원</span>
                  </div>
                )}
              </div>

              {/* ── EMS 원가 / 마진 / 청구가 ── */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">EMS 원가 (원)</label>
                  <input
                    type="number" value={emsCost}
                    onChange={(e) => {
                      setEmsCost(e.target.value);
                      const cost = parseInt(e.target.value) || 0;
                      const m = parseInt(margin) || 0;
                      setFinalFee(String(cost + m));
                    }}
                    placeholder="EMS API"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">마진 (원)</label>
                  <input
                    type="number" value={margin}
                    onChange={(e) => {
                      setMargin(e.target.value);
                      const cost = parseInt(emsCost) || calcFee || 0;
                      const m = parseInt(e.target.value) || 0;
                      setFinalFee(String(cost + m));
                    }}
                    placeholder="0"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">청구 배송비 (원) *</label>
                  <input
                    type="number" value={finalFee}
                    onChange={(e) => setFinalFee(e.target.value)}
                    placeholder="원가+마진"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {emsCost && margin && (
                <p className="text-xs text-gray-400">
                  원가 {parseInt(emsCost).toLocaleString()}원 + 마진 {parseInt(margin).toLocaleString()}원
                  = {(parseInt(emsCost) + parseInt(margin)).toLocaleString()}원
                </p>
              )}

              {order.duty_prepaid && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-emerald-800">관세 선납 (DDP)</p>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">
                      관세 선납 청구액 (원)
                    </label>
                    <input
                      type="number"
                      value={dutyDepositKrw}
                      onChange={(e) => setDutyDepositKrw(e.target.value)}
                      placeholder="자동 산출"
                      className="w-full px-3 py-2.5 border border-emerald-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>
                  <p className="text-[10px] text-emerald-700">
                    신고가액 USD {Number(order.customs_value ?? 0).toFixed(2)} 기준 보수적 산출.
                    비워두면 견적 확정 시 자동 재계산됩니다.
                  </p>
                  {dutyDepositKrw && finalFee && (
                    <p className="text-xs text-gray-600">
                      총 청구 예상:{" "}
                      <span className="font-bold">
                        {(
                          (order.packaging_fee ?? 0) +
                          parseInt(finalFee || "0", 10) +
                          parseInt(dutyDepositKrw || "0", 10)
                        ).toLocaleString()}
                        원
                      </span>
                      {" "}(포장 + 배송 + 관세)
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">메모 (선택)</label>
                <input
                  value={quoteNote} onChange={(e) => setQuoteNote(e.target.value)}
                  placeholder="예: 실측 무게 1.25kg 기준"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
                견적 확정 후 고객에게 알림이 발송됩니다. 고객이 결제를 완료하면 <strong>EMS 접수가 자동으로 처리</strong>됩니다.
              </div>

              <button
                onClick={handleQuote}
                disabled={actioning || !finalFee}
                className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {actioning
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <><Send size={14} /> 견적 발송하기</>
                }
              </button>
            </div>
          )}
        </div>
      )}
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
