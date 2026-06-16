import { describe, expect, it } from "vitest";
import { buildActionCards, formatPickupDate } from "./action-dashboard";

const parcel = (
  id: string,
  status: string,
  pickup_date: string | null = null,
  epost_pickup_date: string | null = null,
) => ({ id, status, pickup_date, epost_pickup_date });

const order = (
  id: string,
  status: string,
  total_amount = 0,
  created_at = "2026-01-01",
) => ({ id, status, total_amount, created_at });

describe("formatPickupDate", () => {
  it("formats ISO pickup_date", () => {
    expect(formatPickupDate("2026-05-23", null)).toMatch(/5월 23일/);
  });

  it("formats epost YYYYMMDD string", () => {
    expect(formatPickupDate(null, "20260523")).toMatch(/5월 23일/);
  });

  it("returns fallback when no date", () => {
    expect(formatPickupDate(null, null)).toBe("일정 확인 중");
  });
});

describe("buildActionCards", () => {
  it("returns no cards when no active items", () => {
    const cards = buildActionCards([], []);
    expect(cards).toHaveLength(0);
  });

  it("prioritizes payment over inbound", () => {
    const cards = buildActionCards(
      [parcel("p1", "INBOUND"), parcel("p2", "INBOUND")],
      [order("o1", "PENDING_PAYMENT", 12500)],
    );
    expect(cards).toHaveLength(2);
    expect(cards[0].id).toBe("payment");
    expect(cards[0].message).toContain("12,500원");
    expect(cards[0].highlight).toBe(true);
    expect(cards[0].button?.href).toBe("/orders/o1");
    expect(cards[1].id).toBe("inbound");
  });

  it("shows pickup card for PENDING_PICKUP and PICKUP_REQUESTED", () => {
    const cards = buildActionCards(
      [
        parcel("p1", "PENDING_PICKUP", "2026-05-25"),
        parcel("p2", "PICKUP_REQUESTED", "2026-05-20"),
      ],
      [],
    );
    expect(cards[0].id).toBe("pickup");
    expect(cards[0].message).toContain("2건");
    expect(cards[0].button?.href).toBe("/pickup/history");
  });

  it("shows in-transit card", () => {
    const cards = buildActionCards([], [order("o1", "IN_TRANSIT")]);
    expect(cards[0].id).toBe("in-transit");
    expect(cards[0].message).toBe("배송 중 1건");
  });

  it("limits to top 3 cards by priority", () => {
    const cards = buildActionCards(
      [
        parcel("p1", "INBOUND"),
        parcel("p2", "PENDING_PICKUP", "2026-05-20"),
      ],
      [
        order("o1", "PENDING_PAYMENT", 5000),
        order("o2", "IN_TRANSIT"),
        order("o3", "INSPECTION"),
      ],
    );
    expect(cards).toHaveLength(3);
    expect(cards.map((c) => c.id)).toEqual(["payment", "inbound", "pickup"]);
  });

  it("shows payment card for QUOTE_SENT orders", () => {
    const cards = buildActionCards([], [order("o1", "QUOTE_SENT", 9800)]);
    expect(cards[0].id).toBe("payment");
    expect(cards[0].message).toContain("9,800원");
  });

  it("does not show card for inspection-only activity", () => {
    const cards = buildActionCards(
      [parcel("p1", "INSPECTION")],
      [order("o1", "INSPECTION"), order("o2", "PACKAGING_REQUESTED")],
    );
    expect(cards).toHaveLength(0);
  });

  it("hides empty state when user has inactive history", () => {
    const cards = buildActionCards(
      [parcel("p1", "PICKED_UP"), parcel("p2", "DONE")],
      [order("o1", "DELIVERED")],
    );
    expect(cards).toHaveLength(0);
  });

  it("uses earliest pickup date in message", () => {
    const cards = buildActionCards(
      [
        parcel("p1", "PENDING_PICKUP", "2026-05-25"),
        parcel("p2", "PENDING_PICKUP", "2026-05-20"),
      ],
      [],
    );
    expect(cards[0].message).toMatch(/5월 20일/);
  });

  it("ignores completed or inactive statuses for empty fallback", () => {
    const cards = buildActionCards(
      [parcel("p1", "DONE"), parcel("p2", "DELIVERED")],
      [order("o1", "DELIVERED"), order("o2", "CANCELLED")],
    );
    expect(cards).toHaveLength(0);
  });
});
