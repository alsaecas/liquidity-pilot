"use client";

import { QueryClient } from "@tanstack/react-query";
import { createConfig, http } from "wagmi";
import { arbitrum, foundry } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [arbitrum, foundry],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [arbitrum.id]: http(process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL),
    [foundry.id]: http(process.env.NEXT_PUBLIC_LOCAL_RPC_URL ?? "http://127.0.0.1:8545"),
  },
  ssr: true,
});

export const queryClient = new QueryClient();
