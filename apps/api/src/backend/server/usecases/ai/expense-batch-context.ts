import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@backend/db";
import {
  INSTANCE_TENANT_ID,
  project,
  projectBudgets,
  projectBudgetCategory,
  expenseCategory,
  materialMaster,
  inventoryLocation,
  materialInventory,
  projectCategoryPlanItem,
  projectRap,
  projectRapItem,
  formDraft,
  attachment,
} from "@backend/db/schema";
import { actorCan } from "@backend/lib/auth/permissions";
import type { Actor } from "@backend/server/actor";
import type { FinanceTransaction } from "../finance/mutation-access";
import { readApprovalThresholds } from "@backend/lib/finance/approval-thresholds";
import { thresholdCentsToRupiah } from "@atria/core/finance/approval-thresholds";
import { decideExpenseApproval } from "@atria/core/finance/expense-approval-rule";
import { hasTwoDecimalPrecision, RAP_COST_MAX } from "@atria/core/project/rap-cost";
import {
  expenseDraftPayloadSchema,
  type ExpenseDraftPayloadInput,
} from "@atria/core/validations/expense-draft";
import { submitFieldRequestSchema } from "@atria/core/validations/finance";
import {
  expenseBatchRequestSchema,
  expenseBatchProposalSchema,
  expenseBatchStateSchema,
  EXPENSE_BATCH_KIND,
  type ExpenseBatchRequest,
  type ExpenseBatchProposal,
  type ExpenseBatchRow,
  type ExpenseBatchView,
} from "@atria/core/ai/expense-batch";
import { authorizedPrivateAttachment } from "../media/private-attachments";
import { FinanceInputError } from "./finance-input-context";
export const EXPENSE_BATCH_FORM_TYPE = "AI_EXPENSE_BATCH";
export type ExpenseViewer = Pick<Actor, "userId" | "permissions" | "dataScope">;
export type ExpenseReader = Pick<FinanceTransaction, "query" | "select">;
export const expenseHash = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function assertExpenseBatchRights(
  actor: ExpenseViewer,
  permission: "create:cost" | "view:cost" = "create:cost",
): void {
  if (
    !actorCan(actor, "use:ai_chat") ||
    !actorCan(actor, "view:project") ||
    !actorCan(actor, permission) ||
    actor.dataScope === "NONE"
  )
    throw new FinanceInputError("FORBIDDEN", "Akses pengeluaran atau proyek tidak tersedia.");
}
export async function assertExpenseProjectAccess(
  actor: ExpenseViewer,
  projectId: string,
  reader: Pick<ExpenseReader, "query"> = db,
): Promise<typeof project.$inferSelect> {
  const p = await reader.query.project.findFirst({
    where: and(eq(project.id, projectId), eq(project.tenantId, INSTANCE_TENANT_ID)),
  });
  if (!p || (actor.dataScope === "ASSIGNED" && p.projectManagerId !== actor.userId))
    throw new FinanceInputError("FORBIDDEN", "Proyek tidak ditemukan atau di luar akses Anda.");
  return p;
}
export type ExpenseContext = {
  project: typeof project.$inferSelect;
  categories: (typeof projectBudgetCategory.$inferSelect & {
    expenseCategory: typeof expenseCategory.$inferSelect;
  })[];
  materials: (typeof materialMaster.$inferSelect)[];
  locations: (typeof inventoryLocation.$inferSelect)[];
  inventories: (typeof materialInventory.$inferSelect)[];
  packages: (typeof projectCategoryPlanItem.$inferSelect)[];
  rapItems: (typeof projectRapItem.$inferSelect)[];
  threshold: number;
};
export async function readExpenseContext(
  actor: ExpenseViewer,
  projectId: string,
  reader: ExpenseReader = db,
): Promise<ExpenseContext> {
  if (
    !actorCan(actor, "use:ai_chat") ||
    !actorCan(actor, "view:project") ||
    (!actorCan(actor, "create:cost") && !actorCan(actor, "view:cost")) ||
    actor.dataScope === "NONE"
  )
    throw new FinanceInputError("FORBIDDEN", "Akses pengeluaran tidak tersedia.");
  const p = await assertExpenseProjectAccess(actor, projectId, reader);
  const budgets = await reader.query.projectBudgets.findMany({
    where: and(eq(projectBudgets.projectId, p.id), eq(projectBudgets.tenantId, INSTANCE_TENANT_ID)),
  });
  const categories = await reader.query.projectBudgetCategory.findMany({
    where: and(
      eq(projectBudgetCategory.tenantId, INSTANCE_TENANT_ID),
      inArray(
        projectBudgetCategory.projectBudgetId,
        budgets.length ? budgets.map((x) => x.id) : ["00000000-0000-0000-0000-000000000000"],
      ),
    ),
    with: { expenseCategory: true },
    orderBy: [asc(projectBudgetCategory.id)],
  });
  const materials = actorCan(actor, "view:material")
    ? await reader.query.materialMaster.findMany({
        where: and(
          eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
          eq(materialMaster.isActive, true),
        ),
        orderBy: [asc(materialMaster.name), asc(materialMaster.id)],
      })
    : [];
  const locations = actorCan(actor, "view:material")
    ? await reader.query.inventoryLocation.findMany({
        where: and(
          eq(inventoryLocation.tenantId, INSTANCE_TENANT_ID),
          eq(inventoryLocation.isActive, true),
        ),
        orderBy: [asc(inventoryLocation.name), asc(inventoryLocation.id)],
      })
    : [];
  const inventories = actorCan(actor, "view:material")
    ? await reader.query.materialInventory.findMany({
        where: eq(materialInventory.tenantId, INSTANCE_TENANT_ID),
        orderBy: [asc(materialInventory.id)],
      })
    : [];
  const packages = await reader.query.projectCategoryPlanItem.findMany({
    where: and(
      eq(projectCategoryPlanItem.projectId, p.id),
      eq(projectCategoryPlanItem.tenantId, INSTANCE_TENANT_ID),
    ),
    orderBy: [asc(projectCategoryPlanItem.id)],
  });
  const raps = await reader.query.projectRap.findMany({
    where: and(eq(projectRap.projectId, p.id), eq(projectRap.tenantId, INSTANCE_TENANT_ID)),
  });
  const rapItems = await reader.query.projectRapItem.findMany({
    where: and(
      eq(projectRapItem.tenantId, INSTANCE_TENANT_ID),
      inArray(
        projectRapItem.projectRapId,
        raps.length ? raps.map((x) => x.id) : ["00000000-0000-0000-0000-000000000000"],
      ),
    ),
    orderBy: [asc(projectRapItem.id)],
  });
  const threshold = thresholdCentsToRupiah((await readApprovalThresholds(reader)).fieldCostCents);
  return {
    project: p,
    categories,
    materials,
    locations,
    inventories,
    packages,
    rapItems,
    threshold,
  };
}
export async function ownedExpenseForm(
  actor: ExpenseViewer,
  id: string,
  type: string,
  reader: ExpenseReader = db,
): Promise<typeof formDraft.$inferSelect> {
  const draft = await reader.query.formDraft.findFirst({
    where: and(
      eq(formDraft.id, id),
      eq(formDraft.ownerUserId, actor.userId),
      eq(formDraft.tenantId, INSTANCE_TENANT_ID),
      eq(formDraft.formType, type),
    ),
  });
  if (!draft)
    throw new FinanceInputError("NOT_FOUND", "Draft tidak tersedia atau bukan milik Anda.");
  return draft;
}
export async function expenseReceipt(
  actor: ExpenseViewer,
  id: string,
  projectId: string,
  reader: ExpenseReader = db,
): Promise<NonNullable<ExpenseDraftPayloadInput["receipt"]>> {
  const row = await reader.query.attachment.findFirst({
    where: and(
      eq(attachment.id, id),
      eq(attachment.tenantId, INSTANCE_TENANT_ID),
      eq(attachment.uploadedById, actor.userId),
    ),
  });
  if (!row)
    throw new FinanceInputError(
      "FORBIDDEN",
      "Bukti pengeluaran tidak tersedia atau bukan milik Anda.",
    );
  const url = new URL(
    `/api/media/attachments/${row.id}`,
    process.env.WEB_ORIGIN ?? "http://localhost:3000",
  ).href;
  await authorizedPrivateAttachment(actor, url, undefined, reader);
  if (
    !row.mimeType.startsWith("image/") ||
    !["private_expense", "private_ai_chat"].includes(row.referenceType) ||
    (row.referenceType === "private_expense" && row.referenceId !== projectId)
  )
    throw new FinanceInputError(
      "VALIDATION_ERROR",
      "Bukti nota harus gambar milik Anda untuk proyek ini. Dokumen data tetap dapat dianalisis tanpa dijadikan nota.",
    );
  return {
    fileId: row.id,
    url,
    fileName: row.fileName,
    mimeType: row.mimeType,
    size: row.fileSize,
  };
}
export function reviewExpensePayload(
  actor: ExpenseViewer,
  payload: ExpenseDraftPayloadInput,
  selectedKeys: readonly string[],
  context: ExpenseContext,
): {
  rows: ExpenseBatchRow[];
  hash: string;
  categories: ExpenseBatchView["categories"];
  blockers: string[];
  totalSelected: number;
} {
  const rows: ExpenseBatchRow[] = [],
    pending = new Map(context.categories.map((c) => [c.id, Number(c.pendingAmount)])),
    stock = new Map<string, { current: number; reserved: number }>();
  for (const line of payload.lines) {
    const issues: string[] = [],
      category = context.categories.find((c) => c.id === line.projectBudgetCategoryId),
      material = context.materials.find((m) => m.id === line.materialId),
      location = context.locations.find((l) => l.id === line.inventoryLocationId),
      pkg = context.packages.find((p) => p.id === line.projectCategoryPlanItemId),
      rap = context.rapItems.find((r) => r.id === line.projectRapItemId);
    const qty = Number(line.quantity),
      price = Number(line.unitPrice),
      amount = Number(line.amount);
    if (
      !submitFieldRequestSchema.safeParse({
        projectId: payload.projectId,
        ...line,
        projectBudgetItemId: undefined,
        materialId: line.materialId || undefined,
        projectRapItemId: line.projectRapItemId || undefined,
        projectCategoryPlanItemId: line.projectCategoryPlanItemId || undefined,
        inventoryLocationId: line.inventoryLocationId || undefined,
        quantity: qty,
        unitPrice: price,
        amount,
      }).success
    )
      issues.push("Lengkapi kategori, deskripsi, jumlah dan nominal yang valid.");
    if (!category) issues.push("Pilih kategori budget proyek yang tersedia.");
    if (
      !hasTwoDecimalPrecision(qty) ||
      !hasTwoDecimalPrecision(price) ||
      !hasTwoDecimalPrecision(amount) ||
      amount > RAP_COST_MAX ||
      price > RAP_COST_MAX ||
      qty > 999999999
    )
      issues.push("Jumlah/harga memakai maksimal dua desimal dan batas nominal yang berlaku.");
    if (
      (line.materialId || line.projectRapItemId || line.stockHandling !== "EXPENSE_ONLY") &&
      category?.expenseCategory.code !== "MATERIAL"
    )
      issues.push("Tautan material dan aksi stok hanya untuk kategori Material.");
    if (line.materialId && !material) issues.push("Material tidak aktif atau tidak tersedia.");
    if (line.projectRapItemId && (!rap || (rap.materialId && rap.materialId !== line.materialId)))
      issues.push("Item RAP tidak sesuai proyek/material.");
    if (
      line.projectCategoryPlanItemId &&
      (!pkg ||
        pkg.projectBudgetCategoryId !== line.projectBudgetCategoryId ||
        !["TUKANG", "SUBCON"].includes(category?.expenseCategory.code ?? ""))
    )
      issues.push("Paket kerja tidak sesuai proyek/kategori.");
    if (
      line.stockHandling !== "EXPENSE_ONLY" &&
      (!actorCan(actor, "create:stock_movement") ||
        !material ||
        !location ||
        Math.abs(Math.round(qty * price * 100) / 100 - amount) > 0.001)
    )
      issues.push("Aksi stok memerlukan izin, material/lokasi aktif, dan nominal jumlah × harga.");
    const key = `${line.materialId}:${line.inventoryLocationId}`,
      inv = context.inventories.find(
        (i) => i.materialId === line.materialId && i.locationId === line.inventoryLocationId,
      ),
      before = stock.get(key) ?? {
        current: Number(inv?.currentStock ?? 0),
        reserved: Number(inv?.reservedStock ?? 0),
      };
    const after = {
      current:
        before.current +
        (line.stockHandling === "STOCK_IN" || line.stockHandling === "RESERVE_FOR_PROJECT"
          ? qty
          : 0),
      reserved: before.reserved + (line.stockHandling === "RESERVE_FOR_PROJECT" ? qty : 0),
    };
    if (
      selectedKeys.includes(line.key) &&
      issues.length === 0 &&
      line.stockHandling !== "EXPENSE_ONLY"
    )
      stock.set(key, after);
    const rule = category
      ? decideExpenseApproval({
          amount,
          allocatedAmount: Number(category.allocatedAmount),
          actualAmount: Number(category.actualAmount),
          otherPendingAmount: pending.get(category.id) ?? 0,
          ownerApprovalThreshold: context.threshold,
        })
      : { requiresOwnerApproval: false };
    if (category && selectedKeys.includes(line.key) && issues.length === 0)
      pending.set(category.id, (pending.get(category.id) ?? 0) + amount);
    const effect = {
      EXPENSE_ONLY: "Tanpa perubahan stok",
      STOCK_IN: "Masuk gudang",
      DIRECT_USE: "Pembelian masuk lalu langsung digunakan",
      RESERVE_FOR_PROJECT: "Masuk gudang lalu dicadangkan untuk proyek",
    }[line.stockHandling];
    rows.push({
      key: line.key,
      description: line.description,
      categoryName: category?.expenseCategory.name ?? "Kategori belum dipilih",
      materialName: material?.name ?? null,
      unit: material?.unit ?? null,
      locationName: location?.name ?? null,
      packageName: pkg?.name ?? null,
      issues,
      requiresApproval: rule.requiresOwnerApproval,
      stockEffect: effect,
      stockBefore: line.stockHandling !== "EXPENSE_ONLY" ? before.current : null,
      stockAfter: line.stockHandling !== "EXPENSE_ONLY" ? after.current : null,
      reservedBefore: line.stockHandling !== "EXPENSE_ONLY" ? before.reserved : null,
      reservedAfter: line.stockHandling !== "EXPENSE_ONLY" ? after.reserved : null,
      amount,
    });
  }
  const blockers =
    context.project.status !== "ACTIVE" ? ["Proyek harus aktif sebelum pengeluaran diajukan."] : [];
  const relevantMaterials = new Set(payload.lines.map((l) => l.materialId)),
    relevantLocations = new Set(payload.lines.map((l) => l.inventoryLocationId));
  const hash = expenseHash({
    project: context.project,
    categories: context.categories,
    threshold: context.threshold,
    materials: context.materials.filter((m) => relevantMaterials.has(m.id)),
    locations: context.locations.filter((l) => relevantLocations.has(l.id)),
    inventories: context.inventories.filter(
      (i) => relevantMaterials.has(i.materialId) && relevantLocations.has(i.locationId),
    ),
    packages: context.packages.filter((p) =>
      payload.lines.some((l) => l.projectCategoryPlanItemId === p.id),
    ),
    rap: context.rapItems.filter((r) => payload.lines.some((l) => l.projectRapItemId === r.id)),
    receipt: payload.receipt,
  });
  return {
    rows,
    hash,
    blockers,
    totalSelected: rows
      .filter((r) => selectedKeys.includes(r.key))
      .reduce((s, r) => s + r.amount, 0),
    categories: context.categories.map((c) => ({
      id: c.id,
      name: c.expenseCategory.name,
      code: c.expenseCategory.code,
      allocated: actorCan(actor, "view:budget") ? Number(c.allocatedAmount) : 0,
      actual: actorCan(actor, "view:budget") ? Number(c.actualAmount) : 0,
      pending: actorCan(actor, "view:budget") ? Number(c.pendingAmount) : 0,
      proposed: rows
        .filter(
          (r) =>
            selectedKeys.includes(r.key) &&
            payload.lines.find((l) => l.key === r.key)?.projectBudgetCategoryId === c.id,
        )
        .reduce((sum, r) => sum + r.amount, 0),
    })),
  };
}
export async function prepareExpenseBatch(
  actor: ExpenseViewer,
  raw: ExpenseBatchRequest,
  reader: ExpenseReader = db,
): Promise<ExpenseBatchProposal> {
  assertExpenseBatchRights(actor);
  const request = expenseBatchRequestSchema.parse(raw);
  let payload: ExpenseDraftPayloadInput | undefined,
    sourceDraftId: string | null = null,
    sourceRevision: number | null = null,
    expectedReviewRevision: number | null = null,
    reviewId: string = randomUUID();
  if (request.sourceDraftId) {
    const d = await ownedExpenseForm(actor, request.sourceDraftId, "EXPENSE_CREATE", reader);
    if (d.status !== "ACTIVE" || d.expiresAt <= new Date())
      throw new FinanceInputError("CONFLICT", "Draft sumber tidak aktif atau kedaluwarsa.");
    payload = expenseDraftPayloadSchema.parse(d.payload);
    sourceDraftId = d.id;
    sourceRevision = d.revision;
  }
  if (request.reviewDraftId) {
    const d = await ownedExpenseForm(actor, request.reviewDraftId, EXPENSE_BATCH_FORM_TYPE, reader);
    if (d.status !== "ACTIVE" || d.revision !== request.expectedRevision)
      throw new FinanceInputError("CONFLICT", "Versi review berubah. Baca draft terbaru.");
    const state = expenseBatchStateSchema.parse(d.payload);
    payload = {
      ...state.payload,
      lines: state.payload.lines.filter((l) => !state.submitted.some((s) => s.key === l.key)),
    };
    sourceDraftId = state.sourceDraftId;
    sourceRevision = state.sourceRevision;
    reviewId = d.id;
    expectedReviewRevision = d.revision;
  }
  const projectId = payload?.projectId || request.projectId;
  if (!projectId)
    throw new FinanceInputError("VALIDATION_ERROR", "Pilih proyek sebelum menyiapkan draft.");
  if (request.projectId && request.projectId !== projectId)
    throw new FinanceInputError("CONFLICT", "Koreksi proyek memerlukan draft baru.");
  if (payload && !payload.projectId) payload = { ...payload, projectId };
  if (request.rows) {
    payload = {
      projectId,
      inputMode: "MANUAL",
      receipt: payload?.receipt ?? null,
      ocrWarning: payload?.ocrWarning ?? null,
      lines: request.rows.map((r, index) => ({
        key: r.key ?? `baris-${index + 1}`,
        projectBudgetCategoryId: r.projectBudgetCategoryId ?? "",
        projectBudgetItemId: "",
        description: r.description,
        quantity: r.quantity ?? "",
        unitPrice: r.unitPrice ?? "",
        amount: r.amount ?? "",
        materialId: r.materialId ?? "",
        projectRapItemId: r.projectRapItemId ?? "",
        projectCategoryPlanItemId: r.projectCategoryPlanItemId ?? "",
        inventoryLocationId: r.inventoryLocationId ?? "",
        stockHandling: r.stockHandling,
      })),
    };
  }
  if (!payload) throw new FinanceInputError("VALIDATION_ERROR", "Draft tidak berisi baris.");
  if (request.receiptAttachmentId)
    payload = {
      ...payload,
      receipt: await expenseReceipt(actor, request.receiptAttachmentId, projectId, reader),
      inputMode: "RECEIPT",
    };
  payload = expenseDraftPayloadSchema.parse(payload);
  if (new Set(payload.lines.map((l) => l.key)).size !== payload.lines.length)
    throw new FinanceInputError("VALIDATION_ERROR", "ID baris harus unik.");
  const context = await readExpenseContext(actor, projectId, reader),
    review = reviewExpensePayload(
      actor,
      payload,
      payload.lines.map((l) => l.key),
      context,
    );
  return expenseBatchProposalSchema.parse({
    kind: EXPENSE_BATCH_KIND,
    reviewId,
    request,
    payload,
    projectName: context.project.name,
    expectedContext: review.hash,
    sourceDraftId,
    sourceRevision,
    expectedReviewRevision,
  });
}
