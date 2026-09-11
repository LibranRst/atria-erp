import { beforeEach, describe, expect, it } from "bun:test";
import { db } from "@/db";
import type { Actor } from "@/server/actor";
import {
  createDefaultOwnerQuickStartState,
  OWNER_ONBOARDING_V2_CONFIG_KEY,
} from "@atria/core/onboarding/organization-setup";
import { OWNER_ONBOARDING_CONFIG_KEY } from "@atria/core/onboarding/owner-onboarding";
import { resolveHomeDestination, resolveHomeDestinationInfo } from "./home-destination";

function createMockActor(roleName: string): Actor {
  return {
    userId: "user-1",
    roleId: `role-${roleName}`,
    roleName,
    permissions: [],
    name: "Test User",
    email: "test@dekoria.id",
    image: null,
    isActive: true,
    mustChangePassword: false,
    sessionId: "test-session",
    dataScope: "GLOBAL",
    developerActorUserId: null,
  };
}

describe("resolveHomeDestinationInfo", () => {
  beforeEach(() => {
    // Default stubs so tests never attempt real database connections
    db.query.appConfig.findMany = (async () => []) as unknown as typeof db.query.appConfig.findMany;
    db.query.project.findFirst = (async () =>
      undefined) as unknown as typeof db.query.project.findFirst;
    db.query.inventoryOpeningBatch.findFirst = (async () =>
      undefined) as unknown as typeof db.query.inventoryOpeningBatch.findFirst;
  });

  describe("Owner role (manage:onboarding)", () => {
    const ownerActor = createMockActor("OWNER");

    it("routes fresh install with no projects directly to onboarding welcome", async () => {
      db.query.appConfig.findMany =
        (async () => []) as unknown as typeof db.query.appConfig.findMany;
      db.query.project.findFirst = (async () =>
        undefined) as unknown as typeof db.query.project.findFirst;

      const destination = await resolveHomeDestinationInfo(ownerActor);
      expect(destination).toEqual({
        route: "/onboarding",
        onboardingStep: "welcome",
        path: "/onboarding?step=welcome",
      });

      const path = await resolveHomeDestination(ownerActor);
      expect(path).toBe("/onboarding?step=welcome");
    });

    it("routes fresh install with existing project directly to ledger", async () => {
      db.query.appConfig.findMany =
        (async () => []) as unknown as typeof db.query.appConfig.findMany;
      db.query.project.findFirst = (async () => ({
        id: "proj-1",
      })) as unknown as typeof db.query.project.findFirst;

      const destination = await resolveHomeDestinationInfo(ownerActor);
      expect(destination).toEqual({
        route: "/ledger",
        onboardingStep: null,
        path: "/ledger",
      });
    });

    it("routes in-progress onboarding v2 to the current step", async () => {
      const v2State = {
        ...createDefaultOwnerQuickStartState(),
        status: "IN_PROGRESS" as const,
        currentStep: "financial_defaults" as const,
        reviewedSteps: ["welcome" as const],
      };

      db.query.appConfig.findMany = (async () => [
        {
          key: OWNER_ONBOARDING_V2_CONFIG_KEY,
          value: JSON.stringify(v2State),
        },
      ]) as unknown as typeof db.query.appConfig.findMany;

      const destination = await resolveHomeDestinationInfo(ownerActor);
      expect(destination).toEqual({
        route: "/onboarding",
        onboardingStep: "financial_defaults",
        path: "/onboarding?step=financial_defaults",
      });
    });

    it("routes completed onboarding v2 to ledger", async () => {
      const v2State = {
        ...createDefaultOwnerQuickStartState(),
        status: "COMPLETED" as const,
        currentStep: "success" as const,
        reviewedSteps: [
          "welcome" as const,
          "financial_defaults" as const,
          "first_project" as const,
          "success" as const,
        ],
        completedAt: new Date().toISOString(),
      };

      db.query.appConfig.findMany = (async () => [
        {
          key: OWNER_ONBOARDING_V2_CONFIG_KEY,
          value: JSON.stringify(v2State),
        },
      ]) as unknown as typeof db.query.appConfig.findMany;

      const destination = await resolveHomeDestinationInfo(ownerActor);
      expect(destination).toEqual({
        route: "/ledger",
        onboardingStep: null,
        path: "/ledger",
      });
    });

    it("routes completed legacy onboarding v1 to ledger", async () => {
      const v1State = {
        version: 1,
        status: "COMPLETED",
        currentStep: "summary",
        reviewedSteps: [
          "welcome",
          "financial_defaults",
          "team_vendors",
          "bank_accounts",
          "material_foundation",
          "item_library",
          "initial_stock",
          "summary",
        ],
        skippedSteps: [],
        completedAt: new Date().toISOString(),
        initialStockDecision: "NO_LEGACY_STOCK",
      };

      db.query.appConfig.findMany = (async () => [
        {
          key: OWNER_ONBOARDING_CONFIG_KEY,
          value: JSON.stringify(v1State),
        },
      ]) as unknown as typeof db.query.appConfig.findMany;

      const destination = await resolveHomeDestinationInfo(ownerActor);
      expect(destination).toEqual({
        route: "/ledger",
        onboardingStep: null,
        path: "/ledger",
      });
    });

    it("routes paused legacy onboarding v1 to ledger", async () => {
      const v1State = {
        version: 1,
        status: "PAUSED",
        currentStep: "team_vendors",
        reviewedSteps: ["welcome", "financial_defaults"],
        skippedSteps: [],
        completedAt: null,
        initialStockDecision: "UNDECIDED",
      };

      db.query.appConfig.findMany = (async () => [
        {
          key: OWNER_ONBOARDING_CONFIG_KEY,
          value: JSON.stringify(v1State),
        },
      ]) as unknown as typeof db.query.appConfig.findMany;

      const destination = await resolveHomeDestinationInfo(ownerActor);
      expect(destination).toEqual({
        route: "/ledger",
        onboardingStep: null,
        path: "/ledger",
      });
    });
  });

  describe("Finance admin role (review:onboarding)", () => {
    const financeAdmin = createMockActor("FINANCE_ADMIN");

    it("routes to review when there is a pending inventory opening batch", async () => {
      db.query.inventoryOpeningBatch.findFirst = (async () => ({
        id: "batch-1",
      })) as unknown as typeof db.query.inventoryOpeningBatch.findFirst;

      const destination = await resolveHomeDestinationInfo(financeAdmin);
      expect(destination).toEqual({
        route: "/onboarding/review",
        onboardingStep: null,
        path: "/onboarding/review",
      });
    });

    it("routes to ledger when there are no pending batches", async () => {
      db.query.inventoryOpeningBatch.findFirst = (async () =>
        undefined) as unknown as typeof db.query.inventoryOpeningBatch.findFirst;

      const destination = await resolveHomeDestinationInfo(financeAdmin);
      expect(destination).toEqual({
        route: "/ledger",
        onboardingStep: null,
        path: "/ledger",
      });
    });
  });

  describe("Operational roles", () => {
    it("routes Project Manager to /projects", async () => {
      const pmActor = createMockActor("PROJECT_MANAGER");
      const destination = await resolveHomeDestinationInfo(pmActor);
      expect(destination).toEqual({
        route: "/projects",
        onboardingStep: null,
        path: "/projects",
      });
    });

    it("routes Purchasing to /materials", async () => {
      const purchasingActor = createMockActor("PURCHASING");
      const destination = await resolveHomeDestinationInfo(purchasingActor);
      expect(destination).toEqual({
        route: "/materials",
        onboardingStep: null,
        path: "/materials",
      });
    });

    it("defaults unknown role to /projects", async () => {
      const guestActor = createMockActor("GUEST");
      const destination = await resolveHomeDestinationInfo(guestActor);
      expect(destination).toEqual({
        route: "/projects",
        onboardingStep: null,
        path: "/projects",
      });
    });
  });
});
