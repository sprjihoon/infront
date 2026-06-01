import { adminDb } from "@/lib/supabase/admin";
import Link from "next/link";
import { Package, Plus, Warehouse } from "lucide-react";

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
  parcel_count: number;
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; border: string; text: string; dot: string }> = {
  AVAILABLE: { label: "비어있음", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-400" },
  OCCUPIED:  { label: "사용중",   bg: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-700",    dot: "bg-blue-500"   },
  DISABLED:  { label: "사용불가", bg: "bg-gray-100",   border: "border-gray-300",    text: "text-gray-400",    dot: "bg-gray-300"   },
};

export default async function StoragePage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string; status?: string }>;
}) {
  const { zone, status } = await searchParams;

  // 모든 로케이션 + 고객 + 현재 보관 중인 소포 수
  const { data: rawLocations } = await adminDb
    .from("storage_locations")
    .select(`
      id, code, zone, slot, label, status, customer_id, assigned_at, notes,
      customers(name, customer_code)
    `)
    .order("zone", { ascending: true })
    .order("slot", { ascending: true });

  // 각 로케이션별 활성 소포 수 집계
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

  const locations: StorageLocation[] = (rawLocations ?? []).map((loc) => ({
    ...loc,
    customers: (loc.customers as unknown) as { name: string | null; customer_code: string } | null,
    parcel_count: countMap[loc.id] ?? 0,
  }));

  // 필터
  const filtered = locations.filter((loc) => {
    if (zone && loc.zone !== zone) return false;
    if (status && loc.status !== status) return false;
    return true;
  });

  // 구역 목록
  const zones = [...new Set(locations.map((l) => l.zone))].sort();

  // 통계
  const total      = locations.length;
  const available  = locations.filter((l) => l.status === "AVAILABLE").length;
  const occupied   = locations.filter((l) => l.status === "OCCUPIED").length;
  const disabled   = locations.filter((l) => l.status === "DISABLED").length;

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
            스토리지 관리
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">구역별 보관 현황 · 총 {total}개 로케이션</p>
        </div>
        <Link
          href="/storage/manage"
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          <Plus size={15} /> 로케이션 관리
        </Link>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "전체",    value: total,     color: "text-gray-900", bg: "bg-white" },
          { label: "사용중",  value: occupied,  color: "text-blue-700", bg: "bg-blue-50" },
          { label: "비어있음", value: available, color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: "사용불가", value: disabled,  color: "text-gray-400", bg: "bg-gray-50" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl border border-gray-200 p-4`}>
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* 필터 바 */}
      <div className="flex gap-2 flex-wrap mb-5">
        {/* 구역 필터 */}
        <div className="flex gap-1.5">
          <Link
            href={status ? `/storage?status=${status}` : "/storage"}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              !zone ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            전체 구역
          </Link>
          {zones.map((z) => {
            const params = new URLSearchParams();
            params.set("zone", z);
            if (status) params.set("status", status);
            return (
              <Link
                key={z}
                href={`/storage?${params}`}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  zone === z
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                }`}
              >
                구역 {z}
              </Link>
            );
          })}
        </div>

        <div className="w-px bg-gray-200 self-stretch mx-1" />

        {/* 상태 필터 */}
        {[
          { key: "", label: "전체 상태" },
          { key: "AVAILABLE", label: "비어있음" },
          { key: "OCCUPIED", label: "사용중" },
          { key: "DISABLED", label: "사용불가" },
        ].map(({ key, label }) => {
          const params = new URLSearchParams();
          if (key) params.set("status", key);
          if (zone) params.set("zone", zone);
          return (
            <Link
              key={key || "all-s"}
              href={params.toString() ? `/storage?${params}` : "/storage"}
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
      </div>

      {/* 구역별 그리드 */}
      {Object.keys(grouped).length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
          <Warehouse size={44} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium mb-1">로케이션이 없습니다</p>
          <p className="text-xs text-gray-400 mb-5">로케이션 관리에서 구역과 슬롯을 추가하세요</p>
          <Link
            href="/storage/manage"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl"
          >
            <Plus size={15} /> 로케이션 추가하기
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([z, locs]) => (
            <div key={z} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-indigo-700">{z}</span>
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">구역 {z}</h2>
                  <p className="text-xs text-gray-400">
                    {locs.filter(l => l.status === "OCCUPIED").length}개 사용중 ·{" "}
                    {locs.filter(l => l.status === "AVAILABLE").length}개 빈 공간
                  </p>
                </div>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
                {locs.map((loc) => {
                  const cfg = STATUS_CONFIG[loc.status] ?? STATUS_CONFIG.AVAILABLE;
                  return (
                    <Link
                      key={loc.id}
                      href={`/storage/${loc.id}`}
                      className={`${cfg.bg} ${cfg.border} border-2 rounded-xl p-3 hover:shadow-md transition-all group`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-gray-800">{loc.code}</span>
                        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      </div>
                      {loc.status === "OCCUPIED" && loc.customers ? (
                        <>
                          <p className="text-xs font-medium text-gray-700 truncate">
                            {loc.customers.name ?? loc.customers.customer_code}
                          </p>
                          <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                            {loc.customers.customer_code}
                          </p>
                          {loc.parcel_count > 0 && (
                            <div className="flex items-center gap-1 mt-1.5">
                              <Package size={10} className="text-blue-400" />
                              <span className="text-[10px] text-blue-600 font-semibold">
                                {loc.parcel_count}개 보관중
                              </span>
                            </div>
                          )}
                        </>
                      ) : loc.status === "DISABLED" ? (
                        <p className="text-[10px] text-gray-400 mt-1">{loc.notes ?? "비활성"}</p>
                      ) : (
                        <p className="text-[10px] text-emerald-600 mt-1">할당 가능</p>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
