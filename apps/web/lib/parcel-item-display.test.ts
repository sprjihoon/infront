import { describe, expect, it } from "vitest";
import { formatParcelItemTitle, normalizeParcelItems } from "./parcel-item-display";

describe("formatParcelItemTitle", () => {
  it("shows ×N for single line with quantity > 1", () => {
    expect(
      formatParcelItemTitle([
        { product_name: "나이스운동화", name_en: "Sneakers", quantity: 3 },
      ]),
    ).toBe("나이스운동화 ×3");
  });

  it("shows 외1 for two items", () => {
    expect(
      formatParcelItemTitle([
        { product_name: "나이스운동화", name_en: "Sneakers" },
        { product_name: "가방", name_en: "Bag" },
      ]),
    ).toBe("나이스운동화 외1");
  });

  it("shows 외N for three or more items", () => {
    expect(
      formatParcelItemTitle([
        { name_en: "A" },
        { name_en: "B" },
        { name_en: "C" },
      ]),
    ).toBe("A 외2");
  });

  it("parses JSON string from API", () => {
    const raw = JSON.stringify([
      { product_name: "나이스운동화", name_en: "Sneakers" },
      { product_name: "모자", name_en: "Cap" },
    ]);
    expect(formatParcelItemTitle(raw)).toBe("나이스운동화 외1");
  });
});

describe("normalizeParcelItems", () => {
  it("ignores empty rows in title", () => {
    expect(
      formatParcelItemTitle([
        { product_name: "나이스운동화", name_en: "Sneakers" },
        { name_en: "", product_name: "" },
      ]),
    ).toBe("나이스운동화");
  });
});
