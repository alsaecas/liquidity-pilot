import { formatUnits, parseUnits } from "viem";

export const BPS_SCALE = 10_000n;
export const MAX_SLIPPAGE_BPS = 5_000n;

export function parseAmount(value: string, decimals: number): bigint | null {
  const trimmed = value.trim();
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) return null;
  const fraction = trimmed.split(".")[1] ?? "";
  if (fraction.length > decimals) return null;
  try {
    const parsed = parseUnits(trimmed, decimals);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

export function parseSlippageBps(value: string): bigint | null {
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(value.trim())) return null;
  try {
    const bps = parseUnits(value.trim(), 2);
    return bps >= 0n && bps <= MAX_SLIPPAGE_BPS ? bps : null;
  } catch {
    return null;
  }
}

export function applySlippage(value: bigint, bps: bigint): bigint {
  if (bps < 0n || bps > MAX_SLIPPAGE_BPS) throw new RangeError("Slippage must be between 0% and 50%.");
  return (value * (BPS_SCALE - bps)) / BPS_SCALE;
}

export function percentageOf(value: bigint, percentage: number): bigint {
  if (!Number.isInteger(percentage) || percentage < 0 || percentage > 100) {
    throw new RangeError("Percentage must be an integer from 0 to 100.");
  }
  return (value * BigInt(percentage)) / 100n;
}

export function proportionalAmount(reserve: bigint, liquidity: bigint, totalSupply: bigint): bigint {
  return totalSupply > 0n ? (reserve * liquidity) / totalSupply : 0n;
}

export function formatAmount(value: bigint | undefined, decimals: number, digits = 4): string {
  if (value === undefined) return "—";
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  const formattedWhole = new Intl.NumberFormat("en-US").format(BigInt(whole));
  const clipped = fraction.slice(0, digits).replace(/0+$/, "");
  return clipped ? `${formattedWhole}.${clipped}` : formattedWhole;
}

export function deadlineFromNow(minutes: number, now = Date.now()): bigint {
  return BigInt(Math.floor(now / 1000) + minutes * 60);
}
