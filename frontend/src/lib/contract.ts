import type { Address } from "viem";

export const pilotAddress =
  (process.env.NEXT_PUBLIC_LIQUIDITY_PILOT_ADDRESS as Address | undefined) ?? null;

export const arbitrumV2 = {
  router: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24" as Address,
  factory: "0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9" as Address,
} as const;

export const arbitrumTokens = {
  USDT: {
    address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" as Address,
    decimals: 6,
  },
  DAI: {
    address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1" as Address,
    decimals: 18,
  },
} as const;

export const pilotAbi = [
  {
    type: "function",
    name: "quoteSwap",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "swapExactTokens",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "minAmountOut", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "recipient", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;
