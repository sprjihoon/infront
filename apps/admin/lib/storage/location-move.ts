import type { SupabaseClient } from "@supabase/supabase-js";

export const LOCATION_MOVE_REASONS = [
  "INBOUND",
  "TRANSFER",
  "TEMP_OUT",
  "RETURN",
  "MANUAL",
] as const;

export type LocationMoveReason = (typeof LOCATION_MOVE_REASONS)[number];

interface MoveLocationRow {
  id: string;
  status: string;
  customer_id: string | null;
  is_temp: boolean;
}

async function releaseLocationIfEmpty(
  db: SupabaseClient,
  locationId: string,
) {
  const { data: loc } = await db
    .from("storage_locations")
    .select("id, is_temp")
    .eq("id", locationId)
    .single();

  if (!loc || loc.is_temp) return;

  const [{ count: parcelCount }, { count: barcodeCount }] = await Promise.all([
    db
      .from("parcels")
      .select("id", { count: "exact", head: true })
      .eq("storage_location_id", locationId)
      .not("status", "in", '("DONE","SHIPPING","PICKUP_CANCELLED")'),
    db
      .from("parcel_barcodes")
      .select("id", { count: "exact", head: true })
      .eq("storage_location_id", locationId),
  ]);

  if ((parcelCount ?? 0) === 0 && (barcodeCount ?? 0) === 0) {
    await db
      .from("storage_locations")
      .update({ status: "AVAILABLE", customer_id: null, assigned_at: null })
      .eq("id", locationId);
  }
}

async function occupyDestination(
  db: SupabaseClient,
  toLoc: MoveLocationRow,
  customerId: string | null,
) {
  if (!["AVAILABLE", "RESERVED"].includes(toLoc.status)) return;

  await db
    .from("storage_locations")
    .update({
      status: "OCCUPIED",
      ...(customerId && !toLoc.customer_id
        ? { customer_id: customerId, assigned_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", toLoc.id);
}

async function confirmPutawayIfNeeded(
  db: SupabaseClient,
  parcelId: string,
  toLocationId: string,
  fromIsTemp: boolean,
  toIsTemp: boolean,
) {
  if (fromIsTemp && !toIsTemp) {
    await db
      .from("parcels")
      .update({
        putaway_at: new Date().toISOString(),
        planned_storage_location_id: null,
      })
      .eq("id", parcelId);
    return;
  }

  const { data: parcel } = await db
    .from("parcels")
    .select("planned_storage_location_id")
    .eq("id", parcelId)
    .single();

  if (parcel?.planned_storage_location_id === toLocationId) {
    await db
      .from("parcels")
      .update({
        putaway_at: new Date().toISOString(),
        planned_storage_location_id: null,
      })
      .eq("id", parcelId);
  }
}

export async function moveParcelToLocation(
  db: SupabaseClient,
  opts: {
    parcelId: string;
    toLocationId: string;
    reason: LocationMoveReason;
    notes?: string | null;
    createdBy: string;
  },
): Promise<{ eventId: string; fromLocationId: string | null }> {
  const { parcelId, toLocationId, reason, notes, createdBy } = opts;

  const { data: parcel, error: parcelErr } = await db
    .from("parcels")
    .select("id, storage_location_id, customer_id")
    .eq("id", parcelId)
    .single();

  if (parcelErr || !parcel) {
    throw new Error("소포를 찾을 수 없습니다");
  }

  const fromLocationId = parcel.storage_location_id as string | null;

  if (fromLocationId === toLocationId) {
    throw new Error("현재 위치와 동일한 로케이션입니다");
  }

  const { data: toLoc, error: toLocErr } = await db
    .from("storage_locations")
    .select("id, status, customer_id, is_temp")
    .eq("id", toLocationId)
    .single();

  if (toLocErr || !toLoc) {
    throw new Error("대상 로케이션을 찾을 수 없습니다");
  }

  let fromIsTemp = false;
  if (fromLocationId) {
    const { data: fromLoc } = await db
      .from("storage_locations")
      .select("is_temp")
      .eq("id", fromLocationId)
      .single();
    fromIsTemp = !!fromLoc?.is_temp;
  }

  const { error: updateErr } = await db
    .from("parcels")
    .update({ storage_location_id: toLocationId })
    .eq("id", parcelId);

  if (updateErr) throw new Error(updateErr.message);

  await db
    .from("parcel_barcodes")
    .update({ storage_location_id: toLocationId })
    .eq("parcel_id", parcelId);

  const { data: event, error: eventErr } = await db
    .from("parcel_location_events")
    .insert({
      parcel_id: parcelId,
      from_location_id: fromLocationId,
      to_location_id: toLocationId,
      reason,
      notes: notes || null,
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (eventErr || !event) {
    throw new Error(eventErr?.message ?? "이동 이력 기록 실패");
  }

  if (fromLocationId) {
    await releaseLocationIfEmpty(db, fromLocationId);
  }

  await occupyDestination(db, toLoc as MoveLocationRow, parcel.customer_id as string | null);
  await confirmPutawayIfNeeded(
    db,
    parcelId,
    toLocationId,
    fromIsTemp,
    !!toLoc.is_temp,
  );

  return { eventId: event.id, fromLocationId };
}

export async function moveBarcodeToLocation(
  db: SupabaseClient,
  opts: {
    barcodeId: string;
    toLocationId: string;
    reason: LocationMoveReason;
    notes?: string | null;
    createdBy: string;
  },
): Promise<{
  eventId: string;
  barcodeNo: string;
  itemName: string | null;
  fromLocationId: string | null;
  toLocationCode: string;
}> {
  const { barcodeId, toLocationId, reason, notes, createdBy } = opts;

  const { data: barcode, error: barcodeErr } = await db
    .from("parcel_barcodes")
    .select("id, barcode_no, seq, item_name, storage_location_id, parcel_id")
    .eq("id", barcodeId)
    .single();

  if (barcodeErr || !barcode) {
    throw new Error("바코드를 찾을 수 없습니다");
  }

  if (barcode.storage_location_id === toLocationId) {
    throw new Error("현재 위치와 동일한 로케이션입니다");
  }

  const { data: toLoc, error: toLocErr } = await db
    .from("storage_locations")
    .select("id, code, status, customer_id, is_temp")
    .eq("id", toLocationId)
    .single();

  if (toLocErr || !toLoc) {
    throw new Error("대상 로케이션을 찾을 수 없습니다");
  }

  const { data: parcel } = await db
    .from("parcels")
    .select("id, customer_id, storage_location_id")
    .eq("id", barcode.parcel_id)
    .single();

  let fromIsTemp = false;
  if (barcode.storage_location_id) {
    const { data: fromLoc } = await db
      .from("storage_locations")
      .select("is_temp")
      .eq("id", barcode.storage_location_id)
      .single();
    fromIsTemp = !!fromLoc?.is_temp;
  }

  const { error: updateErr } = await db
    .from("parcel_barcodes")
    .update({ storage_location_id: toLocationId })
    .eq("id", barcodeId);

  if (updateErr) throw new Error(updateErr.message);

  const siblingLocs = await db
    .from("parcel_barcodes")
    .select("storage_location_id")
    .eq("parcel_id", barcode.parcel_id);

  const uniqueLocs = new Set(
    (siblingLocs.data ?? [])
      .map((s) => s.storage_location_id)
      .filter(Boolean),
  );

  if (uniqueLocs.size === 1 && parcel) {
    await db
      .from("parcels")
      .update({ storage_location_id: toLocationId })
      .eq("id", barcode.parcel_id);
  }

  const { data: event, error: eventErr } = await db
    .from("parcel_location_events")
    .insert({
      parcel_id: barcode.parcel_id,
      from_location_id: barcode.storage_location_id,
      to_location_id: toLocationId,
      reason,
      notes: `내품 이동: ${barcode.barcode_no} (${barcode.item_name ?? "품목명 없음"})${notes ? ` — ${notes}` : ""}`,
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (eventErr || !event) {
    throw new Error(eventErr?.message ?? "이동 이력 기록 실패");
  }

  if (barcode.storage_location_id) {
    await releaseLocationIfEmpty(db, barcode.storage_location_id);
  }

  await occupyDestination(
    db,
    toLoc as MoveLocationRow,
    (parcel?.customer_id as string | null) ?? null,
  );

  if (parcel) {
    await confirmPutawayIfNeeded(
      db,
      parcel.id,
      toLocationId,
      fromIsTemp,
      !!toLoc.is_temp,
    );
  }

  return {
    eventId: event.id,
    barcodeNo: barcode.barcode_no,
    itemName: barcode.item_name,
    fromLocationId: barcode.storage_location_id,
    toLocationCode: toLoc.code,
  };
}

/** TEMP → 최종 로케이션이면 INBOUND, 그 외 TRANSFER */
export function resolveMoveReason(
  fromIsTemp: boolean,
  toIsTemp: boolean,
  requested?: string,
): LocationMoveReason {
  if (requested && LOCATION_MOVE_REASONS.includes(requested as LocationMoveReason)) {
    return requested as LocationMoveReason;
  }
  if (fromIsTemp && !toIsTemp) return "INBOUND";
  return "TRANSFER";
}
