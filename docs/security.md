# Security notes

LiquidityPilot is an educational, unaudited project. It is not production-ready and should
not be used with funds that cannot be lost.

## Implemented controls

- `SafeERC20` for transfers and USDT-compatible `forceApprove`
- `ReentrancyGuard` on every state-changing public entry point
- custom errors and validation before token custody
- exact approvals followed by allowance reset
- immutable router and factory; no admin or privileged withdrawals
- pair resolution through the configured factory
- user-supplied swap, liquidity, and removal minimums
- user-supplied deadlines validated before token transfer
- LP tokens pulled into the contract before router approval
- per-operation balance deltas and dust refunds
- detailed events for off-chain reconciliation

## Trust assumptions

The configured router and factory are trusted to implement compatible V2 semantics. Token
contracts must behave like ordinary ERC-20s. Users remain responsible for checking addresses,
quotes, slippage, and deadlines.

## Known limitations

- Fee-on-transfer and rebasing tokens are not supported.
- The one-sided split is approximately 50/50, not reserve-optimized.
- Token ordering and decimal normalization are handled by caller-provided amounts and quotes.
- No permit or Permit2 flow is included.
- No emergency token rescue exists because it would require privileged control. Balance-delta
  accounting prevents normal operations from sweeping unrelated accidental transfers.
- Sandwiching and adverse price movement remain possible within the user's minimum outputs.

## Review checklist

Before any real deployment, obtain an independent review, test the exact target router/factory,
set conservative slippage, verify bytecode and pair tokens, and rehearse with low-value funds.
Never describe this repository as audited.
# Frontend execution safeguards

- Deployment addresses are chain-scoped. Reviewed Arbitrum constants are used only with chain
  `42161`; local `31337` requires an entirely explicit address set.
- Invalid or partial public configuration degrades to non-submitting demo mode.
- Numeric preparation uses bigint base units. Decimal precision, positive amounts, balances,
  LP percentages, deadlines, and slippage (`0–50%`) are checked before simulation.
- Slippage minima are derived from the same live quote or reserve estimate used in the preview;
  values above 5% receive an additional warning.
- The app never requests unlimited approval. Sufficient allowance is reused, zero allowance gets
  one exact approval, and non-zero insufficient allowance is reset before exact approval.
- The persistent user-to-LiquidityPilot allowance can be reused or revoked by the user. The
  contract clears only its own router-facing approvals after each flow.
- Main operations run through `simulateContract`, require a successful mined receipt, and refresh
  balances, LP ownership, allowances, reserves, and quotes after confirmation.
- Transaction links are emitted only for Arbitrum; local confirmations are labelled local.
