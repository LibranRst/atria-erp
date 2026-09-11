export type ProjectOverviewActionModel = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly tab: "overview" | "rab" | "rap" | "stok" | "expenses" | "payments" | "profitability";
  readonly severity: "CRITICAL" | "WARNING" | "INFO";
};

export type ProjectOverviewActionInput = {
  readonly hasProjectManager?: boolean;
  readonly hasRap: boolean;
  readonly rapStatus: string | null;
  readonly rapSetupStage: string | null;
  readonly hasApprovedRab: boolean;
  readonly hasRabDraft: boolean;
  readonly criticalCategoryNames: readonly string[];
  readonly shortageCount: number;
  readonly overdueInvoiceCount: number;
  readonly overdueVendorBillCount: number;
};

export function buildProjectOverviewActions(
  input: ProjectOverviewActionInput,
): readonly ProjectOverviewActionModel[] {
  const actions: ProjectOverviewActionModel[] = [];
  if (input.hasProjectManager === false) {
    actions.push({
      id: "assign-pm",
      title: "Tugaskan Project Manager",
      description: "PM bertanggung jawab atas penyusunan RAP dan eksekusi proyek.",
      tab: "overview",
      severity: "CRITICAL",
    });
  }
  if (!input.hasRap) {
    actions.push({
      id: "create-rap",
      title: "Susun RAP internal",
      description: "Internal execution plan belum dibuat.",
      tab: "rap",
      severity: "WARNING",
    });
  } else if (
    input.rapStatus !== "LOCKED" &&
    (input.rapStatus === "DRAFT" || input.rapSetupStage !== "COMPLETE")
  ) {
    actions.push({
      id: "finish-rap",
      title: "Selesaikan setup RAP",
      description: `Tahap saat ini: ${input.rapSetupStage ?? "MATERIAL"}.`,
      tab: "rap",
      severity: "WARNING",
    });
  }
  if (!input.hasApprovedRab) {
    actions.push({
      id: "approve-rab",
      title: "Selesaikan RAB client",
      description: input.hasRabDraft
        ? "Draft RAB menunggu approval."
        : "RAB approved belum tersedia.",
      tab: "rab",
      severity: "WARNING",
    });
  }
  if (input.criticalCategoryNames.length > 0) {
    actions.push({
      id: "budget-risk",
      title: `${input.criticalCategoryNames.length} kategori melewati batas`,
      description: input.criticalCategoryNames.join(", "),
      tab: "expenses",
      severity: "CRITICAL",
    });
  }
  if (input.shortageCount > 0) {
    actions.push({
      id: "material-shortage",
      title: `${input.shortageCount} material perlu dibeli`,
      description: "Kebutuhan RAP belum tertutup stok.",
      tab: "rap",
      severity: "WARNING",
    });
  }
  const overdueCount = input.overdueInvoiceCount + input.overdueVendorBillCount;
  if (overdueCount > 0) {
    actions.push({
      id: "overdue",
      title: `${overdueCount} tagihan lewat jatuh tempo`,
      description: "Tinjau invoice klien dan tagihan vendor.",
      tab: "payments",
      severity: "CRITICAL",
    });
  }
  return actions.slice(0, 3);
}
