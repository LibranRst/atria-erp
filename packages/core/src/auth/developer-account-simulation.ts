import { z } from "zod";

import { SYSTEM_ROLES } from "./role-constants";

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const developerAccountSimulationSchema = z.object({
  targetUserId: z.string().regex(uuidRegex, "ID akun simulasi tidak valid."),
  context: z.enum(["GENERAL", "ONBOARDING_SETUP_REVIEW"]).default("GENERAL"),
});

export const stopDeveloperAccountSimulationSchema = z.object({
  context: z.enum(["GENERAL", "ONBOARDING_SETUP_REVIEW"]).default("GENERAL"),
});

export type DeveloperSimulationContext = "GENERAL" | "ONBOARDING_SETUP_REVIEW";

export type DeveloperSimulationRole = "FINANCE_ADMIN" | "PROJECT_MANAGER" | "PURCHASING";

export type DeveloperSimulationTarget = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly roleName: DeveloperSimulationRole;
  readonly mustChangePassword: boolean;
};

export type DeveloperAccountSimulationState = {
  readonly enabled: boolean;
  readonly isSimulating: boolean;
  readonly onboardingCompleted: boolean;
  readonly teamReady: boolean;
  readonly blockers: readonly string[];
  readonly targets: readonly DeveloperSimulationTarget[];
  readonly onboardingReviewTargets?: readonly DeveloperSimulationTarget[];
};

export const REQUIRED_SIMULATION_ROLE_IDS = SYSTEM_ROLES.slice(1, 4).map((role) => role.id);

export function isDeveloperAccountSimulationEnabled(
  environment: Readonly<{
    nodeEnv?: string;
    featureFlag?: string;
  }> = {
    nodeEnv: process.env.NODE_ENV,
    featureFlag: process.env.ATRIA_DEV_ACCOUNT_SWITCHER_ENABLED,
  },
): boolean {
  return environment.nodeEnv !== "production" && environment.featureFlag === "true";
}

export function canUseTemporaryPasswordDuringDeveloperSimulation(input: {
  readonly simulationEnabled: boolean;
  readonly developerActorUserId: unknown;
  readonly effectiveRoleId: string;
}): boolean {
  return (
    input.simulationEnabled &&
    typeof input.developerActorUserId === "string" &&
    input.developerActorUserId.length > 0 &&
    REQUIRED_SIMULATION_ROLE_IDS.some((roleId) => roleId === input.effectiveRoleId)
  );
}

export function getDeveloperSimulationRoleLabel(roleName: DeveloperSimulationRole): string {
  const labels: Record<DeveloperSimulationRole, string> = {
    FINANCE_ADMIN: "Finance Admin",
    PROJECT_MANAGER: "Project Manager",
    PURCHASING: "Purchasing",
  };
  return labels[roleName];
}

export function getDeveloperSimulationLandingRoute(roleName: DeveloperSimulationRole): string {
  const routes: Record<DeveloperSimulationRole, string> = {
    FINANCE_ADMIN: "/ledger",
    PROJECT_MANAGER: "/projects",
    PURCHASING: "/materials",
  };
  return routes[roleName];
}
