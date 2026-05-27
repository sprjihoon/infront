import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_USD_KRW,
  EMS_USD_KRW_CONFIG_KEY,
  defaultRate,
  fetchLatestEmsUsdKrwRate,
  normalizeStoredExchangeRate,
  rateFromEnv,
  type StoredExchangeRate,
} from "./exchange-rate";

let memoryCache: { value: StoredExchangeRate; expiresAt: number } | null = null;
const MEMORY_TTL_MS = 60_000;

function cacheGet(): StoredExchangeRate | null {
  if (!memoryCache || Date.now() > memoryCache.expiresAt) return null;
  return memoryCache.value;
}

function cacheSet(value: StoredExchangeRate): void {
  memoryCache = { value, expiresAt: Date.now() + MEMORY_TTL_MS };
}

export async function loadStoredExchangeRate(
  db: SupabaseClient,
): Promise<StoredExchangeRate | null> {
  try {
    const { data, error } = await db
      .from("admin_config")
      .select("value, updated_at")
      .eq("key", EMS_USD_KRW_CONFIG_KEY)
      .maybeSingle();

    if (error || !data?.value) return null;
    const parsed = normalizeStoredExchangeRate(data.value);
    if (!parsed) return null;
    if (data.updated_at && !parsed.updated_at) {
      parsed.updated_at = data.updated_at;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveStoredExchangeRate(
  db: SupabaseClient,
  value: StoredExchangeRate,
): Promise<void> {
  await db.from("admin_config").upsert({
    key: EMS_USD_KRW_CONFIG_KEY,
    value,
    updated_at: new Date().toISOString(),
  });
  cacheSet(value);
}

/** 견적·접수 API용 — DB → env → 기본값 */
export async function getEmsUsdKrwRate(db?: SupabaseClient): Promise<StoredExchangeRate> {
  const cached = cacheGet();
  if (cached) return cached;

  if (db) {
    const stored = await loadStoredExchangeRate(db);
    if (stored) {
      cacheSet(stored);
      return stored;
    }
  }

  const fromEnv = rateFromEnv();
  if (fromEnv) {
    cacheSet(fromEnv);
    return fromEnv;
  }

  const fallback = defaultRate();
  cacheSet(fallback);
  return fallback;
}

/** Cron — 관세청 주간 환율 API 조회 후 DB 저장 */
export async function syncEmsUsdKrwRate(db: SupabaseClient): Promise<StoredExchangeRate> {
  const fetched = await fetchLatestEmsUsdKrwRate();
  await saveStoredExchangeRate(db, fetched);
  return fetched;
}

export function getEmsUsdKrwRateNumber(info: StoredExchangeRate): number {
  return info.rate || DEFAULT_USD_KRW;
}
