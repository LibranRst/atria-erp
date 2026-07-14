import { describe, expect, test } from "bun:test";

import { assertRabRevisionCanBeVoided, getNextRabRevision, isOpenChangeOrderStatus, selectApprovedRabEstimate, selectCurrentRabEstimate } from "./rab-selection";

const estimates = [
  { id: "r1", status: "APPROVED", revision: 1 },
  { id: "r2", status: "VOID", revision: 2 },
  { id: "r3", status: "DRAFT", revision: 3 },
] as const;

describe("RAB selection", () => {
  test("prefers an active draft over the approved baseline", () => {
    expect(selectCurrentRabEstimate(estimates)?.id).toBe("r3");
  });

  test("returns the approved baseline when the latest revision is void", () => {
    expect(selectCurrentRabEstimate(estimates.slice(0, 2))?.id).toBe("r1");
  });

  test("selects the approved baseline independently from the active revision", () => {
    expect(selectApprovedRabEstimate(estimates)?.id).toBe("r1");
  });

  test("never presents a lone void revision as current", () => {
    expect(selectCurrentRabEstimate([{ id: "r2", status: "VOID", revision: 2 }])).toBeNull();
  });

  test("does not reuse a voided revision number", () => {
    expect(getNextRabRevision(estimates.slice(0, 2))).toBe(3);
  });

  test("allows cancellation only for a draft revision", () => {
    expect(() => assertRabRevisionCanBeVoided({ status: "DRAFT", supersedesRabEstimateId: "r1" })).not.toThrow();
    expect(() => assertRabRevisionCanBeVoided({ status: "DRAFT", supersedesRabEstimateId: null })).toThrow();
    expect(() => assertRabRevisionCanBeVoided({ status: "APPROVED", supersedesRabEstimateId: "r1" })).toThrow();
    expect(() => assertRabRevisionCanBeVoided({ status: "VOID", supersedesRabEstimateId: "r1" })).toThrow();
  });

  test("treats cancelled Change Orders as closed", () => {
    expect(isOpenChangeOrderStatus("PENDING_APPROVAL")).toBeTrue();
    expect(isOpenChangeOrderStatus("CANCELLED")).toBeFalse();
    expect(isOpenChangeOrderStatus("APPROVED")).toBeFalse();
  });
});
