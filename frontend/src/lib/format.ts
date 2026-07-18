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

export function parseTransactionError(error: unknown): string {
  if (!(error instanceof Error)) return "The transaction could not be completed.";
  const match = error.message.match(/reason: ([^\n]+)/i);
  if (match?.[1]) return match[1];
  if (error.message.includes("User rejected")) return "The wallet request was rejected.";
  return error.message.split("\n")[0] ?? "The transaction could not be completed.";
}
