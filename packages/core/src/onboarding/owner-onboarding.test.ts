import { describe, expect, test } from "bun:test";

import {
  DEFAULT_OWNER_ONBOARDING_STATE,
  deriveOwnerOnboardingGates,
  getOwnerOnboardingProgress,
  nextOnboardingStep,
  parseOwnerOnboardingState,
  shouldRedirectToOwnerOnboarding,
} from "./owner-onboarding";

describe("owner onboarding state", () => {
  test("parses the versioned state", () => {
    expect(parseOwnerOnboardingState(JSON.stringify(DEFAULT_OWNER_ONBOARDING_STATE))).toEqual(
      DEFAULT_OWNER_ONBOARDING_STATE,
    );
  });

  test("blocks every hard requirement but keeps vendor and library optional", () => {
    const gates = deriveOwnerOnboardingGates({
      financeDefaultsReady: false,
      teamReady: false,
      bankReady: false,
      materialFoundationReady: false,
      postedInitialStockBatches: 0,
      pendingInitialStockBatches: 0,
      rejectedInitialStockBatches: 0,
      noLegacyStockConfirmed: false,
      vendorReady: false,
      itemLibraryReady: false,
      initialStockSkipped: true,
    });
    expect(gates.canComplete).toBe(false);
    expect(gates.blockers.map((row) => row.stepId)).toEqual([
      "financial_defaults",
      "team_vendors",
      "bank_accounts",
      "material_foundation",
      "initial_stock",
    ]);
    expect(gates.warnings.map((row) => row.stepId)).toEqual(["team_vendors", "item_library"]);
  });

  test("allows completion with posted stock or explicit no-stock decision", () => {
    const base = {
      financeDefaultsReady: true,
      teamReady: true,
      bankReady: true,
      materialFoundationReady: true,
      pendingInitialStockBatches: 0,
      rejectedInitialStockBatches: 0,
      vendorReady: false,
      itemLibraryReady: false,
      initialStockSkipped: false,
    } as const;
    expect(
      deriveOwnerOnboardingGates({
        ...base,
        postedInitialStockBatches: 1,
        noLegacyStockConfirmed: false,
      }).canComplete,
    ).toBe(true);
    expect(
      deriveOwnerOnboardingGates({
        ...base,
        postedInitialStockBatches: 0,
        noLegacyStockConfirmed: true,
      }).canComplete,
    ).toBe(true);
  });

  test("pending approval remains a hard blocker even with an older posted batch", () => {
    const gates = deriveOwnerOnboardingGates({
      financeDefaultsReady: true,
      teamReady: true,
      bankReady: true,
      materialFoundationReady: true,
      postedInitialStockBatches: 1,
      pendingInitialStockBatches: 1,
      rejectedInitialStockBatches: 0,
      noLegacyStockConfirmed: false,
      vendorReady: true,
      itemLibraryReady: true,
      initialStockSkipped: false,
    });
    expect(gates.canComplete).toBe(false);
    expect(gates.blockers).toHaveLength(1);
  });

  test("rejects malformed and future state", () => {
    expect(parseOwnerOnboardingState("not-json")).toBeNull();
    expect(
      parseOwnerOnboardingState(JSON.stringify({ ...DEFAULT_OWNER_ONBOARDING_STATE, version: 2 })),
    ).toBeNull();
  });

  test("moves through the canonical order and clamps at summary", () => {
    expect(nextOnboardingStep("welcome")).toBe("financial_defaults");
    expect(nextOnboardingStep("initial_stock")).toBe("summary");
    expect(nextOnboardingStep("summary")).toBe("summary");
  });

  test("counts only the six business setup steps in header progress", () => {
    expect(getOwnerOnboardingProgress("welcome")).toEqual({
      current: 0,
      total: 6,
      percentage: 0,
      label: "6 langkah setup",
    });
    expect(getOwnerOnboardingProgress("initial_stock")).toEqual({
      current: 6,
      total: 6,
      percentage: 100,
      label: "6 dari 6",
    });
    expect(getOwnerOnboardingProgress("summary")).toEqual({
      current: 6,
      total: 6,
      percentage: 100,
      label: "Ringkasan",
    });
  });

  test("auto-opens fresh installs and resumes only persisted progress", () => {
    expect(
      shouldRedirectToOwnerOnboarding({
        shouldAutoOpen: true,
        hasPersistedState: false,
        state: DEFAULT_OWNER_ONBOARDING_STATE,
      }),
    ).toBe(true);
    expect(
      shouldRedirectToOwnerOnboarding({
        shouldAutoOpen: false,
        hasPersistedState: true,
        state: DEFAULT_OWNER_ONBOARDING_STATE,
      }),
    ).toBe(true);
    expect(
      shouldRedirectToOwnerOnboarding({
        shouldAutoOpen: false,
        hasPersistedState: false,
        state: DEFAULT_OWNER_ONBOARDING_STATE,
      }),
    ).toBe(false);
  });
});
