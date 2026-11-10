import { describe, expect, it } from "vitest";
import {
  billableMonths,
  longTermStartsAt,
  remainingStorageMonths,
  shippingBillableMonths,
  unpaidMonthsSince,
} from "./holding-fee";

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

  it("charges the first month once long-term has started", () => {
    expect(remainingStorageMonths(null, "2026-11-02T12:00:00", now)).toBe(1);
  });
});

describe("shipping free week", () => {
  const now = new Date("2026-11-02T12:00:00");

  it("stays free for 7 days regardless of how the period is counted", () => {
    expect(shippingBillableMonths("2026-11-02T12:00:00", now)).toBe(0);
    expect(shippingBillableMonths("2026-10-26T12:00:00", now)).toBe(0);
  });

  it("starts a billable month on the 8th day", () => {
    expect(shippingBillableMonths("2026-10-25T12:00:00", now)).toBe(1);
  });

  it("keeps the first paid month through 7 days plus 30", () => {
    expect(shippingBillableMonths("2026-09-26T12:00:00", now)).toBe(1);
    expect(shippingBillableMonths("2026-09-25T12:00:00", now)).toBe(2);
  });
});

describe("long-term start", () => {
  const now = new Date("2026-11-02T12:00:00");

  it("begins 7 days after inbound", () => {
    expect(longTermStartsAt("2026-10-26T12:00:00")).toBe(new Date("2026-11-02T12:00:00").toISOString());
  });

  it("charges nothing before the start and one month on the start day", () => {
    expect(unpaidMonthsSince("2026-11-03T12:00:00", now)).toBe(0);
    expect(unpaidMonthsSince("2026-11-02T12:00:00", now)).toBe(1);
    expect(unpaidMonthsSince("2026-10-03T12:00:00", now)).toBe(1);
    expect(unpaidMonthsSince("2026-10-02T12:00:00", now)).toBe(2);
  });
});
