import type { SupabaseClient } from "@supabase/supabase-js";

export const EMS_USD_KRW_CONFIG_KEY = "ems_usd_krw_rate";
export const DEFAULT_USD_KRW = 1400;

export type StoredExchangeRate = {
  rate: number;
  source: string;
  as_of_date: string;
  label: string;
  updated_at: string;
};

let memoryCache: { value: StoredExchangeRate; expiresAt: number } | null = null;
const MEMORY_TTL_MS = 60_000;

function parseRate(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function normalizeStoredExchangeRate(raw: unknown): StoredExchangeRate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const rate = parseRate(o.rate);
  if (!rate) return null;
  return {
    rate,
    source: String(o.source ?? "default"),
    as_of_date: String(o.as_of_date ?? ""),
    label: String(o.label ?? "저장된 환율"),
    updated_at: String(o.updated_at ?? new Date().toISOString()),
  };
}

function rateFromEnv(): StoredExchangeRate | null {
  const raw = process.env.EMS_USD_KRW_RATE?.trim();
  if (!raw) return null;
  const rate = parseRate(raw);
  if (!rate) return null;
  return {
    rate,
    source: "env",
    as_of_date: "",
    label: "환경변수 EMS_USD_KRW_RATE",
    updated_at: new Date().toISOString(),
  };
}

export async function getEmsUsdKrwRate(db?: SupabaseClient): Promise<StoredExchangeRate> {
  if (memoryCache && Date.now() <= memoryCache.expiresAt) {
    return memoryCache.value;
  }

  if (db) {
    try {
      const { data } = await db
        .from("admin_config")
        .select("value, updated_at")
        .eq("key", EMS_USD_KRW_CONFIG_KEY)
        .maybeSingle();
      const parsed = data?.value ? normalizeStoredExchangeRate(data.value) : null;
      if (parsed) {
        memoryCache = { value: parsed, expiresAt: Date.now() + MEMORY_TTL_MS };
        return parsed;
      }
    } catch {
      /* fall through */
    }
  }

  const fromEnv = rateFromEnv() ?? {
    rate: DEFAULT_USD_KRW,
    source: "default",
    as_of_date: "",
    label: "기본값",
    updated_at: new Date().toISOString(),
  };
  memoryCache = { value: fromEnv, expiresAt: Date.now() + MEMORY_TTL_MS };
  return fromEnv;
}

export function getEmsUsdKrwRateNumber(info: StoredExchangeRate): number {
  return info.rate || DEFAULT_USD_KRW;
}
