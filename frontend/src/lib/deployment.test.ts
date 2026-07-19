import { describe, expect, it } from "vitest";
import { resolveDeployment } from "./deployment";

const pilot = "0x1111111111111111111111111111111111111111";

describe("deployment configuration", () => {
  it("falls back to explicit demo mode when absent or invalid", () => {
    expect(resolveDeployment({}).mode).toBe("demo");
    expect(resolveDeployment({
      NEXT_PUBLIC_LIQUIDITY_PILOT_ADDRESS: pilot,
      NEXT_PUBLIC_DEPLOYMENT_CHAIN_ID: "1",
    }).mode).toBe("demo");
  });

  it("uses reviewed Arbitrum addresses only on chain 42161", () => {
    const config = resolveDeployment({
      NEXT_PUBLIC_LIQUIDITY_PILOT_ADDRESS: pilot,
      NEXT_PUBLIC_DEPLOYMENT_CHAIN_ID: "42161",
    });
    expect(config.mode).toBe("live");
    if (config.mode === "live") expect(config.chainId).toBe(42161);
  });

  it("requires complete local Anvil addresses", () => {
    expect(resolveDeployment({
      NEXT_PUBLIC_LIQUIDITY_PILOT_ADDRESS: pilot,
      NEXT_PUBLIC_DEPLOYMENT_CHAIN_ID: "31337",
    }).mode).toBe("demo");
  });
});
