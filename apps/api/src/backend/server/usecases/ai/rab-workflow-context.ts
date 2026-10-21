import { readRabSourceRefresh, type RabSourceRefresh } from "../project/rab-source-refresh";
import { createHash } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@backend/db";
import {
  INSTANCE_TENANT_ID,
  project,
  projectBudgets,
  projectBudgetCategory,
  expenseCategory,
  projectChangeOrder,
  projectRap,
  projectCategoryPlanItem,
  rabEstimate,
  rabEstimateItem,
  rabEstimateBundle,
} from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import type { FinanceTransaction } from "../finance/mutation-access";
import { RabReviewError } from "./rab-context";
import {
  previewRabChanges,
  rabWorkflowItemSchema,
  rabWorkflowBundleSchema,
  rabWorkflowInputSchema,
  rabWorkflowProposalSchema,
  rabWorkflowPermission,
  rabWorkflowTotal,
  type RabWorkflowInput,
  type RabWorkflowProposal,
  type RabWorkflowItem,
  type RabWorkflowBundle,
} from "@atria/core/ai/rab-workflow";
import { calculateRabBudgetDerivation } from "@atria/core/budget/excel-budget";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { rabLineTotal } from "@atria/core/ai/rab-draft";

export type RabWorkflowActor = Pick<Actor, "userId" | "permissions" | "dataScope">;
type Estimate = typeof rabEstimate.$inferSelect & {
  items: (typeof rabEstimateItem.$inferSelect)[];
  bundles: (typeof rabEstimateBundle.$inferSelect)[];
};
type Budget = typeof projectBudgets.$inferSelect & {
  categories: (typeof projectBudgetCategory.$inferSelect & {
    expenseCategory: typeof expenseCategory.$inferSelect;
  })[];
};
export type RabWorkflowContext = {
  readonly records: {
    project: typeof project.$inferSelect;
    rab: Estimate;
    estimates: (typeof rabEstimate.$inferSelect)[];
    orders: (typeof projectChangeOrder.$inferSelect)[];
    budget: Budget | null;
    raps: (typeof projectRap.$inferSelect)[];
    packages: (typeof projectCategoryPlanItem.$inferSelect)[];
  };
  readonly items: RabWorkflowItem[];
  readonly bundles: RabWorkflowBundle[];
  readonly sourceRefresh?: readonly RabSourceRefresh[];
  readonly fingerprint: string;
};
export function canReadRabWorkflow(actor: RabWorkflowActor): boolean {
  return (
    actor.dataScope !== "NONE" && actorCan(actor, "use:ai_chat") && actorCan(actor, "view:rab")
  );
}
export async function readRabWorkflowContext(
  actor: RabWorkflowActor,
  projectId: string,
  rabId: string,
  connection: Pick<FinanceTransaction, "query"> = db,
): Promise<RabWorkflowContext> {
  if (!canReadRabWorkflow(actor))
    throw new RabReviewError("FORBIDDEN", "Akses chat dan RAB diperlukan.");
  const proj = await connection.query.project.findFirst({
    where: and(eq(project.id, projectId), eq(project.tenantId, INSTANCE_TENANT_ID)),
  });
  if (!proj || (actor.dataScope === "ASSIGNED" && proj.projectManagerId !== actor.userId))
    throw new RabReviewError("FORBIDDEN", "Proyek di luar akses Anda.");
  const rab = await connection.query.rabEstimate.findFirst({
    where: and(
      eq(rabEstimate.id, rabId),
      eq(rabEstimate.projectId, projectId),
      eq(rabEstimate.tenantId, INSTANCE_TENANT_ID),
    ),
    with: {
      items: { orderBy: [asc(rabEstimateItem.id)] },
      bundles: { orderBy: [asc(rabEstimateBundle.id)] },
    },
  });
  if (!rab) throw new RabReviewError("NOT_FOUND", "RAB pada proyek ini tidak ditemukan.");
  const [estimates, orders, budget, raps, packages] = await Promise.all([
    connection.query.rabEstimate.findMany({
      where: eq(rabEstimate.projectId, projectId),
      orderBy: [asc(rabEstimate.id)],
    }),
    connection.query.projectChangeOrder.findMany({
      where: eq(projectChangeOrder.projectId, projectId),
      orderBy: [asc(projectChangeOrder.id)],
    }),
    connection.query.projectBudgets.findFirst({
      where: eq(projectBudgets.projectId, projectId),
      with: {
        categories: { orderBy: [asc(projectBudgetCategory.id)], with: { expenseCategory: true } },
      },
    }),
    connection.query.projectRap.findMany({
      where: eq(projectRap.projectId, projectId),
      orderBy: [asc(projectRap.id)],
    }),
    connection.query.projectCategoryPlanItem.findMany({
      where: eq(projectCategoryPlanItem.projectId, projectId),
      orderBy: [asc(projectCategoryPlanItem.id)],
    }),
  ]);
  const records = { project: proj, rab, estimates, orders, budget: budget ?? null, raps, packages };
  const sourceRefresh = actorCan(actor, "update:rab")
    ? await readRabSourceRefresh(connection, rab, Number(budget?.targetGrossPercentage ?? 10))
    : [];
  const items = rab.items.map((row) =>
    rabWorkflowItemSchema.parse({
      id: row.id,
      clientLabel: row.clientLabel,
      description: row.description ?? "",
      quantity: Number(row.quantity),
      unit: row.unit,
      unitPrice: Number(row.unitPrice),
      itemNature: row.itemNature,
      isHidden: row.isHidden,
      bundleId: row.bundleId,
      lineTotal: Number(row.lineTotal),
    }),
  );
  const bundles = rab.bundles.map((row) =>
    rabWorkflowBundleSchema.parse({
      id: row.id,
      clientLabel: row.clientLabel,
      description: row.description ?? "",
      quantity: Number(row.quantity),
      unit: row.unit,
      unitPrice: Number(row.unitPrice),
      isHidden: row.isHidden,
      itemIds: rab.items.filter((item) => item.bundleId === row.id).map((item) => item.id),
      lineTotal: Number(row.lineTotal),
    }),
  );
  return {
    records,
    sourceRefresh,
    items,
    bundles,
    fingerprint: createHash("sha256")
      .update(JSON.stringify({ records, sourceRefresh }))
      .digest("hex"),
  };
}
export function buildRabWorkflowProposal(
  actor: RabWorkflowActor,
  input: RabWorkflowInput,
  context: RabWorkflowContext,
): RabWorkflowProposal {
  input = rabWorkflowInputSchema.parse(input);
  if (!actorCan(actor, rabWorkflowPermission(input.request)))
    throw new RabReviewError("FORBIDDEN", "Izin tindakan RAB tidak tersedia.");
  const { rab, estimates, orders, project: proj, budget } = context.records,
    request = input.request;
  if (input.projectId !== proj.id || input.rabEstimateId !== rab.id)
    throw new RabReviewError(
      "CONFLICT",
      "Identitas usulan tidak sesuai dengan RAB yang diperiksa.",
    );
  if (!["DRAFT", "ACTIVE"].includes(proj.status))
    throw new RabReviewError("CONFLICT", "Proyek tidak tersedia untuk perubahan RAB.");
  const changeOrder =
    "changeOrderId" in request
      ? orders.find(
          (row) => row.id === request.changeOrderId && row.revisedRabEstimateId === rab.id,
        )
      : null;
  const linked = orders.find((row) => row.revisedRabEstimateId === rab.id);
  const baseline = estimates.find((row) => row.id === rab.supersedesRabEstimateId);
  if (
    request.action === "APPROVE_CHANGE_ORDER" &&
    request.emergencyOverride &&
    !actorCan(actor, "override:self_approval")
  )
    throw new RabReviewError("FORBIDDEN", "Override membutuhkan izin yang sesuai.");
  const editable = [
    "EDIT_DRAFT",
    "REFRESH_SOURCES",
    "CREATE_BUNDLE",
    "UPDATE_BUNDLE",
    "DISSOLVE_BUNDLE",
  ].includes(request.action);
  if (request.action === "CREATE_REVISION") {
    if (rab.status !== "APPROVED" || estimates.some((row) => row.status === "DRAFT"))
      throw new RabReviewError(
        "CONFLICT",
        "Pilih baseline yang disetujui dan lanjutkan Draft yang tersedia terlebih dahulu.",
      );
  } else if (rab.status !== "DRAFT")
    throw new RabReviewError(
      "CONFLICT",
      "Tindakan ini membutuhkan RAB Draft. Buat revisi untuk baseline yang disetujui.",
    );
  if (
    editable &&
    linked &&
    ["PENDING_CLIENT", "PENDING_APPROVAL", "APPROVED"].includes(linked.status)
  )
    throw new RabReviewError(
      "CONFLICT",
      "Isi Change Order yang telah dikonfirmasi tidak boleh dikoreksi diam-diam.",
    );
  if (
    request.action === "APPROVE_INITIAL" &&
    (rab.supersedesRabEstimateId || estimates.some((row) => row.status === "APPROVED"))
  )
    throw new RabReviewError("CONFLICT", "Revisi harus disetujui melalui Change Order.");
  if (
    (request.action === "CREATE_CHANGE_ORDER" || request.action === "VOID_REVISION") &&
    (!baseline || baseline.status !== "APPROVED")
  )
    throw new RabReviewError("CONFLICT", "Baseline revisi tidak lagi tersedia.");
  if (
    request.action === "CREATE_CHANGE_ORDER" &&
    linked &&
    !["DRAFT", "REJECTED"].includes(linked.status)
  )
    throw new RabReviewError("CONFLICT", "Change Order yang dikonfirmasi tidak dapat ditimpa.");
  if ("changeOrderId" in request) {
    if (!changeOrder) throw new RabReviewError("NOT_FOUND", "Change Order bukan milik revisi ini.");
    if (!baseline || baseline.status !== "APPROVED")
      throw new RabReviewError("CONFLICT", "Baseline Change Order berubah.");
    if (
      Math.abs(
        Number(changeOrder.revisedContractValue) - rabWorkflowTotal(context.items, context.bundles),
      ) > 0.01
    )
      throw new RabReviewError("CONFLICT", "Perbarui draft Change Order setelah koreksi RAB.");
    if (request.action === "CONFIRM_CLIENT") {
      if (!["DRAFT", "PENDING_CLIENT"].includes(changeOrder.status))
        throw new RabReviewError("CONFLICT", "Konfirmasi klien tidak tersedia pada status ini.");
      if (new Date(request.confirmedAt).getTime() > Date.now() + 60000)
        throw new RabReviewError("VALIDATION_ERROR", "Tanggal konfirmasi klien belum terjadi.");
    } else {
      if (
        changeOrder.status !== "PENDING_APPROVAL" ||
        !changeOrder.clientConfirmedAt ||
        !changeOrder.clientConfirmationReference
      )
        throw new RabReviewError("CONFLICT", "Konfirmasi klien harus lengkap sebelum keputusan.");
      if (
        changeOrder.createdById === actor.userId &&
        !(
          request.action === "APPROVE_CHANGE_ORDER" &&
          request.emergencyOverride &&
          request.reason &&
          actorCan(actor, "override:self_approval")
        )
      )
        throw new RabReviewError(
          "FORBIDDEN",
          "Change Order memerlukan pemeriksa berbeda. Override hanya lewat izin dan alasan eksplisit.",
        );
    }
  }
  const refresh = context.sourceRefresh ?? [];
  if (request.action === "REFRESH_SOURCES" && !refresh.length)
    throw new RabReviewError("VALIDATION_ERROR", "Tidak ada sumber tertaut yang dapat diperbarui.");
  const preview = previewRabChanges(
    context.items,
    context.bundles,
    request.action === "REFRESH_SOURCES"
      ? {
          action: "EDIT_DRAFT",
          rows: refresh.map((row) => ({ action: "UPDATE", itemId: row.itemId, fields: row.after })),
        }
      : request,
  );
  const rows = preview.rows;
  if (request.action === "EDIT_DRAFT") {
    if (request.title !== undefined && request.title !== rab.title)
      rows.unshift({
        id: "title",
        title: "Judul RAB",
        action: "Koreksi judul",
        detail: "",
        before: null,
        after: null,
        beforeState: rab.title,
        afterState: request.title,
      });
    if (request.clientNotes !== undefined && request.clientNotes !== (rab.clientNotes ?? ""))
      rows.push({
        id: "client-notes",
        title: "Catatan untuk klien",
        action: "Koreksi catatan",
        detail: "",
        before: null,
        after: null,
        beforeState: rab.clientNotes || "Tanpa catatan",
        afterState: request.clientNotes || "Tanpa catatan",
      });
  }
  if (request.action === "CREATE_REVISION") {
    for (const item of context.items)
      rows.push({
        id: item.id,
        title: item.clientLabel,
        action: "Salin ke revisi",
        detail: item.bundleId ? "Anggota paket ikut tersalin." : `${item.quantity} ${item.unit}`,
        before: null,
        after: {
          clientLabel: item.clientLabel,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          itemNature: item.itemNature,
          isHidden: item.isHidden,
        },
        beforeState: "Baseline disetujui",
        afterState: "Draft revisi baru",
      });
    for (const bundle of context.bundles)
      rows.push({
        id: bundle.id,
        title: bundle.clientLabel,
        action: "Salin paket",
        detail: `${bundle.itemIds.length} anggota tersalin utuh.`,
        before: null,
        after: {
          clientLabel: bundle.clientLabel,
          description: bundle.description,
          quantity: bundle.quantity,
          unit: bundle.unit,
          unitPrice: bundle.unitPrice,
          itemNature: "PRODUCTION",
          isHidden: bundle.isHidden,
        },
        beforeState: "Baseline disetujui",
        afterState: "Draft revisi baru",
      });
  }
  if (!rows.length) {
    if (request.action === "EDIT_DRAFT")
      throw new RabReviewError(
        "VALIDATION_ERROR",
        "Tidak ada koreksi baru pada judul atau catatan klien.",
      );
    const reviewedOrder = changeOrder ?? (request.action === "CREATE_CHANGE_ORDER" ? linked : null);
    const after =
      request.action === "APPROVE_INITIAL" || request.action === "APPROVE_CHANGE_ORDER"
        ? "Disetujui"
        : request.action === "VOID_REVISION"
          ? "Dibatalkan"
          : request.action === "CONFIRM_CLIENT"
            ? "Menunggu persetujuan"
            : request.action === "REJECT_CHANGE_ORDER"
              ? "Ditolak"
              : "Draft Change Order";
    rows.push({
      id: reviewedOrder?.id ?? rab.id,
      title: reviewedOrder || request.action === "CREATE_CHANGE_ORDER" ? "Change Order" : rab.title,
      action: after,
      detail:
        "reason" in request
          ? (request.reason ?? "")
          : "confirmationReference" in request
            ? request.confirmationReference
            : "",
      before: null,
      after: null,
      beforeState: formatBusinessLabel(
        reviewedOrder?.status ??
          (request.action === "CREATE_CHANGE_ORDER" ? "Belum dibuat" : rab.status),
      ),
      afterState: after,
    });
  }
  let budgetImpact: RabWorkflowProposal["budgetImpact"] = null;
  const approval =
    request.action === "APPROVE_INITIAL" || request.action === "APPROVE_CHANGE_ORDER";
  if (approval && actorCan(actor, "view:budget") && budget) {
    const derived = calculateRabBudgetDerivation({
      items: preview.items.map((row) => ({
        ...row,
        lineTotal: row.lineTotal ?? rabLineTotal(row),
      })),
      bundles: preview.bundles.map((row) => ({
        ...row,
        lineTotal: row.lineTotal ?? rabLineTotal(row),
      })),
      budgetCapRatio: Number(budget.budgetCapRatio),
    });
    budgetImpact = {
      contractBefore: Number(proj.totalContractValue),
      contractAfter: derived.approvedValue,
      capBefore: Number(budget.internalBudget),
      capAfter: derived.internalBudget,
      categories: budget.categories.map((row) => ({
        name: row.expenseCategory.name,
        before: Number(row.allocatedAmount),
        after: row.isManualOverride
          ? Number(row.allocatedAmount)
          : derived.internalBudget * Number(row.ratioPercentage),
        actual: Number(row.actualAmount),
        manual: row.isManualOverride,
      })),
    };
  }
  const totalBefore =
    request.action === "CREATE_CHANGE_ORDER" || request.action === "APPROVE_CHANGE_ORDER"
      ? Number(baseline?.approvedValue ?? 0)
      : rabWorkflowTotal(context.items, context.bundles);
  return rabWorkflowProposalSchema.parse({
    kind: "RAB_WORKFLOW",
    projectId: proj.id,
    projectName: proj.name,
    rabEstimateId: rab.id,
    title: rab.title,
    revision:
      request.action === "CREATE_REVISION"
        ? Math.max(...estimates.map((row) => row.revision)) + 1
        : rab.revision,
    request,
    expectedContext: context.fingerprint,
    rows,
    totalBefore,
    totalAfter: rabWorkflowTotal(preview.items, preview.bundles),
    budgetImpact,
    warning:
      request.action === "REFRESH_SOURCES"
        ? "Jumlah, satuan dan harga jual sumber tertaut diperbarui. Label klien, deskripsi, visibilitas dan harga paket tetap; kas dan stok tetap."
        : approval
          ? `Persetujuan memperbarui nilai kontrak, budget yang tersedia, dan status rencana terkait. Stok dan kas tetap.${budgetImpact && budgetImpact.categories.reduce((sum, row) => sum + row.after, 0) > budgetImpact.capAfter + 0.01 ? " Total alokasi baru melebihi plafon karena alokasi manual dipertahankan." : ""}`
          : request.action === "CREATE_REVISION"
            ? "Baseline tetap utuh. Draft baru perlu dikoreksi dan diajukan melalui Change Order."
            : request.action === "CONFIRM_CLIENT"
              ? "Konfirmasi ini mencatat bukti persetujuan klien yang benar-benar telah diterima."
              : request.action === "VOID_REVISION"
                ? "Revisi tidak lagi digunakan; Change Order terbuka yang terkait ikut dibatalkan. Baseline tetap utuh."
                : request.action === "REJECT_CHANGE_ORDER"
                  ? "Baseline tetap utuh. Koreksi Draft dan perbarui Change Order sebelum konfirmasi klien baru."
                  : null,
  });
}
