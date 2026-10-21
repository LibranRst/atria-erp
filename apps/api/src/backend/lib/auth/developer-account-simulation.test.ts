import { describe, expect, test } from "bun:test";

import {
  canUseTemporaryPasswordDuringDeveloperSimulation,
  getDeveloperSimulationLandingRoute,
  developerAccountSimulationSchema,
  isDeveloperAccountSimulationEnabled,
} from "@atria/core/auth/developer-account-simulation";

const simulationActionPath = new URL(
  "../../app/actions/developer-account-simulation.ts",
  import.meta.url,
);

describe("developer account simulation guard", () => {
  test("is enabled only by an explicit non-production flag", () => {
    expect(
      isDeveloperAccountSimulationEnabled({
        nodeEnv: "development",
        featureFlag: "true",
      }),
    ).toBe(true);
    expect(
      isDeveloperAccountSimulationEnabled({
        nodeEnv: "development",
        featureFlag: "false",
      }),
    ).toBe(false);
    expect(
      isDeveloperAccountSimulationEnabled({
        nodeEnv: "production",
        featureFlag: "true",
      }),
    ).toBe(false);
  });

  test("validates general and onboarding review contexts", () => {
    const targetUserId = "11111111-1111-4111-8111-111111111111";
    expect(developerAccountSimulationSchema.parse({ targetUserId }).context).toBe("GENERAL");
    expect(
      developerAccountSimulationSchema.parse({
        targetUserId,
        context: "ONBOARDING_SETUP_REVIEW",
      }).context,
    ).toBe("ONBOARDING_SETUP_REVIEW");
    expect(
      developerAccountSimulationSchema.safeParse({
        targetUserId,
        context: "OWNER_BYPASS",
      }).success,
    ).toBe(false);
  });

  test("accepts deterministic demo user ids used by the seeded walkthrough", () => {
    expect(
      developerAccountSimulationSchema.parse({
        targetUserId: "22222222-2222-2222-2222-222222222222",
        context: "ONBOARDING_SETUP_REVIEW",
      }).targetUserId,
    ).toBe("22222222-2222-2222-2222-222222222222");
  });

  test("lands each simulated role on its real operational route", () => {
    expect(getDeveloperSimulationLandingRoute("FINANCE_ADMIN")).toBe("/ledger");
    expect(getDeveloperSimulationLandingRoute("PROJECT_MANAGER")).toBe("/projects");
    expect(getDeveloperSimulationLandingRoute("PURCHASING")).toBe("/materials");
  });

  test("uses UUID user targets for simulation audit records", async () => {
    const source = await Bun.file(simulationActionPath).text();
    expect(source).toContain('targetTable: "user"');
    expect(source).toContain("targetId: target.id");
    expect(source).toContain("targetId: current.userId");
    expect(source).not.toContain("targetId: lockedSession.id");
  });

  test("allows temporary-password team accounts only during active development simulation", () => {
    const base = {
      simulationEnabled: true,
      developerActorUserId: "650371ec-79c5-4ecb-9478-c94bf6beb7d8",
    } as const;
    for (const effectiveRoleId of [
      "00000000-0000-0000-0000-000000000002",
      "00000000-0000-0000-0000-000000000003",
      "00000000-0000-0000-0000-000000000004",
    ]) {
      expect(
        canUseTemporaryPasswordDuringDeveloperSimulation({
          ...base,
          effectiveRoleId,
        }),
      ).toBe(true);
    }
    expect(
      canUseTemporaryPasswordDuringDeveloperSimulation({
        ...base,
        simulationEnabled: false,
        effectiveRoleId: "00000000-0000-0000-0000-000000000003",
      }),
    ).toBe(false);
    expect(
      canUseTemporaryPasswordDuringDeveloperSimulation({
        ...base,
        developerActorUserId: null,
        effectiveRoleId: "00000000-0000-0000-0000-000000000004",
      }),
    ).toBe(false);
    expect(
      canUseTemporaryPasswordDuringDeveloperSimulation({
        ...base,
        effectiveRoleId: "00000000-0000-0000-0000-000000000001",
      }),
    ).toBe(false);
  });
});
