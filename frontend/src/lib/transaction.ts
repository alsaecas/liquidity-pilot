import type { Address, Hash } from "viem";
import { erc20Abi } from "@/lib/contract";

export type TransactionPhase =
  | "idle"
  | "preparing_quote"
  | "approval_required"
  | "resetting"
  | "approving"
  | "waiting_approval"
  | "simulating"
  | "awaiting_wallet"
  | "waiting_execution"
  | "confirmed"
  | "failed"
  | "rejected";

export type ApprovalPlan = "skip" | "approve" | "reset_then_approve";

export function approvalPlan(allowance: bigint, required: bigint): ApprovalPlan {
  if (allowance >= required) return "skip";
  return allowance === 0n ? "approve" : "reset_then_approve";
}

interface Client {
  simulateContract: (request: never) => Promise<{ request: unknown }>;
  waitForTransactionReceipt: (request: { hash: Hash }) => Promise<{ status: "success" | "reverted" }>;
}

interface RunTransactionOptions {
  client: Client;
  write: (request: never) => Promise<Hash>;
  token: Address;
  pilot: Address;
  allowance: bigint;
  required: bigint;
  mainRequest: Record<string, unknown>;
  onPhase: (phase: TransactionPhase) => void;
  refresh: () => Promise<void> | void;
}

function isRejected(error: unknown): boolean {
  return error instanceof Error && /reject|denied|4001/i.test(error.message);
}

export async function runTransaction(options: RunTransactionOptions): Promise<Hash> {
  const { client, write, token, pilot, allowance, required, mainRequest, onPhase, refresh } = options;
  try {
    const plan = approvalPlan(allowance, required);
    if (plan !== "skip") {
      onPhase("approval_required");
      if (plan === "reset_then_approve") {
        onPhase("resetting");
        const resetHash = await write({ address: token, abi: erc20Abi, functionName: "approve", args: [pilot, 0n] } as never);
        onPhase("waiting_approval");
        const resetReceipt = await client.waitForTransactionReceipt({ hash: resetHash });
        if (resetReceipt.status !== "success") throw new Error("Allowance reset reverted.");
      }
      onPhase("approving");
      const approvalHash = await write({
        address: token,
        abi: erc20Abi,
        functionName: "approve",
        args: [pilot, required],
      } as never);
      onPhase("waiting_approval");
      const approvalReceipt = await client.waitForTransactionReceipt({ hash: approvalHash });
      if (approvalReceipt.status !== "success") throw new Error("Approval reverted.");
    }

    onPhase("simulating");
    const simulation = await client.simulateContract(mainRequest as never);
    onPhase("awaiting_wallet");
    const hash = await write(simulation.request as never);
    onPhase("waiting_execution");
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Execution reverted.");
    await refresh();
    onPhase("confirmed");
    return hash;
  } catch (error) {
    onPhase(isRejected(error) ? "rejected" : "failed");
    throw error;
  }
}
