import { describe, expect, it } from "vitest";
import { getInicisGopaymethod, getInicisMobilePayment } from "./pay-method";

describe("getInicisGopaymethod", () => {
  it("maps Alipay and WeChat to only* codes", () => {
    expect(getInicisGopaymethod("alipay")).toBe("onlyalipay");
    expect(getInicisGopaymethod("wechat")).toBe("onlywechat");
  });

  it("maps domestic methods", () => {
    expect(getInicisGopaymethod("card")).toBe("Card");
    expect(getInicisGopaymethod("bank")).toBe("DirectBank");
    expect(getInicisGopaymethod("vbank")).toBe("VBank");
    expect(getInicisGopaymethod("easy")).toBe("");
  });
});

describe("getInicisMobilePayment", () => {
  it("maps Alipay and WeChat to only* codes", () => {
    expect(getInicisMobilePayment("alipay")).toBe("onlyalipay");
    expect(getInicisMobilePayment("wechat")).toBe("onlywechat");
  });
});
