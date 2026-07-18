"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { arbitrum } from "wagmi/chains";
import { compactAddress } from "@/lib/format";

export function WalletButton() {
  const { address, chainId, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  if (isConnected && chainId !== arbitrum.id && chainId !== 31337) {
    return (
      <button
        className="button button-warning"
        disabled={isSwitching}
        onClick={() => switchChain({ chainId: arbitrum.id })}
        type="button"
      >
        {isSwitching ? "Switching…" : "Switch to Arbitrum"}
      </button>
    );
  }

  if (isConnected) {
    return (
      <button className="button button-secondary wallet-address" onClick={() => disconnect()} type="button">
        <span className="status-dot" />
        {compactAddress(address)}
      </button>
    );
  }

  return (
    <button
      className="button button-primary"
      disabled={isPending || connectors.length === 0}
      onClick={() => connectors[0] && connect({ connector: connectors[0] })}
      type="button"
    >
      {isPending ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
