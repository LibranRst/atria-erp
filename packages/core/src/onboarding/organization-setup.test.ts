import { describe, expect, test } from "bun:test";

import { DEFAULT_OWNER_ONBOARDING_STATE } from "./owner-onboarding";
import {
  getQuickStartProgress,
  mapLegacyOwnerOnboardingState,
  ownerQuickStartStateSchema,
  resolveQuickStartActiveStep,
} from "./organization-setup";

describe("organization setup v2", () => {
  test("maps completed v1 without forcing quick start again", () => {
    const mapped = mapLegacyOwnerOnboardingState(
      {
        ...DEFAULT_OWNER_ONBOARDING_STATE,
        status: "COMPLETED",
        currentStep: "summary",
        completedAt: "2026-08-01T00:00:00.000Z",
      },
      { financeDefaultsReady: true, hasProject: false, now: "2026-08-31T00:00:00.000Z" },
    );

    expect(mapped.status).toBe("COMPLETED");
    expect(mapped.currentStep).toBe("success");
    expect(mapped.completedAt).toBe("2026-08-01T00:00:00.000Z");
    expect(ownerQuickStartStateSchema.safeParse(mapped).success).toBe(true);
  });

  test("maps an incomplete reviewed legacy install to the first project", () => {
    const mapped = mapLegacyOwnerOnboardingState(
      {
        ...DEFAULT_OWNER_ONBOARDING_STATE,
        currentStep: "bank_accounts",
        reviewedSteps: ["welcome", "financial_defaults"],
      },
      { financeDefaultsReady: true, hasProject: false, now: "2026-08-31T00:00:00.000Z" },
    );

    expect(mapped.status).toBe("IN_PROGRESS");
    expect(mapped.currentStep).toBe("first_project");
    expect(mapped.reviewedSteps).toEqual(["welcome", "financial_defaults"]);
  });

  test("treats an existing project as completed compatibility evidence", () => {
    const mapped = mapLegacyOwnerOnboardingState(null, {
      financeDefaultsReady: true,
      hasProject: true,
      firstProjectId: "11111111-1111-4111-8111-111111111111",
      now: "2026-08-31T00:00:00.000Z",
    });

    expect(mapped.status).toBe("COMPLETED");
    expect(mapped.firstProjectId).toBe("11111111-1111-4111-8111-111111111111");
  });

  test("journey progress counts only the two quick-start work stages", () => {
    expect(getQuickStartProgress("welcome")).toEqual({
      current: 0,
      total: 2,
      percentage: 0,
      label: "2 tahap",
    });
    expect(getQuickStartProgress("financial_defaults").percentage).toBe(50);
    expect(getQuickStartProgress("first_project").percentage).toBe(100);
    expect(getQuickStartProgress("success").label).toBe("Quick start selesai");
  });

  test("keeps stale reviewed URLs on the persisted current step", () => {
    const state = {
      ...mapLegacyOwnerOnboardingState(DEFAULT_OWNER_ONBOARDING_STATE, {
        financeDefaultsReady: true,
        hasProject: false,
        now: "2026-08-31T00:00:00.000Z",
      }),
      currentStep: "first_project" as const,
      reviewedSteps: ["welcome", "financial_defaults"] as const,
    };

    expect(resolveQuickStartActiveStep(state, "financial_defaults")).toBe("first_project");
    expect(resolveQuickStartActiveStep(state, "first_project")).toBe("first_project");
  });
});
