import { createHash } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@backend/db";
import {
  INSTANCE_TENANT_ID,
  project,
  projectBudgets,
  projectRap,
  projectRapItem,
  projectCategoryPlanItem,
  rabEstimate,
} from "@backend/db/schema";
import { actorCan } from "@backend/lib/auth/permissions";
import type { Actor } from "@backend/server/actor";
import {
  buildRabMaterialItemValues,
  buildRabCategoryPlanItemValues,
} from "@backend/app/actions/project/rap-rab-utils";
import { getNextRabRevision } from "@atria/core/project/rab-selection";
import {
  rabDraftProposalSchema,
  type RabDraftInput,
  type RabDraftProposal,
  type RabDraftRow,
} from "@atria/core/ai/rab-draft";
import type { ActionResponse } from "@atria/core/types/action-response";

export type RabReadActor = Pick<Actor, "userId" | "permissions" | "dataScope"> & {
  readonly isActive?: boolean;
};
export class RabReviewError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR",
    message: string,
  ) {
    super(message);
  }
}
export function canPrepareRab(actor: RabReadActor): boolean {
  return (
    actor.dataScope !== "NONE" &&
    (["use:ai_chat", "view:rap", "view:rab", "create:rab"] as const).every((permission) =>
      actorCan(actor, permission),
    )
  );
}
export function rabFailure(error: unknown): ActionResponse<never> {
  if (error instanceof RabReviewError)
    return { success: false, error: { code: error.code, message: error.message } };
  if (error instanceof Error && error.message.startsWith("FORBIDDEN:"))
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Izin atau akses proyek tidak tersedia untuk membuat RAB.",
      },
    };
  return {
    success: false,
    error: {
      code: "TRANSACTION_FAILED",
      message: "Draft RAB belum dapat disimpan. Periksa sumber lalu coba lagi.",
    },
  };
}
export async function assertRabScope(
  actor: RabReadActor,
  projectId: string,
  connection: Pick<typeof db, "query"> = db,
): Promise<typeof project.$inferSelect> {
  if (!canPrepareRab(actor))
    throw new RabReviewError("FORBIDDEN", "Akses chat, RAP dan pembuatan RAB diperlukan.");
  const found = await connection.query.project.findFirst({
    where: and(
      eq(project.id, projectId),
      eq(project.tenantId, INSTANCE_TENANT_ID),
      actor.dataScope === "ASSIGNED" ? eq(project.projectManagerId, actor.userId) : undefined,
    ),
  });
  if (!found)
    throw new RabReviewError("FORBIDDEN", "Proyek tidak ditemukan atau di luar akses Anda.");
  return found;
}
export async function readRabContext(
  actor: RabReadActor,
  projectId: string,
  connection: Pick<typeof db, "query"> = db,
): Promise<{
  readonly projectId: string;
  readonly projectName: string;
  readonly revision: number;
  readonly supersedesId: string | null;
  readonly openDraftId: string | null;
  readonly expectedContext: string;
  readonly rows: readonly RabDraftRow[];
}> {
  const record = await assertRabScope(actor, projectId, connection);
  if (!["DRAFT", "ACTIVE"].includes(record.status))
    throw new RabReviewError("CONFLICT", "RAB hanya dapat disiapkan pada proyek draft atau aktif.");
  const budget = await connection.query.projectBudgets.findFirst({
    where: and(
      eq(projectBudgets.projectId, projectId),
      eq(projectBudgets.tenantId, INSTANCE_TENANT_ID),
    ),
  });
  const rap = await connection.query.projectRap.findFirst({
    where: and(eq(projectRap.projectId, projectId), eq(projectRap.tenantId, INSTANCE_TENANT_ID)),
    orderBy: [desc(projectRap.revision), desc(projectRap.createdAt)],
  });
  const packages = await connection.query.projectCategoryPlanItem.findMany({
    where: and(
      eq(projectCategoryPlanItem.projectId, projectId),
      eq(projectCategoryPlanItem.tenantId, INSTANCE_TENANT_ID),
    ),
    with: { expenseCategory: true },
    orderBy: [asc(projectCategoryPlanItem.id)],
  });
  const estimates = await connection.query.rabEstimate.findMany({
    where: and(eq(rabEstimate.projectId, projectId), eq(rabEstimate.tenantId, INSTANCE_TENANT_ID)),
    orderBy: [asc(rabEstimate.id)],
  });
  const items = rap
    ? await connection.query.projectRapItem.findMany({
        where: and(
          eq(projectRapItem.projectRapId, rap.id),
          eq(projectRapItem.tenantId, INSTANCE_TENANT_ID),
        ),
        orderBy: [asc(projectRapItem.id)],
      })
    : [];
  const targetGrossPercentage = budget ? Number(budget.targetGrossPercentage) : 10;
  const rows: RabDraftRow[] = [];
  if (rap?.status === "LOCKED")
    for (const item of items) {
      const client = buildRabMaterialItemValues({
        rabEstimateId: rap.id,
        item: { ...item, revision: rap.revision },
        targetGrossPercentage,
        displayOrder: rows.length + 1,
      });
      rows.push({
        rowId: item.id,
        sourceId: item.id,
        sourceKind: "MATERIAL",
        sourceName: item.name,
        sourceRevision: rap.revision,
        clientLabel: client.clientLabel,
        description: "",
        quantity: Number(client.quantity),
        unit: client.unit,
        unitPrice: Number(client.unitPrice),
        selected: true,
      });
    }
  const superseded = new Set(
    packages
      .filter((p) => p.status !== "CANCELLED")
      .flatMap((p) =>
        p.supersedesProjectCategoryPlanItemId ? [p.supersedesProjectCategoryPlanItemId] : [],
      ),
  );
  for (const item of packages) {
    const code = item.expenseCategory.code;
    if (
      (code !== "TUKANG" && code !== "SUBCON") ||
      !["ACTIVE", "LOCKED"].includes(item.status) ||
      superseded.has(item.id)
    )
      continue;
    const client = buildRabCategoryPlanItemValues({
      rabEstimateId: item.id,
      item,
      targetGrossPercentage,
      displayOrder: rows.length + 1,
    });
    rows.push({
      rowId: item.id,
      sourceId: item.id,
      sourceKind: code,
      sourceName: item.name,
      sourceRevision: item.revision,
      clientLabel: client.clientLabel,
      description: "",
      quantity: Number(client.quantity),
      unit: client.unit,
      unitPrice: Number(client.unitPrice),
      selected: true,
    });
  }
  return {
    projectId,
    projectName: record.name,
    revision: getNextRabRevision(estimates),
    supersedesId: estimates.find((r) => r.status === "APPROVED")?.id ?? null,
    openDraftId: estimates.find((r) => r.status === "DRAFT")?.id ?? null,
    expectedContext: createHash("sha256")
      .update(JSON.stringify({ record, budget, rap, items, packages, estimates }))
      .digest("hex"),
    rows,
  };
}
export async function buildRabProposal(
  actor: RabReadActor,
  input: RabDraftInput,
): Promise<RabDraftProposal> {
  const context = await readRabContext(actor, input.projectId);
  if (context.openDraftId)
    throw new RabReviewError(
      "CONFLICT",
      "Proyek sudah memiliki draft RAB. Buka dan lanjutkan draft tersebut di halaman proyek.",
    );
  const rows = input.rows.map((request) => {
    const candidate = context.rows.find(
      (row) => row.sourceId === request.sourceId && row.sourceKind === request.sourceKind,
    );
    if (!candidate)
      throw new RabReviewError(
        "CONFLICT",
        "Pilih sumber terbaru: Material RAP terkunci atau paket Tukang/Subcon Siap.",
      );
    return {
      ...candidate,
      clientLabel: request.clientLabel ?? candidate.clientLabel,
      description: request.description ?? "",
      quantity: request.quantity ?? candidate.quantity,
      unitPrice: request.unitPrice ?? candidate.unitPrice,
    };
  });
  return rabDraftProposalSchema.parse({
    kind: "RAB_DRAFT",
    projectId: input.projectId,
    projectName: context.projectName,
    revision: context.revision,
    supersedesId: context.supersedesId,
    title: input.title ?? `RAB ${context.projectName}`,
    clientNotes: input.clientNotes ?? "",
    expectedContext: context.expectedContext,
    rows,
  });
}
