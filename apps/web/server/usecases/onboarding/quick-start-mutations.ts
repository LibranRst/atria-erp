import "server-only";

import { eq } from "drizzle-orm";

import { getBudgetAllocationDefault } from "@/app/actions/project/excel-budget-utils";
import { db } from "@/db";
import {
  appConfig,
  auditLog,
  budgetAllocationSetting,
  expenseCategory,
  onboardingEvent,
} from "@/db/schema";
import { insertProjectWithCanonicalBudgetTx } from "@/server/usecases/project/project-creation-write";
import { recordReadinessMilestonesTx } from "@/lib/onboarding/readiness-events";
import type { Actor } from "@/server/actor";
import { DEFAULT_EXPENSE_CATEGORIES } from "@atria/core/budget/excel-budget";
import {
  advanceQuickStartSchema,
  createDefaultOwnerQuickStartState,
  createFirstProjectQuickStartSchema,
  mapLegacyOwnerOnboardingState,
  OWNER_ONBOARDING_V2_CONFIG_KEY,
  parseOwnerQuickStartState,
  pauseQuickStartSchema,
  recordQuickStartInteractionSchema,
  setInitialStockDecisionSchema,
  type CreateFirstProjectQuickStartInput,
  type OwnerQuickStartState,
  type QuickStartStepId,
} from "@atria/core/onboarding/organization-setup";
import {
  OWNER_ONBOARDING_CONFIG_KEY,
  parseOwnerOnboardingState,
} from "@atria/core/onboarding/owner-onboarding";
import type { ActionResponse } from "@atria/core/types/action-response";

type QuickStartTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type LockedQuickStartState = {
  readonly state: OwnerQuickStartState;
  readonly configRow: typeof appConfig.$inferSelect | null;
};

function hasPermission(actor: Actor, permission: Actor["permissions"][number]): boolean {
  return actor.permissions.includes(permission);
}

async function financeDefaultsReadyTx(tx: QuickStartTx): Promise<boolean> {
  const [budget, categories] = await Promise.all([
    tx.query.budgetAllocationSetting.findFirst({
      where: eq(budgetAllocationSetting.isActive, true),
      columns: { id: true },
    }),
    tx.query.expenseCategory.findMany({
      where: eq(expenseCategory.isActive, true),
      columns: { code: true },
    }),
  ]);
  const codes = new Set(categories.map((category) => category.code));
  return (
    Boolean(budget) && DEFAULT_EXPENSE_CATEGORIES.every((category) => codes.has(category.code))
  );
}

async function lockQuickStartState(tx: QuickStartTx): Promise<LockedQuickStartState> {
  const [v2Row] = await tx
    .select()
    .from(appConfig)
    .where(eq(appConfig.key, OWNER_ONBOARDING_V2_CONFIG_KEY))
    .for("update");
  const parsedV2 = parseOwnerQuickStartState(v2Row?.value);
  if (parsedV2) return { state: parsedV2, configRow: v2Row };
  if (v2Row) throw new Error("QUICK_START_STATE_INVALID");

  const [legacyRow] = await tx
    .select()
    .from(appConfig)
    .where(eq(appConfig.key, OWNER_ONBOARDING_CONFIG_KEY))
    .for("update");
  const [financeReady, firstProject] = await Promise.all([
    financeDefaultsReadyTx(tx),
    tx.query.project.findFirst({
      columns: { id: true },
      orderBy: (table, { asc }) => [asc(table.createdAt)],
    }),
  ]);
  return {
    state: legacyRow
      ? mapLegacyOwnerOnboardingState(parseOwnerOnboardingState(legacyRow.value), {
          financeDefaultsReady: financeReady,
          hasProject: Boolean(firstProject),
          firstProjectId: firstProject?.id ?? null,
        })
      : createDefaultOwnerQuickStartState(),
    configRow: null,
  };
}

async function persistQuickStartStateTx(args: {
  readonly tx: QuickStartTx;
  readonly actor: Actor;
  readonly locked: LockedQuickStartState;
  readonly next: OwnerQuickStartState;
  readonly action: string;
}): Promise<typeof appConfig.$inferSelect> {
  const value = JSON.stringify(args.next);
  const [saved] = args.locked.configRow
    ? await args.tx
        .update(appConfig)
        .set({ value, updatedAt: new Date(), updatedById: args.actor.userId })
        .where(eq(appConfig.id, args.locked.configRow.id))
        .returning()
    : await args.tx
        .insert(appConfig)
        .values({
          key: OWNER_ONBOARDING_V2_CONFIG_KEY,
          value,
          description: "Quick start Owner dan keputusan kesiapan operasional Atria.",
          updatedById: args.actor.userId,
        })
        .returning();

  await args.tx.insert(auditLog).values({
    userId: args.actor.userId,
    action: args.action,
    targetTable: "app_config",
    targetId: saved.id,
    originalState: args.locked.configRow?.value ?? null,
    newState: value,
  });
  return saved;
}

async function insertEventTx(args: {
  readonly tx: QuickStartTx;
  readonly actor: Actor;
  readonly eventType: string;
  readonly stepId?: QuickStartStepId;
  readonly readinessItemId?: string;
  readonly idempotencyKey?: string;
  readonly durationMs?: number;
  readonly metadata?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  await args.tx.insert(onboardingEvent).values({
    actorUserId: args.actor.userId,
    eventType: args.eventType,
    stepId: args.stepId,
    readinessItemId: args.readinessItemId,
    idempotencyKey: args.idempotencyKey,
    durationMs: args.durationMs,
    metadata: args.metadata,
  });
}

async function recordFailure(actor: Actor, eventType: string, errorCode: string): Promise<void> {
  try {
    await db.insert(onboardingEvent).values({
      actorUserId: actor.userId,
      eventType,
      outcome: "ERROR",
      errorCode,
    });
  } catch {
    // Telemetry is best-effort and must never replace the real workflow error.
  }
}

export async function advanceQuickStartUseCase(
  actor: Actor,
  input: unknown,
): Promise<ActionResponse<OwnerQuickStartState>> {
  const parsed = advanceQuickStartSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: { code: "VALIDATION_ERROR", message: "Tahap tidak valid." } };
  }
  if (!hasPermission(actor, "manage:onboarding")) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Hanya Owner yang dapat menjalankan quick start." },
    };
  }

  try {
    const next = await db.transaction(async (tx) => {
      const locked = await lockQuickStartState(tx);
      if (locked.state.status === "COMPLETED") throw new Error("QUICK_START_COMPLETED");
      if (locked.state.currentStep !== parsed.data.stepId)
        throw new Error("STALE_QUICK_START_STEP");
      if (parsed.data.stepId === "financial_defaults" && !(await financeDefaultsReadyTx(tx))) {
        throw new Error("FINANCE_DEFAULTS_INCOMPLETE");
      }

      const destination: QuickStartStepId =
        parsed.data.stepId === "welcome" ? "financial_defaults" : "first_project";
      const state: OwnerQuickStartState = {
        ...locked.state,
        status: "IN_PROGRESS",
        currentStep: destination,
        reviewedSteps: [...new Set([...locked.state.reviewedSteps, parsed.data.stepId])],
      };
      await persistQuickStartStateTx({
        tx,
        actor,
        locked,
        next: state,
        action: "ADVANCE_OWNER_QUICK_START",
      });
      await insertEventTx({
        tx,
        actor,
        eventType:
          locked.configRow === null && parsed.data.stepId === "welcome"
            ? "QUICK_START_STARTED"
            : "QUICK_START_STEP_COMPLETED",
        stepId: parsed.data.stepId,
      });
      if (locked.state.status === "PAUSED") {
        await insertEventTx({
          tx,
          actor,
          eventType: "QUICK_START_RESUMED",
          stepId: parsed.data.stepId,
        });
      }
      return state;
    });
    return { success: true, data: next };
  } catch (error) {
    const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
    await recordFailure(actor, "QUICK_START_ADVANCE_ERROR", code);
    if (code === "QUICK_START_COMPLETED" || code === "STALE_QUICK_START_STEP") {
      return {
        success: false,
        error: {
          code: "CONFLICT",
          message: "Progress quick start sudah berubah. Muat ulang halaman.",
        },
      };
    }
    if (code === "FINANCE_DEFAULTS_INCOMPLETE") {
      return {
        success: false,
        error: {
          code: "CONFLICT",
          message: "Lengkapi default budget dan lima kategori utama terlebih dahulu.",
        },
      };
    }
    return {
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Progress quick start gagal disimpan." },
    };
  }
}

export async function pauseQuickStartUseCase(
  actor: Actor,
  input: unknown,
): Promise<ActionResponse<OwnerQuickStartState>> {
  const parsed = pauseQuickStartSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: { code: "VALIDATION_ERROR", message: "Tahap tidak valid." } };
  }
  if (!hasPermission(actor, "manage:onboarding")) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Hanya Owner yang dapat menjeda quick start." },
    };
  }

  try {
    const next = await db.transaction(async (tx) => {
      const locked = await lockQuickStartState(tx);
      if (locked.state.status === "COMPLETED") throw new Error("QUICK_START_COMPLETED");
      if (locked.state.currentStep !== parsed.data.currentStep)
        throw new Error("STALE_QUICK_START_STEP");
      const state: OwnerQuickStartState = { ...locked.state, status: "PAUSED" };
      await persistQuickStartStateTx({
        tx,
        actor,
        locked,
        next: state,
        action: "PAUSE_OWNER_QUICK_START",
      });
      await insertEventTx({
        tx,
        actor,
        eventType: "QUICK_START_PAUSED",
        stepId: state.currentStep,
      });
      return state;
    });
    return { success: true, data: next };
  } catch (error) {
    const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
    await recordFailure(actor, "QUICK_START_PAUSE_ERROR", code);
    return {
      success: false,
      error: {
        code:
          code === "QUICK_START_COMPLETED" || code === "STALE_QUICK_START_STEP"
            ? "CONFLICT"
            : "INTERNAL_SERVER_ERROR",
        message: "Quick start tidak dapat dijeda. Muat ulang lalu coba lagi.",
      },
    };
  }
}

export async function createFirstProjectQuickStartUseCase(
  actor: Actor,
  input: CreateFirstProjectQuickStartInput,
): Promise<ActionResponse<{ readonly projectId: string; readonly alreadyCompleted: boolean }>> {
  const parsed = createFirstProjectQuickStartSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Data project tidak valid.",
      },
    };
  }
  if (!hasPermission(actor, "manage:onboarding") || !hasPermission(actor, "create:project")) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Hanya Owner yang dapat membuat project pertama." },
    };
  }

  try {
    const allocation = await getBudgetAllocationDefault();
    const result = await db.transaction(async (tx) => {
      const locked = await lockQuickStartState(tx);
      if (locked.state.status === "COMPLETED") {
        if (locked.state.firstProjectId) {
          return { projectId: locked.state.firstProjectId, alreadyCompleted: true };
        }
        throw new Error("QUICK_START_COMPLETED");
      }
      if (locked.state.currentStep !== "first_project") throw new Error("STALE_QUICK_START_STEP");
      if (!(await financeDefaultsReadyTx(tx))) throw new Error("FINANCE_DEFAULTS_INCOMPLETE");
      if (parsed.data.projectManagerId) {
        const manager = await tx.query.user.findFirst({
          where: (table, { and, eq }) =>
            and(eq(table.id, parsed.data.projectManagerId!), eq(table.isActive, true)),
          columns: { id: true },
          with: { role: { columns: { name: true, dataScope: true } } },
        });
        if (!manager || manager.role.dataScope !== "ASSIGNED") {
          throw new Error("PROJECT_MANAGER_INVALID");
        }
      }

      const created = await insertProjectWithCanonicalBudgetTx({
        tx,
        input: {
          ...parsed.data,
          projectManagerId: parsed.data.projectManagerId ?? null,
        },
        allocation,
      });
      await tx.insert(auditLog).values({
        userId: actor.userId,
        action: "CREATE_FIRST_PROJECT_QUICK_START",
        targetTable: "project",
        targetId: created.project.id,
        newState: JSON.stringify({
          project: created.project,
          canonicalBudgetId: created.budgetId,
          source: "OWNER_QUICK_START",
        }),
      });

      const completedAt = new Date().toISOString();
      const state: OwnerQuickStartState = {
        ...locked.state,
        status: "COMPLETED",
        currentStep: "success",
        reviewedSteps: ["welcome", "financial_defaults", "first_project", "success"],
        firstProjectId: created.project.id,
        completedAt,
      };
      await persistQuickStartStateTx({
        tx,
        actor,
        locked,
        next: state,
        action: "COMPLETE_OWNER_QUICK_START",
      });
      await insertEventTx({
        tx,
        actor,
        eventType: "FIRST_PROJECT_CREATED",
        stepId: "first_project",
        idempotencyKey: `first-project:${created.project.id}`,
      });
      await insertEventTx({
        tx,
        actor,
        eventType: "QUICK_START_COMPLETED",
        stepId: "success",
        idempotencyKey: `quick-start-completed:${created.project.id}`,
        durationMs: Math.max(0, Date.parse(completedAt) - Date.parse(state.startedAt)),
      });
      return { projectId: created.project.id, alreadyCompleted: false };
    });
    return { success: true, data: result };
  } catch (error) {
    const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
    await recordFailure(actor, "FIRST_PROJECT_CREATE_ERROR", code);
    if (code === "QUICK_START_COMPLETED" || code === "STALE_QUICK_START_STEP") {
      return {
        success: false,
        error: { code: "CONFLICT", message: "Quick start sudah berubah. Muat ulang halaman." },
      };
    }
    if (code === "FINANCE_DEFAULTS_INCOMPLETE") {
      return {
        success: false,
        error: { code: "CONFLICT", message: "Default finansial belum siap digunakan." },
      };
    }
    if (code === "PROJECT_MANAGER_INVALID") {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Project Manager harus merupakan akun aktif dengan scope project.",
        },
      };
    }
    return {
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Project pertama gagal dibuat." },
    };
  }
}

export async function setInitialStockDecisionUseCase(
  actor: Actor,
  input: unknown,
): Promise<ActionResponse<OwnerQuickStartState>> {
  const parsed = setInitialStockDecisionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Keputusan stok tidak valid." },
    };
  }
  if (
    !hasPermission(actor, "manage:onboarding") &&
    !hasPermission(actor, "create:opening_inventory")
  ) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Anda tidak memiliki izin mengubah keputusan stok awal.",
      },
    };
  }

  try {
    const next = await db.transaction(async (tx) => {
      const locked = await lockQuickStartState(tx);
      const state: OwnerQuickStartState = {
        ...locked.state,
        initialStockDecision: parsed.data.decision,
      };
      await persistQuickStartStateTx({
        tx,
        actor,
        locked,
        next: state,
        action: "SET_INITIAL_STOCK_READINESS_DECISION",
      });
      if (parsed.data.decision === "NO_LEGACY_STOCK") {
        await recordReadinessMilestonesTx({
          tx,
          actorUserId: actor.userId,
          changedItem: "initial_stock",
        });
      }
      return state;
    });
    return { success: true, data: next };
  } catch {
    await recordFailure(actor, "INITIAL_STOCK_DECISION_ERROR", "INTERNAL_SERVER_ERROR");
    return {
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Keputusan stok awal gagal disimpan." },
    };
  }
}

export async function recordQuickStartInteractionUseCase(
  actor: Actor,
  input: unknown,
): Promise<ActionResponse<{ readonly recorded: true }>> {
  const parsed = recordQuickStartInteractionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Event quick start tidak valid." },
    };
  }
  if (!hasPermission(actor, "manage:onboarding")) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Event quick start tidak diizinkan." },
    };
  }
  try {
    await db.insert(onboardingEvent).values({
      actorUserId: actor.userId,
      eventType: "QUICK_START_RETRY",
      stepId: parsed.data.stepId,
    });
    return { success: true, data: { recorded: true } };
  } catch {
    return {
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Event quick start gagal dicatat." },
    };
  }
}
