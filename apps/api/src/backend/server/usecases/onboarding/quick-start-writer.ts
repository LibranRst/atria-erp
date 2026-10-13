import { and, asc, eq, ne, inArray, or } from "drizzle-orm";
import { db } from "@backend/db";
import {
  appConfig,
  auditLog,
  budgetAllocationSetting,
  budgetAllocationSettingCategory,
  expenseCategory,
  onboardingEvent,
  project,
  client,
  user,
  role,
  rolePermission,
  tenant,
  tenantMember,
  materialInventory,
  inventoryOpeningBatch,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { insertProjectWithCanonicalBudgetTx } from "@backend/server/usecases/project/project-creation-write";
import { recordReadinessMilestonesTx } from "@backend/lib/onboarding/readiness-events";
import { readBudgetAllocationSnapshot } from "@backend/lib/budget/allocation-defaults";
import type { Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import type { PermissionKey } from "@atria/core/auth/permissions";
import { DEFAULT_EXPENSE_CATEGORIES } from "@atria/core/budget/excel-budget";
import {
  advanceQuickStartSchema,
  mapLegacyOwnerOnboardingState,
  OWNER_ONBOARDING_V2_CONFIG_KEY,
  parseOwnerQuickStartState,
  pauseQuickStartSchema,
  setInitialStockDecisionSchema,
  type OwnerQuickStartState,
  type QuickStartStepId,
} from "@atria/core/onboarding/organization-setup";
import {
  OWNER_ONBOARDING_CONFIG_KEY,
  parseOwnerOnboardingState,
} from "@atria/core/onboarding/owner-onboarding";
import { z } from "zod";
import { quickStartProjectSchema, type QuickStartInput } from "@atria/core/ai/quick-start";
export class QuickStartError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR",
    message: string,
  ) {
    super(message);
  }
}
export type QuickStartTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type LockedQuickStartState = {
  readonly state: OwnerQuickStartState;
  readonly configRow: typeof appConfig.$inferSelect | null;
};

export async function financeDefaultsReadyTx(tx: QuickStartTx): Promise<boolean> {
  const [budget, categories] = await Promise.all([
    tx.query.budgetAllocationSetting.findFirst({
      where: and(
        eq(budgetAllocationSetting.tenantId, INSTANCE_TENANT_ID),
        eq(budgetAllocationSetting.isActive, true),
      ),
      columns: { id: true },
    }),
    tx.query.expenseCategory.findMany({
      where: and(
        eq(expenseCategory.tenantId, INSTANCE_TENANT_ID),
        eq(expenseCategory.isActive, true),
      ),
      columns: { code: true },
    }),
  ]);
  const codes = new Set(categories.map((category) => category.code));
  return (
    Boolean(budget) && DEFAULT_EXPENSE_CATEGORIES.every((category) => codes.has(category.code))
  );
}

export async function lockQuickStartState(tx: QuickStartTx): Promise<LockedQuickStartState> {
  const [v2Row] = await tx
    .select()
    .from(appConfig)
    .where(
      and(
        eq(appConfig.tenantId, INSTANCE_TENANT_ID),
        eq(appConfig.key, OWNER_ONBOARDING_V2_CONFIG_KEY),
      ),
    )
    .for("update");
  const parsedV2 = parseOwnerQuickStartState(v2Row?.value);
  if (parsedV2) return { state: parsedV2, configRow: v2Row };
  if (v2Row)
    throw new QuickStartError(
      "CONFLICT",
      "Progres setup tersimpan tidak valid. Periksa konfigurasi setup sebelum melanjutkan.",
    );

  const [legacyRow] = await tx
    .select()
    .from(appConfig)
    .where(
      and(
        eq(appConfig.tenantId, INSTANCE_TENANT_ID),
        eq(appConfig.key, OWNER_ONBOARDING_CONFIG_KEY),
      ),
    )
    .for("update");
  const [financeReady, firstProject] = await Promise.all([
    financeDefaultsReadyTx(tx),
    tx.query.project.findFirst({
      where: eq(project.tenantId, INSTANCE_TENANT_ID),
      columns: { id: true },
      orderBy: (table, { asc }) => [asc(table.createdAt)],
    }),
  ]);
  return {
    state: mapLegacyOwnerOnboardingState(
      legacyRow ? parseOwnerOnboardingState(legacyRow.value) : null,
      {
        financeDefaultsReady: financeReady,
        hasProject: Boolean(firstProject),
        firstProjectId: firstProject?.id ?? null,
      },
    ),
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

export async function advanceQuickStartTx(
  tx: QuickStartTx,
  actor: Actor,
  raw: z.input<typeof advanceQuickStartSchema>,
): Promise<OwnerQuickStartState> {
  const parsed = advanceQuickStartSchema.safeParse(raw);
  if (!parsed.success)
    throw new QuickStartError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Isian setup tidak valid.",
    );
  await assertQuickStartActorTx(tx, actor, { action: "ADVANCE", stepId: parsed.data.stepId });
  const locked = await lockQuickStartState(tx);
  if (locked.state.status === "COMPLETED") throw new Error("QUICK_START_COMPLETED");
  if (locked.state.currentStep !== parsed.data.stepId) throw new Error("STALE_QUICK_START_STEP");
  if (parsed.data.stepId === "financial_defaults" && !(await financeDefaultsReadyTx(tx))) {
    throw new Error("FINANCE_DEFAULTS_INCOMPLETE");
  }

  if (parsed.data.stepId === "financial_defaults") await lockedQuickStartDefaultsTx(tx);

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
}

export async function pauseQuickStartTx(
  tx: QuickStartTx,
  actor: Actor,
  raw: z.input<typeof pauseQuickStartSchema>,
): Promise<OwnerQuickStartState> {
  const parsed = pauseQuickStartSchema.safeParse(raw);
  if (!parsed.success)
    throw new QuickStartError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Isian setup tidak valid.",
    );
  await assertQuickStartActorTx(tx, actor, { action: "PAUSE", stepId: parsed.data.currentStep });
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
}

export async function createFirstProjectQuickStartTx(
  tx: QuickStartTx,
  actor: Actor,
  raw: z.input<typeof quickStartProjectSchema>,
): Promise<{ readonly projectId: string; readonly alreadyCompleted: boolean }> {
  const parsed = quickStartProjectSchema.safeParse(raw);
  if (!parsed.success)
    throw new QuickStartError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Isian setup tidak valid.",
    );
  await assertQuickStartActorTx(tx, actor, { action: "CREATE_PROJECT", project: parsed.data });
  const locked = await lockQuickStartState(tx);
  if (locked.state.status === "COMPLETED") {
    if (locked.state.firstProjectId) {
      return { projectId: locked.state.firstProjectId, alreadyCompleted: true };
    }
    throw new Error("QUICK_START_COMPLETED");
  }
  if (locked.state.currentStep !== "first_project") throw new Error("STALE_QUICK_START_STEP");
  if (!(await financeDefaultsReadyTx(tx))) throw new Error("FINANCE_DEFAULTS_INCOMPLETE");
  await validateQuickStartProjectTx(tx, parsed.data);
  const allocation = await lockedQuickStartDefaultsTx(tx);

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
}

export async function setInitialStockDecisionTx(
  tx: QuickStartTx,
  actor: Actor,
  raw: z.input<typeof setInitialStockDecisionSchema>,
): Promise<OwnerQuickStartState> {
  const parsed = setInitialStockDecisionSchema.safeParse(raw);
  if (!parsed.success)
    throw new QuickStartError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Isian setup tidak valid.",
    );
  await assertQuickStartActorTx(tx, actor, {
    action: "STOCK_DECISION",
    decision: parsed.data.decision,
  });

  const locked = await lockQuickStartState(tx);
  if (
    parsed.data.decision === "NO_LEGACY_STOCK" &&
    locked.state.initialStockDecision !== parsed.data.decision
  )
    await assertNoLegacyStockTx(tx);
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
}

/** Serialize initialization, role changes and manual/AI setup decisions in the instance. */
export async function assertQuickStartActorTx(
  tx: QuickStartTx,
  actor: Actor,
  input: QuickStartInput | null,
  ai = false,
): Promise<void> {
  const [company] = await tx
    .select({ id: tenant.id })
    .from(tenant)
    .where(eq(tenant.id, INSTANCE_TENANT_ID))
    .for("update");
  const [r] = await tx.select().from(role).where(eq(role.id, actor.roleId)).for("share");
  const [u] = await tx.select().from(user).where(eq(user.id, actor.userId)).for("share");
  const membership = await tx.query.tenantMember.findFirst({
    where: and(
      eq(tenantMember.tenantId, INSTANCE_TENANT_ID),
      eq(tenantMember.userId, actor.userId),
    ),
  });
  const keys = await tx.query.rolePermission.findMany({
    where: eq(rolePermission.roleId, actor.roleId),
  });
  const can = (key: PermissionKey): boolean =>
    actorCan(actor, key) && keys.some((k) => k.permissionKey === key);
  const stock = input === null || input.action === "STOCK_DECISION";
  const permitted = stock
    ? can("manage:onboarding") || can("create:opening_inventory")
    : can("manage:onboarding");
  if (
    !company ||
    !r ||
    !u ||
    !u.isActive ||
    !actor.isActive ||
    u.roleId !== actor.roleId ||
    r.dataScope !== actor.dataScope ||
    !membership?.isActive ||
    membership.roleId !== u.roleId ||
    (u.mustChangePassword && !actor.developerActorUserId) ||
    !permitted ||
    (ai && !can("use:ai_chat")) ||
    (input?.action === "CREATE_PROJECT" && !can("create:project"))
  )
    throw new QuickStartError(
      "FORBIDDEN",
      "Sesi atau izin setup berubah. Periksa akses akun Anda.",
    );
  if (
    ai &&
    (input?.action === "CREATE_PROJECT" ||
      (input?.action === "ADVANCE" && input.stepId === "financial_defaults")) &&
    !can("view:settings")
  )
    throw new QuickStartError(
      "FORBIDDEN",
      "Akses membaca default finansial diperlukan untuk meninjau setup ini.",
    );
}

export async function lockedQuickStartDefaultsTx(
  tx: QuickStartTx,
): Promise<Awaited<ReturnType<typeof readBudgetAllocationSnapshot>>> {
  await tx
    .select({ id: budgetAllocationSetting.id })
    .from(budgetAllocationSetting)
    .where(eq(budgetAllocationSetting.tenantId, INSTANCE_TENANT_ID))
    .orderBy(asc(budgetAllocationSetting.id))
    .for("share");
  await tx
    .select({ id: expenseCategory.id })
    .from(expenseCategory)
    .where(eq(expenseCategory.tenantId, INSTANCE_TENANT_ID))
    .orderBy(asc(expenseCategory.id))
    .for("share");
  await tx
    .select({ id: budgetAllocationSettingCategory.id })
    .from(budgetAllocationSettingCategory)
    .where(eq(budgetAllocationSettingCategory.tenantId, INSTANCE_TENANT_ID))
    .orderBy(asc(budgetAllocationSettingCategory.id))
    .for("share");
  const defaults = await readBudgetAllocationSnapshot(tx);
  const ownedCategories = await tx.query.expenseCategory.findMany({
    where: eq(expenseCategory.tenantId, INSTANCE_TENANT_ID),
    columns: { id: true },
  });
  if (defaults.categories.some((c) => !ownedCategories.some((o) => o.id === c.expenseCategoryId)))
    throw new QuickStartError("CONFLICT", "Kategori default budget di luar perusahaan ini.");
  if (
    !defaults.settingId ||
    !Number.isFinite(defaults.budgetCapRatio) ||
    defaults.budgetCapRatio <= 0 ||
    defaults.budgetCapRatio > 1 ||
    defaults.categories.some(
      (c) => !Number.isFinite(c.ratioPercentage) || c.ratioPercentage < 0 || c.ratioPercentage > 1,
    ) ||
    defaults.categories.reduce((sum, c) => sum + c.ratioPercentage, 0) > 1.000001 ||
    !DEFAULT_EXPENSE_CATEGORIES.every((c) => defaults.categories.some((v) => v.code === c.code))
  )
    throw new QuickStartError(
      "CONFLICT",
      "Default budget belum lengkap atau tidak valid. Periksa pengaturan formula dan lima kategori utama.",
    );
  return defaults;
}

export async function validateQuickStartProjectTx(
  tx: QuickStartTx,
  input: z.infer<typeof quickStartProjectSchema>,
): Promise<{ clientName: string; managerName: string }> {
  let clientName = input.newClientName ?? "";
  if (input.clientId) {
    const [c] = await tx
      .select()
      .from(client)
      .where(and(eq(client.id, input.clientId), eq(client.tenantId, INSTANCE_TENANT_ID)))
      .for("share");
    if (!c) throw new QuickStartError("NOT_FOUND", "Klien tidak tersedia. Pilih klien yang valid.");
    clientName = c.name;
  }
  let managerName = "Belum ditugaskan";
  if (input.projectManagerId) {
    const [u] = await tx
      .select()
      .from(user)
      .where(eq(user.id, input.projectManagerId))
      .for("share");
    const member = await tx.query.tenantMember.findFirst({
      where: and(
        eq(tenantMember.tenantId, INSTANCE_TENANT_ID),
        eq(tenantMember.userId, input.projectManagerId),
        eq(tenantMember.isActive, true),
      ),
    });
    const r = u ? await tx.query.role.findFirst({ where: eq(role.id, u.roleId) }) : undefined;
    if (!u?.isActive || !member || member.roleId !== u.roleId || r?.dataScope !== "ASSIGNED")
      throw new QuickStartError(
        "VALIDATION_ERROR",
        "Project Manager harus aktif, berada di perusahaan ini dan memiliki cakupan proyek ditugaskan.",
      );
    managerName = u.name;
  }
  return { clientName, managerName };
}
export async function assertNoLegacyStockTx(tx: QuickStartTx): Promise<void> {
  const physical = await tx.query.materialInventory.findFirst({
    where: and(
      eq(materialInventory.tenantId, INSTANCE_TENANT_ID),
      or(ne(materialInventory.currentStock, "0"), ne(materialInventory.reservedStock, "0")),
    ),
    columns: { id: true },
  });
  const pending = await tx.query.inventoryOpeningBatch.findFirst({
    where: and(
      eq(inventoryOpeningBatch.tenantId, INSTANCE_TENANT_ID),
      inArray(inventoryOpeningBatch.status, ["DRAFT", "PENDING_APPROVAL"]),
    ),
    columns: { id: true },
  });
  if (physical || pending)
    throw new QuickStartError(
      "CONFLICT",
      "Stok atau pengajuan saldo awal sudah ada. Tinjau saldo awal; keputusan tidak ada stok lama belum bisa dipakai.",
    );
}
export async function resumeQuickStartTx(
  tx: QuickStartTx,
  actor: Actor,
  stepId: Exclude<QuickStartStepId, "success">,
): Promise<OwnerQuickStartState> {
  await assertQuickStartActorTx(tx, actor, { action: "RESUME", stepId });
  const locked = await lockQuickStartState(tx);
  if (locked.state.currentStep !== stepId || locked.state.status !== "PAUSED")
    throw new QuickStartError(
      "CONFLICT",
      "Posisi setup berubah atau sudah berjalan. Minta preview terbaru.",
    );
  const next: OwnerQuickStartState = { ...locked.state, status: "IN_PROGRESS" };
  await persistQuickStartStateTx({ tx, actor, locked, next, action: "RESUME_OWNER_QUICK_START" });
  await insertEventTx({ tx, actor, eventType: "QUICK_START_RESUMED", stepId });
  return next;
}
export async function recordQuickStartRetryTx(
  tx: QuickStartTx,
  actor: Actor,
  stepId: QuickStartStepId,
): Promise<string> {
  await assertQuickStartActorTx(tx, actor, { action: "RETRY", stepId });
  const [event] = await tx
    .insert(onboardingEvent)
    .values({ actorUserId: actor.userId, eventType: "QUICK_START_RETRY", stepId })
    .returning({ id: onboardingEvent.id });
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "RETRY_OWNER_QUICK_START",
    targetTable: "onboarding_event",
    targetId: event.id,
    newState: JSON.stringify({ stepId }),
  });
  return event.id;
}
