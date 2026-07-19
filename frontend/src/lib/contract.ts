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
  {
    type: "function",
    name: "zapIn",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "p",
        type: "tuple",
        components: [
          { name: "tokenA", type: "address" },
          { name: "tokenB", type: "address" },
          { name: "inputToken", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "minSwapOut", type: "uint256" },
          { name: "minAmountA", type: "uint256" },
          { name: "minAmountB", type: "uint256" },
          { name: "minLiquidity", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
        ],
      },
    ],
    outputs: [
      { name: "amountAUsed", type: "uint256" },
      { name: "amountBUsed", type: "uint256" },
      { name: "liquidity", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "removeLiquidity",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "p",
        type: "tuple",
        components: [
          { name: "tokenA", type: "address" },
          { name: "tokenB", type: "address" },
          { name: "liquidity", type: "uint256" },
          { name: "minAmountA", type: "uint256" },
          { name: "minAmountB", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
        ],
      },
    ],
    outputs: [
      { name: "amountA", type: "uint256" },
      { name: "amountB", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "zapOutToSingleToken",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "p",
        type: "tuple",
        components: [
          { name: "tokenA", type: "address" },
          { name: "tokenB", type: "address" },
          { name: "outputToken", type: "address" },
          { name: "liquidity", type: "uint256" },
          { name: "minAmountA", type: "uint256" },
          { name: "minAmountB", type: "uint256" },
          { name: "minSwapOut", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "totalOutput", type: "uint256" }],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "allowance", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "decimals", type: "uint8" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const pairAbi = [
  ...erc20Abi,
  {
    type: "function",
    name: "token0",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "token0", type: "address" }],
  },
  {
    type: "function",
    name: "token1",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "token1", type: "address" }],
  },
  {
    type: "function",
    name: "getReserves",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "reserve0", type: "uint112" },
      { name: "reserve1", type: "uint112" },
      { name: "blockTimestampLast", type: "uint32" },
    ],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "totalSupply", type: "uint256" }],
  },
] as const;

export const factoryAbi = [
  {
    type: "function",
    name: "getPair",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
    ],
    outputs: [{ name: "pair", type: "address" }],
  },
] as const;
