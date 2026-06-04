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
  User,
  CheckCircle2,
  Clock,
  AlertCircle,
  PlayCircle,
} from "lucide-react";

// ── 상태 설정 ─────────────────────────────────────────────────

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

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PAID:         { label: "피킹 대기",  cls: "bg-amber-100 text-amber-800 border-amber-200" },
  PACKING:      { label: "피킹 대기",  cls: "bg-amber-100 text-amber-800 border-amber-200" },
  PENDING:      { label: "피킹 대기",  cls: "bg-amber-100 text-amber-800 border-amber-200" },
  PICKING:      { label: "피킹 중",    cls: "bg-blue-100 text-blue-800 border-blue-200" },
  PICKING_DONE: { label: "피킹 완료",  cls: "bg-green-100 text-green-800 border-green-200" },
};

// ── 타입 ──────────────────────────────────────────────────────

type OrderRow = {
  id:            string;
  kind:          "intl" | "domestic";
  rawId:         string;
  orderNo:       string;
  status:        string;
  customerName:  string;
  customerCode:  string;
  recipientCountry?: string;
  packagingType: string;
  customerNote:  string;
  parcelCount:   number;
  itemCount:     number;
  locations:     string[];
  createdAt:     string;
};

// ── 헬퍼: 소포 위치 조회 ──────────────────────────────────────

async function getParcelInfo(parcelIds: string[]): Promise<{
  locations: string[];
  itemCount: number;
}> {
  if (parcelIds.length === 0) return { locations: [], itemCount: 0 };

  const { data } = await adminDb
    .from("parcels")
    .select("item_count, storage_locations(code)")
    .in("id", parcelIds);

  const locationSet = new Set<string>();
  let itemCount = 0;

  (data ?? []).forEach((p) => {
    const loc = p.storage_locations as unknown as { code: string } | null;
    if (loc?.code) locationSet.add(loc.code);
    itemCount += (p.item_count as number) ?? 1;
  });

  return { locations: [...locationSet].sort(), itemCount };
}

// ── 서버 컴포넌트 ─────────────────────────────────────────────

export default async function PickingPage() {
  const admin = await requireAdmin();
  const workerName = admin?.email?.split("@")[0] ?? "작업자";

  // ── 해외 주문 ─────────────────────────────────────────────
  const { data: intlOrders } = await adminDb
    .from("orders")
    .select(`
      id, order_no, status, recipient_country, packaging_type, created_at,
      customers(name, customer_code)
    `)
    .in("status", [...INTL_PICK_STATUSES])
    .order("created_at", { ascending: true })
    .limit(60);

  // ── 국내 주문 ─────────────────────────────────────────────
  const { data: domOrders } = await adminDb
    .from("domestic_orders")
    .select(`
      id, status, packaging_type, delivery_msg, notes, created_at, parcel_ids,
      customers(name, customer_code)
    `)
    .in("status", [...DOM_PICK_STATUSES])
    .order("created_at", { ascending: true })
    .limit(60);

  // ── 주문별 소포/위치 조회 (batched) ───────────────────────

  // 해외: order_parcels → parcel_ids
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

  // 전체 parcel_ids 수집
  const allParcelIds = new Set<string>();
  intlParcelMap.forEach((ids) => ids.forEach((id) => allParcelIds.add(id)));
  (domOrders ?? []).forEach((o) => {
    ((o.parcel_ids as string[]) ?? []).forEach((id) => allParcelIds.add(id));
  });

  // 한 번에 소포 정보 조회
  let parcelInfoMap = new Map<string, { location: string; itemCount: number }>();
  if (allParcelIds.size > 0) {
    const { data: parcels } = await adminDb
      .from("parcels")
      .select("id, item_count, storage_locations(code)")
      .in("id", [...allParcelIds]);

    (parcels ?? []).forEach((p) => {
      const loc = p.storage_locations as unknown as { code: string } | null;
      parcelInfoMap.set(p.id, {
        location:  loc?.code ?? "",
        itemCount: (p.item_count as number) ?? 1,
      });
    });
  }

  // ── 통합 데이터 조립 ───────────────────────────────────────

  const rows: OrderRow[] = [];

  for (const o of intlOrders ?? []) {
    const pids  = intlParcelMap.get(o.id) ?? [];
    const locs  = new Set<string>();
    let itemCnt = 0;

    pids.forEach((pid) => {
      const info = parcelInfoMap.get(pid);
      if (info?.location) locs.add(info.location);
      itemCnt += info?.itemCount ?? 1;
    });

    const cust = o.customers as { name?: string; customer_code?: string } | null;

    rows.push({
      id:             o.id,
      kind:           "intl",
      rawId:          `intl-${o.id}`,
      orderNo:        o.order_no ?? "-",
      status:         o.status,
      customerName:   cust?.name ?? "-",
      customerCode:   cust?.customer_code ?? "-",
      recipientCountry: o.recipient_country ?? undefined,
      packagingType:  o.packaging_type ?? "NONE",
      customerNote:   "",
      parcelCount:    pids.length,
      itemCount:      itemCnt,
      locations:      [...locs].sort(),
      createdAt:      o.created_at,
    });
  }

  for (const o of domOrders ?? []) {
    const pids  = (o.parcel_ids as string[] | null) ?? [];
    const locs  = new Set<string>();
    let itemCnt = 0;

    pids.forEach((pid) => {
      const info = parcelInfoMap.get(pid);
      if (info?.location) locs.add(info.location);
      itemCnt += info?.itemCount ?? 1;
    });

    const cust = o.customers as { name?: string; customer_code?: string } | null;

    rows.push({
      id:           o.id,
      kind:         "domestic",
      rawId:        `dom-${o.id}`,
      orderNo:      `국내-${o.id.slice(0, 8)}`,
      status:       o.status,
      customerName: cust?.name ?? "-",
      customerCode: cust?.customer_code ?? "-",
      packagingType: o.packaging_type ?? "NONE",
      customerNote: o.delivery_msg ?? o.notes ?? "",
      parcelCount:  pids.length,
      itemCount:    itemCnt,
      locations:    [...locs].sort(),
      createdAt:    o.created_at,
    });
  }

  // 날짜순 정렬
  rows.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // ── 통계 ──────────────────────────────────────────────────

  const waitingCount  = rows.filter((r) => ["PAID", "PACKING", "PENDING"].includes(r.status)).length;
  const pickingCount  = rows.filter((r) => r.status === "PICKING").length;
  const doneCount     = rows.filter((r) => r.status === "PICKING_DONE").length;
  const totalCount    = rows.length;
  const totalItems    = rows.reduce((s, r) => s + r.itemCount, 0);

  const progressPct   = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const todayRows     = rows.filter((r) => {
    const d = new Date(r.createdAt);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });
  const todayOrders   = todayRows.length;
  const todayItems    = todayRows.reduce((s, r) => s + r.itemCount, 0);

  return (
    <div className="max-w-3xl mx-auto pb-10">
      {/* ── 작업자 헤더 ─────────────────────────────────────── */}
      <div className="bg-indigo-600 text-white rounded-2xl p-5 mb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-indigo-500 rounded-full p-2.5">
            <User size={22} />
          </div>
          <div>
            <p className="text-indigo-200 text-sm">작업자</p>
            <p className="text-xl font-bold">{workerName}</p>
          </div>
        </div>

        {/* 오늘 배정 통계 */}
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

        {/* 진행 상태 뱃지 */}
        <div className="flex gap-2 flex-wrap">
          <StatusBadge icon={<Clock size={14} />}       label="대기"    count={waitingCount} cls="bg-amber-400/30 border-amber-300/40" />
          <StatusBadge icon={<PlayCircle size={14} />}  label="진행중"  count={pickingCount} cls="bg-blue-400/30 border-blue-300/40" />
          <StatusBadge icon={<CheckCircle2 size={14} />} label="완료"   count={doneCount}    cls="bg-green-400/30 border-green-300/40" />
          <StatusBadge icon={<AlertCircle size={14} />} label="전체"    count={totalCount}   cls="bg-white/20 border-white/20" />
        </div>
      </div>

      {/* ── 주문 카드 목록 ───────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <ClipboardList size={18} className="text-indigo-600" />
        <h2 className="text-base font-bold text-gray-900">피킹 코스 목록</h2>
        <span className="text-sm text-gray-400 ml-auto">{totalCount}건</span>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm text-center py-16 text-gray-400 border border-gray-100">
          <ClipboardList size={48} className="mx-auto mb-3 text-gray-200" />
          <p className="font-medium">피킹 대상 주문이 없습니다</p>
          <p className="text-sm mt-1">출고 대기 주문이 생기면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <OrderCard key={`${row.kind}-${row.id}`} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 서브 컴포넌트 ─────────────────────────────────────────────

function StatusBadge({
  icon,
  label,
  count,
  cls,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  cls: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-semibold ${cls}`}>
      {icon}
      <span>{label}</span>
      <span className="font-extrabold">{count}</span>
    </div>
  );
}

function OrderCard({ row }: { row: OrderRow }) {
  const badge  = STATUS_BADGE[row.status] ?? STATUS_BADGE.PAID;
  const isIntl = row.kind === "intl";
  const pkgLabel = PACKAGING_LABEL[row.packagingType] ?? row.packagingType;

  const canStart  = ["PAID", "PACKING", "PENDING"].includes(row.status);
  const inPicking = row.status === "PICKING";
  const isDone    = row.status === "PICKING_DONE";

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
        isDone
          ? "border-green-200 opacity-70"
          : inPicking
          ? "border-blue-300 shadow-blue-100"
          : "border-gray-100"
      }`}
    >
      {/* 카드 헤더 */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          {isIntl ? (
            <Globe size={16} className="text-indigo-500 shrink-0" />
          ) : (
            <Truck size={16} className="text-emerald-500 shrink-0" />
          )}
          <span className="font-mono text-sm font-semibold text-gray-800 truncate">
            {row.orderNo}
          </span>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* 고객 정보 */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">고객</span>
          <span className="font-semibold text-gray-900">
            {row.customerName}
            <span className="text-xs text-gray-400 font-normal ml-1.5">{row.customerCode}</span>
          </span>
        </div>

        {/* 물품 수량 + 배송 국가 */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-gray-500">
            <Package size={14} />
            <span>
              <span className="font-bold text-gray-900">{row.itemCount}</span>개
              {row.parcelCount !== row.itemCount && (
                <span className="text-gray-400 text-xs ml-1">({row.parcelCount}박스)</span>
              )}
            </span>
          </div>
          {row.recipientCountry && (
            <div className="flex items-center gap-1.5 text-gray-500">
              <Globe size={14} />
              <span className="font-bold text-indigo-700">{row.recipientCountry}</span>
            </div>
          )}
        </div>

        {/* 로케이션 */}
        <div className="flex items-center gap-2 flex-wrap">
          <MapPin size={14} className="text-gray-400 shrink-0" />
          {row.locations.length > 0 ? (
            row.locations.map((loc) => (
              <span
                key={loc}
                className="text-sm font-black font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg"
              >
                {loc}
              </span>
            ))
          ) : (
            <span className="text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-lg">
              로케이션 미지정
            </span>
          )}
        </div>

        {/* 포장옵션 + 고객 요청사항 */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {row.packagingType && row.packagingType !== "NONE" && (
            <span className="text-gray-500">
              포장:{" "}
              <span className="font-semibold text-gray-800">{pkgLabel}</span>
            </span>
          )}
          {row.customerNote && (
            <span className="text-gray-500">
              요청:{" "}
              <span className="font-semibold text-orange-700">
                {row.customerNote.length > 40
                  ? `${row.customerNote.slice(0, 40)}…`
                  : row.customerNote}
              </span>
            </span>
          )}
        </div>

        {/* 피킹 시작 버튼 */}
        {!isDone && (
          <Link href={`/picking/${row.rawId}`}>
            <button
              className={`w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                inPicking
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                  : "bg-indigo-600 text-white shadow-md shadow-indigo-200"
              }`}
            >
              {inPicking ? (
                <>
                  <PlayCircle size={20} />
                  피킹 계속하기
                  <ChevronRight size={20} />
                </>
              ) : (
                <>
                  <ClipboardList size={20} />
                  피킹 시작
                  <ChevronRight size={20} />
                </>
              )}
            </button>
          </Link>
        )}

        {isDone && (
          <div className="flex items-center justify-center gap-2 py-3 bg-green-50 rounded-xl text-green-700 font-semibold text-sm border border-green-200">
            <CheckCircle2 size={18} />
            피킹 완료 — 출고 작업대 대기 중
          </div>
        )}
      </div>
    </div>
  );
}
