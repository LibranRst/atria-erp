import type { ActionResponse } from "@atria/core/types/action-response";

type FixtureDecisionMode = "failure" | "pending";
let mode: FixtureDecisionMode = "failure";
const pendingDecisions = new Set<() => void>();
type FixtureDecisionCall = {
  readonly kind: "field" | "vendor" | "stock";
  readonly args: readonly unknown[];
};
const decisionCalls: FixtureDecisionCall[] = [];

export function approvalsFixtureDecisionCalls(): readonly FixtureDecisionCall[] {
  return [...decisionCalls];
}

function failure(): ActionResponse<never> {
  return {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Fixture visual: keputusan tidak disimpan dan backend tidak dihubungi.",
    },
  };
}

/** Resolves pending preview actions as failures; no fixture can perform a real decision. */
export function releaseApprovalsFixtureDecisions(): void {
  for (const release of pendingDecisions) release();
  pendingDecisions.clear();
}

export function setApprovalsFixtureDecisionMode(next: FixtureDecisionMode): void {
  releaseApprovalsFixtureDecisions();
  decisionCalls.length = 0;
  mode = next;
}

async function fixtureDecision(
  kind: FixtureDecisionCall["kind"],
  args: readonly unknown[],
): Promise<ActionResponse<never>> {
  decisionCalls.push({ kind, args });
  if (mode === "pending") {
    await new Promise<void>((resolve) => pendingDecisions.add(resolve));
  }
  return failure();
}

export function approveFieldRequest(...args: readonly unknown[]): Promise<ActionResponse<never>> {
  return fixtureDecision("field", args);
}
export function approveVendorPayment(...args: readonly unknown[]): Promise<ActionResponse<never>> {
  return fixtureDecision("vendor", args);
}
export function decideInventoryOpening(
  ...args: readonly unknown[]
): Promise<ActionResponse<never>> {
  return fixtureDecision("stock", args);
}
