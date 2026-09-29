import { actorCan } from "@/lib/auth/permissions";
import "server-only";

import { eq } from "drizzle-orm";

import { buildProjectBudgetDashboard } from "@/app/actions/project/excel-budget-utils";
import { db } from "@/db";
import { clientInvoice, project, projectRapItem, vendorBill } from "@/db/schema";
import { assertProjectAccess } from "@/lib/auth/scoping";
import type { Actor } from "@/server/actor";

import { resolveEffectiveProjectHealth } from "@atria/core/project/effective-health";
import { buildProjectOverviewActions } from "@atria/core/project/project-overview";
import {
  selectApprovedRabEstimate,
  selectCurrentRabEstimate,
} from "@atria/core/project/rab-selection";
import { projectMaterialProjection } from "@atria/core/material/project-material-projection";
import type {
  ProjectOverviewData,
  ProjectOverviewPageData,
  ProjectOverviewReadinessItem,
} from "@atria/core/types/project-overview";

function toProjectStatus(status: string): ProjectOverviewData["project"]["status"] {
  if (
    status === "ACTIVE" ||
    status === "ON_HOLD" ||
    status === "COMPLETED" ||
    status === "CANCELLED"
  ) {
    return status;
  }
  return "DRAFT";
}

/**
 * Bootstrap ringan untuk pintu domain detail proyek native.
 *
 * Sengaja menjalankan query sendiri, bukan memakai `getProjectDetailData` web
 * (yang memuat seluruh pohon RAP/RAB/vendor bill/movement) — spesifikasi P2.4
 * melarang mengirim item penuh itu ke klien. Angka pendukung readiness
 * (shortage material, tagihan overdue) tetap dihitung dengan rumus yang sama
 * persis dengan halaman detail web, hanya lewat query yang jauh lebih kecil.
 */
export async function getProjectOverviewData(
  actor: Actor,
  projectId: string,
): Promise<ProjectOverviewPageData> {
  if (!actorCan(actor, "view:budget")) {
    return { status: "restricted" };
  }

  try {
    await assertProjectAccess(projectId, actor.userId, actor.roleName);
  } catch {
    return { status: "restricted" };
  }

  const projectRecord = await db.query.project.findFirst({
    where: eq(project.id, projectId),
    with: {
      client: { columns: { name: true } },
      projectManager: { columns: { name: true } },
      raps: { columns: { id: true, status: true, revision: true, setupStage: true } },
      rabEstimates: { columns: { id: true, status: true, revision: true } },
    },
  });

  if (!projectRecord) return { status: "notFound" };

  const [dashboard, invoices, vendorBills] = await Promise.all([
    buildProjectBudgetDashboard(projectId),
    db.query.clientInvoice.findMany({
      where: eq(clientInvoice.projectId, projectId),
      columns: { status: true, amount: true, dueDate: true },
      with: { payments: { columns: { amountPaid: true } } },
    }),
    db.query.vendorBill.findMany({
      where: eq(vendorBill.projectId, projectId),
      columns: { status: true, dueDate: true },
    }),
  ]);

  const activeRap = projectRecord.raps.reduce<(typeof projectRecord.raps)[number] | null>(
    (latest, rap) => (latest === null || rap.revision > latest.revision ? rap : latest),
    null,
  );
  const latestRabEstimate = selectCurrentRabEstimate(projectRecord.rabEstimates);
  const hasApprovedRab = Boolean(selectApprovedRabEstimate(projectRecord.rabEstimates));

  const rapItems = activeRap
    ? await db.query.projectRapItem.findMany({
        where: eq(projectRapItem.projectRapId, activeRap.id),
        columns: { totalQuantity: true },
        with: {
          stockMovements: { columns: { movementType: true, quantity: true, createdAt: true } },
        },
      })
    : [];
  const shortageCount = rapItems.filter(
    (item) =>
      projectMaterialProjection(item.stockMovements, Number(item.totalQuantity)).needToBuy > 0,
  ).length;

  const now = new Date();
  const invoiceOutstanding = invoices.reduce(
    (sum, invoice) =>
      sum +
      (invoice.status === "VOID"
        ? 0
        : Math.max(
            0,
            Number(invoice.amount) -
              invoice.payments.reduce((paid, payment) => paid + Number(payment.amountPaid), 0),
          )),
    0,
  );
  const overdueInvoiceCount = invoices.filter(
    (invoice) => invoice.status !== "VOID" && invoice.status !== "PAID" && invoice.dueDate < now,
  ).length;
  const overdueVendorBillCount = vendorBills.filter(
    (bill) => bill.status !== "VOID" && bill.status !== "PAID" && bill.dueDate < now,
  ).length;

  const isLocked = !dashboard || dashboard.status !== "APPROVED";
  const health = resolveEffectiveProjectHealth({
    storedHealth: projectRecord.financialHealth,
    remainingBudget: dashboard?.remainingBudget ?? 0,
    usedPercentage: dashboard?.usedPercentage ?? 0,
    categoryStatuses: dashboard?.categories.map((category) => category.status) ?? [],
    projectedMarginPercentage: dashboard?.projectedMarginPercentage ?? null,
    targetMarginPercentage: dashboard?.targetGrossPercentage ?? null,
  });

  const readiness: readonly ProjectOverviewReadinessItem[] = [
    {
      id: "pm",
      label: "Project Manager",
      value: projectRecord.projectManager?.name ?? "Belum ada",
      detail: projectRecord.projectManager?.name ? "Penanggung jawab aktif" : "Perlu ditugaskan",
      tone: projectRecord.projectManager ? "APPROVED" : "WARNING",
    },
    {
      id: "rab",
      label: "RAB",
      value: latestRabEstimate
        ? latestRabEstimate.status === "APPROVED"
          ? `R${latestRabEstimate.revision}`
          : latestRabEstimate.status === "DRAFT"
            ? "Draft"
            : latestRabEstimate.status
        : "Belum ada",
      detail: latestRabEstimate ? `Revisi ${latestRabEstimate.revision}` : "Butuh quotation client",
      tone:
        latestRabEstimate?.status === "APPROVED"
          ? "APPROVED"
          : latestRabEstimate?.status === "DRAFT"
            ? "DRAFT"
            : "WARNING",
    },
    {
      id: "rap",
      label: "RAP",
      value: activeRap
        ? activeRap.status === "LOCKED"
          ? "Terkunci"
          : activeRap.setupStage === "COMPLETE"
            ? "Siap"
            : "Perlu dilengkapi"
        : "Belum ada",
      detail: activeRap
        ? `R${activeRap.revision} · ${activeRap.status === "LOCKED" ? "Baseline" : activeRap.setupStage}`
        : "Internal plan belum dibuat",
      tone:
        activeRap?.status === "LOCKED" || activeRap?.setupStage === "COMPLETE"
          ? "APPROVED"
          : activeRap
            ? "DRAFT"
            : "WARNING",
    },
    {
      id: "material",
      label: "Material",
      value: !activeRap ? "Belum ada" : shortageCount > 0 ? `${shortageCount} kurang` : "Siap",
      detail: !activeRap
        ? "Menunggu RAP"
        : shortageCount > 0
          ? "Perlu pembelian"
          : "Kebutuhan tertutup",
      tone: !activeRap ? "DRAFT" : shortageCount > 0 ? "WARNING" : "APPROVED",
    },
    {
      id: "billing",
      label: "Tagihan",
      value:
        overdueInvoiceCount > 0
          ? `${overdueInvoiceCount} overdue`
          : invoiceOutstanding > 0
            ? "Terbuka"
            : "Aman",
      detail:
        invoiceOutstanding > 0
          ? `Rp ${Math.round(invoiceOutstanding).toLocaleString("id-ID")} belum diterima`
          : "Tidak ada piutang terbuka",
      tone: overdueInvoiceCount > 0 ? "CRITICAL" : invoiceOutstanding > 0 ? "WARNING" : "APPROVED",
    },
  ];

  const criticalCategoryNames = (dashboard?.categories ?? [])
    .filter((category) => category.status === "CRITICAL" || category.status === "OVER_BUDGET")
    .map((category) => category.name);

  const actions = buildProjectOverviewActions({
    hasProjectManager: Boolean(projectRecord.projectManagerId),
    hasRap: Boolean(activeRap),
    rapStatus: activeRap?.status ?? null,
    rapSetupStage: activeRap?.setupStage ?? null,
    hasApprovedRab,
    hasRabDraft: latestRabEstimate?.status === "DRAFT",
    criticalCategoryNames,
    shortageCount,
    overdueInvoiceCount,
    overdueVendorBillCount,
  });

  return {
    status: "ready",
    project: {
      id: projectRecord.id,
      name: projectRecord.name,
      status: toProjectStatus(projectRecord.status),
      effectiveHealth: health.effectiveHealth,
      clientName: projectRecord.client?.name ?? "-",
      pmName: projectRecord.projectManager?.name ?? "-",
      totalContractValue: Number(projectRecord.totalContractValue),
      startDate: projectRecord.startDate?.toISOString() ?? null,
      endDate: projectRecord.endDate?.toISOString() ?? null,
      location: projectRecord.location,
      roomArea: projectRecord.roomArea,
      projectType: projectRecord.projectType,
      coverImageUrl: projectRecord.coverImageUrl,
      notes: projectRecord.notes,
    },
    isLocked,
    readiness,
    actions,
    categories: (dashboard?.categories ?? []).slice(0, 5).map((category) => ({
      id: category.id,
      code: category.code,
      name: category.name,
      allocatedAmount: category.allocatedAmount,
      actualAmount: category.actualAmount,
      remainingAmount: category.remainingAmount,
      usedPercentage: category.usedPercentage,
      status: category.status,
    })),
  };
}
