import { describe, expect, it } from "vitest";
import { formatUsd, krwToUsd, usdValueString } from "./fx";

describe("krwToUsd", () => {
  it("converts and rounds to cents", () => {
    expect(krwToUsd(14000, 1400)).toBe(10);
    expect(krwToUsd(9900, 1400)).toBe(7.07);
  });

  it("falls back when rate is invalid", () => {
    expect(krwToUsd(1400, 0)).toBe(1);
  });
});

describe("formatUsd", () => {
  it("formats with two decimals", () => {
    expect(formatUsd(7.07)).toBe("$7.07");
    expect(usdValueString(10)).toBe("10.00");
  });
});
