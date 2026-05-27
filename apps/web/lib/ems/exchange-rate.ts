/** admin_config key + 기본값 */
export const EMS_USD_KRW_CONFIG_KEY = "ems_usd_krw_rate";
export const DEFAULT_USD_KRW = 1400;

export type ExchangeRateSource = "koreaexim" | "customs" | "env" | "default";

export type StoredExchangeRate = {
  rate: number;
  source: ExchangeRateSource;
  as_of_date: string;
  label: string;
  updated_at: string;
};

export type KoreaEximRow = {
  result?: number;
  cur_unit?: string;
  deal_bas_r?: string;
};

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function parseRate(value: string | number | undefined | null): number | null {
  if (value == null || value === "") return null;
  const n = parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** KST 기준 관세 주간(일~토) 시작일 — aplyBgnDt 비교용 */
export function getCustomsWeekStartYmd(at = new Date()): string {
  const kst = new Date(at.getTime() + 9 * 60 * 60 * 1000);
  const dow = kst.getUTCDay();
  const start = new Date(kst);
  start.setUTCDate(start.getUTCDate() - dow);
  const y = start.getUTCFullYear();
  const m = String(start.getUTCMonth() + 1).padStart(2, "0");
  const d = String(start.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/** 이번 관세 주간에 이미 갱신된 환율이면 Cron 스킵 */
export function shouldSkipWeeklyExchangeRateSync(
  stored: StoredExchangeRate | null,
  options?: { force?: boolean; at?: Date },
): boolean {
  if (options?.force || !stored) return false;
  const weekStart = getCustomsWeekStartYmd(options?.at ?? new Date());
  return stored.as_of_date >= weekStart;
}

/** 관세청 수입 과세환율(주간) — EMS 보험 boprc 환산 1순위 */
export async function fetchCustomsImportUsdRate(
  serviceKey: string,
  fromDate = new Date(),
): Promise<StoredExchangeRate | null> {
  const base =
    "https://apis.data.go.kr/1220000/retrieveTrifFxrtInfo/getRetrieveTrifFxrtInfo";

  for (let i = 0; i < 21; i++) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() - i);
    const aplyBgnDt = formatYmd(d);
    const url = new URL(base);
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("aplyBgnDt", aplyBgnDt);
    url.searchParams.set("weekFxrtTpcd", "2");
    url.searchParams.set("currSgn", "USD");
    url.searchParams.set("_type", "json");
    url.searchParams.set("numOfRows", "1");
    url.searchParams.set("pageNo", "1");

    try {
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        response?: { body?: { items?: { item?: { fxrt?: string | number } | { fxrt?: string | number }[] } } };
      };
      const items = json.response?.body?.items?.item;
      const item = Array.isArray(items) ? items[0] : items;
      const rate = parseRate(item?.fxrt);
      if (!rate) continue;

      return {
        rate,
        source: "customs",
        as_of_date: aplyBgnDt,
        label: "관세청 수입 과세환율(주간)",
        updated_at: new Date().toISOString(),
      };
    } catch {
      continue;
    }
  }
  return null;
}

/** 한국수출입은행 매매기준율 — 관세청 API 실패 시 폴백 */
export async function fetchKoreaEximUsdRate(
  authKey: string,
  fromDate = new Date(),
): Promise<StoredExchangeRate | null> {
  const base = "https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON";

  for (let i = 0; i < 10; i++) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() - i);
    const searchdate = formatYmd(d);
    const url = `${base}?authkey=${encodeURIComponent(authKey)}&searchdate=${searchdate}&data=AP01`;

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = (await res.json()) as KoreaEximRow[] | { result?: number };
      if (!Array.isArray(data)) continue;

      const usd = data.find((row) => row.cur_unit === "USD" && row.result === 1);
      const rate = parseRate(usd?.deal_bas_r);
      if (!rate) continue;

      return {
        rate,
        source: "koreaexim",
        as_of_date: searchdate,
        label: "한국수출입은행 매매기준율",
        updated_at: new Date().toISOString(),
      };
    } catch {
      continue;
    }
  }
  return null;
}

export function rateFromEnv(): StoredExchangeRate | null {
  const raw = process.env.EMS_USD_KRW_RATE?.trim();
  if (!raw) return null;
  const rate = parseRate(raw);
  if (!rate) return null;
  return {
    rate,
    source: "env",
    as_of_date: formatYmd(new Date()),
    label: "환경변수 EMS_USD_KRW_RATE",
    updated_at: new Date().toISOString(),
  };
}

export function defaultRate(): StoredExchangeRate {
  return {
    rate: DEFAULT_USD_KRW,
    source: "default",
    as_of_date: formatYmd(new Date()),
    label: "기본값",
    updated_at: new Date().toISOString(),
  };
}

/** Cron·수동 갱신용 — 관세청(주간) → 수출입은행 → env 순 */
export async function fetchLatestEmsUsdKrwRate(): Promise<StoredExchangeRate> {
  const customsKey =
    process.env.PUBLIC_DATA_API_KEY?.trim() ??
    process.env.CUSTOMS_EXCHANGE_API_KEY?.trim();
  if (customsKey) {
    const customs = await fetchCustomsImportUsdRate(customsKey);
    if (customs) return customs;
  }

  const eximKey = process.env.KOREAEXIM_AUTH_KEY?.trim();
  if (eximKey) {
    const exim = await fetchKoreaEximUsdRate(eximKey);
    if (exim) return exim;
  }

  return rateFromEnv() ?? defaultRate();
}

export function normalizeStoredExchangeRate(raw: unknown): StoredExchangeRate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const rate = parseRate(o.rate as string | number);
  if (!rate) return null;
  const source = o.source as ExchangeRateSource;
  return {
    rate,
    source: source ?? "default",
    as_of_date: String(o.as_of_date ?? formatYmd(new Date())),
    label: String(o.label ?? "저장된 환율"),
    updated_at: String(o.updated_at ?? new Date().toISOString()),
  };
}

export function formatExchangeRateDate(ymd: string): string {
  if (ymd.length !== 8) return ymd;
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}
