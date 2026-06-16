import type { SupabaseClient } from "@supabase/supabase-js";
import { SIZE_VOLUME_L, PARCEL_SIZE_OPTIONS } from "@/lib/parcels/size";

export interface PlannedLocationResult {
  plannedLocationId: string | null;
  reserveNewLocation: boolean;
  splitLocationIds: string[];
}

async function countAtLocation(
  db: SupabaseClient,
  locationId: string,
  newParcelVolume: number,
): Promise<{ usedVolume: number; parcelCount: number }> {
  const [{ data: atLoc }, { data: planned }] = await Promise.all([
    db
      .from("parcels")
      .select("parcel_size_code")
      .eq("storage_location_id", locationId)
      .not("status", "in", '("DONE","SHIPPING","PICKUP_CANCELLED")'),
    db
      .from("parcels")
      .select("parcel_size_code")
      .eq("planned_storage_location_id", locationId)
      .is("putaway_at", null)
      .not("status", "in", '("DONE","SHIPPING","PICKUP_CANCELLED")'),
  ]);

  const rows = [...(atLoc ?? []), ...(planned ?? [])];
  return {
    usedVolume: rows.reduce(
      (sum, p) => sum + (p.parcel_size_code ? (SIZE_VOLUME_L[p.parcel_size_code] ?? 0) : 0),
      0,
    ) + newParcelVolume,
    parcelCount: rows.length + 1,
  };
}

/**
 * 입고 시 배정 예정 로케이션 결정 (물리 적치는 TEMP → transfer)
 */
export async function resolvePlannedLocation(
  db: SupabaseClient,
  opts: {
    customerId: string;
    locationId?: string | null;
    newParcelVolume: number;
  },
): Promise<PlannedLocationResult> {
  const { customerId, locationId, newParcelVolume } = opts;

  let plannedLocationId: string | null = locationId ?? null;
  let reserveNewLocation = false;
  const splitLocationIds: string[] = [];

  if (!plannedLocationId) {
    const { data: customerLocs } = await db
      .from("storage_locations")
      .select("id, max_parcels, volume_liter, storage_type_id")
      .eq("customer_id", customerId)
      .in("status", ["OCCUPIED", "RESERVED"])
      .order("assigned_at");

    if (customerLocs && customerLocs.length > 0) {
      for (const loc of customerLocs) {
        if (newParcelVolume > 0 && loc.volume_liter != null) {
          const { usedVolume } = await countAtLocation(db, loc.id, newParcelVolume);
          if (usedVolume <= loc.volume_liter) {
            plannedLocationId = loc.id;
            break;
          }
        } else {
          if (loc.max_parcels === null) {
            plannedLocationId = loc.id;
            break;
          }
          const { parcelCount } = await countAtLocation(db, loc.id, 0);
          if (parcelCount <= loc.max_parcels) {
            plannedLocationId = loc.id;
            break;
          }
        }
      }
    }

    if (!plannedLocationId && newParcelVolume > 0) {
      const candidateVolumes = PARCEL_SIZE_OPTIONS
        .filter((o) => o.volume_l >= newParcelVolume)
        .map((o) => o.volume_l);

      for (const vol of candidateVolumes) {
        const { data: sizedLoc } = await db
          .from("storage_locations")
          .select("id, storage_types!inner(volume_liter)")
          .eq("status", "AVAILABLE")
          .is("customer_id", null)
          .eq("storage_types.volume_liter", vol)
          .order("zone")
          .order("slot")
          .limit(1)
          .maybeSingle();

        if (sizedLoc) {
          plannedLocationId = sizedLoc.id;
          reserveNewLocation = true;
          break;
        }
      }
    }

    if (!plannedLocationId && newParcelVolume > 0) {
      const { data: availLocs } = await db
        .from("storage_locations")
        .select("id, volume_liter")
        .eq("status", "AVAILABLE")
        .is("customer_id", null)
        .not("volume_liter", "is", null)
        .order("volume_liter", { ascending: false })
        .limit(20);

      if (availLocs && availLocs.length > 0) {
        let accumulated = 0;
        const toAssign: string[] = [];

        for (const loc of availLocs) {
          if (accumulated >= newParcelVolume) break;
          toAssign.push(loc.id);
          accumulated += loc.volume_liter ?? 0;
        }

        if (toAssign.length > 0) {
          plannedLocationId = toAssign[0];
          splitLocationIds.push(...toAssign.slice(1));
          reserveNewLocation = true;
        }
      }
    }

    if (!plannedLocationId) {
      const { data: autoLoc } = await db
        .from("storage_locations")
        .select("id")
        .eq("status", "AVAILABLE")
        .is("customer_id", null)
        .order("zone")
        .order("slot")
        .limit(1)
        .maybeSingle();
      plannedLocationId = autoLoc?.id ?? null;
      reserveNewLocation = !!plannedLocationId;
    }
  } else {
    reserveNewLocation = true;
  }

  return { plannedLocationId, reserveNewLocation, splitLocationIds };
}

/**
 * 변경 요청(작업지시서) 처리용: 요청된 타입 코드에 맞는 첫 번째 AVAILABLE 로케이션 탐색
 * - storage_type_id 직접 매칭 (typeId 우선)
 * - typeCode로 storage_types 조인 (typeId 없을 때)
 */
export async function resolveLocationForType(
  db: SupabaseClient,
  opts: { typeId?: string | null; typeCode?: string | null },
): Promise<{ locationId: string | null; locationCode: string | null; zone: string | null; slot: string | null }> {
  const empty = { locationId: null, locationCode: null, zone: null, slot: null };

  if (opts.typeId) {
    const { data } = await db
      .from("storage_locations")
      .select("id, code, zone, slot")
      .eq("status", "AVAILABLE")
      .is("customer_id", null)
      .eq("storage_type_id", opts.typeId)
      .order("zone")
      .order("slot")
      .limit(1)
      .maybeSingle();
    if (!data) return empty;
    return { locationId: data.id, locationCode: data.code, zone: data.zone, slot: data.slot };
  }

  if (opts.typeCode) {
    const { data } = await db
      .from("storage_locations")
      .select("id, code, zone, slot, storage_types!inner(code)")
      .eq("status", "AVAILABLE")
      .is("customer_id", null)
      .eq("storage_types.code", opts.typeCode)
      .order("zone")
      .order("slot")
      .limit(1)
      .maybeSingle();
    if (!data) return empty;
    return { locationId: data.id, locationCode: data.code, zone: data.zone, slot: data.slot };
  }

  return empty;
}

export async function reservePlannedLocations(
  db: SupabaseClient,
  customerId: string,
  locationIds: string[],
  assignedAt: string,
) {
  if (locationIds.length === 0) return;

  await db
    .from("storage_locations")
    .update({
      status: "RESERVED",
      customer_id: customerId,
      assigned_at: assignedAt,
    })
    .in("id", locationIds)
    .in("status", ["AVAILABLE"]);
}
