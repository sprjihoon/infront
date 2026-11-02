import { describe, expect, it } from "vitest";
import { billableMonths, remainingStorageMonths } from "./holding-fee";

describe("billableMonths", () => {
  const now = new Date("2026-11-02T12:00:00");

  it("charges nothing on the start day", () => {
    expect(billableMonths("2026-11-02T08:00:00", now)).toBe(0);
  });

  it("rounds a partial month up to one month", () => {
    expect(billableMonths("2026-10-20T12:00:00", now)).toBe(1);
  });

  it("rounds 31 days up to two months", () => {
    expect(billableMonths("2026-10-02T12:00:00", now)).toBe(2);
  });
});

describe("remainingStorageMonths", () => {
  const now = new Date("2026-11-02T12:00:00");

  it("does not charge a month that is already paid", () => {
    expect(remainingStorageMonths("2026-11-30", "2026-10-01", now)).toBe(0);
  });

  it("charges only the period after paid_until", () => {
    expect(remainingStorageMonths("2026-10-01", "2026-08-01", now)).toBe(2);
  });
});
