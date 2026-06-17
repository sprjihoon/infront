"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CreditCard,
  Package,
  MapPin,
  Phone,
  Mail,
  Hash,
  XCircle,
  CheckCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface ShopOrder {
  id: string;
  oid: string;
  product_id: string;
  amount: number;
  status: string;
  sender_name: string;
  sender_email: string;
  sender_phone: string;
  sender_zipcode: string | null;
  sender_address: string | null;
  sender_detail: string | null;
  recipient_name: string;
  recipient_phone: string | null;
  recipient_zipcode: string | null;
  recipient_address: string | null;
  recipient_detail: string | null;
  recipient_addr1: string | null;
  recipient_addr2: string | null;
  recipient_addr3: string | null;
  recipient_email: string | null;
  inicis_tid: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  cancel_msg: string | null;
  ems_regino: string | null;
  ems_receive_seq: string | null;
  ems_fee: number | null;
  ems_applied_at: string | null;
  admin_memo: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  PENDING_PAYMENT: { label: "결제대기", cls: "bg-yellow-100 text-yellow-800" },
  PAID:            { label: "결제완료", cls: "bg-green-100 text-green-800" },
  CANCELLED:       { label: "취소됨",  cls: "bg-red-100 text-red-700" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_LABEL[status] ?? { label: status, cls: "bg-gray-100 text-gray-700" };
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-gray-500 mb-0.5">{label}</dt>
      <dd className="text-sm text-gray-900 font-medium">{value}</dd>
    </div>
  );
}

export default function ShopOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [order, setOrder]         = useState<ShopOrder | null>(null);
  const [loading, setLoading]     = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelMsg, setCancelMsg] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [memo, setMemo]           = useState("");
  const [savingMemo, setSavingMemo] = useState(false);
  const [alert, setAlert]         = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const backUrl = `/shop-orders?${searchParams.toString()}`;

  async function fetchOrder() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/shop-orders/${params.id}`);
      if (!res.ok) throw new Error("not found");
      const data = await res.json() as { order: ShopOrder };
      setOrder(data.order);
      setMemo(data.order.admin_memo ?? "");
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchOrder(); }, [params.id]);

  async function handleCancel() {
    if (!order) return;
    if (!confirm(`[${order.oid}] 결제를 취소하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    setCancelling(true);
    setAlert(null);
    try {
      const res = await fetch(`/api/admin/shop-orders/${order.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msg: cancelMsg || "관리자 취소" }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; code?: string };
      if (!res.ok || !data.ok) {
        setAlert({ type: "err", msg: data.error ?? "취소 실패" });
      } else {
        setAlert({ type: "ok", msg: "취소가 완료되었습니다." });
        setShowCancel(false);
        await fetchOrder();
      }
    } catch {
      setAlert({ type: "err", msg: "네트워크 오류" });
    } finally {
      setCancelling(false);
    }
  }

  async function saveMemo() {
    if (!order) return;
    setSavingMemo(true);
    try {
      await fetch(`/api/admin/shop-orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_memo: memo }),
      });
      setAlert({ type: "ok", msg: "메모가 저장되었습니다." });
    } catch {
      setAlert({ type: "err", msg: "저장 실패" });
    } finally {
      setSavingMemo(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20 text-gray-500">
        주문을 찾을 수 없습니다.
        <Link href="/shop-orders" className="block mt-2 text-primary text-sm underline">목록으로</Link>
      </div>
    );
  }

  const canCancel = order.status === "PAID" && !!order.inicis_tid;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={backUrl} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              샵 주문 상세
            </h1>
            <p className="text-xs font-mono text-gray-500">{order.oid}</p>
          </div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* 알림 */}
      {alert && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${alert.type === "ok" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
          {alert.type === "ok" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {alert.msg}
          <button onClick={() => setAlert(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">닫기</button>
        </div>
      )}

      {/* 결제 정보 */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <CreditCard className="h-4 w-4" /> 결제 정보
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Field label="주문금액" value={`${order.amount.toLocaleString()}원`} />
          <Field label="결제 TID" value={order.inicis_tid ?? undefined} />
          <Field label="결제 완료" value={order.paid_at ? new Date(order.paid_at).toLocaleString("ko-KR") : undefined} />
          <Field label="결제대기 시작" value={new Date(order.created_at).toLocaleString("ko-KR")} />
          {order.cancelled_at && (
            <Field label="취소 일시" value={new Date(order.cancelled_at).toLocaleString("ko-KR")} />
          )}
          {order.cancel_msg && <Field label="취소 사유" value={order.cancel_msg} />}
        </dl>
      </section>

      {/* 발송인 */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Package className="h-4 w-4" /> 발송인
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Field label="이름" value={order.sender_name} />
          <Field label="전화" value={order.sender_phone} />
          <Field label="이메일" value={order.sender_email} />
          <Field label="주소" value={[order.sender_zipcode && `(${order.sender_zipcode})`, order.sender_address, order.sender_detail].filter(Boolean).join(" ") || undefined} />
        </dl>
      </section>

      {/* 수취인 */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <MapPin className="h-4 w-4" /> 수취인
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Field label="이름" value={order.recipient_name} />
          <Field label="전화" value={order.recipient_phone ?? undefined} />
          <Field label="이메일" value={order.recipient_email ?? undefined} />
          <Field label="주소" value={[order.recipient_zipcode && `(${order.recipient_zipcode})`, order.recipient_address, order.recipient_detail].filter(Boolean).join(" ") || undefined} />
          {order.recipient_addr1 && (
            <Field label="EMS addr1 (도/주)" value={order.recipient_addr1} />
          )}
          {order.recipient_addr2 && (
            <Field label="EMS addr2 (시/군구)" value={order.recipient_addr2} />
          )}
          {order.recipient_addr3 && (
            <Field label="EMS addr3 (도로명+상세)" value={order.recipient_addr3} />
          )}
        </dl>
      </section>

      {/* EMS 접수 정보 */}
      {order.ems_regino && (
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Hash className="h-4 w-4" /> EMS 접수 정보
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Field label="등기번호" value={order.ems_regino} />
            <Field label="접수번호" value={order.ems_receive_seq ?? undefined} />
            <Field label="우편요금" value={order.ems_fee ? `${order.ems_fee.toLocaleString()}원` : undefined} />
            <Field label="접수 일시" value={order.ems_applied_at ? new Date(order.ems_applied_at).toLocaleString("ko-KR") : undefined} />
          </dl>
        </section>
      )}

      {/* 관리자 메모 */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">관리자 메모</h2>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="내부 메모 입력..."
          rows={3}
          className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
        />
        <button
          onClick={saveMemo}
          disabled={savingMemo}
          className="mt-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium flex items-center gap-1.5 disabled:opacity-40"
        >
          {savingMemo && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          저장
        </button>
      </section>

      {/* 결제 취소 */}
      {canCancel && (
        <section className="bg-white rounded-xl border border-red-200 p-5">
          <h2 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
            <XCircle className="h-4 w-4" /> 결제 취소
          </h2>
          {!showCancel ? (
            <button
              onClick={() => setShowCancel(true)}
              className="px-4 py-2 text-sm bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg font-medium"
            >
              취소 처리하기
            </button>
          ) : (
            <div className="space-y-3">
              <input
                type="text"
                value={cancelMsg}
                onChange={(e) => setCancelMsg(e.target.value)}
                placeholder="취소 사유 (기본: 관리자 취소)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center gap-1.5 disabled:opacity-40"
                >
                  {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                  KG이니시스 취소 확정
                </button>
                <button
                  onClick={() => setShowCancel(false)}
                  className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
                >
                  취소
                </button>
              </div>
              <p className="text-xs text-red-600">
                ※ KG이니시스를 통해 전액 환불이 처리됩니다. 취소 후 복구 불가합니다.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
