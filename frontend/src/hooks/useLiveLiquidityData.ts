"use client";

import { zeroAddress, type Address } from "viem";
import { useBalance, useReadContract } from "wagmi";
import { erc20Abi, factoryAbi, pairAbi, pilotAbi } from "@/lib/contract";
import type { LiveDeployment } from "@/lib/deployment";

export function useLiveLiquidityData(
  config: LiveDeployment | null,
  account: Address | undefined,
  enabled: boolean,
  quoteInput: bigint | null,
) {
  const baseEnabled = Boolean(config && account && enabled);
  const pair = useReadContract({
    chainId: config?.chainId,
    address: config?.factory,
    abi: factoryAbi,
    functionName: "getPair",
    args: config ? [config.tokenA.address, config.tokenB.address] : undefined,
    query: { enabled: baseEnabled },
  });
  const pairAddress = pair.data && pair.data !== zeroAddress ? pair.data : undefined;
  const pairEnabled = baseEnabled && Boolean(pairAddress);
  const tokenABalance = useReadContract({
    chainId: config?.chainId,
    address: config?.tokenA.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    query: { enabled: baseEnabled },
  });
  const tokenBBalance = useReadContract({
    chainId: config?.chainId,
    address: config?.tokenB.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    query: { enabled: baseEnabled },
  });
  const tokenAAllowance = useReadContract({
    chainId: config?.chainId,
    address: config?.tokenA.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: account && config ? [account, config.pilot] : undefined,
    query: { enabled: baseEnabled },
  });
  const lpBalance = useReadContract({
    chainId: config?.chainId,
    address: pairAddress,
    abi: pairAbi,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    query: { enabled: pairEnabled },
  });
  const lpAllowance = useReadContract({
    chainId: config?.chainId,
    address: pairAddress,
    abi: pairAbi,
    functionName: "allowance",
    args: account && config ? [account, config.pilot] : undefined,
    query: { enabled: pairEnabled },
  });
  const lpDecimals = useReadContract({
    chainId: config?.chainId,
    address: pairAddress,
    abi: pairAbi,
    functionName: "decimals",
    query: { enabled: pairEnabled },
  });
  const token0 = useReadContract({
    chainId: config?.chainId,
    address: pairAddress,
    abi: pairAbi,
    functionName: "token0",
    query: { enabled: pairEnabled },
  });
  const token1 = useReadContract({
    chainId: config?.chainId,
    address: pairAddress,
    abi: pairAbi,
    functionName: "token1",
    query: { enabled: pairEnabled },
  });
  const reserves = useReadContract({
    chainId: config?.chainId,
    address: pairAddress,
    abi: pairAbi,
    functionName: "getReserves",
    query: { enabled: pairEnabled },
  });
  const totalSupply = useReadContract({
    chainId: config?.chainId,
    address: pairAddress,
    abi: pairAbi,
    functionName: "totalSupply",
    query: { enabled: pairEnabled },
  });
  const quote = useReadContract({
    chainId: config?.chainId,
    address: config?.pilot,
    abi: pilotAbi,
    functionName: "quoteSwap",
    args: config && quoteInput ? [quoteInput, [config.tokenA.address, config.tokenB.address]] : undefined,
    query: { enabled: baseEnabled && Boolean(quoteInput) },
  });
  const gasBalance = useBalance({
    address: account,
    chainId: config?.chainId,
    query: { enabled: baseEnabled },
  });

  async function refresh() {
    await Promise.all([
      pair.refetch(), tokenABalance.refetch(), tokenBBalance.refetch(), tokenAAllowance.refetch(),
      lpBalance.refetch(), lpAllowance.refetch(), lpDecimals.refetch(), token0.refetch(), token1.refetch(),
      reserves.refetch(), totalSupply.refetch(), quote.refetch(), gasBalance.refetch(),
    ]);
  }

  return {
    pairAddress,
    pairMissing: pair.isSuccess && !pairAddress,
    pairLoading: pair.isLoading,
    tokenABalance: tokenABalance.data,
    tokenBBalance: tokenBBalance.data,
    tokenAAllowance: tokenAAllowance.data ?? 0n,
    lpBalance: lpBalance.data,
    lpAllowance: lpAllowance.data ?? 0n,
    lpDecimals: Number(lpDecimals.data ?? 18),
    token0: token0.data,
    token1: token1.data,
    reserves: reserves.data,
    totalSupply: totalSupply.data,
    quote: quote.data,
    quoteLoading: quote.isLoading || quote.isFetching,
    quoteError: quote.error,
    gasBalance: gasBalance.data?.value,
    refresh,
  };
}
