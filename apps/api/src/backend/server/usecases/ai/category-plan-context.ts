import { createHash, randomUUID } from "node:crypto";
import { db } from "@backend/db";
import {
  INSTANCE_TENANT_ID,
  project,
  projectCategoryPlanItem,
  projectRap,
  projectBudgets,
  itemPriceLibrary,
  vendor,
  projectBudgetCategory,
  expenseCategory,
} from "@backend/db/schema";
import { actorCan } from "@backend/lib/auth/permissions";
import type { Actor } from "@backend/server/actor";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  packageCost,
  packagePlanTotal,
  packageProposalSchema,
  packageSnapshotSchema,
  type PackageCategory,
  type PackageFields,
  type PackageInput,
  type PackageProposal,
  type PackageSnapshot,
} from "@atria/core/ai/category-plan";
import type { ActionResponse } from "@atria/core/types/action-response";

type PlanningActor = Pick<Actor, "userId" | "permissions" | "dataScope"> & {
  readonly isActive?: boolean;
};
export class PackageError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "CONFLICT" | "NOT_FOUND" | "VALIDATION_ERROR",
    message: string,
  ) {
    super(message);
  }
}
export function packageFailure(error: unknown): ActionResponse<never> {
  if (error instanceof PackageError)
    return { success: false, error: { code: error.code, message: error.message } };
  if (error instanceof Error && error.message.startsWith("FORBIDDEN:"))
    return {
      success: false,
      error: { code: "FORBIDDEN", message: error.message.slice(10).trim() },
    };
  return {
    success: false,
    error: {
      code: "TRANSACTION_FAILED",
      message: "Paket belum dapat disimpan. Periksa usulan lalu coba lagi.",
    },
  };
}
export function canPlanPackages(actor: PlanningActor): boolean {
  return (
    actor.dataScope !== "NONE" &&
    (["use:ai_chat", "update:budget", "view:budget"] as const).every((p) => actorCan(actor, p))
  );
}
export async function assertPackageScope(
  actor: PlanningActor,
  id: string,
  connection: Pick<typeof db, "query"> = db,
): Promise<typeof project.$inferSelect> {
  if (!canPlanPackages(actor))
    throw new PackageError("FORBIDDEN", "Akses chat dan perencanaan budget proyek diperlukan.");
  const record = await connection.query.project.findFirst({
    where: and(
      eq(project.id, id),
      eq(project.tenantId, INSTANCE_TENANT_ID),
      actor.dataScope === "ASSIGNED" ? eq(project.projectManagerId, actor.userId) : undefined,
    ),
  });
  if (!record)
    throw new PackageError("FORBIDDEN", "Proyek tidak ditemukan atau di luar akses Anda.");
  return record;
}
export type PackageContext = {
  project: typeof project.$inferSelect;
  budget: typeof projectBudgets.$inferSelect & {
    categories: (typeof projectBudgetCategory.$inferSelect & {
      expenseCategory: typeof expenseCategory.$inferSelect;
    })[];
  };
  rap: typeof projectRap.$inferSelect | undefined;
  items: (typeof projectCategoryPlanItem.$inferSelect & {
    expenseCategory: typeof expenseCategory.$inferSelect;
    vendor: typeof vendor.$inferSelect | null;
  })[];
  templates: (typeof itemPriceLibrary.$inferSelect)[];
  vendors: (typeof vendor.$inferSelect)[];
  fingerprint: string;
};
export async function readPackageContext(
  actor: PlanningActor,
  id: string,
  input?: PackageInput,
  connection: Pick<typeof db, "query"> = db,
): Promise<PackageContext> {
  const record = await assertPackageScope(actor, id, connection);
  if (!["DRAFT", "ACTIVE"].includes(record.status))
    throw new PackageError("CONFLICT", "Proyek tidak tersedia untuk perencanaan.");
  const budget = await connection.query.projectBudgets.findFirst({
    where: and(eq(projectBudgets.projectId, id), eq(projectBudgets.tenantId, INSTANCE_TENANT_ID)),
    with: {
      categories: { orderBy: [asc(projectBudgetCategory.id)], with: { expenseCategory: true } },
    },
  });
  if (!budget) throw new PackageError("NOT_FOUND", "Budget proyek belum tersedia.");
  const rap = await connection.query.projectRap.findFirst({
    where: and(eq(projectRap.projectId, id), eq(projectRap.tenantId, INSTANCE_TENANT_ID)),
    orderBy: [desc(projectRap.revision), desc(projectRap.createdAt)],
  });
  if (rap && rap.status !== "DRAFT")
    throw new PackageError("CONFLICT", "RAP sudah terkunci. Gunakan alur revisi.");
  const items = await connection.query.projectCategoryPlanItem.findMany({
    where: and(
      eq(projectCategoryPlanItem.projectId, id),
      eq(projectCategoryPlanItem.tenantId, INSTANCE_TENANT_ID),
    ),
    with: { expenseCategory: true, vendor: true },
    orderBy: [asc(projectCategoryPlanItem.id)],
  });
  const libraryIds = [
    ...new Set(
      input?.rows.flatMap((r) =>
        r.action === "CREATE" && r.draft.source === "LIBRARY" ? [r.draft.libraryId] : [],
      ) ?? [],
    ),
  ].sort();
  const templates = libraryIds.length
    ? await connection.query.itemPriceLibrary.findMany({
        where: and(
          eq(itemPriceLibrary.tenantId, INSTANCE_TENANT_ID),
          inArray(itemPriceLibrary.id, libraryIds),
        ),
        orderBy: [asc(itemPriceLibrary.id)],
      })
    : [];
  const vendorIds = [
    ...new Set([
      ...templates.flatMap((t) => (t.defaultVendorId ? [t.defaultVendorId] : [])),
      ...items.flatMap((i) => (i.vendorId ? [i.vendorId] : [])),
      ...(input?.rows.flatMap((r) =>
        r.action === "CREATE" && r.draft.source === "MANUAL"
          ? r.draft.vendorId
            ? [r.draft.vendorId]
            : []
          : r.action === "UPDATE" && r.changes.vendorId
            ? [r.changes.vendorId]
            : [],
      ) ?? []),
    ]),
  ].sort();
  const vendors = vendorIds.length
    ? await connection.query.vendor.findMany({
        where: and(eq(vendor.tenantId, INSTANCE_TENANT_ID), inArray(vendor.id, vendorIds)),
        orderBy: [asc(vendor.id)],
      })
    : [];
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({ project: record, budget, rap: rap ?? null, items, templates, vendors }),
    )
    .digest("hex");
  return { project: record, budget, rap, items, templates, vendors, fingerprint };
}
export function currentPackageItems(context: PackageContext): PackageContext["items"] {
  const superseded = new Set(
    context.items
      .filter((i) => i.status !== "CANCELLED")
      .flatMap((i) =>
        i.supersedesProjectCategoryPlanItemId ? [i.supersedesProjectCategoryPlanItemId] : [],
      ),
  );
  return context.items.filter((i) => i.status !== "CANCELLED" && !superseded.has(i.id));
}
export function packageSnapshot(item: PackageContext["items"][number]): PackageSnapshot {
  return packageSnapshotSchema.parse({
    name: item.name,
    scopeDescription: item.scopeDescription,
    area: item.area,
    quantity: Number(item.quantity),
    unit: item.unit,
    estimatedUnitCost: Number(item.estimatedUnitCost),
    vendorId: item.vendorId,
    vendorName: item.vendor?.name ?? null,
    internalNote: item.internalNote,
    sourceLibraryItemId: item.sourceLibraryItemId,
    estimatedTotalCost: Number(item.estimatedTotalCost),
  });
}
export function packageFields(snapshot: PackageSnapshot): PackageFields {
  return {
    name: snapshot.name,
    scopeDescription: snapshot.scopeDescription,
    area: snapshot.area,
    quantity: snapshot.quantity,
    unit: snapshot.unit,
    estimatedUnitCost: snapshot.estimatedUnitCost,
    vendorId: snapshot.vendorId,
    internalNote: snapshot.internalNote,
  };
}
export function buildPackageProposal(
  input: PackageInput,
  context: PackageContext,
  rowIds?: readonly string[],
): PackageProposal {
  const current = currentPackageItems(context);
  const rows = input.rows.map((row, index): PackageProposal["rows"][number] => {
    let fields: PackageFields,
      before: PackageSnapshot | null = null,
      category: PackageCategory,
      libraryId: string | null = null,
      priceSourceLabel = "Estimasi dari pengguna",
      itemId: string | null = null;
    if (row.action === "UPDATE") {
      const existing = current.find((i) => i.id === row.itemId);
      if (!existing || existing.status !== "DRAFT")
        throw new PackageError(
          "VALIDATION_ERROR",
          "Pilih paket Draft terbaru; paket Siap perlu dibuka melalui Edit Lagi.",
        );
      if (existing.expenseCategory.code !== "TUKANG" && existing.expenseCategory.code !== "SUBCON")
        throw new PackageError("VALIDATION_ERROR", "Paket bukan kategori Tukang atau Subcon.");
      category = existing.expenseCategory.code;
      before = packageSnapshot(existing);
      itemId = existing.id;
      libraryId = existing.sourceLibraryItemId;
      fields = { ...packageFields(before), ...row.changes };
      if (JSON.stringify(fields) === JSON.stringify(packageFields(before)))
        throw new PackageError("VALIDATION_ERROR", "Tidak ada perubahan pada paket.");
      priceSourceLabel =
        row.changes.estimatedUnitCost === undefined
          ? "Estimasi paket saat ini"
          : "Estimasi koreksi pengguna";
    } else {
      category = row.category;
      if (row.draft.source === "MANUAL") {
        const { source, ...manual } = row.draft;
        void source;
        fields = manual;
      } else {
        const requestedLibraryId = row.draft.libraryId;
        const template = context.templates.find((t) => t.id === requestedLibraryId);
        const expected = category === "TUKANG" ? "WORK_PACKAGE" : "SUBCON_PACKAGE";
        const budgetCategory = context.budget.categories.find(
          (c) => c.expenseCategory.code === category,
        );
        if (
          !template?.isActive ||
          template.itemType !== expected ||
          template.expenseCategoryId !== budgetCategory?.expenseCategoryId
        )
          throw new PackageError("VALIDATION_ERROR", "Template aktif tidak sesuai kategori paket.");
        libraryId = template.id;
        fields = {
          name: template.name,
          scopeDescription: template.description,
          area: row.draft.area,
          quantity: row.draft.quantity,
          unit: template.unit,
          estimatedUnitCost: row.draft.overrideUnitCost ?? Number(template.defaultInternalCost),
          vendorId: template.defaultVendorId,
          internalNote:
            row.draft.overrideReason ?? `Snapshot template ${template.code ?? template.name}.`,
        };
        priceSourceLabel =
          row.draft.overrideUnitCost === undefined
            ? `Template ${template.name}`
            : `Koreksi template: ${row.draft.overrideReason}`;
      }
      if (
        current.some(
          (i) =>
            i.expenseCategory.code === category &&
            i.name.trim().toLocaleLowerCase("id-ID") ===
              fields.name.trim().toLocaleLowerCase("id-ID") &&
            i.area.trim().toLocaleLowerCase("id-ID") ===
              fields.area.trim().toLocaleLowerCase("id-ID"),
        )
      )
        throw new PackageError(
          "VALIDATION_ERROR",
          "Nama dan area paket sudah ada. Pilih paket untuk diperbarui.",
        );
    }
    if (!context.budget.categories.some((c) => c.expenseCategory.code === category))
      throw new PackageError("VALIDATION_ERROR", "Alokasi kategori belum tersedia.");
    if (
      context.rap &&
      (category === "TUKANG" ? context.rap.tukangScopeSkipped : context.rap.subconScopeSkipped)
    )
      throw new PackageError(
        "CONFLICT",
        "Scope kategori tidak digunakan. Buka kembali scope pada RAP terlebih dahulu.",
      );
    const chosen = fields.vendorId
      ? context.vendors.find((v) => v.id === fields.vendorId && v.isActive)
      : null;
    if (fields.vendorId && !chosen)
      throw new PackageError("VALIDATION_ERROR", "Vendor tidak tersedia atau nonaktif.");
    const after = packageSnapshotSchema.parse({
      ...fields,
      vendorName: chosen?.name ?? null,
      sourceLibraryItemId: libraryId,
      estimatedTotalCost: packageCost(fields),
    });
    return {
      rowId: rowIds?.[index] ?? randomUUID(),
      itemId,
      action: row.action,
      category,
      before,
      after,
      priceSourceLabel,
    };
  });
  const signatures = rows
    .filter((r) => r.action === "CREATE")
    .map(
      (r) =>
        `${r.category}:${r.after.name.trim().toLocaleLowerCase("id-ID")}:${r.after.area.trim().toLocaleLowerCase("id-ID")}`,
    );
  if (new Set(signatures).size !== signatures.length)
    throw new PackageError(
      "VALIDATION_ERROR",
      "Paket yang sama tidak boleh dibuat dua kali dalam satu usulan.",
    );
  const budgets = [...new Set(rows.map((r) => r.category))].map((category) => {
    const cat = context.budget.categories.find((c) => c.expenseCategory.code === category);
    if (!cat) throw new PackageError("VALIDATION_ERROR", "Kategori tidak tersedia.");
    const baseline = current.filter((i) => i.expenseCategory.code === category);
    const beforePlan = packagePlanTotal(baseline.map((i) => Number(i.estimatedTotalCost)));
    const afterPlan = packagePlanTotal([
      ...baseline.map(
        (i) =>
          rows.find((r) => r.itemId === i.id)?.after.estimatedTotalCost ??
          Number(i.estimatedTotalCost),
      ),
      ...rows
        .filter((r) => r.category === category && r.action === "CREATE")
        .map((r) => r.after.estimatedTotalCost),
    ]);
    const allocated = Number(cat.allocatedAmount);
    return {
      category,
      categoryId: cat.id,
      allocated,
      actual: Number(cat.actualAmount),
      pending: Number(cat.pendingAmount),
      remaining: Number(cat.remainingAmount),
      beforePlan,
      afterPlan,
      delta: packagePlanTotal([afterPlan, -beforePlan]),
      overAllocation: Math.max(0, packagePlanTotal([afterPlan, -allocated])),
    };
  });
  return packageProposalSchema.parse({
    kind: "CATEGORY_PLAN_PACKAGES",
    projectId: input.projectId,
    projectName: context.project.name,
    projectRapId: context.rap?.id ?? null,
    expectedContext: context.fingerprint,
    request: input,
    rows,
    budgets,
  });
}
