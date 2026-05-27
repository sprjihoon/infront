import { describe, expect, it } from "vitest";
import {
  calcLengthPlusGirthCm,
  calcVolumetricWeightG,
  sortBoxDimensions,
  validateBoxDimensions,
  validateShippingDimensions,
  EMS_PREMIUM_DIMENSION_RULES,
  EMS_PARCEL_DEFAULT_RULES,
  KPACKET_DIMENSION_RULES,
} from "./dimension-limits";

describe("sortBoxDimensions", () => {
  it("sorts longest first regardless of input order", () => {
    expect(sortBoxDimensions(40, 100, 70)).toEqual({
      longest: 100,
      middle: 70,
      shortest: 40,
    });
  });
});

describe("calcLengthPlusGirthCm", () => {
  it("uses longest side as length", () => {
    expect(calcLengthPlusGirthCm(40, 100, 70)).toBe(320);
    expect(calcLengthPlusGirthCm(100, 40, 70)).toBe(320);
  });
});

describe("calcVolumetricWeightG", () => {
  it("computes L×W×H÷6", () => {
    expect(calcVolumetricWeightG(30, 20, 15)).toBe(1500);
  });
});

describe("validateBoxDimensions — EMS 프리미엄", () => {
  it("passes within FedEx limits", () => {
    expect(
      validateBoxDimensions(EMS_PREMIUM_DIMENSION_RULES, 100, 40, 40),
    ).toBeNull();
  });

  it("rejects over 330cm length+girth", () => {
    expect(
      validateBoxDimensions(EMS_PREMIUM_DIMENSION_RULES, 200, 50, 50),
    ).toMatch(/330/);
  });

  it("rejects over 274cm longest side", () => {
    expect(
      validateBoxDimensions(EMS_PREMIUM_DIMENSION_RULES, 50, 50, 280),
    ).toMatch(/최장변.*274/);
  });

  it("rejects over 105cm second longest side", () => {
    expect(
      validateBoxDimensions(EMS_PREMIUM_DIMENSION_RULES, 120, 110, 30),
    ).toMatch(/2번째/);
  });

  it("rejects over 76cm shortest side", () => {
    expect(
      validateBoxDimensions(EMS_PREMIUM_DIMENSION_RULES, 100, 80, 77),
    ).toMatch(/최단변/);
  });
});

describe("validateBoxDimensions — EMS", () => {
  it("rejects over default 300cm length+girth", () => {
    expect(
      validateBoxDimensions(EMS_PARCEL_DEFAULT_RULES, 120, 60, 60),
    ).toMatch(/300/);
  });
});

describe("validateBoxDimensions — K-Packet", () => {
  it("rejects over 90cm sum", () => {
    expect(
      validateBoxDimensions(KPACKET_DIMENSION_RULES, 40, 30, 25),
    ).toMatch(/90/);
  });

  it("rejects over 60cm longest side", () => {
    expect(
      validateBoxDimensions(KPACKET_DIMENSION_RULES, 30, 25, 62),
    ).toMatch(/60/);
  });
});

describe("validateShippingDimensions", () => {
  it("skips when dimensions incomplete", () => {
    expect(
      validateShippingDimensions({
        premiumcd: "32",
        em_ee: "em",
        boxlength: 100,
      }),
    ).toBeNull();
  });

  it("validates EMS with country override", () => {
    expect(
      validateShippingDimensions({
        premiumcd: "31",
        em_ee: "em",
        countrycd: "US",
        boxlength: 160,
        boxwidth: 40,
        boxheight: 40,
      }),
    ).toMatch(/152/);
  });
});
