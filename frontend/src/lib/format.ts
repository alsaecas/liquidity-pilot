export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function estimateMinimum(amount: number, slippagePercent: number): number {
  return amount * (1 - clampNumber(slippagePercent, 0, 100) / 100);
}

export function compactAddress(address?: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatTokenAmount(value: number, maximumFractionDigits = 4): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);
}
