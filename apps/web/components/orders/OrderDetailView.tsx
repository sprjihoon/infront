"use client";

import Link from "next/link";
import { ChevronRight, MapPin, Package, Scale, Truck, X } from "lucide-react";
import { canCustomerCancelOrder } from "@/lib/order-reservation";
import {
  COUNTRIES,
  formatRecipientAddress,
  ORDER_STATUS_CONFIG,
  PACKAGING_TYPE_LABELS,
  SHIPPING_METHOD_LABELS,
  type OrderDetail,
  type OrderSummary,
} from "@/lib/order-display";
import PaymentButton from "@/components/orders/PaymentButton";

interface OrderDetailViewProps {
  order: OrderDetail;
  variant?: "embedded" | "page";
  onCancelClick?: () => void;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = ORDER_STATUS_CONFIG[status] ?? ORDER_STATUS_CONFIG.DRAFT;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function OrderSummaryHeader({ order }: { order: OrderSummary }) {
  const country = COUNTRIES[order.recipient_country ?? ""];
  return (
    <>
      <p className="text-xs font-bold text-gray-400 mb-0.5">{order.order_no}</p>
      <p className="text-sm font-semibold text-gray-900">
        {country ? `${country.flag} ${country.name}` : order.recipient_country ?? "—"}
        {order.recipient_name ? ` · ${order.recipient_name}` : ""}
      </p>
      <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
        <span>{SHIPPING_METHOD_LABELS[order.shipping_method] ?? order.shipping_method}</span>
        <span>·</span>
        <span>물품 {order.order_parcels?.length ?? 0}개</span>
        <span>·</span>
        <span>{new Date(order.created_at).toLocaleDateString("ko-KR")}</span>
      </div>
    </>
  );
}

export function OrderListActions({
  order,
  onCancelClick,
}: {
  order: OrderSummary;
  onCancelClick?: () => void;
}) {
  return (
    <>
      {canCustomerCancelOrder(order.status, order.payment_status) && onCancelClick && (
        <div className="mt-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCancelClick();
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-red-200 text-red-600 text-xs font-semibold bg-white"
          >
            <X size={14} />
            신청 취소
          </button>
        </div>
      )}

      {(order.status === "QUOTE_SENT" || order.status === "PENDING_PAYMENT") && (
        <div className="mt-3 flex items-center justify-between bg-brand-50 rounded-xl px-3 py-2.5">
          <div>
            <p className="text-xs font-bold text-brand-800">결제 대기 중</p>
            <p className="text-xs text-brand-600">{order.total_amount.toLocaleString()}원</p>
          </div>
          <PaymentButton order={order} />
        </div>
      )}
    </>
  );
}

export default function OrderDetailView({
  order,
  variant = "embedded",
  onCancelClick,
}: OrderDetailViewProps) {
  const country = COUNTRIES[order.recipient_country ?? ""];
  const showWeights =
    order.actual_weight != null ||
    order.chargeable_weight != null;

  return (
    <div className={variant === "page" ? "space-y-4" : "space-y-3"}>
      {variant === "page" && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <OrderSummaryHeader order={order} />
            </div>
            <StatusBadge status={order.status} />
          </div>
          <OrderListActions order={order} onCancelClick={onCancelClick} />
        </div>
      )}

      {/* 수취인 정보 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
        <p className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
          <MapPin size={12} /> 배송지
        </p>
        <p className="text-sm font-semibold text-gray-900">
          {country ? `${country.flag} ${country.name}` : order.recipient_country ?? "—"}
          {order.recipient_name ? ` · ${order.recipient_name}` : ""}
        </p>
        {order.recipient_phone && (
          <p className="text-xs text-gray-500">{order.recipient_phone}</p>
        )}
        <p className="text-sm text-gray-700 leading-relaxed">{formatRecipientAddress(order)}</p>
        {order.recipient_email && (
          <p className="text-xs text-gray-400">{order.recipient_email}</p>
        )}
      </div>

      {/* 포장·배송 옵션 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-gray-500 mb-2">배송 옵션</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-gray-50 rounded-xl px-3 py-2">
            <p className="text-gray-400 mb-0.5">배송 방법</p>
            <p className="font-semibold text-gray-800">
              {SHIPPING_METHOD_LABELS[order.shipping_method] ?? order.shipping_method}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl px-3 py-2">
            <p className="text-gray-400 mb-0.5">포장</p>
            <p className="font-semibold text-gray-800">
              {PACKAGING_TYPE_LABELS[order.packaging_type] ?? order.packaging_type}
            </p>
          </div>
        </div>
      </div>

      {/* 연결 물품 */}
      {order.order_parcels.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
          <p className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
            <Package size={12} /> 포함 물품
          </p>
          <div className="space-y-1.5">
            {order.order_parcels.map((link) => {
              const parcel = link.parcels;
              if (!parcel) {
                return (
                  <div
                    key={link.parcel_id}
                    className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5 text-xs text-gray-500"
                  >
                    물품 ID {link.parcel_id.slice(0, 8)}…
                  </div>
                );
              }
              return (
                <Link
                  key={link.parcel_id}
                  href={`/warehouse/${parcel.id}`}
                  className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5 active:bg-gray-100 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {parcel.sender_name ?? "발송인 미상"}
                    </p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                      {parcel.tracking_no ?? "운송장 없음"}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* 운송장 */}
      {order.shipping_boxes && order.shipping_boxes.length > 0 ? (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
            <Truck size={12} /> 배송 박스별 운송장
          </p>
          <div className="space-y-1.5">
            {order.shipping_boxes.map((box) => (
              <div
                key={box.id}
                className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 border border-gray-100"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500">박스 {box.box_seq}</span>
                  {box.weight_kg != null && (
                    <span className="text-xs text-gray-400">{box.weight_kg}kg</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {box.intl_tracking_no ? (
                    <>
                      <span className="text-xs text-gray-400">{box.carrier ?? ""}</span>
                      <span className="font-mono text-xs font-semibold text-gray-800">
                        {box.intl_tracking_no}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-gray-300">운송장 준비중</span>
                  )}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      box.status === "SHIPPED" || box.status === "DELIVERED"
                        ? "bg-green-100 text-green-600"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {box.status === "PREPARING"
                      ? "준비중"
                      : box.status === "PACKED"
                        ? "포장완료"
                        : box.status === "SHIPPED"
                          ? "발송됨"
                          : "배달완료"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : order.intl_tracking_no ? (
        <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <span className="text-gray-500 text-sm flex items-center gap-1.5">
            <Truck size={13} /> 국제 운송장
          </span>
          <span className="font-semibold text-gray-800 font-mono text-sm">
            {order.intl_tracking_no}
          </span>
        </div>
      ) : null}

      {/* 국제 배송 행방 */}
      {(order.intl_tracking_last_event || (order.intl_tracking_events?.length ?? 0) > 0) && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
            <Truck size={12} /> 국제 배송 추적
            {order.intl_tracking_status === "DELIVERED" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-600">
                배달완료
              </span>
            )}
          </p>
          {order.intl_tracking_last_event && (
            <div className="bg-brand-50 border border-brand-100 rounded-xl px-3 py-2 mb-2">
              <p className="text-xs font-semibold text-brand-800">
                {order.intl_tracking_last_event.statusLabel}
              </p>
              <p className="text-xs text-brand-600 mt-0.5">
                {order.intl_tracking_last_event.description}
              </p>
              {(order.intl_tracking_last_event.location || order.intl_tracking_last_event.time) && (
                <p className="text-[10px] text-brand-400 mt-1">
                  {[order.intl_tracking_last_event.location, order.intl_tracking_last_event.time]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          )}
          {(order.intl_tracking_events?.length ?? 0) > 1 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {order.intl_tracking_events!.slice(1, 8).map((ev, i) => (
                <div key={i} className="flex gap-2 text-[11px] text-gray-500 py-1 border-t border-gray-50">
                  <span className="shrink-0 text-gray-400 w-16 truncate">{ev.time}</span>
                  <span className="text-gray-700">{ev.statusLabel || ev.description}</span>
                </div>
              ))}
            </div>
          )}
          {order.delivered_at && (
            <p className="text-[10px] text-gray-400 mt-2 text-center">
              배달완료 {new Date(order.delivered_at).toLocaleString("ko-KR")}
            </p>
          )}
        </div>
      )}

      {/* 실측 무게 */}
      {showWeights && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
            <Scale size={12} /> 실측 정보
          </p>
          <div className="flex gap-4 text-sm">
            {order.actual_weight != null && (
              <div>
                <p className="text-xs text-gray-400">실중량</p>
                <p className="font-semibold text-gray-800">{order.actual_weight}kg</p>
              </div>
            )}
            {order.chargeable_weight != null && (
              <div>
                <p className="text-xs text-gray-400">적용 중량</p>
                <p className="font-semibold text-gray-800">{order.chargeable_weight}kg</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 인보이스 */}
      {order.item_list?.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-2">인보이스 물품</p>
          <div className="space-y-1.5">
            {order.item_list.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-700">
                  {item.name_en} × {item.quantity}
                </span>
                <span className="text-gray-500">
                  USD {(item.unit_price_usd * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          {order.customs_value != null && (
            <div className="flex justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
              <span>세관신고 합계</span>
              <span>USD {Number(order.customs_value).toFixed(2)}</span>
            </div>
          )}
          {order.insurance_enabled && (
            <div className="flex justify-between text-xs text-brand-700 mt-1">
              <span>보험 가입 신고가액</span>
              <span>USD {Number(order.insurance_amount ?? order.customs_value ?? 0).toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {/* 금액 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-1.5">
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
        {(order.extra_fee ?? 0) > 0 && (
          <div className="flex justify-between text-xs text-gray-500">
            <span>추가 요금</span>
            <span>{Number(order.extra_fee).toLocaleString()}원</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-100">
          <span>합계</span>
          <span className={order.payment_status === "PAID" ? "text-green-600" : "text-gray-900"}>
            {order.total_amount.toLocaleString()}원
            {order.payment_status === "PAID" ? " (결제완료)" : ""}
          </span>
        </div>
      </div>

      {variant === "page" && order.updated_at && (
        <p className="text-center text-xs text-gray-300 pb-2">
          최종 업데이트 {new Date(order.updated_at).toLocaleString("ko-KR")}
        </p>
      )}
    </div>
  );
}

export { StatusBadge, OrderSummaryHeader };
