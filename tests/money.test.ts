import { describe, expect, it } from "vitest";
import { applyBps, formatMoney, toMajorString, toMinor } from "../src/server/money";

describe("money", () => {
  it("converts using currency precision", () => {
    expect(toMinor("250.5", 2)).toBe(25050);
    expect(toMinor("250", 0)).toBe(250);
    expect(() => toMinor("1.234", 2)).toThrow();
    expect(() => toMinor("abc", 2)).toThrow();
    expect(toMajorString(25050, 2)).toBe("250.50");
    expect(toMajorString(5, 2)).toBe("0.05");
    expect(toMajorString(12000, 0)).toBe("12000");
  });
  it("formats with the currency's own symbol", () => {
    expect(formatMoney(123456789, { code: "GHS", symbol: "GH₵", minorUnits: 2 })).toBe("GH₵1,234,567.89");
    expect(formatMoney(5000, { code: "UGX", symbol: "USh", minorUnits: 0 })).toBe("USh5,000");
  });
  it("rounds basis points half-up", () => {
    expect(applyBps(20000, 1500)).toBe(3000);
    expect(applyBps(333, 1500)).toBe(50); // 49.95 → 50
  });
});
