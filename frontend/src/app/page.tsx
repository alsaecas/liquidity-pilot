import { PilotConsole } from "@/components/PilotConsole";
import { ProjectMark } from "@/components/ProjectMark";
import { WalletButton } from "@/components/WalletButton";

const lessons = [
  ["01", "Route", "Validate paths and quote before moving funds."],
  ["02", "Execute", "Approve exact amounts and enforce deadlines."],
  ["03", "Settle", "Deliver LP or output directly; refund every remainder."],
] as const;

export default function Home() {
  return (
    <main>
      <nav className="site-nav" aria-label="Main navigation">
        <a className="brand" href="#">
          <ProjectMark />
          <span>Liquidity<strong>Pilot</strong></span>
        </a>
        <div className="nav-links">
          <a href="#app">App</a>
          <a href="#architecture">Architecture</a>
          <a href="#learned">What I learned</a>
        </div>
        <WalletButton />
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><i /> Built for Arbitrum · V2 compatible</span>
          <h1>Liquidity,<br /><em>on your heading.</em></h1>
          <p>
            Swap, enter a pool from one token, or exit to the asset you choose.
            One focused contract keeps custody measured in blocks—not sessions.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#app">Open console <span>↗</span></a>
            <a className="text-link" href="#architecture">Inspect the system <span>↓</span></a>
          </div>
          <div className="hero-proof">
            <span><strong>01</strong> Exact approvals</span>
            <span><strong>02</strong> Dust refunds</span>
            <span><strong>03</strong> User-owned LP</span>
          </div>
        </div>
        <div className="hero-instrument" aria-hidden="true">
          <div className="orbital orbital-one" />
          <div className="orbital orbital-two" />
          <div className="radar-line" />
          <div className="instrument-core"><ProjectMark size={72} /></div>
          <span className="instrument-label label-a">INPUT / USDT</span>
          <span className="instrument-label label-b">PAIR / DAI</span>
          <span className="instrument-label label-c">LP / USER</span>
          <span className="coordinate">ARB · 42161<br />V2 ROUTE READY</span>
        </div>
      </section>

      <PilotConsole />

      <section className="how-section" id="architecture">
        <div className="section-heading">
          <span className="eyebrow">How it works</span>
          <h2>A short route. Clear controls.</h2>
          <p>Every flow is explicit about custody, acceptable output, and final recipient.</p>
        </div>
        <div className="lesson-grid">
          {lessons.map(([number, title, copy]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <div className="architecture-strip">
          <div><small>Wallet</small><strong>Exact input</strong></div>
          <i>→</i>
          <div><small>LiquidityPilot</small><strong>Validate + route</strong></div>
          <i>→</i>
          <div><small>V2 router</small><strong>Swap + liquidity</strong></div>
          <i>→</i>
          <div><small>Wallet</small><strong>Output + refund</strong></div>
        </div>
      </section>

      <section className="learned-section" id="learned">
        <div>
          <span className="eyebrow">What I learned</span>
          <h2>The LP token is part of the flow—not an afterthought.</h2>
        </div>
        <p>
          Removing liquidity only works when the contract actually owns the LP tokens it asks
          the router to spend. LiquidityPilot pulls the exact LP amount, grants a narrow approval,
          settles the underlying assets, and clears the allowance.
        </p>
        <div className="code-card">
          <span>{"// removal lifecycle"}</span>
          <code>pair.safeTransferFrom(user, pilot, liquidity);</code>
          <code>pair.forceApprove(router, liquidity);</code>
          <code>router.removeLiquidity(...);</code>
          <code>pair.forceApprove(router, 0);</code>
        </div>
      </section>

      <section className="risk-section">
        <ProjectMark size={30} />
        <div>
          <strong>Navigate with the instruments on.</strong>
          <p>Slippage, token approvals, smart-contract bugs, and volatile pools can cause loss. This educational project is not audited and is not financial advice.</p>
        </div>
      </section>

      <footer>
        <a className="brand" href="#"><ProjectMark size={28} /><span>Liquidity<strong>Pilot</strong></span></a>
        <span>Original Module 11 portfolio project · MIT</span>
        <a href="https://github.com/alsaecas/liquidity-pilot">Source ↗</a>
      </footer>
    </main>
  );
}
