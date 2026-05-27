import { describe, expect, it } from "vitest";
import {
  calculateDutyDeposit,
  computeOrderTotalAmount,
  isDdpCountry,
  isDdpEligibleForShipment,
  isPostalDdpEligible,
  isPremiumDdpEligible,
  requiresUsEmsPremium,
} from "./duty-deposit";

describe("isDdpCountry", () => {
  it("returns true for US and GB", () => {
    expect(isDdpCountry("US")).toBe(true);
    expect(isDdpCountry("gb")).toBe(true);
  });

  it("returns false for other countries", () => {
    expect(isDdpCountry("JP")).toBe(false);
    expect(isDdpCountry("DE")).toBe(false);
  });
});

describe("calculateDutyDeposit", () => {
  const rate = 1400;

  it("returns zero when not requested", () => {
    expect(
      calculateDutyDeposit({
        countryCode: "US",
        customsValueUsd: 100,
        dutyPrepaidRequested: false,
        usdKrwRate: rate,
      }),
    ).toMatchObject({ dutyPrepaid: false, depositKrw: 0 });
  });

  it("rejects non-DDP country", () => {
    const r = calculateDutyDeposit({
      countryCode: "JP",
      customsValueUsd: 50,
      dutyPrepaidRequested: true,
      usdKrwRate: rate,
    });
    expect(r.dutyPrepaid).toBe(false);
    expect(r.ineligibleReason).toBeTruthy();
  });

  it("rejects US over $800 without EMS premium", () => {
    const r = calculateDutyDeposit({
      countryCode: "US",
      customsValueUsd: 850,
      dutyPrepaidRequested: true,
      usdKrwRate: rate,
    });
    expect(r.eligible).toBe(false);
    expect(r.ineligibleReason).toContain("EMS 프리미엄");
  });

  it("calculates US premium DDP over $800", () => {
    const r = calculateDutyDeposit({
      countryCode: "US",
      customsValueUsd: 850,
      dutyPrepaidRequested: true,
      shippingMethod: "EMS_PREMIUM",
      usdKrwRate: rate,
    });
    expect(r.dutyPrepaid).toBe(true);
    expect(r.ddpPath).toBe("premium");
    expect(r.depositKrw).toBeGreaterThanOrEqual(25_000);
    expect(r.estimateUsd).toBeGreaterThan(0);
  });

  it("calculates US postal deposit with minimum floor", () => {
    const r = calculateDutyDeposit({
      countryCode: "US",
      customsValueUsd: 150,
      dutyPrepaidRequested: true,
      usdKrwRate: rate,
    });
    expect(r.dutyPrepaid).toBe(true);
    expect(r.ddpPath).toBe("postal");
    expect(r.depositKrw).toBeGreaterThanOrEqual(15_000);
    expect(r.estimateUsd).toBeGreaterThan(0);
  });

  it("calculates GB VAT-based deposit", () => {
    const r = calculateDutyDeposit({
      countryCode: "GB",
      customsValueUsd: 100,
      dutyPrepaidRequested: true,
      usdKrwRate: rate,
    });
    expect(r.dutyPrepaid).toBe(true);
    expect(r.depositKrw).toBeGreaterThanOrEqual(10_000);
  });
});

describe("requiresUsEmsPremium", () => {
  it("returns true for US over $800", () => {
    expect(requiresUsEmsPremium("US", 801)).toBe(true);
    expect(requiresUsEmsPremium("us", 900)).toBe(true);
  });

  it("returns false for US at or under $800", () => {
    expect(requiresUsEmsPremium("US", 800)).toBe(false);
    expect(requiresUsEmsPremium("US", 100)).toBe(false);
  });

  it("returns false for non-US", () => {
    expect(requiresUsEmsPremium("GB", 900)).toBe(false);
  });
});

describe("isPostalDdpEligible", () => {
  it("US over $800 is not postal DDP eligible", () => {
    expect(isPostalDdpEligible("US", 850)).toBe(false);
    expect(isPostalDdpEligible("US", 500)).toBe(true);
  });
});

describe("isPremiumDdpEligible", () => {
  it("US over $800 with EMS premium is premium DDP eligible", () => {
    expect(isPremiumDdpEligible("US", 850, "EMS_PREMIUM")).toBe(true);
    expect(isPremiumDdpEligible("US", 500, "EMS_PREMIUM")).toBe(false);
    expect(isPremiumDdpEligible("US", 850, "EMS")).toBe(false);
  });
});

describe("isDdpEligibleForShipment", () => {
  it("combines postal and premium paths", () => {
    expect(isDdpEligibleForShipment("US", 500, "EMS")).toBe(true);
    expect(isDdpEligibleForShipment("US", 850, "EMS_PREMIUM")).toBe(true);
    expect(isDdpEligibleForShipment("US", 850, "EMS")).toBe(false);
  });
});

describe("computeOrderTotalAmount", () => {
  it("sums all fee components", () => {
    expect(
      computeOrderTotalAmount({
        packagingFee: 3000,
        shippingFee: 45000,
        dutyDepositKrw: 28000,
      }),
    ).toBe(76000);
  });
});
