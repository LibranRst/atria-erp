import { formatBusinessLabel } from "@/lib/presentation/business-labels";
import { formatShortIdr } from "@/lib/utils/money";
import type { ProjectReadinessItem } from "../components/overview/project-overview";
import { buildRapForManager } from "./project-tabs-mappers";
import type { ProjectTabsProps } from "../types/project-tabs-types";

type RabEstimateForSelection = ProjectTabsProps["project"]["rabEstimates"][number] | null;

export function calculateBudgetTotals(
  project: ProjectTabsProps["project"],
  projectBudgetDashboard: ProjectTabsProps["projectBudgetDashboard"],
): {
  readonly totalAllocated: number;
  readonly totalSpent: number;
  readonly totalRemaining: number;
} {
  let totalAllocated = 0;
  let totalSpent = 0;

  for (const item of project.budget?.items ?? []) {
    totalAllocated += Number(item.allocatedAmount);
    totalSpent += Number(item.actualSpent);
  }

  totalAllocated = projectBudgetDashboard?.internalBudget ?? totalAllocated;
  totalSpent = projectBudgetDashboard?.actualCost ?? totalSpent;
  const totalRemaining = projectBudgetDashboard?.remainingBudget ?? totalAllocated - totalSpent;

  return { totalAllocated, totalSpent, totalRemaining };
}

export function calculateTotalReceived(invoices: ProjectTabsProps["invoices"]): number {
  return invoices.reduce(
    (sum, invoice) =>
      sum +
      invoice.payments.reduce((paymentSum, payment) => paymentSum + Number(payment.amountPaid), 0),
    0,
  );
}

export function calculateInvoiceOutstanding(invoices: ProjectTabsProps["invoices"]): number {
  return invoices.reduce(
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
}

export function buildReadiness({
  latestRabEstimate,
  activeRap,
  rapForManager,
  shortageCount,
  invoiceOutstanding,
  overdueInvoiceCount,
}: {
  readonly latestRabEstimate: RabEstimateForSelection;
  readonly activeRap: ProjectTabsProps["project"]["raps"][number] | null;
  readonly rapForManager: ReturnType<typeof buildRapForManager>;
  readonly shortageCount: number;
  readonly invoiceOutstanding: number;
  readonly overdueInvoiceCount: number;
}): readonly ProjectReadinessItem[] {
  return [
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
      tab: "rab",
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
        ? `R${activeRap.revision} · ${activeRap.status === "LOCKED" ? "Baseline" : formatBusinessLabel(activeRap.setupStage)}`
        : "Internal plan belum dibuat",
      tab: "rap",
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
      value: !rapForManager ? "Belum ada" : shortageCount > 0 ? `${shortageCount} kurang` : "Siap",
      detail: !rapForManager
        ? "Menunggu RAP"
        : shortageCount > 0
          ? "Perlu pembelian"
          : "Kebutuhan tertutup",
      tab: "stok",
      tone: !rapForManager ? "DRAFT" : shortageCount > 0 ? "WARNING" : "APPROVED",
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
          ? `${formatShortIdr(invoiceOutstanding)} belum diterima`
          : "Tidak ada piutang terbuka",
      tab: "payments",
      tone: overdueInvoiceCount > 0 ? "CRITICAL" : invoiceOutstanding > 0 ? "WARNING" : "APPROVED",
    },
  ];
}
