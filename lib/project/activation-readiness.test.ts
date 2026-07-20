import { describe, expect, test } from "bun:test";

import { getProjectActivationReadiness } from "./activation-readiness";

describe("project activation readiness", () => {
  test("requires an approved budget, approved RAB, and its locked RAP baseline", () => {
    const readiness = getProjectActivationReadiness({
      projectStatus: "DRAFT",
      budgetStatus: "APPROVED",
      raps: [{ id: "rap-1", status: "LOCKED" }],
      rabEstimates: [
        {
          status: "APPROVED",
          sourceProjectRapId: "rap-1",
        },
      ],
    });

    expect(readiness.isReady).toBe(true);
    expect(readiness.rapLocked).toBe(true);
  });

  test("does not offer activation when an approved RAB is not tied to a locked RAP", () => {
    const readiness = getProjectActivationReadiness({
      projectStatus: "DRAFT",
      budgetStatus: "APPROVED",
      raps: [{ id: "rap-1", status: "DRAFT" }],
      rabEstimates: [
        {
          status: "APPROVED",
          sourceProjectRapId: "rap-1",
        },
      ],
    });

    expect(readiness.isReady).toBe(false);
    expect(readiness.rapLocked).toBe(false);
  });
});
