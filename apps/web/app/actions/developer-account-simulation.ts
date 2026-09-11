"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { appConfig, auditLog, session, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  developerAccountSimulationSchema,
  getDeveloperSimulationLandingRoute,
  isDeveloperAccountSimulationEnabled,
  REQUIRED_SIMULATION_ROLE_IDS,
  stopDeveloperAccountSimulationSchema,
  type DeveloperAccountSimulationState,
  type DeveloperSimulationRole,
  type DeveloperSimulationTarget,
} from "@atria/core/auth/developer-account-simulation";
import { OWNER_ROLE_ID, SYSTEM_ROLES } from "@atria/core/auth/role-constants";
import {
  OWNER_ONBOARDING_V2_CONFIG_KEY,
  parseOwnerQuickStartState,
} from "@atria/core/onboarding/organization-setup";
import {
  OWNER_ONBOARDING_CONFIG_KEY,
  parseOwnerOnboardingState,
} from "@atria/core/onboarding/owner-onboarding";
import type { ActionResponse } from "@atria/core/types/action-response";

type SessionContext = {
  readonly sessionId: string;
  readonly userId: string;
  readonly roleId: string;
};

type SimulationActionResult = {
  readonly redirectTo: string;
};

function toSimulationRole(roleName: string): DeveloperSimulationRole | null {
  if (roleName === "FINANCE_ADMIN" || roleName === "PROJECT_MANAGER" || roleName === "PURCHASING") {
    return roleName;
  }
  return null;
}

async function getSessionContext(): Promise<SessionContext | null> {
  const current = await auth.api.getSession({
    headers: { cookie: (await cookies()).toString() },
  });
  if (!current?.user || !current.session?.id) return null;
  return {
    sessionId: current.session.id,
    userId: current.user.id,
    roleId: current.user.roleId,
  };
}

function mapTarget(row: {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly mustChangePassword: boolean;
  readonly role: { readonly name: string };
}): DeveloperSimulationTarget | null {
  const roleName = toSimulationRole(row.role.name.toUpperCase());
  return roleName
    ? {
        id: row.id,
        name: row.name,
        email: row.email,
        roleName,
        mustChangePassword: row.mustChangePassword,
      }
    : null;
}

export async function getDeveloperAccountSimulationState(): Promise<
  ActionResponse<DeveloperAccountSimulationState>
> {
  const current = await getSessionContext();
  if (!current) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." },
    };
  }

  const currentSession = await db.query.session.findFirst({
    where: eq(session.id, current.sessionId),
    columns: { developerActorUserId: true },
  });
  const enabled = isDeveloperAccountSimulationEnabled();
  const isSimulating = Boolean(currentSession?.developerActorUserId);

  if (!enabled || current.roleId !== OWNER_ROLE_ID || isSimulating) {
    return {
      success: true,
      data: {
        enabled,
        isSimulating,
        onboardingCompleted: false,
        teamReady: false,
        blockers: [],
        targets: [],
      },
    };
  }

  const [onboardingRow, staffRows] = await Promise.all([
    db.query.appConfig.findMany({
      where: inArray(appConfig.key, [OWNER_ONBOARDING_V2_CONFIG_KEY, OWNER_ONBOARDING_CONFIG_KEY]),
      columns: { key: true, value: true },
    }),
    db.query.user.findMany({
      where: and(eq(user.isActive, true), inArray(user.roleId, REQUIRED_SIMULATION_ROLE_IDS)),
      columns: {
        id: true,
        name: true,
        email: true,
        roleId: true,
        mustChangePassword: true,
      },
      with: { role: { columns: { name: true } } },
      orderBy: [asc(user.name)],
    }),
  ]);
  const onboardingCompleted =
    parseOwnerQuickStartState(
      onboardingRow.find((row) => row.key === OWNER_ONBOARDING_V2_CONFIG_KEY)?.value,
    )?.status === "COMPLETED" ||
    parseOwnerOnboardingState(
      onboardingRow.find((row) => row.key === OWNER_ONBOARDING_CONFIG_KEY)?.value,
    )?.status === "COMPLETED";
  const readyRoleIds = new Set(staffRows.map((row) => row.roleId));
  const teamReady = REQUIRED_SIMULATION_ROLE_IDS.every((roleId) => readyRoleIds.has(roleId));
  const targets = staffRows
    .map(mapTarget)
    .filter((row): row is DeveloperSimulationTarget => row !== null);
  const onboardingReviewTargets = staffRows
    .filter((row) => row.roleId === SYSTEM_ROLES[1].id)
    .map(mapTarget)
    .filter((row): row is DeveloperSimulationTarget => row !== null);
  const blockers: string[] = [];
  if (!onboardingCompleted) blockers.push("Selesaikan onboarding Owner terlebih dahulu.");
  if (!teamReady) {
    blockers.push("Siapkan akun aktif Finance Admin, Project Manager, dan Purchasing.");
  }

  return {
    success: true,
    data: {
      enabled,
      isSimulating,
      onboardingCompleted,
      teamReady,
      blockers,
      targets: onboardingCompleted && teamReady ? targets : [],
      onboardingReviewTargets,
    },
  };
}

export async function startDeveloperAccountSimulation(
  input: unknown,
): Promise<ActionResponse<SimulationActionResult>> {
  if (!isDeveloperAccountSimulationEnabled()) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Mode simulasi developer sedang dinonaktifkan.",
      },
    };
  }
  const validation = developerAccountSimulationSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Akun simulasi tidak valid.",
      },
    };
  }
  const current = await getSessionContext();
  if (!current) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." },
    };
  }

  try {
    const roleName = await db.transaction(async (tx) => {
      const [lockedSession] = await tx
        .select()
        .from(session)
        .where(and(eq(session.id, current.sessionId), eq(session.userId, current.userId)))
        .for("update");
      if (!lockedSession) throw new Error("SESSION_NOT_FOUND");
      if (lockedSession.developerActorUserId) throw new Error("ALREADY_SIMULATING");

      const actor = await tx.query.user.findFirst({
        where: and(
          eq(user.id, current.userId),
          eq(user.roleId, OWNER_ROLE_ID),
          eq(user.isActive, true),
        ),
      });
      if (!actor) throw new Error("OWNER_REQUIRED");

      if (validation.data.context === "GENERAL") {
        const onboardingRows = await tx.query.appConfig.findMany({
          where: inArray(appConfig.key, [
            OWNER_ONBOARDING_V2_CONFIG_KEY,
            OWNER_ONBOARDING_CONFIG_KEY,
          ]),
          columns: { key: true, value: true },
        });
        const quickStartCompleted =
          parseOwnerQuickStartState(
            onboardingRows.find((row) => row.key === OWNER_ONBOARDING_V2_CONFIG_KEY)?.value,
          )?.status === "COMPLETED" ||
          parseOwnerOnboardingState(
            onboardingRows.find((row) => row.key === OWNER_ONBOARDING_CONFIG_KEY)?.value,
          )?.status === "COMPLETED";
        if (!quickStartCompleted) throw new Error("ONBOARDING_REQUIRED");
        const staffRows = await tx.query.user.findMany({
          where: and(eq(user.isActive, true), inArray(user.roleId, REQUIRED_SIMULATION_ROLE_IDS)),
          columns: { roleId: true },
        });
        const readyRoleIds = new Set(staffRows.map((row) => row.roleId));
        if (!REQUIRED_SIMULATION_ROLE_IDS.every((roleId) => readyRoleIds.has(roleId)))
          throw new Error("TEAM_REQUIRED");
      }

      const target = await tx.query.user.findFirst({
        where: and(
          eq(user.id, validation.data.targetUserId),
          eq(user.isActive, true),
          inArray(user.roleId, REQUIRED_SIMULATION_ROLE_IDS),
        ),
        with: { role: { columns: { name: true } } },
      });
      const targetRole = target ? toSimulationRole(target.role.name.toUpperCase()) : null;
      if (!target || !targetRole) throw new Error("TARGET_NOT_FOUND");
      if (
        validation.data.context === "ONBOARDING_SETUP_REVIEW" &&
        target.roleId !== SYSTEM_ROLES[1].id
      )
        throw new Error("FINANCE_TARGET_REQUIRED");
      await tx
        .update(session)
        .set({
          userId: target.id,
          developerActorUserId: actor.id,
          updatedAt: new Date(),
        })
        .where(eq(session.id, lockedSession.id));
      await tx.insert(auditLog).values({
        userId: actor.id,
        action: "START_DEVELOPER_ACCOUNT_SIMULATION",
        targetTable: "user",
        targetId: target.id,
        originalState: JSON.stringify({
          sessionId: lockedSession.id,
          effectiveUserId: actor.id,
        }),
        newState: JSON.stringify({
          sessionId: lockedSession.id,
          developerActorUserId: actor.id,
          effectiveUserId: target.id,
          effectiveRole: targetRole,
          context: validation.data.context,
        }),
      });
      return targetRole;
    });
    if (validation.data.context === "GENERAL") revalidatePath("/", "layout");
    return {
      success: true,
      data: {
        redirectTo:
          validation.data.context === "ONBOARDING_SETUP_REVIEW"
            ? "/onboarding/review"
            : getDeveloperSimulationLandingRoute(roleName),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const errors: Record<string, string> = {
      SESSION_NOT_FOUND: "Sesi aktif tidak ditemukan.",
      ALREADY_SIMULATING: "Sesi ini sudah berada dalam mode simulasi.",
      OWNER_REQUIRED: "Hanya Owner aktif yang dapat memulai simulasi.",
      ONBOARDING_REQUIRED: "Selesaikan onboarding Owner terlebih dahulu.",
      TEAM_REQUIRED:
        "Lengkapi akun aktif Finance Admin, Project Manager, dan Purchasing terlebih dahulu.",
      TARGET_NOT_FOUND: "Akun simulasi tidak tersedia atau sudah nonaktif.",
      FINANCE_TARGET_REQUIRED:
        "Setup review hanya dapat disimulasikan sebagai Finance Admin aktif.",
    };
    return {
      success: false,
      error: {
        code: message in errors ? "FORBIDDEN" : "TRANSACTION_FAILED",
        message: errors[message] ?? "Mode simulasi belum dapat dimulai.",
      },
    };
  }
}

export async function stopDeveloperAccountSimulation(
  input: unknown = {},
): Promise<ActionResponse<SimulationActionResult>> {
  const validation = stopDeveloperAccountSimulationSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Context simulasi tidak valid.",
      },
    };
  const current = await getSessionContext();
  if (!current) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." },
    };
  }
  try {
    await db.transaction(async (tx) => {
      const [lockedSession] = await tx
        .select()
        .from(session)
        .where(eq(session.id, current.sessionId))
        .for("update");
      if (!lockedSession?.developerActorUserId) {
        throw new Error("NOT_SIMULATING");
      }
      const actor = await tx.query.user.findFirst({
        where: and(
          eq(user.id, lockedSession.developerActorUserId),
          eq(user.roleId, OWNER_ROLE_ID),
          eq(user.isActive, true),
        ),
      });
      if (!actor) throw new Error("OWNER_NOT_AVAILABLE");

      await tx
        .update(session)
        .set({
          userId: actor.id,
          developerActorUserId: null,
          updatedAt: new Date(),
        })
        .where(eq(session.id, lockedSession.id));
      await tx.insert(auditLog).values({
        userId: actor.id,
        action: "STOP_DEVELOPER_ACCOUNT_SIMULATION",
        targetTable: "user",
        targetId: current.userId,
        originalState: JSON.stringify({
          sessionId: lockedSession.id,
          developerActorUserId: actor.id,
          effectiveUserId: current.userId,
        }),
        newState: JSON.stringify({
          sessionId: lockedSession.id,
          effectiveUserId: actor.id,
          context: validation.data.context,
        }),
      });
    });
    revalidatePath("/", "layout");
    return {
      success: true,
      data: {
        redirectTo:
          validation.data.context === "ONBOARDING_SETUP_REVIEW"
            ? "/onboarding?step=initial_stock"
            : "/profile",
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return {
      success: false,
      error: {
        code: message === "NOT_SIMULATING" ? "CONFLICT" : "TRANSACTION_FAILED",
        message:
          message === "NOT_SIMULATING"
            ? "Sesi ini tidak sedang melakukan simulasi."
            : message === "OWNER_NOT_AVAILABLE"
              ? "Akun Owner asal tidak lagi tersedia."
              : "Belum dapat kembali ke akun Owner.",
      },
    };
  }
}
