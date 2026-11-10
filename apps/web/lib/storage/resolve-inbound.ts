import type { SupabaseClient } from "@supabase/supabase-js";

export type InboundPurpose = "storage" | "shipping";

const SHIPPED = ["SHIPPED", "RETURNED", "DISPOSED", "PICKUP_CANCELLED"];

/**
 * 장기보관이 있으면 그 보관함.
 * 배송이고 장기보관이 없으면 배송전용 스토리지 하나.
 * 보관인데 보관함이 없으면 먼저 만들도록 돌려보낸다.
 */
export async function resolveInboundStorage(
  supabase: SupabaseClient,
  userId: string,
  purpose: InboundPurpose,
  explicitId?: string | null,
): Promise<{ storageId: string } | { error: string; status: number; code?: string }> {
  if (explicitId) {
    const { data } = await supabase
      .from("customer_storages")
      .select("id")
      .eq("id", explicitId)
      .eq("user_id", userId)
      .neq("status", "CANCELLED")
      .maybeSingle();
    if (!data) return { error: "스토리지를 찾을 수 없습니다.", status: 404 };
    return { storageId: data.id };
  }

  const { data: longTerm } = await supabase
    .from("customer_storages")
    .select("id")
    .eq("user_id", userId)
    .eq("storage_mode", "long_term")
    .neq("status", "CANCELLED")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (longTerm) return { storageId: longTerm.id };

  if (purpose === "storage") {
    return {
      error: "보관 신청은 보관함을 만든 뒤 물건을 넣을 수 있습니다.",
      status: 409,
      code: "NEED_STORAGE",
    };
  }

  const { data: existing } = await supabase
    .from("customer_storages")
    .select("id")
    .eq("user_id", userId)
    .eq("storage_mode", "shipping")
    .neq("status", "CANCELLED")
    .limit(1)
    .maybeSingle();

  if (existing) return { storageId: existing.id };

  const { data: shippingType } = await supabase
    .from("storage_types")
    .select("id")
    .eq("code", "SHIPPING")
    .maybeSingle();

  const { data: created, error } = await supabase
    .from("customer_storages")
    .insert({
      user_id: userId,
      storage_name: "배송전용 블록",
      storage_mode: "shipping",
      storage_type_id: shippingType?.id ?? null,
      status: "ACTIVE",
    })
    .select("id")
    .single();

  if (error || !created) {
    return { error: "배송 스토리지를 만들지 못했습니다.", status: 500 };
  }
  return { storageId: created.id };
}

type ParcelRow = {
  id: string;
  customer_storage_id: string | null;
  inbound_at: string | null;
  created_at: string | null;
  status: string;
};

type StorageRow = {
  id: string;
  storage_mode: string;
  monthly_amount: number | null;
  paid_until_date: string | null;
  created_at: string | null;
  storage_types: { price_per_month: number | null } | null;
};

function earliestHold(
  parcels: { inbound_at: string | null; created_at: string | null }[],
): string | null {
  let best: number | null = null;
  let iso: string | null = null;
  for (const parcel of parcels) {
    const raw = parcel.inbound_at ?? parcel.created_at;
    if (!raw) continue;
    const time = new Date(raw).getTime();
    if (Number.isNaN(time)) continue;
    if (best === null || time < best) {
      best = time;
      iso = raw;
    }
  }
  return iso;
}

/** 이번 출고 한 장에 넣을 보관료. */
export async function quoteOutboundStorageFee(
  supabase: SupabaseClient,
  userId: string,
  parcelIds: string[],
): Promise<{ amount: number; memo: string }> {
  const { longTermStartsAt, monthlyRate, remainingStorageMonths, shippingBillableMonths } = await import("./holding-fee");

  const { data: parcels } = await supabase
    .from("parcels")
    .select("id, customer_storage_id, inbound_at, created_at, status")
    .in("id", parcelIds)
    .eq("customer_id", userId);

  const rows = (parcels ?? []) as ParcelRow[];
  const storageIds = [...new Set(rows.map((p) => p.customer_storage_id).filter(Boolean))] as string[];
  if (storageIds.length === 0) return { amount: 0, memo: "" };

  const { data: storages } = await supabase
    .from("customer_storages")
    .select("id, storage_mode, monthly_amount, paid_until_date, created_at, storage_types(price_per_month)")
    .in("id", storageIds);

  const storageMap = new Map<string, StorageRow>();
  for (const raw of storages ?? []) {
    const row = raw as unknown as StorageRow & { storage_types: StorageRow["storage_types"] | StorageRow["storage_types"][] };
    const types = Array.isArray(row.storage_types) ? row.storage_types[0] ?? null : row.storage_types;
    storageMap.set(row.id, { ...row, storage_types: types });
  }

  const { data: siblings } = await supabase
    .from("parcels")
    .select("id, customer_storage_id, status, inbound_at, created_at")
    .eq("customer_id", userId)
    .in("customer_storage_id", storageIds);

  const leaving = new Set(parcelIds);
  let amount = 0;
  const lines: string[] = [];

  for (const storageId of storageIds) {
    const storage = storageMap.get(storageId);
    if (!storage) continue;
    const rate = monthlyRate(storage);
    if (rate <= 0) continue;

    const inStorage = (siblings ?? []).filter(
      (p) => p.customer_storage_id === storageId && !SHIPPED.includes(p.status as string),
    );
    const stillThere = inStorage.filter((p) => !leaving.has(p.id as string));

    if (storage.storage_mode === "long_term") {
      if (stillThere.length > 0) continue;
      const held = (siblings ?? []).filter((p) => p.customer_storage_id === storageId);
      const earliest = earliestHold(held) ?? storage.created_at;
      const months = remainingStorageMonths(storage.paid_until_date, longTermStartsAt(earliest));
      if (months <= 0) continue;
      amount += months * rate;
      lines.push(`잔여 보관료 ${months}달 × ${rate.toLocaleString()}원`);
      continue;
    }

    if (storage.storage_mode !== "shipping") continue;

    let months = 0;
    for (const parcel of rows.filter((p) => p.customer_storage_id === storageId)) {
      months += shippingBillableMonths(parcel.inbound_at ?? parcel.created_at);
    }
    if (months <= 0) continue;
    amount += months * rate;
    lines.push(`보관료 ${months}달 × ${rate.toLocaleString()}원`);
  }

  return { amount, memo: lines.join(" / ") };
}
