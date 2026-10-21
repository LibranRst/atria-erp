"use client";

import React from "react";
import type { ProjectBudgetDashboard } from "@/app/actions/project/excel-budget";
import {
  AppIcon,
  Button,
  DesktopTable,
  FactRow,
  GroupedSurface,
  MoneyValue,
  PageState,
  SectionHeader,
  StatusBadge,
  UsageBlockMeter,
  useListDetailFocus,
  type DesktopTableProps,
} from "@/components/ui";
import { useWorkspaceViewportAtLeast } from "@/lib/navigation/workspace-viewport";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import {
  projectHealthLabel,
  projectHealthReasonLabel,
  resolveEffectiveProjectHealth,
} from "@atria/core/project/effective-health";
import type { ProjectBudgetSource } from "../../types/project-tabs-types";
import { categoryTab } from "../../utils/project-overview-utils";
import type {
  ProjectOverviewAction,
  ProjectOverviewTab,
  ProjectReadinessItem,
} from "./project-overview";

type BudgetCategory = ProjectBudgetDashboard["categories"][number];
export type BudgetCategorySort = NonNullable<DesktopTableProps<BudgetCategory>["sortDescriptor"]>;

function percent(value: number): string {
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}

function categoryStatus(category: BudgetCategory): React.JSX.Element {
  return (
    <StatusBadge
      label={formatBusinessLabel(category.status)}
      tone={
        category.status === "OVER_BUDGET"
          ? "critical"
          : category.status === "WATCH"
            ? "warning"
            : "healthy"
      }
    />
  );
}

function Amount({
  amount,
  exact = false,
}: {
  readonly amount: number;
  readonly exact?: boolean;
}): React.JSX.Element {
  return (
    <MoneyValue
      amount={amount}
      fractionDigits={Number.isInteger(amount) ? 0 : 2}
      variant={exact ? "fullDynamic" : "compact"}
      align="right"
      size="sm"
      tone={amount < 0 ? "danger" : "default"}
    />
  );
}

export function ProjectOverviewDesktop({
  budget,
  budgetSource,
  storedHealth = "HEALTHY",
  contractValue,
  actions,
  readiness,
  selectedCategoryId,
  categorySort,
  canUpdateBudget,
  canApproveBudget,
  canReallocate,
  decisionPending,
  onCategorySelect,
  onCategoryClose,
  onCategorySort,
  onBudgetDecision,
  onReallocate,
  onNavigate,
  onAssignPm,
  onRetry,
}: {
  readonly budget: ProjectBudgetDashboard | null;
  readonly budgetSource?: ProjectBudgetSource;
  readonly storedHealth?: string;
  readonly contractValue: number;
  readonly actions: readonly ProjectOverviewAction[];
  readonly readiness: readonly ProjectReadinessItem[];
  readonly selectedCategoryId: string | null;
  readonly categorySort: BudgetCategorySort | undefined;
  readonly canUpdateBudget: boolean;
  readonly canApproveBudget: boolean;
  readonly canReallocate: boolean;
  readonly decisionPending: boolean;
  readonly onCategorySelect: (categoryId: string) => void;
  readonly onCategoryClose: () => void;
  readonly onCategorySort: (sort: BudgetCategorySort) => void;
  readonly onBudgetDecision: (kind: "submit" | "approve" | "reject") => void;
  readonly onReallocate: () => void;
  readonly onNavigate: (tab: ProjectOverviewTab) => void;
  readonly onAssignPm?: () => void;
  readonly onRetry?: () => void;
}): React.JSX.Element {
  const wide = useWorkspaceViewportAtLeast(1280);
  const source =
    budgetSource?.status === "ready" && !budget
      ? "unavailable"
      : (budgetSource?.status ?? (budget ? "ready" : "missing"));
  const availableBudget = source === "ready" ? budget : null;
  const selected =
    availableBudget?.categories.find((category) => category.id === selectedCategoryId) ?? null;
  const categoryContext = selected;
  const categoryDetailOnly = Boolean(!wide && selected);
  const { listRef, detailRef } = useListDetailFocus({
    active: useWorkspacePresentation() === "desktop",
    narrow: !wide,
    selectionKey: categoryContext?.id ?? null,
  });
  const risk = availableBudget
    ? resolveEffectiveProjectHealth({
        storedHealth,
        remainingBudget: availableBudget.remainingBudget,
        usedPercentage: availableBudget.usedPercentage,
        categoryStatuses: availableBudget.categories.map((category) => category.status),
        projectedMarginPercentage: availableBudget.projectedMarginPercentage,
        targetMarginPercentage: availableBudget.targetGrossPercentage,
      })
    : null;

  function navigateReadiness(item: ProjectReadinessItem): void {
    if (item.id === "pm" && onAssignPm) onAssignPm();
    else onNavigate(item.tab);
  }
  function navigateAction(item: ProjectOverviewAction): void {
    if (item.id === "assign-pm" && onAssignPm) onAssignPm();
    else onNavigate(item.tab);
  }

  return (
    <div className="min-w-0 space-y-4 select-text">
      <GroupedSurface variant="desktopPanel" as="section" className="p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-row font-semibold">Posisi budget proyek</h2>
          {availableBudget ? (
            <StatusBadge
              label={formatBusinessLabel(availableBudget.status)}
              tone={availableBudget.status === "PENDING_APPROVAL" ? "warning" : "neutral"}
            />
          ) : (
            <span className="text-support text-on-surface-variant">
              {source === "missing" ? "Belum terbentuk" : "Data belum tersedia"}
            </span>
          )}
        </div>
        <dl className="grid grid-cols-4 divide-x divide-outline-variant/25">
          {[
            { label: "Nilai proyek", amount: availableBudget?.contractValue ?? contractValue },
            { label: "Budget internal", amount: availableBudget?.internalBudget },
            { label: "Terpakai", amount: availableBudget?.actualCost },
            { label: "Sisa budget", amount: availableBudget?.remainingBudget },
          ].map((metric) => (
            <div key={metric.label} className="min-w-0 px-4 first:pl-0 last:pr-0">
              <dt className="mb-1 text-support text-on-surface-variant">{metric.label}</dt>
              <dd>
                {metric.amount === undefined ? (
                  <span className="text-title text-on-surface-variant">
                    —<span className="sr-only">Belum tersedia</span>
                  </span>
                ) : (
                  <MoneyValue
                    amount={metric.amount}
                    fractionDigits={Number.isInteger(metric.amount) ? 0 : 2}
                    variant="compact"
                    size="md"
                    tone={metric.amount < 0 ? "danger" : "default"}
                  />
                )}
              </dd>
            </div>
          ))}
        </dl>
        {availableBudget && risk ? (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-outline-variant/25 pt-3 text-support text-on-surface-variant">
              <span className="inline-flex items-center gap-2">
                Sudah dibayar <Amount amount={availableBudget.paidCost} />
              </span>
              <span className="inline-flex items-center gap-2">
                Menunggu review <Amount amount={availableBudget.pendingCost} />
              </span>
              <span>Penggunaan {percent(availableBudget.usedPercentage)}</span>
              <span className="inline-flex items-center gap-2">
                Proyeksi margin <Amount amount={availableBudget.projectedMarginAmount} /> ·{" "}
                {percent(availableBudget.projectedMarginPercentage)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-support text-on-surface-variant">
              <StatusBadge
                label={projectHealthLabel(risk.effectiveHealth)}
                tone={
                  risk.effectiveHealth === "CRITICAL"
                    ? "critical"
                    : risk.effectiveHealth === "WARNING"
                      ? "warning"
                      : "healthy"
                }
              />
              <span>
                {risk.healthReasons[0]
                  ? projectHealthReasonLabel(risk.healthReasons[0])
                  : `Target margin ${percent(availableBudget.targetGrossPercentage)}`}
              </span>
              {risk.healthReasons[0] ? (
                <span>· target margin {percent(availableBudget.targetGrossPercentage)}</span>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-support text-on-surface-variant">
              <span className="inline-flex items-center gap-2">
                RAB disetujui <Amount amount={availableBudget.approvedRabValue} />
              </span>
              {availableBudget.serviceFeeTotal > 0 ? (
                <>
                  <span className="inline-flex items-center gap-2">
                    Margin produksi <Amount amount={availableBudget.physicalMarginAmount} /> ·{" "}
                    {percent(availableBudget.physicalMarginPercentage)}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    Fee jasa <Amount amount={availableBudget.serviceFeeTotal} />
                  </span>
                </>
              ) : null}
            </div>
            {availableBudget.status === "DRAFT" || availableBudget.status === "PENDING_APPROVAL" ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/25 pt-3">
                <p className="text-support text-on-surface-variant">
                  {availableBudget.status === "PENDING_APPROVAL"
                    ? "Periksa plafon dan alokasi sebelum memutuskan."
                    : "Budget masih draft. Periksa nilai proyek dan alokasi sebelum diajukan."}
                </p>
                <div className="flex gap-2">
                  {availableBudget.status === "DRAFT" && canUpdateBudget ? (
                    <Button
                      size="compact"
                      pending={decisionPending}
                      onClick={() => onBudgetDecision("submit")}
                    >
                      Ajukan budget
                    </Button>
                  ) : null}
                  {availableBudget.status === "PENDING_APPROVAL" && canApproveBudget ? (
                    <>
                      <Button
                        size="compact"
                        variant="criticalQuiet"
                        pending={decisionPending}
                        onClick={() => onBudgetDecision("reject")}
                      >
                        Minta revisi
                      </Button>
                      <Button
                        size="compact"
                        pending={decisionPending}
                        onClick={() => onBudgetDecision("approve")}
                      >
                        Setujui budget
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </GroupedSurface>

      {!availableBudget ? (
        <div id="project-budget" className="scroll-mt-24">
          <PageState
            compact
            kind={
              source === "restricted" ? "restricted" : source === "missing" ? "first-use" : "error"
            }
            title={
              source === "restricted"
                ? "Akses budget terbatas"
                : source === "missing"
                  ? "Budget internal belum terbentuk"
                  : "Budget belum dapat dimuat"
            }
            description={
              budgetSource?.message ??
              (source === "restricted"
                ? "Akun ini tidak memiliki izin melihat budget proyek."
                : source === "missing"
                  ? "Lengkapi RAP dan RAB untuk membentuk baseline budget proyek."
                  : "Kondisi budget dan margin belum dapat dipastikan. Muat ulang untuk mencoba lagi.")
            }
            actionLabel={
              source === "missing" && canUpdateBudget
                ? "Buka perencanaan"
                : source === "unavailable"
                  ? "Coba lagi"
                  : undefined
            }
            onAction={
              source === "missing" && canUpdateBudget
                ? () => onNavigate("rap")
                : source === "unavailable"
                  ? onRetry
                  : undefined
            }
          />
        </div>
      ) : (
        <section
          id="project-budget"
          className="min-w-0 scroll-mt-24 space-y-3"
          aria-label="Kontrol kategori budget"
        >
          <SectionHeader
            title="Budget per kategori"
            action={
              canReallocate ? (
                <Button size="compact" variant="secondary" onClick={onReallocate}>
                  Atur alokasi
                </Button>
              ) : undefined
            }
          />
          <p className="px-1 text-support text-on-surface-variant">
            Terpakai menunjukkan beban budget. Pembayaran dan pengajuan ditampilkan terpisah dalam
            rincian.
          </p>
          <div
            className={`grid min-w-0 items-start gap-4 ${wide && categoryContext ? "grid-cols-[minmax(0,1fr)_18rem]" : "grid-cols-1"}`}
          >
            <div ref={listRef} hidden={categoryDetailOnly} className="min-w-0">
              <DesktopTable
                ariaLabel="Budget proyek per kategori"
                layout="fixed"
                rows={availableBudget.categories}
                rowKey={(category) => category.id}
                selectedRowKey={wide ? (categoryContext?.id ?? null) : null}
                onRowSelectionChange={(category) => {
                  if (decisionPending) return;
                  if (category) onCategorySelect(category.id);
                  else onCategoryClose();
                }}
                sortDescriptor={categorySort}
                onSortChange={onCategorySort}
                emptyTitle="Belum ada alokasi kategori"
                emptyDescription="Alokasi kategori belum tersedia untuk budget ini."
                columns={[
                  {
                    key: "category",
                    label: "Kategori",
                    widthPercent: 22,
                    sortValue: (category) => category.name,
                    render: (category) => (
                      <div className="min-w-0 space-y-1 wrap-anywhere">
                        <p className="text-row font-semibold">{category.name}</p>
                        <p className="text-support text-on-surface-variant">
                          {percent(category.usedPercentage)} terpakai
                        </p>
                      </div>
                    ),
                  },
                  {
                    key: "allocated",
                    label: "Alokasi",
                    widthPercent: 17,
                    align: "end",
                    sortValue: (category) => category.allocatedAmount,
                    render: (category) => <Amount amount={category.allocatedAmount} />,
                  },
                  {
                    key: "actual",
                    label: "Terpakai",
                    widthPercent: 17,
                    align: "end",
                    sortValue: (category) => category.actualAmount,
                    render: (category) => <Amount amount={category.actualAmount} />,
                  },
                  {
                    key: "remaining",
                    label: "Sisa",
                    widthPercent: 17,
                    align: "end",
                    sortValue: (category) => category.remainingAmount,
                    render: (category) => <Amount amount={category.remainingAmount} />,
                  },
                  {
                    key: "status",
                    label: "Kondisi",
                    widthPercent: 27,
                    sortValue: (category) => category.usedPercentage,
                    render: categoryStatus,
                  },
                ]}
              />
            </div>
            {categoryContext ? (
              <div ref={detailRef} className="min-w-0 space-y-3">
                {categoryDetailOnly ? (
                  <Button
                    size="compact"
                    variant="secondary"
                    disabled={decisionPending}
                    onClick={onCategoryClose}
                  >
                    <AppIcon name="arrow_back" className="icon-sm" /> Kembali ke kategori
                  </Button>
                ) : null}
                <ProjectCategoryDesktopDetail category={categoryContext} onNavigate={onNavigate} />
              </div>
            ) : null}
          </div>
        </section>
      )}

      {availableBudget ? (
        <div className="grid min-w-0 grid-cols-2 items-start gap-4">
          <section className="min-w-0 space-y-3">
            <SectionHeader title="Perlu tindakan" count={actions.length} countLabel="prioritas" />
            <GroupedSurface variant="desktopPanel">
              {actions.length ? (
                <div className="divide-y divide-outline-variant/20">
                  {actions.slice(0, 3).map((item) => (
                    <div key={item.id} className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-row font-semibold">{item.title}</h3>
                        <StatusBadge
                          label={
                            item.severity === "CRITICAL"
                              ? "Kritis"
                              : item.severity === "WARNING"
                                ? "Perhatian"
                                : "Tinjau"
                          }
                          tone={
                            item.severity === "CRITICAL"
                              ? "critical"
                              : item.severity === "WARNING"
                                ? "warning"
                                : "neutral"
                          }
                        />
                      </div>
                      <p className="text-support leading-5 text-on-surface-variant">
                        {item.description}
                      </p>
                      <Button size="compact" variant="ghost" onClick={() => navigateAction(item)}>
                        Tinjau <AppIcon name="arrow_forward" className="icon-sm" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-5 text-support text-on-surface-variant">
                  Tidak ada prioritas tindakan dari data proyek saat ini.
                </p>
              )}
              {actions.length > 3 ? (
                <p className="border-t border-outline-variant/20 px-4 py-3 text-support text-on-surface-variant">
                  Menampilkan 3 dari {actions.length} prioritas.
                </p>
              ) : null}
            </GroupedSurface>
          </section>
          <section className="min-w-0 space-y-3">
            <SectionHeader title="Kesiapan proyek" />
            <GroupedSurface variant="desktopPanel">
              <div className="divide-y divide-outline-variant/20">
                {readiness.map((item) => (
                  <Button
                    key={item.id}
                    variant="ghost"
                    size="compact"
                    className="h-auto! min-h-16 w-full justify-between! gap-3 px-4! py-3! text-left!"
                    onClick={() => navigateReadiness(item)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-row font-semibold">{item.label}</span>
                      <span className="mt-1 block text-support leading-5 whitespace-normal text-on-surface-variant">
                        {item.detail}
                      </span>
                    </span>
                    <span className="shrink-0">
                      <StatusBadge
                        label={formatBusinessLabel(item.value)}
                        tone={
                          item.tone === "CRITICAL"
                            ? "critical"
                            : item.tone === "WARNING"
                              ? "warning"
                              : item.tone === "APPROVED"
                                ? "healthy"
                                : "neutral"
                        }
                      />
                    </span>
                    <AppIcon
                      name="chevron_right"
                      className="icon-sm shrink-0 text-on-surface-variant"
                    />
                  </Button>
                ))}
              </div>
            </GroupedSurface>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export function ProjectCategoryDesktopDetail({
  category,
  onNavigate,
}: {
  readonly category: BudgetCategory;
  readonly onNavigate: (tab: ProjectOverviewTab) => void;
}): React.JSX.Element {
  return (
    <section className="min-w-0 space-y-3" aria-label={`Rincian kategori ${category.name}`}>
      <GroupedSurface variant="desktopPanel">
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-section font-semibold">{category.name}</h3>
            {categoryStatus(category)}
          </div>
          <div className="text-support text-on-surface-variant">
            {percent(category.usedPercentage)} budget terpakai
            <UsageBlockMeter
              value={category.usedPercentage}
              tone={
                category.status === "OVER_BUDGET"
                  ? "critical"
                  : category.status === "WATCH"
                    ? "warning"
                    : "positive"
              }
            />
          </div>
        </div>
        <div className="divide-y divide-outline-variant/20 border-t border-outline-variant/20">
          {[
            { label: "Alokasi", amount: category.allocatedAmount },
            { label: "Terpakai", amount: category.actualAmount },
            { label: "Sisa budget", amount: category.remainingAmount },
            { label: "Menunggu review", amount: category.pendingAmount },
            { label: "Sudah dibayar", amount: category.paidAmount },
          ].map((fact) => (
            <FactRow
              key={fact.label}
              label={fact.label}
              value={<Amount amount={fact.amount} exact />}
            />
          ))}
        </div>
        <div className="border-t border-outline-variant/20 p-4">
          <Button
            size="compact"
            className="w-full"
            onClick={() => onNavigate(categoryTab(category.code))}
          >
            {category.code === "OPERASIONAL" || category.code === "LAIN_LAIN"
              ? "Buka pengeluaran"
              : "Buka rencana internal"}
          </Button>
        </div>
      </GroupedSurface>
      <p className="px-1 text-support leading-5 text-on-surface-variant">
        Pengajuan menunggu keputusan belum menjadi pembayaran kas. Nilai kategori mengikuti baseline
        budget proyek.
      </p>
    </section>
  );
}
