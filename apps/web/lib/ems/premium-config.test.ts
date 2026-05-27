import { describe, expect, it } from "vitest";
import {
  calcLengthPlusGirthCm,
  getEmsPremiumMaxWeightG,
  validateEmsPremiumDimensions,
  EMS_PREMIUM_LIMITS,
} from "./premium-config";

describe("getEmsPremiumMaxWeightG", () => {
  it("non-doc allows 70kg", () => {
    expect(getEmsPremiumMaxWeightG("em")).toBe(70_000);
  });

  it("doc allows 0.5kg from 2026.3.31", () => {
    expect(getEmsPremiumMaxWeightG("ee")).toBe(500);
  });
});

describe("EMS_PREMIUM_LIMITS", () => {
  it("exports dimension constants", () => {
    expect(EMS_PREMIUM_LIMITS.nonDocMaxLongestCm).toBe(274);
    expect(EMS_PREMIUM_LIMITS.nonDocMaxLengthPlusGirthCm).toBe(330);
  });
});

describe("validateEmsPremiumDimensions", () => {
  it("rejects over 330cm length+girth", () => {
    expect(validateEmsPremiumDimensions(200, 50, 50)).toMatch(/330/);
    expect(validateEmsPremiumDimensions(100, 40, 40)).toBeNull();
  });

  it("calcLengthPlusGirthCm sorts sides", () => {
    expect(calcLengthPlusGirthCm(100, 40, 40)).toBe(260);
    expect(calcLengthPlusGirthCm(40, 100, 40)).toBe(260);
  });
});
