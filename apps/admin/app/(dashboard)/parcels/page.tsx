import { adminDb } from "@/lib/supabase/admin";
import Link from "next/link";
import { Package, ChevronRight } from "lucide-react";
import {
  PARCEL_FILTER_TABS,
  INBOUND_SOURCE_TABS,
  INBOUND_SOURCE_LABEL,
  parcelDisplayColor,
  parcelDisplayLabel,
} from "@/lib/parcel-status";
import { resolveInboundSource } from "@/lib/parcels/inbound-sync";
import ParcelsSyncButton from "@/components/parcels/ParcelsSyncButton";
import InboundSyncSchedulePanel from "@/components/parcels/InboundSyncSchedulePanel";
import {
  DEFAULT_INBOUND_SYNC_SCHEDULE,
  INBOUND_SYNC_CONFIG_KEY,
  normalizeInboundSyncSchedule,
  type InboundSyncLastRun,
} from "@/lib/parcels/inbound-sync-schedule";

type ParcelRow = {
  id: string;
  tracking_no: string | null;
  status: string;
  sender_name: string | null;
  courier: string | null;
  inbound_source: string | null;
  epost_order_no: string | null;
  pickup_tracking_no: string | null;
  tracking_last_event: { statusLabel?: string; description?: string; time?: string } | null;
  weight_actual: number | null;
  inbound_at: string | null;
  is_shippable: boolean | null;
  hold_reason: string | null;
  created_at: string;
  pickup_date: string | null;
  customers: { name?: string; email?: string; customer_code?: string } | null;
};

function countForFilter(
  parcels: { status: string; is_shippable: boolean | null }[],
  key: string,
): number {
  if (!key) return parcels.length;
  if (key === "INBOUND_READY") {
    return parcels.filter((p) => p.status === "INBOUND" && p.is_shippable === true).length;
  }
  if (key === "INBOUND_ARRIVED") {
    return parcels.filter((p) => p.status === "INBOUND" && p.is_shippable !== true).length;
  }
  return parcels.filter((p) => p.status === key).length;
}

export default async function ParcelsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; customer?: string; source?: string }>;
}) {
  const { status, q, customer, source } = await searchParams;

  let query = adminDb
    .from("parcels")
    .select(`
      id, tracking_no, status, sender_name, courier, inbound_source,
      epost_order_no, pickup_tracking_no, tracking_last_event,
      weight_actual, inbound_at, is_shippable, hold_reason, created_at, pickup_date,
      customers(name, email, customer_code)
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status === "INBOUND_READY") {
    query = query.eq("status", "INBOUND").eq("is_shippable", true);
  } else if (status === "INBOUND_ARRIVED") {
    query = query.eq("status", "INBOUND").or("is_shippable.is.null,is_shippable.eq.false");
  } else if (status) {
    query = query.eq("status", status);
  }

  if (source === "PICKUP") {
    query = query.or("inbound_source.eq.PICKUP,epost_order_no.not.is.null");
  } else if (source === "DIRECT") {
    query = query.or("inbound_source.eq.DIRECT,and(epost_order_no.is.null,pickup_tracking_no.is.null)");
  }

  if (customer) {
    const { data: cust } = await adminDb
      .from("customers")
      .select("id")
      .or(`customer_code.ilike.%${customer}%,name.ilike.%${customer}%,email.ilike.%${customer}%`)
      .limit(1)
      .maybeSingle();
    if (cust) query = query.eq("customer_id", cust.id);
  }

  if (q) {
    const { data: custMatches } = await adminDb
      .from("customers")
      .select("id")
      .or(`name.ilike.%${q}%,customer_code.ilike.%${q}%,email.ilike.%${q}%`);
    const custIds = (custMatches ?? []).map((c) => c.id);
    if (custIds.length > 0) {
      query = query.or(
        `tracking_no.ilike.%${q}%,sender_name.ilike.%${q}%,customer_id.in.(${custIds.join(",")})`,
      );
    } else {
      query = query.or(`tracking_no.ilike.%${q}%,sender_name.ilike.%${q}%`);
    }
  }

  const [{ data: parcels }, { data: allForCount }, { data: scheduleRow }, { data: lastRunRow }] = await Promise.all([
    query,
    adminDb.from("parcels").select("status, is_shippable, inbound_source, epost_order_no, pickup_tracking_no"),
    adminDb.from("admin_config").select("value").eq("key", INBOUND_SYNC_CONFIG_KEY).maybeSingle(),
    adminDb.from("admin_config").select("value").eq("key", "inbound_sync_last_run").maybeSingle(),
  ]);

  const syncSchedule = scheduleRow?.value
    ? normalizeInboundSyncSchedule(scheduleRow.value)
    : DEFAULT_INBOUND_SYNC_SCHEDULE;
  const syncLastRun = (lastRunRow?.value as InboundSyncLastRun | undefined) ?? null;

  const countSource = allForCount ?? [];
  const countForSource = (key: string) => {
    if (!key) return countSource.length;
    return countSource.filter((p) => resolveInboundSource(p) === key).length;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">수거·입고 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            수거신청(우체국 API) · 물품등록(택배 추적 API) · 총 {countSource.length}건
          </p>
        </div>
        <ParcelsSyncButton source={source === "PICKUP" || source === "DIRECT" ? source : undefined} />
      </div>

      <InboundSyncSchedulePanel initialSchedule={syncSchedule} initialLastRun={syncLastRun} />

      {/* 입고 경로 탭 */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
        {INBOUND_SOURCE_TABS.map(({ key, label }) => {
          const params = new URLSearchParams();
          if (key) params.set("source", key);
          if (status) params.set("status", status);
          if (q) params.set("q", q);
          if (customer) params.set("customer", customer);
          const href = params.toString() ? `/parcels?${params}` : "/parcels";
          const cnt = countForSource(key);
          return (
            <Link
              key={key || "all-src"}
              href={href}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border ${
                (source ?? "") === key
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
              }`}
            >
              {label}{cnt > 0 ? ` (${cnt})` : ""}
            </Link>
          );
        })}
      </div>

      <form className="mb-4">
        <div className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="운송장, 발송인, 고객명·고객번호 검색"
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {status && <input type="hidden" name="status" value={status} />}
          {source && <input type="hidden" name="source" value={source} />}
          {customer && <input type="hidden" name="customer" value={customer} />}
          <button type="submit" className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium">
            검색
          </button>
        </div>
      </form>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {PARCEL_FILTER_TABS.map(({ key, label }) => {
          const params = new URLSearchParams();
          if (key) params.set("status", key);
          if (q) params.set("q", q);
          if (customer) params.set("customer", customer);
          if (source) params.set("source", source);
          const href = params.toString() ? `/parcels?${params}` : "/parcels";
          const cnt = countForFilter(countSource, key);
          return (
            <Link
              key={key || "all"}
              href={href}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                (status ?? "") === key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
              }`}
            >
              {label}
              {cnt > 0 ? ` (${cnt})` : ""}
            </Link>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {!parcels || parcels.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Package size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm">해당하는 물품이 없습니다</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-3 px-4 font-medium text-gray-500">유형</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">운송장</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">고객</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">발송인</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">상태</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">수거희망일</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">무게</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {(parcels as ParcelRow[]).map((p) => {
                const cust = p.customers;
                const cfg = parcelDisplayColor(p.status, p.is_shippable);
                const label = parcelDisplayLabel(p.status, p.is_shippable);
                const src = resolveInboundSource(p);
                const srcLabel = INBOUND_SOURCE_LABEL[src];
                const lastEvt = p.tracking_last_event;
                return (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        src === "PICKUP" ? "bg-yellow-100 text-yellow-800" : "bg-indigo-100 text-indigo-800"
                      }`}>
                        {srcLabel}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs">{p.tracking_no ?? p.pickup_tracking_no ?? "미등록"}</span>
                      {lastEvt?.statusLabel && (
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[140px]">{lastEvt.statusLabel}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {cust ? (
                        <Link href={`/customers/${encodeURIComponent(cust.customer_code ?? "")}`} className="hover:text-blue-600">
                          <p className="font-medium text-gray-900">{cust.name ?? "-"}</p>
                          <p className="text-xs text-gray-400">{cust.customer_code}</p>
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600 max-w-[100px] truncate">
                      {p.sender_name ?? "-"}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${cfg}`}>
                        {label}
                      </span>
                      {p.hold_reason && (
                        <p className="text-xs text-red-500 mt-0.5 max-w-[120px] truncate">{p.hold_reason}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">
                      {p.pickup_date
                        ? new Date(p.pickup_date).toLocaleDateString("ko-KR")
                        : p.inbound_at
                          ? new Date(p.inbound_at).toLocaleDateString("ko-KR")
                          : "-"}
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">
                      {p.weight_actual ? `${p.weight_actual}g` : "-"}
                    </td>
                    <td className="py-3 px-4">
                      <Link href={`/parcels/${p.id}`} className="text-blue-600 hover:text-blue-800">
                        <ChevronRight size={16} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
