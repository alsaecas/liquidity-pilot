"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { compactAddress } from "@/lib/format";
import { deploymentConfig } from "@/lib/deployment";

export function WalletButton() {
  const { address, chainId, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const injectedConnectors = connectors.filter((connector) => connector.type === "injected");
  const expectedChain = deploymentConfig.mode === "live" ? deploymentConfig.chainId : null;
  const expectedChainName = deploymentConfig.mode === "live" ? deploymentConfig.chainName : "";

  if (isConnected && expectedChain && chainId !== expectedChain) {
    return (
      <button
        className="button button-warning"
        disabled={isSwitching}
        onClick={() => switchChain({ chainId: expectedChain })}
        type="button"
      >
        {isSwitching ? "Switching…" : `Switch to ${expectedChainName}`}
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

  if (injectedConnectors.length === 0) {
    return <a className="button button-secondary" href="https://ethereum.org/en/wallets/find-wallet/" rel="noreferrer" target="_blank">Install wallet ↗</a>;
  }

  if (injectedConnectors.length > 1) {
    return (
      <label className="wallet-select">
        <span className="sr-only">Choose wallet</span>
        <select
          aria-label="Choose wallet"
          defaultValue=""
          disabled={isPending}
          onChange={(event) => {
            const connector = injectedConnectors.find((item) => item.uid === event.target.value);
            if (connector) connect({ connector });
          }}
        >
          <option disabled value="">{isPending ? "Connecting…" : "Choose wallet"}</option>
          {injectedConnectors.map((connector) => <option key={connector.uid} value={connector.uid}>{connector.name}</option>)}
        </select>
      </label>
    );
  }

  return (
    <button
      className="button button-primary"
      disabled={isPending}
      onClick={() => connect({ connector: injectedConnectors[0] })}
      type="button"
    >
      {isPending ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
