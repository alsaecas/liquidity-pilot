"use client";

import { useMemo, useState } from "react";
import { compactAddress, estimateMinimum, formatTokenAmount } from "@/lib/format";
import { arbitrumV2, pilotAddress } from "@/lib/contract";
import { TransactionStage } from "./TransactionStage";

type Mode = "swap" | "add" | "remove";
type RemoveStyle = "pair" | "single";

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

          <TransactionStage current={demoMode ? -1 : 0} labels={stageLabels} />
          <button className="button button-action" disabled={demoMode} type="button">
            {demoMode ? "Preview only — transactions disabled" : "Approve USDT"}
          </button>
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
