"use client";

import React from "react";
import type { ProjectBudgetDashboard } from "@/app/actions/project/excel-budget";
import {
  Button,
  DesktopTable,
  GroupedSurface,
  MoneyValue,
  SectionHeader,
  StatusBadge,
  type DesktopTableProps,
} from "@/components/ui";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import type {
  ProjectOverviewAction,
  ProjectOverviewTab,
  ProjectReadinessItem,
} from "./project-overview";

export type BudgetCategorySort = NonNullable<
  DesktopTableProps<ProjectBudgetDashboard["categories"][number]>["sortDescriptor"]
>;

export function ProjectOverviewDesktop({
  budget,
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
  onCategorySort,
  onBudgetDecision,
  onReallocate,
  onNavigate,
  onAssignPm,
}: {
  readonly budget: ProjectBudgetDashboard | null;
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
  readonly onCategorySort: (sort: BudgetCategorySort) => void;
  readonly onBudgetDecision: (kind: "submit" | "approve" | "reject") => void;
  readonly onReallocate: () => void;
  readonly onNavigate: (tab: ProjectOverviewTab) => void;
  readonly onAssignPm?: () => void;
}): React.JSX.Element {
  function navigateReadiness(item: ProjectReadinessItem): void {
    if (item.id === "pm" && onAssignPm) onAssignPm();
    else onNavigate(item.tab);
  }
  function navigateAction(item: ProjectOverviewAction): void {
    if (item.id === "assign-pm" && onAssignPm) onAssignPm();
    else onNavigate(item.tab);
  }
  return (
    <div className="space-y-5">
      <GroupedSurface as="section" className="p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-row font-semibold">Posisi budget proyek</h2>
          {budget ? (
            <StatusBadge
              label={formatBusinessLabel(budget.status)}
              tone={budget.status === "PENDING_APPROVAL" ? "warning" : "neutral"}
            />
          ) : null}
        </div>
        {budget ? (
          <>
            <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-3 xl:grid-cols-6">
              {[
                { label: "Nilai proyek", amount: budget.contractValue },
                { label: "Budget internal", amount: budget.internalBudget },
                { label: "Terpakai", amount: budget.actualCost },
                { label: "Dibayar", amount: budget.paidCost },
                { label: "Sisa budget", amount: budget.remainingBudget },
                { label: "Proyeksi margin", amount: budget.projectedMarginAmount },
              ].map((metric) => (
                <div key={metric.label}>
                  <dt className="mb-1 text-support text-on-surface-variant">{metric.label}</dt>
                  <dd>
                    <MoneyValue
                      amount={metric.amount}
                      variant="compact"
                      size="md"
                      tone={metric.amount < 0 ? "danger" : "default"}
                    />
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-outline-variant/25 pt-3 text-support text-on-surface-variant">
              <span>
                Menunggu review{" "}
                <MoneyValue amount={budget.pendingCost} variant="compact" size="sm" />
              </span>
              <span>
                RAB disetujui{" "}
                <MoneyValue amount={budget.approvedRabValue} variant="compact" size="sm" />
              </span>
              <span>
                Penggunaan{" "}
                {budget.usedPercentage.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
              </span>
              <span>
                Margin{" "}
                {budget.projectedMarginPercentage.toLocaleString("id-ID", {
                  maximumFractionDigits: 1,
                })}
                % · target{" "}
                {budget.targetGrossPercentage.toLocaleString("id-ID", { maximumFractionDigits: 1 })}
                %
              </span>
            </div>
            {budget.serviceFeeTotal > 0 ? (
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-support text-on-surface-variant">
                <span>
                  Margin produksi{" "}
                  <MoneyValue amount={budget.physicalMarginAmount} variant="compact" size="sm" /> ·{" "}
                  {budget.physicalMarginPercentage.toLocaleString("id-ID", {
                    maximumFractionDigits: 1,
                  })}
                  %
                </span>
                <span>
                  Fee jasa{" "}
                  <MoneyValue amount={budget.serviceFeeTotal} variant="compact" size="sm" />
                </span>
              </div>
            ) : null}
            {budget.status === "DRAFT" || budget.status === "PENDING_APPROVAL" ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/25 pt-3">
                <p className="text-support text-on-surface-variant">
                  {budget.status === "PENDING_APPROVAL"
                    ? "Periksa plafon dan alokasi kategori sebelum memutuskan."
                    : "Pastikan nilai proyek dan alokasi kategori sebelum diajukan."}
                </p>
                <div className="flex gap-2">
                  {budget.status === "DRAFT" && canUpdateBudget ? (
                    <Button
                      size="compact"
                      pending={decisionPending}
                      onClick={() => onBudgetDecision("submit")}
                    >
                      Ajukan budget
                    </Button>
                  ) : null}
                  {budget.status === "PENDING_APPROVAL" && canApproveBudget ? (
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
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-row font-semibold">Budget internal belum tersedia</p>
              <p className="mt-1 text-support text-on-surface-variant">
                Nilai proyek <MoneyValue amount={contractValue} variant="compact" size="sm" />.
                Lengkapi rencana internal dan RAB proyek.
              </p>
            </div>
            <Button size="compact" onClick={() => onNavigate("rap")}>
              Mulai dari RAP
            </Button>
          </div>
        )}
      </GroupedSurface>

      {budget ? (
        <section className="space-y-3">
          <SectionHeader
            title="Budget per kategori"
            meta="Alokasi, realisasi dan pembayaran memiliki posisi terpisah."
            action={
              canReallocate ? (
                <Button size="compact" variant="secondary" onClick={onReallocate}>
                  Atur alokasi
                </Button>
              ) : undefined
            }
          />
          <DesktopTable
            ariaLabel="Budget proyek per kategori"
            rows={budget.categories}
            rowKey={(category) => category.id}
            selectedRowKey={selectedCategoryId}
            onRowAction={(category) => onCategorySelect(category.id)}
            sortDescriptor={categorySort}
            onSortChange={onCategorySort}
            columns={[
              {
                key: "category",
                label: "Kategori",
                sortValue: (category) => category.name,
                render: (category) => category.name,
              },
              {
                key: "allocated",
                label: "Alokasi",
                align: "end",
                sortValue: (category) => category.allocatedAmount,
                render: (category) => (
                  <MoneyValue
                    amount={category.allocatedAmount}
                    variant="compact"
                    align="right"
                    size="sm"
                  />
                ),
              },
              {
                key: "pending",
                label: "Menunggu review",
                align: "end",
                sortValue: (category) => category.pendingAmount,
                render: (category) => (
                  <MoneyValue
                    amount={category.pendingAmount}
                    variant="compact"
                    align="right"
                    size="sm"
                  />
                ),
              },
              {
                key: "actual",
                label: "Terpakai",
                align: "end",
                sortValue: (category) => category.actualAmount,
                render: (category) => (
                  <MoneyValue
                    amount={category.actualAmount}
                    variant="compact"
                    align="right"
                    size="sm"
                  />
                ),
              },
              {
                key: "paid",
                label: "Dibayar",
                align: "end",
                sortValue: (category) => category.paidAmount,
                render: (category) => (
                  <MoneyValue
                    amount={category.paidAmount}
                    variant="compact"
                    align="right"
                    size="sm"
                  />
                ),
              },
              {
                key: "remaining",
                label: "Sisa budget",
                align: "end",
                sortValue: (category) => category.remainingAmount,
                render: (category) => (
                  <MoneyValue
                    amount={category.remainingAmount}
                    variant="compact"
                    align="right"
                    size="sm"
                    tone={category.remainingAmount < 0 ? "danger" : "default"}
                  />
                ),
              },
              {
                key: "status",
                label: "Kondisi",
                render: (category) => (
                  <div className="space-y-1">
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
                    <p className="text-meta text-on-surface-variant">
                      {category.usedPercentage.toLocaleString("id-ID", {
                        maximumFractionDigits: 1,
                      })}
                      % terpakai
                    </p>
                  </div>
                ),
              },
            ]}
          />
        </section>
      ) : null}

      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <section className="min-w-0 space-y-3">
          <SectionHeader title="Kesiapan proyek" />
          <DesktopTable
            ariaLabel="Kesiapan proyek"
            rows={readiness}
            rowKey={(item) => item.id}
            columns={[
              {
                key: "readiness",
                label: "Kebutuhan",
                render: (item) => (
                  <div>
                    <p className="font-semibold">{item.label}</p>
                    <p className="mt-0.5 max-w-64 text-meta text-on-surface-variant">
                      {item.detail}
                    </p>
                  </div>
                ),
              },
              {
                key: "status",
                label: "Status",
                render: (item) => (
                  <StatusBadge
                    label={item.value}
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
                ),
              },
              {
                key: "action",
                label: "Tindakan",
                render: (item) => (
                  <Button size="compact" variant="tertiary" onClick={() => navigateReadiness(item)}>
                    Buka
                  </Button>
                ),
              },
            ]}
          />
        </section>
        <section className="min-w-0 space-y-3">
          <SectionHeader
            title="Perlu tindakan"
            meta={
              actions.length
                ? `${actions.length} prioritas berdasarkan dampaknya.`
                : "Tidak ada hambatan aktif saat ini."
            }
          />
          <DesktopTable
            ariaLabel="Prioritas proyek"
            rows={actions.slice(0, 3)}
            rowKey={(item) => item.id}
            emptyTitle="Tidak ada hambatan aktif"
            emptyDescription="Proyek berjalan tanpa blocker aktif."
            columns={[
              {
                key: "action",
                label: "Prioritas",
                render: (item) => (
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-0.5 max-w-72 text-meta text-on-surface-variant">
                      {item.description}
                    </p>
                  </div>
                ),
              },
              {
                key: "status",
                label: "Kondisi",
                render: (item) => (
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
                ),
              },
              {
                key: "open",
                label: "Tindakan",
                render: (item) => (
                  <Button size="compact" variant="tertiary" onClick={() => navigateAction(item)}>
                    Tinjau
                  </Button>
                ),
              },
            ]}
          />
        </section>
      </div>
    </div>
  );
}
