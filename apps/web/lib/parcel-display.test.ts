import { describe, expect, it } from "vitest";
import {
  getParcelDisplaySummary,
  getParcelJourneyPhase,
  matchesWarehouseFilter,
} from "./parcel-display";

describe("getParcelJourneyPhase", () => {
  it("groups pre-inbound statuses as INCOMING", () => {
    expect(getParcelJourneyPhase({ status: "PRE_REGISTERED" })).toBe("INCOMING");
    expect(getParcelJourneyPhase({ status: "PENDING_PICKUP" })).toBe("INCOMING");
    expect(getParcelJourneyPhase({ status: "PICKED_UP" })).toBe("INCOMING");
  });

  it("marks shippable parcel as SHIPPABLE", () => {
    expect(
      getParcelJourneyPhase({ status: "INBOUND", is_shippable: true }),
    ).toBe("SHIPPABLE");
  });

  it("marks non-shippable inbound as INCOMING", () => {
    expect(
      getParcelJourneyPhase({ status: "INBOUND", is_shippable: false }),
    ).toBe("INCOMING");
  });

  it("marks HOLD as HOLD", () => {
    expect(getParcelJourneyPhase({ status: "HOLD" })).toBe("HOLD");
  });
});

describe("getParcelDisplaySummary", () => {
  it("shows 입고중 badge for pre-inbound parcels", () => {
    const summary = getParcelDisplaySummary({ status: "PRE_REGISTERED" });
    expect(summary.badgeLabel).toBe("입고중");
    expect(summary.subtitle).toContain("센터 도착");
    expect(summary.meta).toBeUndefined();
  });

  it("shows tracking event in subtitle", () => {
    const summary = getParcelDisplaySummary({
      status: "PRE_REGISTERED",
      tracking_last_event: {
        statusLabel: "집하",
        location: "대구",
      },
    });
    expect(summary.subtitle).toBe("집하 · 대구");
  });

  it("shows inbound meta for shippable parcels", () => {
    const summary = getParcelDisplaySummary({
      status: "INBOUND",
      is_shippable: true,
      inbound_at: "2026-05-27",
      weight_actual: 850,
    });
    expect(summary.badgeLabel).toBe("출고 가능");
    expect(summary.meta).toContain("입고");
    expect(summary.meta).toContain("0.85kg");
  });

  it("shows reserved state", () => {
    const summary = getParcelDisplaySummary(
      { status: "INBOUND", is_shippable: true },
      { isReserved: true },
    );
    expect(summary.badgeLabel).toBe("출고 신청 중");
  });
});

describe("matchesWarehouseFilter", () => {
  it("filters by journey phase", () => {
    expect(
      matchesWarehouseFilter({ status: "PICKED_UP" }, "INCOMING"),
    ).toBe(true);
    expect(
      matchesWarehouseFilter(
        { status: "INBOUND", is_shippable: true },
        "SHIPPABLE",
      ),
    ).toBe(true);
  });
});
