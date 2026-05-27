import { describe, expect, it } from "vitest";
import {
  appendInsuranceQuoteParams,
  getOrderInsuranceParams,
  usdToBoprcKrw,
  MAX_BOPRC_KRW,
} from "./insurance";

describe("usdToBoprcKrw", () => {
  it("converts with explicit rate", () => {
    expect(usdToBoprcKrw(100, 1400)).toBe(140_000);
  });

  it("caps at EMS max insurance amount", () => {
    expect(usdToBoprcKrw(10_000, 1400)).toBe(MAX_BOPRC_KRW);
  });
});

describe("getOrderInsuranceParams", () => {
  it("returns N when insurance disabled", () => {
    expect(getOrderInsuranceParams({ insurance_enabled: false, customs_value: 50 }, 1400)).toEqual({
      boyn: "N",
      boprc: 0,
    });
  });

  it("uses insurance_amount USD and converts to boprc KRW", () => {
    expect(getOrderInsuranceParams({
      insurance_enabled: true,
      insurance_amount: 100,
    }, 1385)).toEqual({ boyn: "Y", boprc: 138_500 });
  });
});

describe("appendInsuranceQuoteParams", () => {
  it("sets boyn and insurance_usd when enabled", () => {
    const p = new URLSearchParams();
    appendInsuranceQuoteParams(p, true, 100);
    expect(p.get("boyn")).toBe("Y");
    expect(p.get("insurance_usd")).toBe("100");
    expect(p.get("boprc")).toBeNull();
  });

  it("does nothing when disabled", () => {
    const p = new URLSearchParams();
    appendInsuranceQuoteParams(p, false, 100);
    expect(p.get("boyn")).toBeNull();
  });
});
