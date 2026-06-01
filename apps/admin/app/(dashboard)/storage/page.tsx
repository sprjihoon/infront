import { adminDb } from "@/lib/supabase/admin";
import Link from "next/link";
import { Package, Plus, Warehouse, Clock, AlertTriangle } from "lucide-react";

type StorageType = {
  code: string;
  name: string;
  dim_l_mm: number;
  dim_w_mm: number;
  dim_h_mm: number;
  volume_liter: number;
  price_per_week: number;
  price_max: number | null;
};

type StorageLocation = {
  id: string;
  code: string;
  zone: string;
  slot: string;
  label: string | null;
  status: string;
  customer_id: string | null;
  assigned_at: string | null;
  notes: string | null;
  customers: { name: string | null; customer_code: string } | null;
  storage_types: StorageType | null;
  parcel_count: number;
  days_stored: number | null;
};

type StorageZone = {
  code: string;
  name: string;
  grid_cols: number;
};

const STATUS_CONFIG: Record<string, {
  label: string; bg: string; border: string; text: string; dot: string; badge: string;
}> = {
  AVAILABLE:   { label: "비어있음",   bg: "bg-emerald-50",  border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-400", badge: "bg-emerald-100 text-emerald-700" },
  RESERVED:    { label: "배정완료",   bg: "bg-yellow-50",   border: "border-yellow-200",  text: "text-yellow-700", dot: "bg-yellow-400",  badge: "bg-yellow-100 text-yellow-700"  },
  OCCUPIED:    { label: "보관중",     bg: "bg-blue-50",     border: "border-blue-200",    text: "text-blue-700",   dot: "bg-blue-500",   badge: "bg-blue-100 text-blue-700"     },
  PENDING_OUT: { label: "반출예정",   bg: "bg-orange-50",   border: "border-orange-200",  text: "text-orange-700", dot: "bg-orange-400", badge: "bg-orange-100 text-orange-700" },
  DISABLED:    { label: "사용불가",   bg: "bg-gray-100",    border: "border-gray-300",    text: "text-gray-400",   dot: "bg-gray-300",   badge: "bg-gray-100 text-gray-400"     },
};

const TYPE_BADGE: Record<string, string> = {
  MINI:     "bg-slate-100 text-slate-600",
  STANDARD: "bg-indigo-100 text-indigo-700",
  LONG:     "bg-purple-100 text-purple-700",
  XL:       "bg-orange-100 text-orange-700",
  OVERSIZE: "bg-red-100 text-red-700",
};

function daysFrom(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

export default async function StoragePage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string; status?: string; type?: string }>;
}) {
  const { zone, status, type } = await searchParams;

  // 로케이션 + 고객 + 타입 정보
  const { data: rawLocations } = await adminDb
    .from("storage_locations")
    .select(`
      id, code, zone, slot, label, status, customer_id, assigned_at, notes,
      customers(name, customer_code),
      storage_types(code, name, dim_l_mm, dim_w_mm, dim_h_mm, volume_liter, price_per_week, price_max)
    `)
    .order("zone", { ascending: true })
    .order("slot", { ascending: true });

  // 파슬 수 집계
  const { data: parcelCounts } = await adminDb
    .from("parcels")
    .select("storage_location_id")
    .not("storage_location_id", "is", null)
    .not("status", "in", '("DONE","SHIPPING")');

  const countMap: Record<string, number> = {};
  for (const p of parcelCounts ?? []) {
    if (p.storage_location_id) {
      countMap[p.storage_location_id] = (countMap[p.storage_location_id] ?? 0) + 1;
    }
  }

  // Zone 메타데이터 (grid_cols, name)
  const { data: rawZones } = await adminDb
    .from("storage_zones")
    .select("code, name, grid_cols")
    .order("sort_order");
  const zoneMap: Record<string, StorageZone> = {};
  for (const z of rawZones ?? []) zoneMap[z.code] = z;

  const locations: StorageLocation[] = (rawLocations ?? []).map((loc) => ({
    ...loc,
    customers:     (loc.customers     as unknown) as StorageLocation["customers"],
    storage_types: (loc.storage_types as unknown) as StorageType | null,
    parcel_count:  countMap[loc.id] ?? 0,
    days_stored:   daysFrom(loc.assigned_at),
  }));

  // 필터
  const filtered = locations.filter((loc) => {
    if (zone   && loc.zone !== zone)                          return false;
    if (status && loc.status !== status)                      return false;
    if (type   && loc.storage_types?.code !== type)           return false;
    return true;
  });

  // 구역 목록 (zone TEXT 기준)
  const zones = [...new Set(locations.map((l) => l.zone))].sort();

  // 타입 목록 (필터용)
  const typeList = [...new Map(
    locations
      .filter((l) => l.storage_types)
      .map((l) => [l.storage_types!.code, l.storage_types!.name])
  ).entries()];

  // 통계
  const total       = locations.length;
  const available   = locations.filter((l) => l.status === "AVAILABLE").length;
  const reserved    = locations.filter((l) => l.status === "RESERVED").length;
  const occupied    = locations.filter((l) => l.status === "OCCUPIED").length;
  const pendingOut  = locations.filter((l) => l.status === "PENDING_OUT").length;
  const disabled    = locations.filter((l) => l.status === "DISABLED").length;
  const longStored  = locations.filter((l) => (l.days_stored ?? 0) >= 30 && l.status !== "AVAILABLE").length;

  // 구역별 그룹
  const grouped: Record<string, StorageLocation[]> = {};
  for (const loc of filtered) {
    if (!grouped[loc.zone]) grouped[loc.zone] = [];
    grouped[loc.zone].push(loc);
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Warehouse size={20} className="text-indigo-600" />
            스토리지 현황
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">구역별 로케이션 보관 현황 · 총 {total}개</p>
        </div>
        <Link
          href="/storage/manage"
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          <Plus size={15} /> Zone·슬롯 관리
        </Link>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        {[
          { label: "전체",    value: total,      color: "text-gray-900",   bg: "bg-white"        },
          { label: "비어있음", value: available,  color: "text-emerald-700",bg: "bg-emerald-50"   },
          { label: "배정완료", value: reserved,   color: "text-yellow-700", bg: "bg-yellow-50"    },
          { label: "보관중",   value: occupied,   color: "text-blue-700",   bg: "bg-blue-50"      },
          { label: "반출예정", value: pendingOut, color: "text-orange-700", bg: "bg-orange-50"    },
          { label: "장기보관", value: longStored, color: "text-red-600",    bg: "bg-red-50"       },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl border border-gray-200 p-3`}>
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* 필터 바 */}
      <div className="flex flex-col gap-2 mb-5">
        {/* Zone 필터 */}
        <div className="flex gap-1.5 flex-wrap">
          <Link
            href={(() => { const p = new URLSearchParams(); if (status) p.set("status", status); if (type) p.set("type", type); return p.toString() ? `/storage?${p}` : "/storage"; })()}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              !zone ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            전체 구역
          </Link>
          {zones.map((z) => {
            const p = new URLSearchParams();
            p.set("zone", z);
            if (status) p.set("status", status);
            if (type)   p.set("type", type);
            return (
              <Link key={z} href={`/storage?${p}`}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  zone === z
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                }`}
              >
                {zoneMap[z]?.name ?? `구역 ${z}`}
              </Link>
            );
          })}
        </div>

        {/* 상태 + 타입 필터 */}
        <div className="flex gap-1.5 flex-wrap">
          {[
            { key: "", label: "전체 상태" },
            { key: "AVAILABLE",   label: "비어있음" },
            { key: "RESERVED",    label: "배정완료" },
            { key: "OCCUPIED",    label: "보관중"   },
            { key: "PENDING_OUT", label: "반출예정" },
            { key: "DISABLED",    label: "사용불가" },
          ].map(({ key, label }) => {
            const p = new URLSearchParams();
            if (key)  p.set("status", key);
            if (zone) p.set("zone", zone);
            if (type) p.set("type", type);
            return (
              <Link key={key || "all-s"} href={p.toString() ? `/storage?${p}` : "/storage"}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  (status ?? "") === key
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                }`}
              >
                {label}
              </Link>
            );
          })}

          {typeList.length > 0 && <div className="w-px bg-gray-200 self-stretch mx-1" />}

          {typeList.map(([code, name]) => {
            const p = new URLSearchParams();
            p.set("type", code);
            if (zone)   p.set("zone", zone);
            if (status) p.set("status", status);
            return (
              <Link key={code} href={`/storage?${p}`}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  type === code
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                }`}
              >
                {name}
              </Link>
            );
          })}
        </div>
      </div>

      {/* 구역별 그리드 */}
      {Object.keys(grouped).length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
          <Warehouse size={44} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium mb-1">로케이션이 없습니다</p>
          <p className="text-xs text-gray-400 mb-5">Zone·슬롯 관리에서 구역과 슬롯을 추가하세요</p>
          <Link href="/storage/manage"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl"
          >
            <Plus size={15} /> 추가하기
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([z, locs]) => {
            const zm = zoneMap[z];
            const cols = zm?.grid_cols ?? 10;
            return (
              <div key={z} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {/* Zone 헤더 */}
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-indigo-700">{z}</span>
                  </div>
                  <div className="flex-1">
                    <h2 className="font-semibold text-gray-900">{zm?.name ?? `구역 ${z}`}</h2>
                    <p className="text-xs text-gray-400">
                      {locs.filter(l => l.status === "OCCUPIED").length}개 보관중 ·{" "}
                      {locs.filter(l => l.status === "AVAILABLE").length}개 비어있음 ·{" "}
                      그리드 {cols}열
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-400">
                    {locs.length}개 슬롯
                  </div>
                </div>

                {/* 슬롯 그리드 — grid_cols 동적 반영 */}
                <div
                  className="p-4 grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                >
                  {locs.map((loc) => {
                    const cfg  = STATUS_CONFIG[loc.status] ?? STATUS_CONFIG.AVAILABLE;
                    const st   = loc.storage_types;
                    const days = loc.days_stored;
                    const isLong = (days ?? 0) >= 30;

                    return (
                      <Link
                        key={loc.id}
                        href={`/storage/${loc.id}`}
                        className={`${cfg.bg} ${isLong ? "border-red-400" : cfg.border} border-2 rounded-xl p-2.5 hover:shadow-md transition-all min-w-0`}
                      >
                        {/* 코드 + 상태 점 */}
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-gray-800 truncate">{loc.code}</span>
                          <span className={`w-2 h-2 rounded-full shrink-0 ml-1 ${isLong ? "bg-red-400" : cfg.dot}`} />
                        </div>

                        {/* 타입 뱃지 */}
                        {st && (
                          <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full mb-1.5 ${TYPE_BADGE[st.code] ?? "bg-gray-100 text-gray-600"}`}>
                            {st.name.replace(" Storage", "").replace(" Rack", "")}
                          </span>
                        )}

                        {/* 상태별 본문 */}
                        {loc.status === "OCCUPIED" || loc.status === "RESERVED" || loc.status === "PENDING_OUT" ? (
                          <>
                            {loc.customers && (
                              <p className="text-[10px] font-medium text-gray-700 truncate">
                                {loc.customers.name ?? loc.customers.customer_code}
                              </p>
                            )}
                            {loc.parcel_count > 0 && (
                              <div className="flex items-center gap-0.5 mt-1">
                                <Package size={9} className="text-blue-400 shrink-0" />
                                <span className="text-[9px] text-blue-600 font-semibold">{loc.parcel_count}개</span>
                              </div>
                            )}
                            {days !== null && (
                              <div className={`flex items-center gap-0.5 mt-0.5 ${isLong ? "text-red-500" : "text-gray-400"}`}>
                                {isLong && <AlertTriangle size={9} className="shrink-0" />}
                                {!isLong && <Clock size={9} className="shrink-0" />}
                                <span className="text-[9px] font-medium">D+{days}</span>
                              </div>
                            )}
                          </>
                        ) : loc.status === "DISABLED" ? (
                          <p className="text-[9px] text-gray-400 mt-0.5 truncate">{loc.notes ?? "비활성"}</p>
                        ) : (
                          /* AVAILABLE */
                          st && (
                            <p className="text-[9px] text-gray-400 mt-0.5 leading-tight">
                              {st.volume_liter}L<br />
                              {st.price_per_week.toLocaleString()}원/주
                            </p>
                          )
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
