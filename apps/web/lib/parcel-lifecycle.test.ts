import { describe, expect, it } from "vitest";
import {
  canCancelPickupRequest,
  canRequestParcelReturn,
  isParcelVisibleInWarehouse,
} from "./parcel-lifecycle";

describe("isParcelVisibleInWarehouse", () => {
  it("hides pre-inbound pickup cancellations", () => {
    expect(
      isParcelVisibleInWarehouse({ status: "PICKUP_CANCELLED", inbound_at: null }),
    ).toBe(false);
  });

  it("keeps inbound pickup cancellations visible", () => {
    expect(
      isParcelVisibleInWarehouse({
        status: "PICKUP_CANCELLED",
        inbound_at: "2026-05-27",
      }),
    ).toBe(true);
  });

  it("hides DONE", () => {
    expect(isParcelVisibleInWarehouse({ status: "DONE" })).toBe(false);
  });

  it("shows active parcels", () => {
    expect(isParcelVisibleInWarehouse({ status: "PENDING_PICKUP" })).toBe(true);
  });
});

describe("cancel vs return windows", () => {
  it("allows pickup cancel only before pickup", () => {
    expect(canCancelPickupRequest("PENDING_PICKUP")).toBe(true);
    expect(canCancelPickupRequest("PICKED_UP")).toBe(false);
    expect(canCancelPickupRequest("INBOUND")).toBe(false);
  });

  it("allows return after inbound", () => {
    expect(canRequestParcelReturn("INBOUND")).toBe(true);
    expect(canRequestParcelReturn("PENDING_PICKUP")).toBe(false);
  });
});
