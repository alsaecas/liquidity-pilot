"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { formatUnits, type Hash } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useLiveLiquidityData } from "@/hooks/useLiveLiquidityData";
import {
  applySlippage,
  deadlineFromNow,
  formatAmount,
  parseAmount,
  parseSlippageBps,
  percentageOf,
  proportionalAmount,
} from "@/lib/amounts";
import { pilotAbi } from "@/lib/contract";
import { deploymentConfig, type LiveDeployment } from "@/lib/deployment";
import { compactAddress, formatTokenAmount, parseTransactionError } from "@/lib/format";
import { runTransaction, type TransactionPhase } from "@/lib/transaction";
import { TransactionStage } from "./TransactionStage";

type Mode = "swap" | "add" | "remove";
type RemoveStyle = "pair" | "single";

const modes: { id: Mode; label: string }[] = [
  { id: "swap", label: "Swap" },
  { id: "add", label: "Add liquidity" },
  { id: "remove", label: "Remove liquidity" },
];
const stageLabels = ["Quote", "Approve", "Simulate", "Execute", "Confirmed"] as const;
const workingPhases: TransactionPhase[] = [
  "preparing_quote", "approval_required", "resetting", "approving", "waiting_approval",
  "simulating", "awaiting_wallet", "waiting_execution",
];
const phaseCopy: Record<TransactionPhase, string> = {
  idle: "Ready",
  preparing_quote: "Preparing on-chain quote",
  approval_required: "Exact approval required",
  resetting: "Resetting the existing allowance to zero",
  approving: "Requesting exact approval",
  waiting_approval: "Waiting for approval confirmation",
  simulating: "Simulating the transaction",
  awaiting_wallet: "Awaiting wallet confirmation",
  waiting_execution: "Waiting for execution confirmation",
  confirmed: "Transaction confirmed",
  failed: "Transaction failed",
  rejected: "Wallet request rejected",
};

export function PilotConsole() {
  const liveConfig = deploymentConfig.mode === "live" ? deploymentConfig : null;
  const demoReason = deploymentConfig.mode === "demo" ? deploymentConfig.reason : "";
  const demoMode = liveConfig === null;
  const [mode, setMode] = useState<Mode>("swap");
  const [amount, setAmount] = useState(demoMode ? "1000" : "");
  const [slippage, setSlippage] = useState("0.5");
  const [deadline, setDeadline] = useState("20");
  const [removeStyle, setRemoveStyle] = useState<RemoveStyle>("pair");
  const [percentage, setPercentage] = useState(50);
  const [phase, setPhase] = useState<TransactionPhase>("idle");
  const [transactionHash, setTransactionHash] = useState<Hash | null>(null);
  const [transactionError, setTransactionError] = useState("");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { address, chainId, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const correctChain = Boolean(liveConfig && chainId === liveConfig.chainId);
  const debouncedAmount = useDebouncedValue(amount);
  const amountIn = liveConfig ? parseAmount(debouncedAmount, liveConfig.tokenA.decimals) : null;
  const quoteInput = mode === "add" && amountIn ? amountIn / 2n : mode === "swap" ? amountIn : null;
  const data = useLiveLiquidityData(liveConfig, address, correctChain, quoteInput);
  const lpToRemove = data.lpBalance === undefined ? null : percentageOf(data.lpBalance, percentage);
  const slippageBps = parseSlippageBps(slippage);
  const deadlineMinutes = Number(deadline);

  const removal = useMemo(() => {
    if (!liveConfig || !data.reserves || !data.totalSupply || !data.token0 || !lpToRemove) return null;
    const tokenAIs0 = data.token0.toLowerCase() === liveConfig.tokenA.address.toLowerCase();
    const reserveA = tokenAIs0 ? data.reserves[0] : data.reserves[1];
    const reserveB = tokenAIs0 ? data.reserves[1] : data.reserves[0];
    return {
      amountA: proportionalAmount(reserveA, lpToRemove, data.totalSupply),
      amountB: proportionalAmount(reserveB, lpToRemove, data.totalSupply),
    };
  }, [data.reserves, data.token0, data.totalSupply, liveConfig, lpToRemove]);

  const singleQuote = useReadContract({
    chainId: liveConfig?.chainId,
    address: liveConfig?.pilot,
    abi: pilotAbi,
    functionName: "quoteSwap",
    args: liveConfig && removal?.amountA
      ? [removal.amountA, [liveConfig.tokenA.address, liveConfig.tokenB.address]]
      : undefined,
    query: { enabled: correctChain && removeStyle === "single" && Boolean(removal?.amountA) },
  });

  function resetTransaction() {
    setPhase("idle");
    setTransactionHash(null);
    setTransactionError("");
  }

  const quoteOutput = data.quote?.at(-1);
  const singleSwapOutput = singleQuote.data?.at(-1);
  const demoEstimate = useMemo(() => {
    const input = Number.parseFloat(amount) || 0;
    return { output: input * 0.9987, kept: input / 2, paired: input * 0.4992 };
  }, [amount]);
  const validation = getValidation({
    liveConfig, isConnected, correctChain, mode, amountIn, balance: data.tokenABalance,
    percentage, lpBalance: data.lpBalance, lpToRemove, pairMissing: data.pairMissing,
    quoteOutput, removal, singleSwapOutput, removeStyle, slippageBps, deadlineMinutes,
    gasBalance: data.gasBalance,
  });
  const isWorking = workingPhases.includes(phase);
  const disabledReason = demoMode
    ? "Preview only — transactions disabled"
    : validation ?? (isWorking ? phaseCopy[phase] : null);
  const stageIndex = phase === "confirmed" ? 4
    : ["awaiting_wallet", "waiting_execution"].includes(phase) ? 3
      : phase === "simulating" ? 2
        : ["approval_required", "resetting", "approving", "waiting_approval"].includes(phase) ? 1
          : quoteOutput || removal ? 0 : -1;

  function selectMode(next: Mode) {
    resetTransaction();
    setMode(next);
    tabRefs.current[modes.findIndex((item) => item.id === next)]?.focus();
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? modes.length - 1
      : (index + (event.key === "ArrowRight" ? 1 : -1) + modes.length) % modes.length;
    selectMode(modes[nextIndex].id);
  }

  async function executeFlow() {
    if (!liveConfig || !address || !correctChain || validation || slippageBps === null) return;
    setTransactionError("");
    setTransactionHash(null);
    setPhase("preparing_quote");
    try {
      const deadlineValue = deadlineFromNow(deadlineMinutes);
      const path = [liveConfig.tokenA.address, liveConfig.tokenB.address] as const;
      let token = liveConfig.tokenA.address;
      let required = amountIn!;
      let allowance = data.tokenAAllowance;
      let mainRequest: Record<string, unknown>;

      if (mode === "swap") {
        mainRequest = {
          account: address, chainId: liveConfig.chainId, address: liveConfig.pilot, abi: pilotAbi,
          functionName: "swapExactTokens",
          args: [amountIn!, applySlippage(quoteOutput!, slippageBps), path, address, deadlineValue],
        };
      } else if (mode === "add") {
        const swapAmount = amountIn! / 2n;
        mainRequest = {
          account: address, chainId: liveConfig.chainId, address: liveConfig.pilot, abi: pilotAbi,
          functionName: "zapIn",
          args: [{
            tokenA: path[0], tokenB: path[1], inputToken: path[0], amountIn: amountIn!,
            minSwapOut: applySlippage(quoteOutput!, slippageBps),
            minAmountA: applySlippage(amountIn! - swapAmount, slippageBps),
            minAmountB: applySlippage(quoteOutput!, slippageBps),
            minLiquidity: 0n, recipient: address, deadline: deadlineValue,
          }],
        };
      } else {
        token = data.pairAddress!;
        required = lpToRemove!;
        allowance = data.lpAllowance;
        const base = {
          tokenA: path[0], tokenB: path[1], liquidity: lpToRemove!,
          minAmountA: applySlippage(removal!.amountA, slippageBps),
          minAmountB: applySlippage(removal!.amountB, slippageBps),
          recipient: address, deadline: deadlineValue,
        };
        mainRequest = {
          account: address, chainId: liveConfig.chainId, address: liveConfig.pilot, abi: pilotAbi,
          functionName: removeStyle === "pair" ? "removeLiquidity" : "zapOutToSingleToken",
          args: [removeStyle === "pair" ? base : {
            ...base, outputToken: path[1],
            minSwapOut: applySlippage(singleSwapOutput!, slippageBps),
          }],
        };
      }
      const hash = await runTransaction({
        client: (await import("@/lib/wagmi")).wagmiConfig.getClient({ chainId: liveConfig.chainId }) as never,
        write: writeContractAsync as never,
        token, pilot: liveConfig.pilot, allowance, required, mainRequest,
        onPhase: setPhase,
        refresh: async () => {
          await Promise.all([data.refresh(), singleQuote.refetch()]);
        },
      });
      setTransactionHash(hash);
    } catch (error) {
      setTransactionError(parseTransactionError(error));
    }
  }

  return (
    <section aria-labelledby="console-heading" className="console-shell" id="app">
      <div className="console-heading">
        <div><span className="eyebrow">Transaction console</span><h2 id="console-heading">Plot your position</h2></div>
        <span className={demoMode ? "mode-badge mode-demo" : "mode-badge mode-live"}>
          <span className="status-dot" />{demoMode ? "Demo mode" : `${liveConfig.chainName} configured`}
        </span>
      </div>

      {(demoMode || (!correctChain && isConnected)) && (
        <div className="demo-notice" role="status">
          {demoMode
            ? `${demoReason} Sample estimates are labelled; transaction submission is disabled.`
            : `Wrong network. Switch your wallet to ${liveConfig.chainName} (${liveConfig.chainId}).`}
        </div>
      )}

      <div aria-label="Liquidity mode" className="mode-tabs" role="tablist">
        {modes.map((item, index) => (
          <button
            aria-controls={`panel-${item.id}`} aria-selected={mode === item.id}
            className={mode === item.id ? "mode-tab mode-tab-active" : "mode-tab"}
            id={`tab-${item.id}`} key={item.id} onClick={() => selectMode(item.id)}
            onKeyDown={(event) => handleTabKey(event, index)}
            ref={(element) => { tabRefs.current[index] = element; }}
            role="tab" tabIndex={mode === item.id ? 0 : -1} type="button"
          >{item.label}</button>
        ))}
      </div>

      <div aria-labelledby={`tab-${mode}`} className="console-grid" id={`panel-${mode}`} role="tabpanel">
        <div className="console-form">
          {mode === "remove" ? (
            <>
              <fieldset className="segmented-field">
                <legend>Exit route</legend>
                <button aria-pressed={removeStyle === "pair"} className={removeStyle === "pair" ? "selected" : ""} onClick={() => { resetTransaction(); setRemoveStyle("pair"); }} type="button">USDT + DAI</button>
                <button aria-pressed={removeStyle === "single"} className={removeStyle === "single" ? "selected" : ""} onClick={() => { resetTransaction(); setRemoveStyle("single"); }} type="button">DAI only</button>
              </fieldset>
              <label className="amount-field">
                <span>LP position</span>
                <span className="balance">
                  {demoMode ? "Sample balance 128.42 LP" : data.pairLoading ? "Discovering pair…" : data.pairMissing ? "Pair unavailable" : `Balance ${formatAmount(data.lpBalance, data.lpDecimals)} LP`}
                </span>
                <div><input aria-label="LP percentage" max="100" min="0" onChange={(event) => { resetTransaction(); setPercentage(Number(event.target.value)); }} type="range" value={percentage} /><strong>{percentage}%</strong></div>
              </label>
              <div className="percentage-row">
                {[25, 50, 75, 100].map((value) => <button key={value} onClick={() => { resetTransaction(); setPercentage(value); }} type="button">{value === 100 ? "Max" : `${value}%`}</button>)}
              </div>
            </>
          ) : (
            <label className="amount-field">
              <span>{mode === "swap" ? "You send" : "One-token input"}</span>
              <span className="balance">
                {demoMode ? "Sample input" : `Balance ${formatAmount(data.tokenABalance, liveConfig.tokenA.decimals)} USDT`}
                {!demoMode && data.tokenABalance !== undefined && <button className="max-button" onClick={() => { resetTransaction(); setAmount(formatUnits(data.tokenABalance!, liveConfig.tokenA.decimals)); }} type="button">Max</button>}
              </span>
              <div>
                <input aria-label="USDT amount" inputMode="decimal" onChange={(event) => { resetTransaction(); setAmount(event.target.value); }} placeholder="0.00" type="text" value={amount} />
                <span className="token-pill"><span className="token-icon token-usdt">₮</span>USDT</span>
              </div>
            </label>
          )}

          {mode === "swap" && (
            <div className="output-field">
              <span>You receive</span>
              <strong>{demoMode ? formatTokenAmount(demoEstimate.output) : data.quoteLoading ? "Quoting…" : data.quoteError ? "Quote unavailable" : formatAmount(quoteOutput, liveConfig.tokenB.decimals)}</strong>
              <span className="token-label"><i className="token-icon token-dai">◈</i> DAI</span>
            </div>
          )}
          {mode === "add" && (
            <div className="route-visual" aria-label="One-sided liquidity route">
              <div><span>Retain</span><strong>{demoMode ? formatTokenAmount(demoEstimate.kept) : formatAmount(amountIn ? amountIn - amountIn / 2n : undefined, liveConfig.tokenA.decimals)} USDT</strong></div>
              <span className="route-line">+</span>
              <div><span>Pair via quote</span><strong>≈ {demoMode ? formatTokenAmount(demoEstimate.paired) : formatAmount(quoteOutput, liveConfig.tokenB.decimals)} DAI</strong></div>
              <span className="route-line">→</span>
              <div><span>Mint</span><strong>LP calculated during execution</strong></div>
            </div>
          )}

          <div className="settings-row">
            <label>Slippage<span><input aria-describedby="slippage-help" inputMode="decimal" onChange={(event) => { resetTransaction(); setSlippage(event.target.value); }} type="text" value={slippage} />%</span></label>
            <label>Deadline<span><input aria-label="Deadline in minutes" min="1" onChange={(event) => { resetTransaction(); setDeadline(event.target.value); }} type="number" value={deadline} />min</span></label>
          </div>
          <p className={slippageBps !== null && slippageBps > 500n ? "field-warning" : "field-help"} id="slippage-help">
            {slippageBps === null ? "Enter 0–50%." : slippageBps > 500n ? "High slippage: more than 5% can materially worsen execution." : "Applied consistently to every quoted minimum."}
          </p>

          <TransactionStage current={stageIndex} labels={stageLabels} />
          <p aria-atomic="true" aria-live="polite" className="sr-status">{phaseCopy[phase]}</p>
          <button aria-describedby="action-reason" className="button button-action" disabled={Boolean(disabledReason)} onClick={executeFlow} type="button">
            {isWorking ? phaseCopy[phase] : phase === "confirmed" ? "Run another transaction" : `Continue to ${mode === "swap" ? "swap" : mode === "add" ? "add liquidity" : "remove liquidity"}`}
          </button>
          <p className="action-note" id="action-reason">{disabledReason ?? "Quote ready. The wallet will approve only the exact required amount."}</p>
          {transactionError && <p className="transaction-error" role="alert">{transactionError}</p>}
          {transactionHash && liveConfig?.chainId === 42161 && <a aria-label="View confirmed transaction on Arbiscan (opens in a new tab)" className="transaction-link" href={`https://arbiscan.io/tx/${transactionHash}`} rel="noreferrer" target="_blank">View confirmed transaction on Arbiscan ↗</a>}
          {transactionHash && liveConfig?.chainId === 31337 && <p className="transaction-link">Confirmed on local Anvil · {compactAddress(transactionHash)}</p>}
          <p className="approval-note">The user → LiquidityPilot allowance remains reusable and can be revoked in the wallet. LiquidityPilot clears only its router-facing allowance after each operation.</p>
        </div>

        <aside className="flight-plan">
          <span className="eyebrow">Expected outcome</span>
          <dl>
            {mode === "swap" && <>
              <div><dt>Expected output</dt><dd>{demoMode ? `≈ ${formatTokenAmount(demoEstimate.output)} DAI` : `${formatAmount(quoteOutput, liveConfig.tokenB.decimals)} DAI`}</dd></div>
              <div><dt>Minimum received</dt><dd>{demoMode ? "Sample only" : slippageBps === null || !quoteOutput ? "—" : `${formatAmount(applySlippage(quoteOutput, slippageBps), liveConfig.tokenB.decimals)} DAI`}</dd></div>
              <div><dt>Route</dt><dd>USDT → DAI</dd></div>
            </>}
            {mode === "add" && <>
              <div><dt>Pool</dt><dd>USDT / DAI</dd></div>
              <div><dt>Swap portion</dt><dd>50%</dd></div>
              <div><dt>Paired output</dt><dd>{demoMode ? "Sample quote" : `${formatAmount(quoteOutput, liveConfig.tokenB.decimals)} DAI`}</dd></div>
              <div><dt>LP output</dt><dd>Calculated during execution</dd></div>
            </>}
            {mode === "remove" && <>
              <div><dt>LP to remove</dt><dd>{demoMode ? `${formatTokenAmount(128.42 * percentage / 100)} LP sample` : `${formatAmount(lpToRemove ?? undefined, data.lpDecimals)} LP`}</dd></div>
              <div><dt>Estimated USDT</dt><dd>{demoMode ? "Sample only" : `${formatAmount(removal?.amountA, liveConfig.tokenA.decimals)} USDT`}</dd></div>
              <div><dt>Estimated DAI</dt><dd>{demoMode ? "Sample only" : `${formatAmount(removal?.amountB, liveConfig.tokenB.decimals)} DAI`}</dd></div>
              {removeStyle === "single" && <div><dt>Combined DAI</dt><dd>{!removal || !singleSwapOutput || demoMode ? "—" : `≈ ${formatAmount(removal.amountB + singleSwapOutput, liveConfig.tokenB.decimals)} DAI`}</dd></div>}
              {removeStyle === "single" && <div><dt>Minimum combined</dt><dd>{!removal || !singleSwapOutput || demoMode || slippageBps === null ? "—" : `${formatAmount(applySlippage(removal.amountB, slippageBps) + applySlippage(singleSwapOutput, slippageBps), liveConfig.tokenB.decimals)} DAI`}</dd></div>}
            </>}
          </dl>
          <div className="config-panel">
            <span>Deployment configuration</span>
            <div><small>Network</small><code>{liveConfig ? `${liveConfig.chainName} · ${liveConfig.chainId}` : "Demo only"}</code></div>
            <div><small>Pilot</small><code>{liveConfig ? compactAddress(liveConfig.pilot) : "Not configured"}</code></div>
            <div><small>Pair</small><code>{data.pairAddress ? compactAddress(data.pairAddress) : demoMode ? "Demo only" : "Discovering…"}</code></div>
            {!demoMode && <div><small>USDT balance</small><code>{formatAmount(data.tokenABalance, liveConfig.tokenA.decimals)}</code></div>}
            {!demoMode && <div><small>DAI balance</small><code>{formatAmount(data.tokenBBalance, liveConfig.tokenB.decimals)}</code></div>}
            {!demoMode && <div><small>Pilot allowance</small><code>{formatAmount(mode === "remove" ? data.lpAllowance : data.tokenAAllowance, mode === "remove" ? data.lpDecimals : liveConfig.tokenA.decimals)}</code></div>}
          </div>
          <div className="route-map" aria-hidden="true"><span className="route-node">USDT</span><span className="route-track"><i /></span><span className="route-node">{mode === "add" ? "LP" : "DAI"}</span></div>
          <p>{demoMode ? "Every numeric estimate shown here is illustrative sample data." : "Quotes, balances, reserves, LP ownership, and allowances are read from the configured chain."}</p>
        </aside>
      </div>
    </section>
  );
}

interface ValidationInput {
  liveConfig: LiveDeployment | null;
  isConnected: boolean;
  correctChain: boolean;
  mode: Mode;
  amountIn: bigint | null;
  balance: bigint | undefined;
  percentage: number;
  lpBalance: bigint | undefined;
  lpToRemove: bigint | null;
  pairMissing: boolean;
  quoteOutput: bigint | undefined;
  removal: { amountA: bigint; amountB: bigint } | null;
  singleSwapOutput: bigint | undefined;
  removeStyle: RemoveStyle;
  slippageBps: bigint | null;
  deadlineMinutes: number;
  gasBalance: bigint | undefined;
}

export function getValidation(input: ValidationInput): string | null {
  if (!input.liveConfig) return "Demo mode cannot submit transactions.";
  if (!input.isConnected) return "Connect a wallet to continue.";
  if (!input.correctChain) return `Switch to ${input.liveConfig.chainName} (${input.liveConfig.chainId}).`;
  if (input.slippageBps === null) return "Slippage must be between 0% and 50%.";
  if (!Number.isInteger(input.deadlineMinutes) || input.deadlineMinutes < 1 || input.deadlineMinutes > 1_440) return "Deadline must be 1–1440 minutes.";
  if (input.gasBalance === 0n) return "The wallet has no native token available for gas.";
  if (input.pairMissing) return "The configured token pair does not exist.";
  if (input.mode === "remove") {
    if (!input.percentage || !input.lpBalance || !input.lpToRemove) return "Choose a non-zero percentage of an available LP balance.";
    if (!input.removal || input.removal.amountA === 0n || input.removal.amountB === 0n) return "Pool reserves are unavailable for this removal.";
    if (input.removeStyle === "single" && !input.singleSwapOutput) return "A live single-exit quote is required.";
    return null;
  }
  if (!input.amountIn) return "Enter a positive amount with no more than the token’s supported decimals.";
  if (input.balance !== undefined && input.amountIn > input.balance) return "Amount exceeds the connected wallet balance.";
  if (!input.quoteOutput) return "A successful live quote is required before execution.";
  return null;
}
