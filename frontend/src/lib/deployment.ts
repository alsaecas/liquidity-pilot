import { getAddress, isAddress, type Address } from "viem";

export const ARBITRUM_CHAIN_ID = 42161;
export const ANVIL_CHAIN_ID = 31337;

const arbitrumDefaults = {
  router: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
  factory: "0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9",
  tokenA: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  tokenB: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
} as const;

export interface LiveDeployment {
  mode: "live";
  chainId: typeof ARBITRUM_CHAIN_ID | typeof ANVIL_CHAIN_ID;
  chainName: string;
  pilot: Address;
  router: Address;
  factory: Address;
  tokenA: { address: Address; symbol: "USDT"; decimals: number };
  tokenB: { address: Address; symbol: "DAI"; decimals: number };
}

export interface DemoDeployment {
  mode: "demo";
  reason: string;
}

export type DeploymentConfig = LiveDeployment | DemoDeployment;

function address(value: string | undefined): Address | null {
  return value && isAddress(value) ? getAddress(value) : null;
}

export function resolveDeployment(env: Record<string, string | undefined>): DeploymentConfig {
  const pilotValue = env.NEXT_PUBLIC_LIQUIDITY_PILOT_ADDRESS;
  if (!pilotValue) return { mode: "demo", reason: "No LiquidityPilot deployment is configured." };
  const pilot = address(pilotValue);
  const chainId = Number(env.NEXT_PUBLIC_DEPLOYMENT_CHAIN_ID);
  if (!pilot) return { mode: "demo", reason: "The configured LiquidityPilot address is invalid." };
  if (chainId !== ARBITRUM_CHAIN_ID && chainId !== ANVIL_CHAIN_ID) {
    return { mode: "demo", reason: "Deployment chain must be Arbitrum (42161) or local Anvil (31337)." };
  }

  const defaults = chainId === ARBITRUM_CHAIN_ID ? arbitrumDefaults : null;
  const router = address(env.NEXT_PUBLIC_ROUTER_ADDRESS ?? defaults?.router);
  const factory = address(env.NEXT_PUBLIC_FACTORY_ADDRESS ?? defaults?.factory);
  const tokenA = address(env.NEXT_PUBLIC_USDT_ADDRESS ?? defaults?.tokenA);
  const tokenB = address(env.NEXT_PUBLIC_DAI_ADDRESS ?? defaults?.tokenB);
  if (!router || !factory || !tokenA || !tokenB) {
    return {
      mode: "demo",
      reason: chainId === ANVIL_CHAIN_ID
        ? "Local deployments require Pilot, router, factory, USDT, and DAI addresses."
        : "The deployment configuration is incomplete or contains an invalid address.",
    };
  }
  return {
    mode: "live",
    chainId,
    chainName: chainId === ARBITRUM_CHAIN_ID ? "Arbitrum One" : "Local Anvil",
    pilot,
    router,
    factory,
    tokenA: { address: tokenA, symbol: "USDT", decimals: Number(env.NEXT_PUBLIC_USDT_DECIMALS ?? 6) },
    tokenB: { address: tokenB, symbol: "DAI", decimals: Number(env.NEXT_PUBLIC_DAI_DECIMALS ?? 18) },
  };
}

export const deploymentConfig = resolveDeployment({
  NEXT_PUBLIC_LIQUIDITY_PILOT_ADDRESS: process.env.NEXT_PUBLIC_LIQUIDITY_PILOT_ADDRESS,
  NEXT_PUBLIC_DEPLOYMENT_CHAIN_ID: process.env.NEXT_PUBLIC_DEPLOYMENT_CHAIN_ID,
  NEXT_PUBLIC_ROUTER_ADDRESS: process.env.NEXT_PUBLIC_ROUTER_ADDRESS,
  NEXT_PUBLIC_FACTORY_ADDRESS: process.env.NEXT_PUBLIC_FACTORY_ADDRESS,
  NEXT_PUBLIC_USDT_ADDRESS: process.env.NEXT_PUBLIC_USDT_ADDRESS,
  NEXT_PUBLIC_DAI_ADDRESS: process.env.NEXT_PUBLIC_DAI_ADDRESS,
  NEXT_PUBLIC_USDT_DECIMALS: process.env.NEXT_PUBLIC_USDT_DECIMALS,
  NEXT_PUBLIC_DAI_DECIMALS: process.env.NEXT_PUBLIC_DAI_DECIMALS,
});
