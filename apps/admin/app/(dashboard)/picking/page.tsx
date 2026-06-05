export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { ReactNode } from "react";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";
import Link from "next/link";
import {
  ClipboardList,
  Globe,
  Truck,
  MapPin,
  Package,
  ChevronRight,
  ChevronLeft,
  User,
  CheckCircle2,
  Clock,
} from "lucide-react";

// ── 상수 ──────────────────────────────────────────────────────
const PAGE_SIZE = 12;

// ── 상태 설정 ─────────────────────────────────────────────────

// 결제 완료 이후 상태만 피킹 대상
const INTL_PICK_STATUSES = ["PAID", "PACKING", "PICKING", "PICKING_DONE"] as const;
const DOM_PICK_STATUSES  = ["PENDING", "PICKING", "PICKING_DONE"] as const;

const PACKAGING_LABEL: Record<string, string> = {
  NONE:        "포장 없음",
  REPACK:      "리팩",
  COMBINED:    "합포장",
  SPECIAL:     "특수포장",
  SAFE_PACK:   "안전포장",
  CONSOLIDATE: "통합포장",
};

const STATUS_BADGE: Record<string, { label: string; cls: string; bar: string }> = {
  PAID:         { label: "피킹 대기", cls: "bg-amber-100  text-amber-800  border-amber-200",  bar: "bg-amber-400"  },
  PACKING:      { label: "피킹 대기", cls: "bg-amber-100  text-amber-800  border-amber-200",  bar: "bg-amber-400"  },
  PENDING:      { label: "피킹 대기", cls: "bg-amber-100  text-amber-800  border-amber-200",  bar: "bg-amber-400"  },
  PICKING:      { label: "피킹 중",   cls: "bg-blue-100   text-blue-800   border-blue-200",   bar: "bg-blue-500"   },
  PICKING_DONE: { label: "피킹 완료", cls: "bg-green-100  text-green-800  border-green-200",  bar: "bg-green-500"  },
};

// ── 타입 ──────────────────────────────────────────────────────

type OrderRow = {
  id:              string;
  kind:            "intl" | "domestic";
  rawId:           string;
  orderNo:         string;
  status:          string;
  customerName:    string;
  customerCode:    string;
  recipientCountry?: string;
  packagingType:   string;
  customerNote:    string;
  parcelCount:     number;
  itemCount:       number;
  locations:       string[];
  createdAt:       string;
};

// ── 필터 ──────────────────────────────────────────────────────

type FilterKey = "all" | "waiting" | "picking" | "done";

const WAITING_STATUSES = ["PAID", "PACKING", "PENDING"];

function applyFilter(rows: OrderRow[], filter: FilterKey): OrderRow[] {
  switch (filter) {
    case "waiting": return rows.filter((r) => WAITING_STATUSES.includes(r.status));
    case "picking": return rows.filter((r) => r.status === "PICKING");
    case "done":    return rows.filter((r) => r.status === "PICKING_DONE");
    default:        return rows;
  }
}

function makeHref(filter: FilterKey, page: number) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/picking?${qs}` : "/picking";
}

// ── 서버 컴포넌트 ─────────────────────────────────────────────

export default async function PickingPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const { filter: rawFilter, page: rawPage } = await searchParams;
  const filter: FilterKey = (["all", "waiting", "picking", "done"].includes(rawFilter ?? "")
    ? rawFilter : "all") as FilterKey;
  const page = Math.max(1, parseInt(rawPage ?? "1", 10) || 1);

  const admin = await requireAdmin();
  const workerName = admin?.email?.split("@")[0] ?? "작업자";

  // ── 해외 주문 ─────────────────────────────────────────────
  const { data: intlOrders } = await adminDb
    .from("orders")
    .select(`id, order_no, status, recipient_country, packaging_type, created_at, customers(name, customer_code)`)
    .in("status", [...INTL_PICK_STATUSES])
    .order("created_at", { ascending: true })
    .limit(200);

  // ── 국내 주문 ─────────────────────────────────────────────
  const { data: domOrders } = await adminDb
    .from("domestic_orders")
    .select(`id, status, packaging_type, delivery_msg, notes, created_at, parcel_ids, customers(name, customer_code)`)
    .in("status", [...DOM_PICK_STATUSES])
    .order("created_at", { ascending: true })
    .limit(200);

  // ── 소포 정보 조회 ────────────────────────────────────────
  const intlParcelMap = new Map<string, string[]>();
  if ((intlOrders ?? []).length > 0) {
    const { data: ops } = await adminDb
      .from("order_parcels")
      .select("order_id, parcel_id")
      .in("order_id", (intlOrders ?? []).map((o) => o.id));
    (ops ?? []).forEach((op) => {
      const list = intlParcelMap.get(op.order_id) ?? [];
      list.push(op.parcel_id);
      intlParcelMap.set(op.order_id, list);
    });
  }

  const allParcelIds = new Set<string>();
  intlParcelMap.forEach((ids) => ids.forEach((id) => allParcelIds.add(id)));
  (domOrders ?? []).forEach((o) => {
    ((o.parcel_ids as string[]) ?? []).forEach((id) => allParcelIds.add(id));
  });

  const parcelInfoMap = new Map<string, { location: string; itemCount: number }>();
  if (allParcelIds.size > 0) {
    const { data: parcels } = await adminDb
      .from("parcels")
      .select("id, item_count, storage_locations(code)")
      .in("id", [...allParcelIds]);
    (parcels ?? []).forEach((p) => {
      const loc = p.storage_locations as unknown as { code: string } | null;
      parcelInfoMap.set(p.id, { location: loc?.code ?? "", itemCount: (p.item_count as number) ?? 1 });
    });
  }

  // ── 통합 데이터 조립 ───────────────────────────────────────
  const rows: OrderRow[] = [];

  for (const o of intlOrders ?? []) {
    const pids = intlParcelMap.get(o.id) ?? [];
    const locs = new Set<string>();
    let itemCnt = 0;
    pids.forEach((pid) => {
      const info = parcelInfoMap.get(pid);
      if (info?.location) locs.add(info.location);
      itemCnt += info?.itemCount ?? 1;
    });
    const cust = o.customers as { name?: string; customer_code?: string } | null;
    rows.push({
      id: o.id, kind: "intl", rawId: `intl-${o.id}`,
      orderNo: o.order_no ?? "-", status: o.status,
      customerName: cust?.name ?? "-", customerCode: cust?.customer_code ?? "-",
      recipientCountry: o.recipient_country ?? undefined,
      packagingType: o.packaging_type ?? "NONE", customerNote: "",
      parcelCount: pids.length, itemCount: itemCnt,
      locations: [...locs].sort(), createdAt: o.created_at,
    });
  }

  for (const o of domOrders ?? []) {
    const pids = (o.parcel_ids as string[] | null) ?? [];
    const locs = new Set<string>();
    let itemCnt = 0;
    pids.forEach((pid) => {
      const info = parcelInfoMap.get(pid);
      if (info?.location) locs.add(info.location);
      itemCnt += info?.itemCount ?? 1;
    });
    const cust = o.customers as { name?: string; customer_code?: string } | null;
    rows.push({
      id: o.id, kind: "domestic", rawId: `dom-${o.id}`,
      orderNo: `국내-${o.id.slice(0, 8)}`, status: o.status,
      customerName: cust?.name ?? "-", customerCode: cust?.customer_code ?? "-",
      packagingType: o.packaging_type ?? "NONE",
      customerNote: o.delivery_msg ?? o.notes ?? "",
      parcelCount: pids.length, itemCount: itemCnt,
      locations: [...locs].sort(), createdAt: o.created_at,
    });
  }

  rows.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // ── 통계 ──────────────────────────────────────────────────
  const READY        = ["PAID", "PACKING", "PENDING"];
  const waitingCount = rows.filter((r) => READY.includes(r.status)).length;
  const pickingCount = rows.filter((r) => r.status === "PICKING").length;
  const doneCount    = rows.filter((r) => r.status === "PICKING_DONE").length;
  const totalCount   = rows.length;
  const progressPct  = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const todayRows   = rows.filter((r) => new Date(r.createdAt).toDateString() === new Date().toDateString());
  const todayOrders = todayRows.length;
  const todayItems  = todayRows.reduce((s, r) => s + r.itemCount, 0);

  // ── 필터 + 페이징 ─────────────────────────────────────────
  const filteredRows = applyFilter(rows, filter);
  const totalPages   = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage     = Math.min(page, totalPages);
  const pagedRows    = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const FILTER_TABS = [
    { key: "all"     as FilterKey, label: "전체",     count: totalCount,   icon: "🗂️" },
    { key: "picking" as FilterKey, label: "진행 중",  count: pickingCount, icon: "🔵" },
    { key: "waiting" as FilterKey, label: "피킹 대기", count: waitingCount, icon: "⏳" },
    { key: "done"    as FilterKey, label: "피킹 완료", count: doneCount,    icon: "✅" },
  ];

  return (
    <div className="max-w-5xl mx-auto pb-10">
      {/* ── 작업자 헤더 ─────────────────────────────────────── */}
      <div className="bg-indigo-600 text-white rounded-2xl p-5 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-indigo-500 rounded-full p-2.5"><User size={22} /></div>
          <div>
            <p className="text-indigo-200 text-sm">작업자</p>
            <p className="text-xl font-bold">{workerName}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-indigo-500/60 rounded-xl p-3 text-center">
            <p className="text-indigo-200 text-xs mb-1">오늘 배정 주문</p>
            <p className="text-2xl font-extrabold">{todayOrders}</p>
          </div>
          <div className="bg-indigo-500/60 rounded-xl p-3 text-center">
            <p className="text-indigo-200 text-xs mb-1">오늘 배정 물품</p>
            <p className="text-2xl font-extrabold">{todayItems}</p>
          </div>
          <div className="bg-indigo-500/60 rounded-xl p-3 text-center">
            <p className="text-indigo-200 text-xs mb-1">전체 진행률</p>
            <p className="text-2xl font-extrabold">{progressPct}%</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <StatusBadge icon={<Clock size={14} />}        label="피킹대기" count={waitingCount} cls="bg-amber-400/30 border-amber-300/40" />
          <StatusBadge icon={<ClipboardList size={14} />}  label="진행중"   count={pickingCount} cls="bg-blue-400/30 border-blue-300/40" />
          <StatusBadge icon={<CheckCircle2 size={14} />} label="완료"     count={doneCount}    cls="bg-green-400/30 border-green-300/40" />
          <StatusBadge icon={<ClipboardList size={14} />} label="전체"    count={totalCount}   cls="bg-white/20 border-white/20" />
        </div>
      </div>

      {/* ── 필터 탭 ───────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
        {FILTER_TABS.map(({ key, label, count, icon }) => {
          const isActive = filter === key;
          return (
            <a key={key} href={makeHref(key, 1)}
              className={`flex-none flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all whitespace-nowrap ${
                isActive
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200"
                  : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              <span>{icon}</span>
              <span>{label}</span>
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-xs font-extrabold ${
                isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
              }`}>{count}</span>
            </a>
          );
        })}
      </div>

      {/* ── 목록 헤더 ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <ClipboardList size={18} className="text-indigo-600" />
        <h2 className="text-base font-bold text-gray-900">
          {filter === "all"     && "전체 목록"}
          {filter === "picking" && "진행 중"}
          {filter === "waiting" && "피킹 대기"}
          {filter === "done"    && "피킹 완료"}
        </h2>
        <span className="text-sm text-gray-400 ml-auto">
          {filteredRows.length}건 · {safePage}/{totalPages}p
        </span>
      </div>

      {/* ── 그리드 카드 목록 ──────────────────────────────────── */}
      {pagedRows.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm text-center py-16 text-gray-400 border border-gray-100">
          <ClipboardList size={48} className="mx-auto mb-3 text-gray-200" />
          <p className="font-medium">
            {filter === "all"     && "피킹 대상 주문이 없습니다"}
            {filter === "picking" && "진행 중인 피킹이 없습니다"}
            {filter === "waiting" && "피킹 대기 주문이 없습니다"}
            {filter === "done"    && "완료된 피킹이 없습니다"}
          </p>
          {filter !== "all" && (
            <a href="/picking" className="mt-3 inline-block text-sm text-indigo-600 hover:underline">전체 보기 →</a>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {pagedRows.map((row) => (
            <OrderCard key={`${row.kind}-${row.id}`} row={row} />
          ))}
        </div>
      )}

      {/* ── 페이지네이션 ──────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-1.5">
          {safePage > 1 ? (
            <a href={makeHref(filter, safePage - 1)}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 text-sm font-medium hover:bg-gray-50"
            >
              <ChevronLeft size={15} /> 이전
            </a>
          ) : (
            <span className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50 text-gray-300 text-sm font-medium cursor-not-allowed">
              <ChevronLeft size={15} /> 이전
            </span>
          )}

          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => Math.abs(p - safePage) <= 2 || p === 1 || p === totalPages)
              .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((item, idx) =>
                item === "…" ? (
                  <span key={`gap-${idx}`} className="px-2 py-2 text-gray-400 text-sm">…</span>
                ) : (
                  <a key={item} href={makeHref(filter, item as number)}
                    className={`min-w-[36px] text-center px-2.5 py-2 rounded-lg text-sm font-bold border transition-colors ${
                      safePage === item
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {item}
                  </a>
                )
              )}
          </div>

          {safePage < totalPages ? (
            <a href={makeHref(filter, safePage + 1)}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 text-sm font-medium hover:bg-gray-50"
            >
              다음 <ChevronRight size={15} />
            </a>
          ) : (
            <span className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50 text-gray-300 text-sm font-medium cursor-not-allowed">
              다음 <ChevronRight size={15} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── 서브 컴포넌트 ─────────────────────────────────────────────

function StatusBadge({ icon, label, count, cls }: {
  icon: ReactNode; label: string; count: number; cls: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-semibold ${cls}`}>
      {icon}<span>{label}</span><span className="font-extrabold">{count}</span>
    </div>
  );
}

// ── 그리드 카드 (컴팩트 정사각형) ─────────────────────────────

function CardBody({ row }: { row: OrderRow }) {
  const badge     = STATUS_BADGE[row.status] ?? STATUS_BADGE.PAID;
  const isIntl    = row.kind === "intl";
  const inPicking = row.status === "PICKING";
  const isDone    = row.status === "PICKING_DONE";
  const pkgLabel  = PACKAGING_LABEL[row.packagingType] ?? "";

  return (
    <>
      {/* 상태 컬러 바 */}
      <div className={`h-1.5 w-full ${badge.bar}`} />

      {/* 본문 */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        {/* 헤더 */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5">
            {isIntl
              ? <Globe size={13} className="text-indigo-500 shrink-0" />
              : <Truck size={13} className="text-emerald-500 shrink-0" />}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
          {row.recipientCountry && (
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
              {row.recipientCountry}
            </span>
          )}
        </div>

        {/* 고객 정보 */}
        <div className="leading-tight">
          <p className="font-bold text-gray-900 text-sm truncate">{row.customerName}</p>
          <p className="text-[11px] text-gray-400 font-mono truncate">{row.customerCode}</p>
        </div>

        {/* 로케이션 */}
        <div className="flex-1 flex flex-col justify-center min-h-[36px]">
          <div className="flex items-start gap-1">
            <MapPin size={11} className="text-gray-400 shrink-0 mt-0.5" />
            <div className="flex flex-wrap gap-1">
              {row.locations.length > 0 ? (
                row.locations.map((loc) => (
                  <span key={loc}
                    className="text-xs font-black font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-md">
                    {loc}
                  </span>
                ))
              ) : (
                <span className="text-[10px] font-semibold text-orange-500 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-md">
                  미지정
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 수량 + 포장 + 메모 */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="flex items-center gap-0.5">
            <Package size={11} />
            <span className="font-bold text-gray-800">{row.itemCount}</span>개
          </span>
          {row.packagingType && row.packagingType !== "NONE" && (
            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px] font-medium">
              {pkgLabel}
            </span>
          )}
          {row.customerNote && (
            <span className="text-orange-500 text-[10px]" title={row.customerNote}>📝 메모</span>
          )}
        </div>

        {/* 액션 */}
        {isDone ? (
          <div className="mt-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold bg-green-50 text-green-700">
            <CheckCircle2 size={13} /> 피킹 완료
          </div>
        ) : inPicking ? (
          /* 피킹 중 — 잠금 배너 */
          <div className="mt-1 space-y-1.5">
            <div className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">
              🔒 다른 작업자 피킹 중
            </div>
            {/* 긴급 재진입 — 의도적인 소형 버튼 */}
            <Link
              href={`/picking/${row.rawId}?resume=1`}
              className="block text-center text-[10px] text-gray-400 hover:text-indigo-500 py-0.5 underline underline-offset-2"
              onClick={(e) => e.stopPropagation()}
            >
              이어서 진행 (작업자 본인만)
            </Link>
          </div>
        ) : (
          <div className="mt-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white">
            <ClipboardList size={13} /> 피킹 시작 <ChevronRight size={13} />
          </div>
        )}
      </div>
    </>
  );
}

function OrderCard({ row }: { row: OrderRow }) {
  const inPicking = row.status === "PICKING";
  const isDone    = row.status === "PICKING_DONE";

  const borderCls = isDone
    ? "border-green-200"
    : inPicking ? "border-orange-300 shadow-orange-100"
    : "border-gray-200";

  const inner = (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col h-full min-h-[200px] transition-all ${borderCls} ${
      !isDone && !inPicking ? "hover:shadow-md hover:-translate-y-0.5" : ""
    } ${isDone ? "opacity-70" : ""}`}>
      <CardBody row={row} />
    </div>
  );

  /* 피킹 중이거나 완료 → 직접 Link 없음 (CardBody 내부 링크가 별도 처리) */
  if (inPicking || isDone) return inner;

  return (
    <Link href={`/picking/${row.rawId}`}>
      {inner}
    </Link>
  );
}
