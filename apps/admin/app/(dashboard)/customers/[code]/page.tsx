import { adminDb } from "@/lib/supabase/admin";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package, ShoppingBag, User } from "lucide-react";
import { parcelDisplayColor, parcelDisplayLabel } from "@/lib/parcel-status";

const ORDER_STATUS: Record<string, string> = {
  DRAFT: "초안", PENDING_QUOTE: "견적 대기", QUOTE_SENT: "견적 발송",
  PAYMENT_WAIT: "결제 대기", PAID: "결제 완료", PACKING: "포장 중",
  IN_TRANSIT: "배송 중", DELIVERED: "배송 완료", CANCELLED: "취소",
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const decoded = decodeURIComponent(code);

  const { data: customer } = await adminDb
    .from("customers")
    .select("id, name, email, customer_code, phone, personal_address, created_at")
    .eq("customer_code", decoded)
    .maybeSingle();

  if (!customer) notFound();

  const [{ data: parcels }, { data: orders }] = await Promise.all([
    adminDb
      .from("parcels")
      .select("id, tracking_no, status, is_shippable, created_at, inbound_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(50),
    adminDb
      .from("orders")
      .select("id, order_no, status, recipient_name, total_amount, created_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/customers" className="p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{customer.name ?? customer.email}</h1>
          <p className="text-sm text-gray-500">{customer.customer_code}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <User size={18} className="text-blue-600" />
          </div>
          <div className="text-sm space-y-1">
            <p><span className="text-gray-400 w-16 inline-block">이메일</span> {customer.email}</p>
            {customer.phone && <p><span className="text-gray-400 w-16 inline-block">연락처</span> {customer.phone}</p>}
            {customer.personal_address && (
              <p><span className="text-gray-400 w-16 inline-block">입고주소</span> {customer.personal_address}</p>
            )}
            <p className="text-xs text-gray-400 pt-1">
              가입 {new Date(customer.created_at).toLocaleDateString("ko-KR")}
            </p>
          </div>
        </div>
      </div>

      <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Package size={18} className="text-gray-500" />
          <h2 className="font-semibold text-gray-900">물품 ({parcels?.length ?? 0})</h2>
          <Link href={`/parcels?q=${encodeURIComponent(customer.customer_code)}`} className="ml-auto text-xs text-blue-600">
            전체 보기
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {(parcels ?? []).length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">물품 없음</p>
          ) : (
            (parcels ?? []).map((p) => (
              <Link key={p.id} href={`/parcels/${p.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                <div>
                  <p className="text-sm font-mono">{p.tracking_no ?? "미등록"}</p>
                  <p className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString("ko-KR")}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full border ${parcelDisplayColor(p.status, p.is_shippable)}`}>
                  {parcelDisplayLabel(p.status, p.is_shippable)}
                </span>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <ShoppingBag size={18} className="text-gray-500" />
          <h2 className="font-semibold text-gray-900">배송 주문 ({orders?.length ?? 0})</h2>
          <Link href={`/orders?q=${encodeURIComponent(customer.customer_code)}`} className="ml-auto text-xs text-blue-600">
            전체 보기
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {(orders ?? []).length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">주문 없음</p>
          ) : (
            (orders ?? []).map((o) => (
              <Link key={o.id} href={`/orders/${o.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium">{o.order_no}</p>
                  <p className="text-xs text-gray-400">{o.recipient_name} · {ORDER_STATUS[o.status] ?? o.status}</p>
                </div>
                <p className="text-sm font-semibold">{(o.total_amount ?? 0).toLocaleString()}원</p>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
