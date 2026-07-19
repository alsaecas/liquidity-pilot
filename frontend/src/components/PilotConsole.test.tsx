import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getValidation, PilotConsole } from "./PilotConsole";
import type { LiveDeployment } from "@/lib/deployment";

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined, chainId: undefined, isConnected: false }),
  useReadContract: () => ({ data: undefined, refetch: vi.fn() }),
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
}));
vi.mock("@/hooks/useLiveLiquidityData", () => ({
  useLiveLiquidityData: () => ({
    pairAddress: undefined, pairMissing: false, pairLoading: false,
    tokenABalance: undefined, tokenBBalance: undefined, tokenAAllowance: 0n,
    lpBalance: undefined, lpAllowance: 0n, lpDecimals: 18, token0: undefined, token1: undefined,
    reserves: undefined, totalSupply: undefined, quote: undefined, quoteLoading: false, quoteError: null,
    gasBalance: undefined, refresh: vi.fn(),
  }),
}));

const config: LiveDeployment = {
  mode: "live", chainId: 42161, chainName: "Arbitrum One",
  pilot: "0x1111111111111111111111111111111111111111",
  router: "0x2222222222222222222222222222222222222222",
  factory: "0x3333333333333333333333333333333333333333",
  tokenA: { address: "0x4444444444444444444444444444444444444444", symbol: "USDT", decimals: 6 },
  tokenB: { address: "0x5555555555555555555555555555555555555555", symbol: "DAI", decimals: 18 },
};

const valid = {
  liveConfig: config, isConnected: true, correctChain: true, mode: "swap" as const,
  amountIn: 1_000_000n, balance: 2_000_000n, percentage: 50, lpBalance: 10n,
  lpToRemove: 5n, pairMissing: false, quoteOutput: 999n,
  removal: { amountA: 100n, amountB: 100n }, singleSwapOutput: 99n,
  removeStyle: "pair" as const, slippageBps: 50n, deadlineMinutes: 20, gasBalance: 1n,
};

describe("PilotConsole safety gates", () => {
  it("never submits in demo mode and labels the 128.42 value as sample", () => {
    render(<PilotConsole />);
    expect((screen.getByRole("button", { name: /continue to swap/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/sample estimates are labelled/i)).toBeTruthy();
    expect(screen.queryByText(/contract configured/i)).toBeNull();
  });

  it("requires the configured chain and a successful live quote", () => {
    expect(getValidation({ ...valid, correctChain: false })).toMatch(/Switch to Arbitrum One/);
    expect(getValidation({ ...valid, quoteOutput: undefined })).toMatch(/live quote/);
    expect(getValidation(valid)).toBeNull();
  });

  it("uses real LP ownership and actual percentage for removal gates", () => {
    expect(getValidation({ ...valid, mode: "remove", lpBalance: 0n, lpToRemove: 0n })).toMatch(/LP balance/);
    expect(getValidation({ ...valid, mode: "remove", percentage: 0, lpToRemove: 0n })).toMatch(/non-zero percentage/);
    expect(getValidation({ ...valid, mode: "remove" })).toBeNull();
  });

  it("rejects invalid input, insufficient balances, and missing pairs", () => {
    expect(getValidation({ ...valid, amountIn: null })).toMatch(/positive amount/);
    expect(getValidation({ ...valid, amountIn: 3_000_000n })).toMatch(/exceeds/);
    expect(getValidation({ ...valid, pairMissing: true })).toMatch(/does not exist/);
  });
});
