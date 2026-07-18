"use client";

import { useMemo, useState } from "react";
import { parseUnits, zeroAddress, type Address, type Hash } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import {
  compactAddress,
  estimateMinimum,
  formatTokenAmount,
  parseTransactionError,
} from "@/lib/format";
import {
  arbitrumTokens,
  arbitrumV2,
  erc20Abi,
  factoryAbi,
  pilotAbi,
  pilotAddress,
} from "@/lib/contract";
import { TransactionStage } from "./TransactionStage";

type Mode = "swap" | "add" | "remove";
type RemoveStyle = "pair" | "single";
type TransactionPhase = "idle" | "approving" | "executing" | "confirmed" | "error";

const modes: { id: Mode; label: string }[] = [
  { id: "swap", label: "Swap" },
  { id: "add", label: "Add liquidity" },
  { id: "remove", label: "Remove liquidity" },
];

const stageLabels = ["Approve", "Execute", "Confirmed"] as const;

export function PilotConsole() {
  const [mode, setMode] = useState<Mode>("swap");
  const [amount, setAmount] = useState("1000");
  const [slippage, setSlippage] = useState("0.5");
  const [deadline, setDeadline] = useState("20");
  const [removeStyle, setRemoveStyle] = useState<RemoveStyle>("pair");
  const [percentage, setPercentage] = useState(50);
  const [minTokenA, setMinTokenA] = useState("1");
  const [minTokenB, setMinTokenB] = useState("1");
  const [minSingleSwap, setMinSingleSwap] = useState("1");
  const [phase, setPhase] = useState<TransactionPhase>("idle");
  const [transactionHash, setTransactionHash] = useState<Hash | null>(null);
  const [transactionError, setTransactionError] = useState("");
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const demoMode = pilotAddress === null;

  const parsedAmount = Number.parseFloat(amount) || 0;
  const parsedSlippage = Number.parseFloat(slippage) || 0;
  const estimate = useMemo(() => {
    const swapOutput = parsedAmount * 0.9987;
    return {
      swapOutput,
      minimum: estimateMinimum(swapOutput, parsedSlippage),
      swapPortion: parsedAmount / 2,
      paired: parsedAmount * 0.4992,
      lp: parsedAmount * 0.4978,
    };
  }, [parsedAmount, parsedSlippage]);
  const stageIndex =
    phase === "approving" ? 0 : phase === "executing" ? 1 : phase === "confirmed" ? 2 : -1;
  const isWorking = phase === "approving" || phase === "executing";

  async function executeFlow() {
    if (!pilotAddress || !address || !publicClient) return;
    setTransactionError("");
    setTransactionHash(null);

    try {
      const deadlineValue = BigInt(
        Math.floor(Date.now() / 1000) + Math.max(Number(deadline) || 1, 1) * 60,
      );
      const slippageBps = BigInt(Math.min(Math.max(Math.round(parsedSlippage * 100), 0), 10_000));
      const applySlippage = (value: bigint) => (value * (10_000n - slippageBps)) / 10_000n;
      const path = [arbitrumTokens.USDT.address, arbitrumTokens.DAI.address] as const;
      const amountIn = parseUnits(amount || "0", arbitrumTokens.USDT.decimals);
      const liquidity = parseUnits(
        ((128.42 * percentage) / 100).toFixed(8),
        18,
      );

      let approvalToken: Address = arbitrumTokens.USDT.address;
      let approvalAmount = amountIn;
      if (mode === "remove") {
        approvalToken = await publicClient.readContract({
          address: arbitrumV2.factory,
          abi: factoryAbi,
          functionName: "getPair",
          args: path,
        });
        if (approvalToken === zeroAddress) throw new Error("The selected V2 pair does not exist.");
        approvalAmount = liquidity;
      }
      if (approvalAmount <= 0n) throw new Error("Enter an amount greater than zero.");

      setPhase("approving");
      const approvalHash = await writeContractAsync({
        address: approvalToken,
        abi: erc20Abi,
        functionName: "approve",
        args: [pilotAddress, approvalAmount],
      });
      await publicClient.waitForTransactionReceipt({ hash: approvalHash });

      setPhase("executing");
      let hash: Hash;
      if (mode === "swap") {
        const quote = await publicClient.readContract({
          address: pilotAddress,
          abi: pilotAbi,
          functionName: "quoteSwap",
          args: [amountIn, path],
        });
        hash = await writeContractAsync({
          address: pilotAddress,
          abi: pilotAbi,
          functionName: "swapExactTokens",
          args: [amountIn, applySlippage(quote[1]), path, address, deadlineValue],
        });
      } else if (mode === "add") {
        const swapAmount = amountIn / 2n;
        const quote = await publicClient.readContract({
          address: pilotAddress,
          abi: pilotAbi,
          functionName: "quoteSwap",
          args: [swapAmount, path],
        });
        hash = await writeContractAsync({
          address: pilotAddress,
          abi: pilotAbi,
          functionName: "zapIn",
          args: [{
            tokenA: path[0],
            tokenB: path[1],
            inputToken: path[0],
            amountIn,
            minSwapOut: applySlippage(quote[1]),
            minAmountA: applySlippage(amountIn - swapAmount),
            minAmountB: applySlippage(quote[1]),
            minLiquidity: 1n,
            recipient: address,
            deadline: deadlineValue,
          }],
        });
      } else {
        const removal = {
          tokenA: path[0],
          tokenB: path[1],
          liquidity,
          minAmountA: parseUnits(minTokenA || "0", arbitrumTokens.USDT.decimals),
          minAmountB: parseUnits(minTokenB || "0", arbitrumTokens.DAI.decimals),
          recipient: address,
          deadline: deadlineValue,
        } as const;
        hash = removeStyle === "pair"
          ? await writeContractAsync({
              address: pilotAddress,
              abi: pilotAbi,
              functionName: "removeLiquidity",
              args: [removal],
            })
          : await writeContractAsync({
              address: pilotAddress,
              abi: pilotAbi,
              functionName: "zapOutToSingleToken",
              args: [{
                ...removal,
                outputToken: path[1],
                minSwapOut: parseUnits(minSingleSwap || "0", arbitrumTokens.DAI.decimals),
              }],
            });
      }
      await publicClient.waitForTransactionReceipt({ hash });
      setTransactionHash(hash);
      setPhase("confirmed");
    } catch (error) {
      setTransactionError(parseTransactionError(error));
      setPhase("error");
    }
  }

  return (
    <section aria-labelledby="console-heading" className="console-shell" id="app">
      <div className="console-heading">
        <div>
          <span className="eyebrow">Transaction console</span>
          <h2 id="console-heading">Plot your position</h2>
        </div>
        <span className={demoMode ? "mode-badge mode-demo" : "mode-badge mode-live"}>
          <span className="status-dot" />
          {demoMode ? "Demo mode" : "Contract configured"}
        </span>
      </div>

      {demoMode && (
        <div className="demo-notice" role="status">
          Sample estimates are clearly marked. Configure a contract address to enable transactions.
        </div>
      )}

      <div aria-label="Liquidity mode" className="mode-tabs" role="tablist">
        {modes.map((item) => (
          <button
            aria-selected={mode === item.id}
            className={mode === item.id ? "mode-tab mode-tab-active" : "mode-tab"}
            key={item.id}
            onClick={() => setMode(item.id)}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="console-grid">
        <div className="console-form">
          {mode === "remove" ? (
            <>
              <fieldset className="segmented-field">
                <legend>Exit route</legend>
                <button
                  className={removeStyle === "pair" ? "selected" : ""}
                  onClick={() => setRemoveStyle("pair")}
                  type="button"
                >
                  USDT + DAI
                </button>
                <button
                  className={removeStyle === "single" ? "selected" : ""}
                  onClick={() => setRemoveStyle("single")}
                  type="button"
                >
                  DAI only
                </button>
              </fieldset>
              <label className="amount-field">
                <span>LP position</span>
                <span className="balance">Balance 128.42 LP</span>
                <div>
                  <input
                    aria-label="LP percentage"
                    max="100"
                    min="0"
                    onChange={(event) => setPercentage(Number(event.target.value))}
                    type="range"
                    value={percentage}
                  />
                  <strong>{percentage}%</strong>
                </div>
              </label>
              <div className="percentage-row">
                {[25, 50, 75, 100].map((value) => (
                  <button key={value} onClick={() => setPercentage(value)} type="button">
                    {value === 100 ? "Max" : `${value}%`}
                  </button>
                ))}
              </div>
              <div className="settings-row removal-minimums">
                <label>
                  Min USDT
                  <span><input min="0" onChange={(event) => setMinTokenA(event.target.value)} type="number" value={minTokenA} /></span>
                </label>
                <label>
                  Min DAI
                  <span><input min="0" onChange={(event) => setMinTokenB(event.target.value)} type="number" value={minTokenB} /></span>
                </label>
              </div>
              {removeStyle === "single" && (
                <label className="single-minimum">
                  Minimum DAI from USDT swap
                  <input min="0" onChange={(event) => setMinSingleSwap(event.target.value)} type="number" value={minSingleSwap} />
                </label>
              )}
            </>
          ) : (
            <label className="amount-field">
              <span>{mode === "swap" ? "You send" : "One-token input"}</span>
              <span className="balance">Balance —</span>
              <div>
                <input
                  inputMode="decimal"
                  min="0"
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  type="number"
                  value={amount}
                />
                <button className="token-pill" type="button">
                  <span className="token-icon token-usdt">₮</span>
                  USDT
                </button>
              </div>
            </label>
          )}

          {mode === "swap" && (
            <div className="output-field">
              <span>You receive</span>
              <strong>{formatTokenAmount(estimate.swapOutput)}</strong>
              <span className="token-label"><i className="token-icon token-dai">◈</i> DAI</span>
            </div>
          )}

          {mode === "add" && (
            <div className="route-visual" aria-label="One-sided liquidity route">
              <div><span>Keep</span><strong>{formatTokenAmount(estimate.swapPortion)} USDT</strong></div>
              <span className="route-line">+</span>
              <div><span>Swap</span><strong>≈ {formatTokenAmount(estimate.paired)} DAI</strong></div>
              <span className="route-line">→</span>
              <div><span>Mint</span><strong>≈ {formatTokenAmount(estimate.lp)} LP</strong></div>
            </div>
          )}

          <div className="settings-row">
            <label>
              Slippage
              <span><input min="0" onChange={(event) => setSlippage(event.target.value)} step="0.1" type="number" value={slippage} />%</span>
            </label>
            <label>
              Deadline
              <span><input min="1" onChange={(event) => setDeadline(event.target.value)} type="number" value={deadline} />min</span>
            </label>
          </div>

          <TransactionStage current={stageIndex} labels={stageLabels} />
          <button
            className="button button-action"
            disabled={demoMode || !isConnected || isWorking}
            onClick={executeFlow}
            type="button"
          >
            {demoMode
              ? "Preview only — transactions disabled"
              : !isConnected
                ? "Connect wallet to continue"
                : phase === "approving"
                  ? "Waiting for approval…"
                  : phase === "executing"
                    ? "Executing route…"
                    : phase === "confirmed"
                      ? "Run another transaction"
                      : `Approve & ${mode === "swap" ? "swap" : mode === "add" ? "add liquidity" : "remove"}`}
          </button>
          {transactionError && <p className="transaction-error" role="alert">{transactionError}</p>}
          {transactionHash && (
            <a
              className="transaction-link"
              href={`https://arbiscan.io/tx/${transactionHash}`}
              rel="noreferrer"
              target="_blank"
            >
              View confirmed transaction on Arbiscan ↗
            </a>
          )}
          <p className="action-note">
            {demoMode
              ? "No transaction will be created in demo mode."
              : "Your wallet will ask for an exact token approval before execution."}
          </p>
        </div>

        <aside className="flight-plan">
          <span className="eyebrow">Expected outcome</span>
          <dl>
            {mode === "swap" && (
              <>
                <div><dt>Expected output</dt><dd>≈ {formatTokenAmount(estimate.swapOutput)} DAI</dd></div>
                <div><dt>Minimum received</dt><dd>{formatTokenAmount(estimate.minimum)} DAI</dd></div>
                <div><dt>Price impact</dt><dd>≈ 0.13% <small>sample</small></dd></div>
                <div><dt>Route</dt><dd>USDT → DAI</dd></div>
              </>
            )}
            {mode === "add" && (
              <>
                <div><dt>Pool</dt><dd>USDT / DAI</dd></div>
                <div><dt>Swap portion</dt><dd>≈ 50%</dd></div>
                <div><dt>LP estimate</dt><dd>≈ {formatTokenAmount(estimate.lp)} LP</dd></div>
                <div><dt>Dust policy</dt><dd>Refund caller</dd></div>
              </>
            )}
            {mode === "remove" && (
              <>
                <div><dt>LP to remove</dt><dd>{formatTokenAmount(128.42 * percentage / 100)} LP</dd></div>
                <div><dt>Exit</dt><dd>{removeStyle === "single" ? "DAI only" : "USDT + DAI"}</dd></div>
                <div><dt>Minimum output</dt><dd>Slippage protected</dd></div>
                <div><dt>Recipient</dt><dd>Connected wallet</dd></div>
              </>
            )}
          </dl>
          <div className="config-panel">
            <span>Contract configuration</span>
            <div><small>Pilot</small><code>{pilotAddress ? compactAddress(pilotAddress) : "Not configured"}</code></div>
            <div><small>Router</small><code>{compactAddress(arbitrumV2.router)}</code></div>
            <div><small>Factory</small><code>{compactAddress(arbitrumV2.factory)}</code></div>
          </div>
          <div className="route-map" aria-hidden="true">
            <span className="route-node">USDT</span>
            <span className="route-track"><i /></span>
            <span className="route-node">{mode === "add" ? "LP" : "DAI"}</span>
          </div>
          <p>Estimates are illustrative in demo mode and are not on-chain quotes.</p>
        </aside>
      </div>
    </section>
  );
}
