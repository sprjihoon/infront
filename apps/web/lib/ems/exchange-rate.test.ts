import { describe, expect, it } from "vitest";
import {
  defaultRate,
  formatExchangeRateDate,
  getCustomsWeekStartYmd,
  normalizeStoredExchangeRate,
  rateFromEnv,
  shouldSkipWeeklyExchangeRateSync,
} from "./exchange-rate";

describe("normalizeStoredExchangeRate", () => {
  it("parses stored config", () => {
    const parsed = normalizeStoredExchangeRate({
      rate: 1385,
      source: "customs",
      as_of_date: "20260525",
      label: "관세청 수입 과세환율(주간)",
      updated_at: "2026-05-25T00:30:00Z",
    });
    expect(parsed?.rate).toBe(1385);
    expect(parsed?.source).toBe("customs");
  });
});

describe("shouldSkipWeeklyExchangeRateSync", () => {
  it("skips when stored rate covers current customs week", () => {
    const weekStart = getCustomsWeekStartYmd(new Date("2026-05-27T12:00:00Z"));
    expect(
      shouldSkipWeeklyExchangeRateSync(
        {
          rate: 1380,
          source: "customs",
          as_of_date: weekStart,
          label: "관세청 수입 과세환율(주간)",
          updated_at: "2026-05-25T00:00:00Z",
        },
        { at: new Date("2026-05-27T12:00:00Z") },
      ),
    ).toBe(true);
  });

  it("does not skip when force", () => {
    expect(
      shouldSkipWeeklyExchangeRateSync(
        {
          rate: 1380,
          source: "customs",
          as_of_date: "20260525",
          label: "관세청 수입 과세환율(주간)",
          updated_at: "2026-05-25T00:00:00Z",
        },
        { force: true },
      ),
    ).toBe(false);
  });
});

describe("formatExchangeRateDate", () => {
  it("formats YYYYMMDD", () => {
    expect(formatExchangeRateDate("20260527")).toBe("2026-05-27");
  });
});

describe("defaultRate", () => {
  it("returns 1400 default", () => {
    expect(defaultRate().rate).toBe(1400);
  });
});

describe("rateFromEnv", () => {
  it("reads EMS_USD_KRW_RATE when set", () => {
    const prev = process.env.EMS_USD_KRW_RATE;
    process.env.EMS_USD_KRW_RATE = "1350";
    expect(rateFromEnv()?.rate).toBe(1350);
    process.env.EMS_USD_KRW_RATE = prev;
  });
});
