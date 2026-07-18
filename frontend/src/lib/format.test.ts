import { describe, expect, it } from "vitest";
import { clampNumber, compactAddress, estimateMinimum, parseTransactionError } from "./format";

describe("format utilities", () => {
  it("clamps slippage to safe percentage boundaries", () => {
    expect(clampNumber(-1, 0, 100)).toBe(0);
    expect(clampNumber(101, 0, 100)).toBe(100);
  });

  it("calculates a minimum received boundary", () => {
    expect(estimateMinimum(100, 0.5)).toBe(99.5);
  });

  it("compacts an EVM address", () => {
    expect(compactAddress("0x1234567890abcdef")).toBe("0x1234…cdef");
  });

  it("turns wallet rejection errors into readable feedback", () => {
    expect(parseTransactionError(new Error("User rejected the request"))).toBe(
      "The wallet request was rejected.",
    );
  });
});
