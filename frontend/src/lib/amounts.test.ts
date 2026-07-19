import { describe, expect, it } from "vitest";
import {
  applySlippage,
  formatAmount,
  parseAmount,
  parseSlippageBps,
  percentageOf,
  proportionalAmount,
} from "./amounts";

describe("bigint amount helpers", () => {
  it("parses supported precision without floating-point math", () => {
    expect(parseAmount("12.345678", 6)).toBe(12_345_678n);
    expect(parseAmount("12.3456789", 6)).toBeNull();
    expect(parseAmount("-1", 6)).toBeNull();
    expect(parseAmount("0", 6)).toBeNull();
  });

  it("converts and bounds slippage from 0% through 50%", () => {
    expect(parseSlippageBps("0.5")).toBe(50n);
    expect(parseSlippageBps("50")).toBe(5_000n);
    expect(parseSlippageBps("50.01")).toBeNull();
    expect(applySlippage(1_000_000n, 50n)).toBe(995_000n);
  });

  it("calculates actual LP percentages and proportional reserves", () => {
    expect(percentageOf(128_420_000_000_000_000_000n, 25)).toBe(32_105_000_000_000_000_000n);
    expect(proportionalAmount(2_000n, 25n, 100n)).toBe(500n);
    expect(formatAmount(1_234_567n, 6)).toBe("1.2345");
  });
});
