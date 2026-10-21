import { createHash } from "node:crypto";
import { db } from "@backend/db";
import {
  project,
  projectRap,
  projectBudgets,
  projectBudgetCategory,
  expenseCategory,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { actorCan } from "@backend/lib/auth/permissions";
import type { Actor } from "@backend/server/actor";
import type { ActionResponse } from "@atria/core/types/action-response";
import { readSetupRecords, type SetupRecords } from "../project/rap-setup-reader";
import {
  setupProposalSchema,
  setupReadiness,
  simulateSetupStep,
  setupStepPermission,
  type SetupInput,
  type SetupProposal,
  type SetupState,
  type SetupStep,
} from "@atria/core/ai/rap-finalization";
import { sumRapAmounts } from "@atria/core/project/rap-cost";

type ReadActor = Pick<Actor, "userId" | "permissions" | "dataScope"> & {
  readonly isActive?: boolean;
};
export class SetupError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR",
    message: string,
  ) {
    super(message);
  }
}
export function setupMessage(text: string): string {
  return text
    .replaceAll("TUKANG", "Tukang")
    .replaceAll("SUBCON", "Subcon")
    .replaceAll("DRAFT", "Draft")
    .replaceAll("package", "paket");
}
export function setupFailure(error: unknown): ActionResponse<never> {
  if (error instanceof SetupError)
    return { success: false, error: { code: error.code, message: setupMessage(error.message) } };
  if (error instanceof Error && error.message.startsWith("FORBIDDEN:"))
    return {
      success: false,
      error: { code: "FORBIDDEN", message: setupMessage(error.message.slice(10).trim()) },
    };
  return {
    success: false,
    error: {
      code: "TRANSACTION_FAILED",
      message: "Tindakan RAP belum dapat disimpan. Periksa kesiapan lalu coba lagi.",
    },
  };
}
export function canReadSetup(actor: ReadActor): boolean {
  return (
    actor.dataScope !== "NONE" &&
    (["use:ai_chat", "view:rap", "view:budget"] as const).every((p) => actorCan(actor, p))
  );
}
export async function assertSetupScope(
  actor: ReadActor,
  id: string,
  connection: Pick<typeof db, "query"> = db,
): Promise<typeof project.$inferSelect> {
  if (!canReadSetup(actor))
    throw new SetupError("FORBIDDEN", "Akses chat, RAP dan budget proyek diperlukan.");
  const row = await connection.query.project.findFirst({
    where: and(
      eq(project.id, id),
      eq(project.tenantId, INSTANCE_TENANT_ID),
      actor.dataScope === "ASSIGNED" ? eq(project.projectManagerId, actor.userId) : undefined,
    ),
  });
  if (!row) throw new SetupError("FORBIDDEN", "Proyek tidak ditemukan atau di luar akses Anda.");
  return row;
}
export type SetupContext = {
  project: typeof project.$inferSelect;
  budget: typeof projectBudgets.$inferSelect & {
    categories: (typeof projectBudgetCategory.$inferSelect & {
      expenseCategory: typeof expenseCategory.$inferSelect;
    })[];
  };
  records: SetupRecords;
  fingerprint: string;
};
export async function readSetupContext(
  actor: ReadActor,
  projectId: string,
  connection: Pick<typeof db, "query"> = db,
): Promise<SetupContext> {
  const record = await assertSetupScope(actor, projectId, connection);
  if (!["DRAFT", "ACTIVE"].includes(record.status))
    throw new SetupError("CONFLICT", "Proyek tidak tersedia untuk finalisasi RAP.");
  const rap = await connection.query.projectRap.findFirst({
    where: and(eq(projectRap.projectId, record.id), eq(projectRap.tenantId, INSTANCE_TENANT_ID)),
    orderBy: [desc(projectRap.revision), desc(projectRap.createdAt)],
  });
  if (!rap) throw new SetupError("NOT_FOUND", "Proyek belum memiliki RAP.");
  const records = await readSetupRecords(rap.id, connection);
  const budget = await connection.query.projectBudgets.findFirst({
    where: and(
      eq(projectBudgets.projectId, record.id),
      eq(projectBudgets.tenantId, INSTANCE_TENANT_ID),
    ),
    with: {
      categories: {
        where: eq(projectBudgetCategory.tenantId, INSTANCE_TENANT_ID),
        orderBy: [asc(projectBudgetCategory.id)],
        with: { expenseCategory: true },
      },
    },
  });
  if (!budget) throw new SetupError("NOT_FOUND", "Budget proyek belum tersedia.");
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ project: record, budget, records }))
    .digest("hex");
  return { project: record, budget, records, fingerprint };
}
const labels = {
  MATERIAL: "Material",
  TUKANG: "Tukang",
  SUBCON: "Subcon",
  REVIEW: "Review",
  COMPLETE: "Selesai",
};
export function setupStepSummary(
  step: SetupStep,
  before: SetupState,
): { label: string; detail: string; packageIds: string[] } {
  if (step.action === "READY_PACKAGES")
    return {
      label: `Tandai ${step.itemIds.length} paket Siap`,
      detail: "Lingkup, jumlah dan estimasi paket yang dipilih sudah ditinjau.",
      packageIds: step.itemIds,
    };
  if (step.action === "SET_SCOPE")
    return {
      label: `${step.category === "TUKANG" ? "Tukang" : "Subcon"}: ${step.skipped ? "tidak digunakan" : "digunakan"}`,
      detail: step.skipped
        ? "Keputusan scope disimpan untuk review RAP."
        : "Scope dibuka kembali untuk perencanaan.",
      packageIds: [],
    };
  if (step.action === "ADVANCE")
    return {
      label: `Lanjut ke ${labels[step.targetStage]}`,
      detail: `Tahap ${labels[before.stage]} memenuhi validasi untuk dilanjutkan.`,
      packageIds: [],
    };
  return {
    label: "Finalisasi dan kunci RAP",
    detail: "RAP selesai ditinjau; perubahan berikutnya mengikuti alur revisi.",
    packageIds: [],
  };
}
export function buildSetupBudget(context: SetupContext): SetupProposal["budget"] {
  const material = sumRapAmounts(context.records.items.map((i) => i.estimatedTotalCost));
  const costs = (code: string): number =>
    sumRapAmounts(
      context.records.packages
        .filter(
          (p) => p.expenseCategory.code === code && !["CANCELLED", "SUPERSEDED"].includes(p.status),
        )
        .map((p) => p.estimatedTotalCost),
    );
  const planTotal = sumRapAmounts(
    [material, costs("TUKANG"), costs("SUBCON")].map((v) => v.toFixed(2)),
  );
  const actual = sumRapAmounts(context.budget.categories.map((c) => c.actualAmount)),
    pending = sumRapAmounts(context.budget.categories.map((c) => c.pendingAmount)),
    remaining = sumRapAmounts(context.budget.categories.map((c) => c.remainingAmount));
  const projectValue = Number(context.project.totalContractValue);
  return {
    projectValue,
    internalCap: Number(context.budget.internalBudget),
    planTotal,
    actual,
    pending,
    remaining,
    marginAmount: sumRapAmounts([projectValue.toFixed(2), (-actual).toFixed(2)]),
    categories: context.budget.categories.map((c) => {
      const code = c.expenseCategory.code,
        planned =
          code === "MATERIAL"
            ? material
            : code === "TUKANG" || code === "SUBCON"
              ? costs(code)
              : null;
      return {
        id: c.id,
        code,
        name: c.expenseCategory.name,
        allocated: Number(c.allocatedAmount),
        planned,
        actual: Number(c.actualAmount),
        pending: Number(c.pendingAmount),
        remaining: Number(c.remainingAmount),
        overAllocation:
          planned === null
            ? 0
            : Math.max(
                0,
                sumRapAmounts([planned.toFixed(2), (-Number(c.allocatedAmount)).toFixed(2)]),
              ),
      };
    }),
  };
}
export function buildSetupProposal(
  actor: ReadActor,
  input: SetupInput,
  context: SetupContext,
): SetupProposal {
  let state = context.records.state;
  const steps = input.steps.map((step) => {
    const permission = setupStepPermission(step, state);
    if (!actorCan(actor, permission))
      throw new SetupError("FORBIDDEN", "Izin untuk salah satu langkah RAP tidak tersedia.");
    const summary = setupStepSummary(step, state);
    try {
      state = simulateSetupStep(state, step);
    } catch (error: unknown) {
      throw new SetupError(
        "VALIDATION_ERROR",
        error instanceof Error ? error.message : "Langkah RAP tidak valid.",
      );
    }
    return { step, permission, ...summary };
  });
  return setupProposalSchema.parse({
    kind: "RAP_SETUP_ACTIONS",
    projectId: context.project.id,
    projectName: context.project.name,
    projectRapId: context.records.rap.id,
    expectedContext: context.fingerprint,
    request: input,
    before: context.records.state,
    after: state,
    steps,
    budget: buildSetupBudget(context),
  });
}
export function setupContextSummary(
  actor: ReadActor,
  context: SetupContext,
): {
  state: SetupState;
  readiness: ReturnType<typeof setupReadiness>;
  budget: SetupProposal["budget"];
  allowed: { ready: boolean; scope: boolean; advance: boolean; finalize: boolean };
} {
  const state = context.records.state;
  const readiness = setupReadiness(state);
  return {
    state,
    readiness,
    budget: buildSetupBudget(context),
    allowed: {
      ready: state.status === "DRAFT" && actorCan(actor, "update:budget"),
      scope: state.status === "DRAFT" && actorCan(actor, "update:budget"),
      advance:
        state.status === "DRAFT" &&
        state.stage !== "REVIEW" &&
        actorCan(actor, state.stage === "MATERIAL" ? "update:rap" : "update:budget"),
      finalize: state.status === "DRAFT" && state.stage === "REVIEW" && actorCan(actor, "lock:rap"),
    },
  };
}
