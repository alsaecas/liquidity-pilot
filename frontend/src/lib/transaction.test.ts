import { describe, expect, it, vi } from "vitest";
import { approvalPlan, runTransaction, type TransactionPhase } from "./transaction";

const address = "0x1111111111111111111111111111111111111111";
const hashes = [
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
] as const;

function fixture(allowance = 0n) {
  const phases: TransactionPhase[] = [];
  const write = vi.fn()
    .mockResolvedValueOnce(hashes[0])
    .mockResolvedValueOnce(hashes[1])
    .mockResolvedValueOnce(hashes[2]);
  const client = {
    simulateContract: vi.fn().mockResolvedValue({ request: { functionName: "main" } }),
    waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success" }),
  };
  const refresh = vi.fn();
  return {
    phases, write, client, refresh,
    run: () => runTransaction({
      client: client as never, write: write as never, token: address, pilot: address,
      allowance, required: 100n, mainRequest: { functionName: "main" },
      onPhase: (phase) => phases.push(phase), refresh,
    }),
  };
}

describe("exact approval and transaction runner", () => {
  it("skips approval when allowance is sufficient", async () => {
    const test = fixture(100n);
    await test.run();
    expect(approvalPlan(100n, 100n)).toBe("skip");
    expect(test.write).toHaveBeenCalledTimes(1);
    expect(test.client.simulateContract).toHaveBeenCalledBefore(test.write);
  });

  it("approves exactly the required amount when allowance is zero", async () => {
    const test = fixture(0n);
    await test.run();
    expect(test.write.mock.calls[0][0].args).toEqual([address, 100n]);
    expect(test.write).toHaveBeenCalledTimes(2);
  });

  it("resets a non-zero insufficient allowance before exact approval", async () => {
    const test = fixture(1n);
    await test.run();
    expect(test.write.mock.calls[0][0].args).toEqual([address, 0n]);
    expect(test.write.mock.calls[1][0].args).toEqual([address, 100n]);
    expect(test.phases).toContain("resetting");
  });

  it("classifies rejected wallets and failed simulations without submitting", async () => {
    const rejected = fixture(100n);
    rejected.client.simulateContract.mockRejectedValue(new Error("User rejected request"));
    await expect(rejected.run()).rejects.toThrow("rejected");
    expect(rejected.phases.at(-1)).toBe("rejected");
    expect(rejected.write).not.toHaveBeenCalled();

    const failed = fixture(100n);
    failed.client.simulateContract.mockRejectedValue(new Error("execution reverted"));
    await expect(failed.run()).rejects.toThrow("reverted");
    expect(failed.phases.at(-1)).toBe("failed");
    expect(failed.write).not.toHaveBeenCalled();
  });

  it("requires a successful receipt then refreshes live queries", async () => {
    const test = fixture(100n);
    await expect(test.run()).resolves.toBe(hashes[0]);
    expect(test.refresh).toHaveBeenCalledOnce();
    expect(test.phases.at(-1)).toBe("confirmed");
  });
});
