"use client";

import { useCan } from "@/components/auth/permissions-provider";
import { ProjectOverviewDesktop, type BudgetCategorySort } from "./project-overview-desktop";
import {
  useWorkspacePresentation,
  useWorkspaceControlPresentation,
} from "@/lib/navigation/workspace-presentation";
import React, { useState } from "react";
import { useRouter } from "@/lib/navigation/workspace-navigation";
import { updateBrowserUrl, useBrowserUrlSearchParam } from "@/lib/utils/use-url-search-param";

import { toast } from "sonner";

import type { ProjectBudgetDashboard } from "@/app/actions/project/excel-budget";
import {
  approveProjectBudget,
  rejectProjectBudget,
  submitProjectBudget,
} from "@/app/actions/project/excel-budget";
import { reallocateProjectBudget } from "@/app/actions/project/workflow-governance";
import {
  AppIcon,
  Badge,
  BudgetSplitIndicator,
  Button,
  CompactFormDialog,
  ConfirmationDialog,
  DetailSheet,
  FactRow,
  FormField,
  FormSection,
  GroupedSurface,
  MoneyValue,
  NumericInput,
  OperationalFormSheet,
  Textarea,
  UsageBlockMeter,
} from "@/components/ui";
import type { IndicatorTone } from "@atria/core/types/indicator-tone";
import { categoryTab, statusTone } from "../../utils/project-overview-utils";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { cn } from "@/lib/utils/cn";
import type { ProjectBudgetSource } from "../../types/project-tabs-types";
export { ProjectIdentityHeader } from "./project-identity-header";

export type ProjectOverviewTab =
  "overview" | "rab" | "rap" | "stok" | "expenses" | "payments" | "profitability";

export type ProjectOverviewAction = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly tab: ProjectOverviewTab;
  readonly severity: "CRITICAL" | "WARNING" | "INFO";
};

export type ProjectReadinessItem = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly tab: ProjectOverviewTab;
  readonly tone: "APPROVED" | "WARNING" | "CRITICAL" | "DRAFT";
};

type ProjectOverviewProps = {
  readonly budget: ProjectBudgetDashboard | null;
  readonly budgetSource?: ProjectBudgetSource;
  readonly storedHealth?: string;
  readonly contractValue: number;
  readonly actions: readonly ProjectOverviewAction[];
  readonly readiness: readonly ProjectReadinessItem[];
  readonly onNavigate: (tab: ProjectOverviewTab) => void;
  readonly onAssignPm?: () => void;
  readonly onWorkflowActiveChange?: (active: boolean) => void;
};

function categoryTone(status: string): IndicatorTone {
  if (status === "CRITICAL" || status === "OVER_BUDGET") return "critical";
  if (status === "WARNING" || status === "WATCH") return "warning";
  return "positive";
}

function SectionHeading({
  title,
  supporting,
  action,
}: {
  readonly title: string;
  readonly supporting?: string;
  readonly action?: React.ReactNode;
}): React.JSX.Element {
  return (
    <header className="flex items-start justify-between gap-3 px-1 pt-2">
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-semibold text-on-surface">{title}</h2>
        {supporting ? (
          <p className="mt-0.5 text-support text-on-surface-variant">{supporting}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function ProjectOverview({
  budget: incomingBudget,
  budgetSource: incomingBudgetSource,
  storedHealth,
  contractValue,
  actions,
  readiness,
  onNavigate,
  onAssignPm,
  onWorkflowActiveChange,
}: ProjectOverviewProps): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  const desktopControls = useWorkspaceControlPresentation() === "desktop";
  const can = useCan();
  const router = useRouter();
  const [sourceSnapshot, setSourceSnapshot] = useState({
    budget: incomingBudget,
    budgetSource: incomingBudgetSource,
  });
  const { budget, budgetSource } = sourceSnapshot;
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedCategorySurface, setSelectedCategorySurface] = useState<"sheet" | "panel">(
    "panel",
  );
  const categorySortColumn = useBrowserUrlSearchParam("budget-category-sort");
  const categorySortDirection = useBrowserUrlSearchParam("budget-category-direction");
  const categorySort = React.useMemo<BudgetCategorySort | undefined>(
    () =>
      categorySortColumn &&
      ["category", "allocated", "actual", "remaining", "condition"].includes(categorySortColumn)
        ? {
            column: categorySortColumn,
            direction: categorySortDirection === "descending" ? "descending" : "ascending",
          }
        : undefined,
    [categorySortColumn, categorySortDirection],
  );
  const budgetDecisionReturnFocusRef = React.useRef<HTMLElement | null>(null);
  const [reallocationOpen, setReallocationOpen] = useState(false);
  const [reallocationReason, setReallocationReason] = useState("");
  const [budgetDecision, setBudgetDecision] = useState<"submit" | "approve" | "reject" | null>(
    null,
  );
  const [budgetRejectionReason, setBudgetRejectionReason] = useState("");
  const [budgetDecisionPending, startBudgetDecision] = React.useTransition();
  const [ratios, setRatios] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (budget?.categories ?? []).map((category) => [
        category.id,
        ((category.allocatedAmount / Math.max(budget?.internalBudget ?? 1, 1)) * 100).toFixed(1),
      ]),
    ),
  );
  const [savingAllocation, setSavingAllocation] = useState(false);
  const sourceFrozen =
    reallocationOpen || budgetDecision !== null || budgetDecisionPending || savingAllocation;
  function updateCategorySort(sort: BudgetCategorySort): void {
    if (!desktop || sourceFrozen) return;
    const url = new URL(window.location.href);
    url.searchParams.set("budget-category-sort", String(sort.column));
    url.searchParams.set("budget-category-direction", sort.direction);
    updateBrowserUrl(`${url.pathname}${url.search}${url.hash}`, "replace");
  }
  React.useEffect(() => {
    onWorkflowActiveChange?.(sourceFrozen);
    return () => onWorkflowActiveChange?.(false);
  }, [onWorkflowActiveChange, sourceFrozen]);
  if (
    !sourceFrozen &&
    (sourceSnapshot.budget !== incomingBudget ||
      sourceSnapshot.budgetSource !== incomingBudgetSource)
  ) {
    setSourceSnapshot({ budget: incomingBudget, budgetSource: incomingBudgetSource });
  }
  const selectedCategory =
    budget?.categories.find((category) => category.id === selectedCategoryId) ?? null;
  const remaining = budget?.remainingBudget ?? 0;
  const used = budget?.usedPercentage ?? 0;
  const margin = budget?.projectedMarginPercentage ?? (contractValue > 0 ? 100 : 0);
  const canReallocate = can("approve:budget") && budget?.status === "APPROVED";
  const canUpdateBudget = can("update:budget");
  const canApproveBudget = can("approve:budget");
  const totalRatio = Object.values(ratios).reduce((sum, value) => sum + Number(value || 0), 0);
  const reallocationDirty = Boolean(
    budget &&
    (reallocationReason.trim().length > 0 ||
      budget.categories.some(
        (category) =>
          ratios[category.id] !==
          ((category.allocatedAmount / Math.max(budget.internalBudget, 1)) * 100).toFixed(1),
      )),
  );

  async function saveReallocation(): Promise<void> {
    if (!budget) return;
    setSavingAllocation(true);
    const result = await reallocateProjectBudget({
      projectBudgetId: budget.budgetId,
      categories: budget.categories.map((category) => ({
        projectBudgetCategoryId: category.id,
        ratioPercentage: Number(ratios[category.id] || 0) / 100,
      })),
      reason: reallocationReason.trim() || undefined,
    });
    setSavingAllocation(false);
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Alokasi budget proyek diperbarui.");
    setReallocationOpen(false);
    router.refresh();
  }

  function openReallocation(): void {
    if (!budget) return;
    setRatios(
      Object.fromEntries(
        budget.categories.map((category) => [
          category.id,
          ((category.allocatedAmount / Math.max(budget.internalBudget, 1)) * 100).toFixed(1),
        ]),
      ),
    );
    setReallocationReason("");
    setReallocationOpen(true);
  }

  function runBudgetDecision(kind: "submit" | "approve" | "reject"): void {
    if (!budget) return;
    startBudgetDecision(async () => {
      const result =
        kind === "submit"
          ? await submitProjectBudget(budget.budgetId)
          : kind === "approve"
            ? await approveProjectBudget(budget.budgetId)
            : await rejectProjectBudget(budget.budgetId, budgetRejectionReason);
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success(
        kind === "submit"
          ? "Project Budget diajukan."
          : kind === "approve"
            ? "Project Budget disetujui."
            : "Project Budget dikembalikan untuk revisi.",
      );
      setBudgetDecision(null);
      setBudgetRejectionReason("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-sm">
      <section
        ref={budgetDecisionReturnFocusRef}
        aria-label="Ringkasan budget proyek"
        tabIndex={-1}
        hidden={!desktop}
        inert={!desktop ? true : undefined}
      >
        <ProjectOverviewDesktop
          budget={budget}
          budgetSource={budgetSource}
          storedHealth={storedHealth}
          contractValue={contractValue}
          actions={actions}
          readiness={readiness}
          selectedCategoryId={selectedCategoryId}
          categorySort={categorySort}
          canUpdateBudget={canUpdateBudget}
          canApproveBudget={canApproveBudget}
          canReallocate={canReallocate}
          decisionPending={budgetDecisionPending}
          onCategorySelect={(categoryId) => {
            setSelectedCategorySurface("panel");
            setSelectedCategoryId(categoryId);
          }}
          onCategoryClose={() => setSelectedCategoryId(null)}
          onRetry={() => router.refresh()}
          onCategorySort={updateCategorySort}
          onBudgetDecision={setBudgetDecision}
          onReallocate={openReallocation}
          onNavigate={onNavigate}
          onAssignPm={onAssignPm}
        />
      </section>
      {!desktop &&
        (!budget ? (
          <section className="rounded-owner bg-primary p-5 text-on-primary shadow-inverse max-[430px]:p-4">
            <p className="text-eyebrow font-bold tracking-[0.16em] text-white/55 uppercase">
              Posisi proyek
            </p>
            <h2 className="mt-2 text-[20px] leading-6 font-semibold">
              Budget internal belum terbentuk
            </h2>
            <p className="mt-2 text-xs leading-5 text-white/65">
              Lengkapi RAP dan RAB agar pengeluaran, stok, pembayaran, dan margin dapat dipantau.
            </p>
            <Button
              type="button"
              onClick={() => onNavigate("rap")}
              className="mt-4 min-h-12 w-full rounded-full bg-white px-5 text-xs font-bold text-primary"
              variant="secondary"
            >
              Mulai dari RAP
            </Button>
          </section>
        ) : (
          <section className="rounded-owner bg-primary p-5 text-on-primary shadow-inverse max-[430px]:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-eyebrow font-bold tracking-[0.16em] text-white/55 uppercase">
                  Sisa budget internal
                </p>
                <MoneyValue
                  amount={remaining}
                  variant="fullDynamic"
                  tone={remaining < 0 ? "danger" : "inverse"}
                  size="hero"
                  className="mt-1"
                />
              </div>
              <Badge status={remaining < 0 ? "CRITICAL" : used >= 80 ? "WARNING" : "APPROVED"}>
                {remaining < 0 ? "Terlampaui" : used >= 80 ? "Perlu dipantau" : "Terkendali"}
              </Badge>
            </div>

            <BudgetSplitIndicator
              value={used}
              inverse
              danger={remaining < 0}
              tone={remaining < 0 ? "critical" : used >= 80 ? "warning" : "positive"}
            />

            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <FinancialFact label="Nilai proyek" amount={budget.contractValue} />
                <FinancialFact label="Budget" amount={budget.internalBudget} />
              </div>
              <FinancialFact label="Realisasi" amount={budget.actualCost} />
            </div>
            {budget.serviceFeeTotal > 0 ? (
              <div className="mt-3 space-y-2 rounded-[18px] bg-white/[0.07] p-3 text-meta">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div>
                    <span className="font-semibold text-white">Margin Murni Produksi</span>
                    <p className="text-[11px] text-white/50">Murni belanja fisik (lapangan)</p>
                  </div>
                  <div className="text-right">
                    <MoneyValue
                      amount={budget.physicalMarginAmount}
                      variant="fullDynamic"
                      tone="inverse"
                      align="right"
                      size="md"
                    />
                    <span className="block font-mono text-[11px] text-white/60 tabular-nums">
                      {budget.physicalMarginPercentage.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <div>
                    <span className="font-semibold text-white">Margin Total Proyek</span>
                    <p className="text-[11px] text-white/50">Gabungan fisik + fee jasa</p>
                  </div>
                  <div className="text-right">
                    <MoneyValue
                      amount={budget.targetGrossAmount}
                      variant="fullDynamic"
                      tone="inverse"
                      align="right"
                      size="md"
                    />
                    <span className="block font-mono text-[11px] text-white/60 tabular-nums">
                      {margin.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-between rounded-[18px] bg-white/[0.07] px-3 py-2.5">
                <span className="text-meta font-semibold text-white/60">Margin proyeksi</span>
                <div className="text-right">
                  <MoneyValue
                    amount={budget.projectedMarginAmount}
                    variant="fullDynamic"
                    tone="inverse"
                    align="right"
                    size="md"
                  />
                  <span
                    className={`block font-mono text-[11px] tabular-nums ${margin < 10 ? "text-critical-on-inverse" : "text-white/60"}`}
                  >
                    {margin.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </section>
        ))}

      {!desktop && budget && (budget.status === "DRAFT" || budget.status === "PENDING_APPROVAL") ? (
        <section className="rounded-owner bg-white p-4 shadow-surface ring-1 ring-ring-subtle">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
                Workflow Project Budget
              </p>
              <h2 className="mt-1 text-row font-semibold text-on-surface">
                {budget.status === "PENDING_APPROVAL"
                  ? "Menunggu keputusan Owner"
                  : "Budget masih dalam draf"}
              </h2>
              <p className="mt-1 text-support text-on-surface-variant">
                {budget.status === "PENDING_APPROVAL"
                  ? "Periksa plafon internal dan alokasi kategori sebelum pekerjaan finansial dibuka."
                  : "Pastikan nilai proyek dan pembagian kategori sudah benar sebelum diajukan."}
              </p>
            </div>
            <Badge status={budget.status === "PENDING_APPROVAL" ? "WARNING" : "DRAFT"}>
              {budget.status === "PENDING_APPROVAL" ? "Perlu keputusan" : "Draf"}
            </Badge>
          </div>

          {budget.status === "DRAFT" && canUpdateBudget ? (
            <Button
              fullWidth
              className="mt-4"
              pending={budgetDecisionPending}
              onClick={() => setBudgetDecision("submit")}
            >
              Ajukan Project Budget
            </Button>
          ) : null}

          {budget.status === "PENDING_APPROVAL" && canApproveBudget ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant="criticalQuiet"
                pending={budgetDecisionPending}
                onClick={() => setBudgetDecision("reject")}
              >
                Minta revisi
              </Button>
              <Button pending={budgetDecisionPending} onClick={() => setBudgetDecision("approve")}>
                Setujui budget
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {!desktop ? (
        <section className="space-y-2.5">
          <SectionHeading
            title="Kesiapan proyek"
            supporting="Status dasar sebelum pekerjaan dan transaksi dilanjutkan."
          />
          <div className="overflow-hidden rounded-3xl bg-white shadow-surface ring-1 ring-ring-subtle">
            {readiness.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === "pm" && onAssignPm) {
                    onAssignPm();
                  } else {
                    onNavigate(item.tab);
                  }
                }}
                className={`flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low ${index > 0 ? "border-t border-outline-variant/20" : ""}`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-surface-container-low text-primary">
                  <AppIcon
                    name={
                      item.tone === "APPROVED"
                        ? "check"
                        : item.tone === "DRAFT"
                          ? "edit_note"
                          : "priority_high"
                    }
                    className="icon-md"
                  />
                </span>
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span className="grid min-w-0 gap-0.5">
                    <span className="truncate text-xs leading-4 font-bold text-on-surface">
                      {item.label}
                    </span>
                    <span className="block truncate text-meta text-on-surface-variant">
                      {item.detail}
                    </span>
                  </span>
                  <Badge status={item.tone} className="shrink-0">
                    {item.value}
                  </Badge>
                </span>
                <AppIcon
                  name="chevron_right"
                  className="icon-md shrink-0 text-on-surface-variant/55"
                />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <ConfirmationDialog
        returnFocusRef={budgetDecisionReturnFocusRef}
        open={budgetDecision === "submit" || budgetDecision === "approve"}
        title={budgetDecision === "approve" ? "Setujui Project Budget?" : "Ajukan Project Budget?"}
        description={
          budgetDecision === "approve"
            ? "Plafon internal menjadi baseline aktif untuk kontrol budget dan transaksi proyek."
            : "Budget akan dikunci sementara dan dikirim kepada pihak yang berwenang untuk diputuskan."
        }
        confirmLabel={budgetDecision === "approve" ? "Setujui" : "Ajukan"}
        pending={budgetDecisionPending}
        onClose={() => setBudgetDecision(null)}
        onConfirm={() => runBudgetDecision(budgetDecision === "approve" ? "approve" : "submit")}
      />

      <CompactFormDialog
        returnFocusRef={budgetDecisionReturnFocusRef}
        open={budgetDecision === "reject"}
        title="Minta revisi budget"
        pending={budgetDecisionPending}
        onClose={() => setBudgetDecision(null)}
        actions={
          <Button
            variant="critical"
            fullWidth
            pending={budgetDecisionPending}
            disabled={budgetRejectionReason.trim().length < 3}
            onClick={() => runBudgetDecision("reject")}
          >
            Kembalikan untuk revisi
          </Button>
        }
      >
        <FormField label="Alasan revisi" helper="Minimal 3 karakter." required>
          <Textarea
            id="project-budget-rejection"
            autoFocus
            rows={4}
            value={budgetRejectionReason}
            onChange={setBudgetRejectionReason}
            placeholder="Contoh: Alokasi Material perlu disesuaikan dengan RAP terbaru"
            disabled={budgetDecisionPending}
          />
        </FormField>
      </CompactFormDialog>

      {!desktop ? (
        <section className="space-y-2.5">
          <SectionHeading
            title="Perlu tindakan"
            supporting={
              actions.length === 0
                ? "Tidak ada hambatan aktif saat ini."
                : `${actions.length} prioritas teratas berdasarkan dampaknya.`
            }
          />
          {actions.length === 0 ? (
            <div className="rounded-[22px] bg-white px-4 py-4 text-xs font-medium text-primary shadow-surface">
              <AppIcon name="check_circle" className="mr-2 icon-md align-middle" />
              Proyek berjalan tanpa blocker aktif.
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl bg-white shadow-surface ring-1 ring-ring-subtle">
              {actions.slice(0, 3).map((action, index) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => {
                    if (action.id === "assign-pm" && onAssignPm) {
                      onAssignPm();
                    } else {
                      onNavigate(action.tab);
                    }
                  }}
                  className={`flex min-h-17 w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low ${index > 0 ? "border-t border-outline-variant/20" : ""}`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ${action.severity === "CRITICAL" ? "bg-error-container/28 text-error" : action.severity === "WARNING" ? "bg-secondary-container/30 text-secondary" : "bg-primary/8 text-primary"}`}
                  >
                    <AppIcon
                      name={action.severity === "INFO" ? "arrow_forward" : "priority_high"}
                      className="icon-md"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs leading-4 font-bold text-on-surface">
                      {action.title}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-meta text-on-surface-variant">
                      {action.description}
                    </span>
                  </span>
                  <Badge status={action.severity === "INFO" ? "DRAFT" : action.severity}>
                    {action.severity === "CRITICAL"
                      ? "Kritis"
                      : action.severity === "WARNING"
                        ? "Perhatian"
                        : "Tinjau"}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {!desktop && budget ? (
        <section className="space-y-2.5">
          <SectionHeading
            title="Budget per kategori"
            supporting="Bandingkan realisasi dan sisa pada setiap pos."
            action={
              canReallocate ? (
                <Button type="button" variant="secondary" size="compact" onClick={openReallocation}>
                  Atur alokasi
                </Button>
              ) : undefined
            }
          />
          <div className="overflow-hidden rounded-3xl bg-white shadow-surface ring-1 ring-ring-subtle">
            {budget.categories.map((category, index) => (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  setSelectedCategorySurface("sheet");
                  setSelectedCategoryId(category.id);
                }}
                className={`block w-full px-4 py-3.5 text-left transition-colors outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low ${index > 0 ? "border-t border-outline-variant/20" : ""}`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-xs font-bold text-on-surface">
                      {category.name}
                    </span>
                    <Badge status={statusTone(category.status)}>
                      {category.status === "SAFE"
                        ? "Aman"
                        : category.status === "WATCH"
                          ? "Dipantau"
                          : category.status === "OVER_BUDGET"
                            ? "Terlampaui"
                            : formatBusinessLabel(category.status)}
                    </Badge>
                  </span>
                  <MoneyValue
                    amount={category.remainingAmount}
                    variant="fullDynamic"
                    tone={category.remainingAmount < 0 ? "danger" : "default"}
                    align="right"
                    size="sm"
                    className="shrink-0"
                  />
                </span>
                <span className="mt-2.5 flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1">
                    <UsageBlockMeter
                      value={category.usedPercentage}
                      tone={categoryTone(category.status)}
                      className="mt-0"
                    />
                  </span>
                  <span className="w-12 shrink-0 text-right font-mono text-eyebrow font-bold text-on-surface-variant tabular-nums">
                    {category.usedPercentage.toFixed(1)}%
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <DetailSheet
        open={Boolean(selectedCategory) && (!desktop || selectedCategorySurface === "sheet")}
        title={selectedCategory?.name ?? "Detail kategori"}
        onClose={() => setSelectedCategoryId(null)}
        footer={
          selectedCategory ? (
            <Button
              type="button"
              onClick={() => {
                const tab = categoryTab(selectedCategory.code);
                setSelectedCategoryId(null);
                onNavigate(tab);
              }}
              size={desktopControls ? "compact" : "default"}
              fullWidth
              className={
                desktopControls
                  ? "w-full"
                  : "min-h-12 w-full rounded-full bg-primary px-5 text-xs font-bold text-on-primary"
              }
              variant="primary"
            >
              {selectedCategory.code === "OPERASIONAL" || selectedCategory.code === "LAIN_LAIN"
                ? "Buka pengeluaran"
                : "Buka rencana internal"}
            </Button>
          ) : undefined
        }
      >
        {selectedCategory ? (
          <div className="overflow-hidden rounded-[22px] bg-white shadow-surface ring-1 ring-ring-subtle">
            <DetailMoneyRow label="Budget" amount={selectedCategory.allocatedAmount} />
            <DetailMoneyRow label="Realisasi" amount={selectedCategory.actualAmount} />
            <DetailMoneyRow label="Menunggu" amount={selectedCategory.pendingAmount} />
            <DetailMoneyRow label="Terbayar" amount={selectedCategory.paidAmount} />
            <DetailMoneyRow
              label="Sisa"
              amount={selectedCategory.remainingAmount}
              danger={selectedCategory.remainingAmount < 0}
            />
            <div className="border-t border-outline-variant/25 px-4 py-3">
              <div className="flex justify-between text-xs font-bold">
                <span>Budget terpakai</span>
                <span>{selectedCategory.usedPercentage.toFixed(1)}%</span>
              </div>
              <UsageBlockMeter
                value={selectedCategory.usedPercentage}
                tone={categoryTone(selectedCategory.status)}
              />
            </div>
          </div>
        ) : null}
      </DetailSheet>
      <OperationalFormSheet
        desktopSize="wide"
        desktopFooterPlacement="aside"
        desktopAsideSummary={
          <div className="space-y-3">
            <h3 className="px-1 text-support font-semibold text-on-surface">Ringkasan alokasi</h3>
            <GroupedSurface variant="desktopPanel" className="wrap-anywhere">
              <div className="divide-y divide-outline-variant/20">
                <FactRow
                  layout="stacked"
                  wrapLabel
                  label="Budget internal"
                  value={
                    budget ? (
                      <MoneyValue
                        fractionDigits={Number.isInteger(budget.internalBudget) ? 0 : 2}
                        amount={budget.internalBudget}
                        variant="fullDynamic"
                        size="sm"
                        align="right"
                      />
                    ) : (
                      "Belum tersedia"
                    )
                  }
                />
                <FactRow
                  layout="stacked"
                  wrapLabel
                  label="Dialokasikan"
                  value={`${totalRatio.toFixed(1)}%`}
                />
                <FactRow
                  layout="stacked"
                  wrapLabel
                  label="Buffer"
                  value={`${Math.max(0, 100 - totalRatio).toFixed(1)}%`}
                />
                <FactRow
                  layout="stacked"
                  wrapLabel
                  label="Kategori"
                  value={budget?.categories.length ?? 0}
                />
              </div>
            </GroupedSurface>
            <p className="px-1 text-support text-on-surface-variant">
              Alokasi dibagi dari budget internal. Perubahan budget yang disetujui tetap membutuhkan
              alasan audit.
            </p>
          </div>
        }
        dismissal={{
          mode: "confirm",
          dirty: reallocationDirty,
          onDiscard: () => {
            setRatios(
              Object.fromEntries(
                (budget?.categories ?? []).map((category) => [
                  category.id,
                  (
                    (category.allocatedAmount / Math.max(budget?.internalBudget ?? 1, 1)) *
                    100
                  ).toFixed(1),
                ]),
              ),
            );
            setReallocationReason("");
          },
          description: "Perubahan alokasi budget yang belum disimpan akan hilang.",
        }}
        pending={savingAllocation}
        open={reallocationOpen}
        title="Atur alokasi budget"
        onClose={() => !savingAllocation && setReallocationOpen(false)}
        submitLabel="Simpan alokasi"
        submittingLabel="Menyimpan…"
        disabled={
          savingAllocation ||
          totalRatio > 100.0001 ||
          (budget?.status === "APPROVED" && reallocationReason.trim().length < 10)
        }
        disabledReason={
          totalRatio > 100.0001
            ? "Total alokasi melebihi 100%. Kurangi salah satu kategori."
            : budget?.status === "APPROVED" && reallocationReason.trim().length < 10
              ? "Tulis alasan perubahan minimal 10 karakter."
              : undefined
        }
        statusText={
          totalRatio > 100
            ? "Total alokasi melebihi 100%. Kurangi salah satu kategori."
            : `${totalRatio.toFixed(1)}% dialokasikan · ${Math.max(0, 100 - totalRatio).toFixed(1)}% menjadi buffer.`
        }
        statusTone={totalRatio > 100 ? "danger" : "default"}
        onSubmit={() => void saveReallocation()}
      >
        <div className="space-y-4">
          <FormSection
            title="Pembagian kategori"
            helper="Masukkan persentase dari budget internal. Total maksimal 100%."
          >
            {budget?.categories.map((category) => (
              <FormField key={category.id} label={category.name} layout="inline">
                <NumericInput
                  value={ratios[category.id] ?? "0"}
                  onChange={(value) =>
                    setRatios((current) => ({
                      ...current,
                      [category.id]: value,
                    }))
                  }
                  min={0}
                  max={100}
                  placeholder="0"
                  suffix="%"
                  disabled={savingAllocation}
                  className="w-24"
                  aria-label={`Persentase ${category.name}`}
                />
              </FormField>
            ))}
          </FormSection>
          {budget?.status === "APPROVED" ? (
            <FormSection
              title="Alasan perubahan"
              helper="Budget sudah approved; alasan minimal 10 karakter akan masuk audit trail."
            >
              <FormField label="Catatan audit" required>
                <Textarea
                  value={reallocationReason}
                  onChange={setReallocationReason}
                  placeholder="Contoh: Realokasi Material ke Subcon sesuai revisi scope approved."
                  disabled={savingAllocation}
                  required
                />
              </FormField>
            </FormSection>
          ) : null}
        </div>
      </OperationalFormSheet>
    </div>
  );
}

function FinancialFact({
  label,
  amount,
  size = "md",
  className,
}: {
  readonly label: string;
  readonly amount: number;
  readonly size?: "sm" | "md";
  readonly className?: string;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-1.5 rounded-2xl bg-white/[0.07] p-3 text-left",
        className,
      )}
    >
      <p className="truncate text-[9px] leading-none font-bold tracking-wider text-white/50 uppercase">
        {label}
      </p>
      <MoneyValue amount={amount} variant="fullDynamic" tone="inverse" size={size} />
    </div>
  );
}

function DetailMoneyRow({
  label,
  amount,
  danger = false,
}: {
  readonly label: string;
  readonly amount: number;
  readonly danger?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 border-t border-outline-variant/25 px-4 py-3 first:border-t-0">
      <span className="text-xs font-semibold text-on-surface-variant">{label}</span>
      <MoneyValue
        amount={amount}
        fractionDigits={Number.isInteger(amount) ? 0 : 2}
        variant="fullDynamic"
        tone={danger ? "danger" : "default"}
        align="right"
        size="sm"
      />
    </div>
  );
}
