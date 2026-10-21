"use client";

import React from "react";
import {
  useWorkspaceControlPresentation,
  useWorkspacePresentation,
} from "@/lib/navigation/workspace-presentation";
import { useCan } from "@/components/auth/permissions-provider";
import { fieldClaimStatusLabel } from "@/features/expenses/utils/expense-list-utils";

import {
  AppIcon,
  DesktopTable,
  EmptyState,
  GroupedSurface,
  MoneyValue,
  SectionHeader,
  SegmentedTabs,
  SummaryFact,
  SummarySurface,
  Button,
  type DesktopTableColumn,
  type SelectOption,
} from "@/components/ui";
import { usePreservedScrollHeight } from "@/lib/hooks/use-preserved-scroll-height";
import type { ExpenseCostItem, FilterStatus } from "@/features/expenses/types/expense-list-types";
import { FieldClaimHistory } from "@/features/expenses/components/lists/field-claim-rows";
import { FieldClaimRow } from "@/features/expenses/components/lists/field-claim-rows";
import {
  useExpenseDesktopQuery,
  useExpenseDesktopTable,
} from "../../hooks/use-expense-desktop-query";
import { FieldClaimDesktopAmount, FieldClaimDesktopStatus } from "./field-claims-desktop-detail";
import { FieldClaimsDesktopWorkspace } from "./field-claims-desktop-workspace";
import {
  fieldClaimCategoryKey,
  fieldClaimCategoryLabel,
  fieldClaimDisplayDate,
  fieldClaimDesktopStatusLabel,
  filterFieldClaimsDesktop,
  type FieldClaimDesktopFilters,
} from "@/features/expenses/utils/field-claims-desktop";
type FilterTab = {
  readonly label: string;
  readonly value: FilterStatus;
  readonly count: number;
};

type FieldClaimsPanelProps = {
  readonly leadingContent?: React.ReactNode;
  readonly projectId?: string;
  readonly initialCosts: readonly ExpenseCostItem[];
  readonly filteredCosts: readonly ExpenseCostItem[];
  readonly filter: FilterStatus;
  readonly filterTabs: readonly FilterTab[];
  readonly needsActionCount: number;
  readonly readyToPayCount: number;
  readonly activeClaimTotal: number;
  readonly isOwnerOrFinance: boolean;
  readonly pending: boolean;
  readonly historyExpanded: boolean;
  readonly onFilterChange: (value: FilterStatus) => void;
  readonly onHistoryExpandedChange: (value: boolean) => void;
  readonly onOpenExpenseDrawer: () => void;
  readonly onScanReceipt?: () => void;
  readonly onVerify: (cost: ExpenseCostItem) => void;
  readonly onDisburse: (cost: ExpenseCostItem) => void;
  readonly onOpenReceipt: (imageUrl: string) => void;
};

export function FieldClaimsPanel({
  leadingContent,
  projectId,
  initialCosts,
  filteredCosts,
  filter,
  filterTabs,
  needsActionCount,
  readyToPayCount,
  activeClaimTotal,
  isOwnerOrFinance,
  pending,
  historyExpanded,
  onFilterChange,
  onHistoryExpandedChange,
  onOpenExpenseDrawer,
  onScanReceipt,
  onVerify,
  onDisburse,
  onOpenReceipt,
}: FieldClaimsPanelProps): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  const desktopControls = useWorkspaceControlPresentation() === "desktop";
  const modernDesktop = desktop || desktopControls;
  const queryState = useExpenseDesktopQuery(projectId, "claims");
  const can = useCan();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [visibleLimit, setVisibleLimit] = React.useState(20);
  const desktopFilters: FieldClaimDesktopFilters = {
    query: queryState.read("search", ""),
    project: projectId ?? queryState.read("project", "all"),
    category: queryState.read("category", "all"),
    date: queryState.read("date", "all"),
  };
  function setDesktopFilters(next: FieldClaimDesktopFilters): void {
    queryState.update({
      search: next.query,
      project: projectId ? null : next.project,
      category: next.category,
      date: next.date,
    });
  }
  // Re-read the calendar when supplied rows or filters change, including after a month rollover.
  const desktopCosts = filterFieldClaimsDesktop(filteredCosts, desktopFilters, new Date());
  const projectOptions = React.useMemo((): readonly SelectOption[] => {
    const projects = new Map<string, string>();
    initialCosts.forEach((cost) => {
      if (cost.project) projects.set(cost.project.id, cost.project.name);
    });
    return [
      { value: "all", label: "Semua proyek" },
      ...[...projects]
        .sort((a, b) => a[1].localeCompare(b[1], "id-ID"))
        .map(([value, label]) => ({ value, label })),
    ];
  }, [initialCosts]);
  const categoryOptions = React.useMemo((): readonly SelectOption[] => {
    const categories = new Map<string, string>();
    initialCosts.forEach((cost) =>
      categories.set(fieldClaimCategoryKey(cost), fieldClaimCategoryLabel(cost)),
    );
    return [
      { value: "all", label: "Semua kategori" },
      ...[...categories]
        .sort((a, b) => a[1].localeCompare(b[1], "id-ID"))
        .map(([value, label]) => ({ value, label })),
    ];
  }, [initialCosts]);
  const desktopColumns = React.useMemo(
    (): readonly DesktopTableColumn<ExpenseCostItem>[] => [
      {
        key: "description",
        label: "Pengeluaran",
        sortable: true,
        sortValue: (cost) => cost.description,
        render: (cost) => (
          <div className="max-w-56">
            <p className="line-clamp-2 font-semibold">{cost.description}</p>
            <p
              className="mt-1 truncate text-support text-on-surface-variant"
              title={
                projectId
                  ? cost.requestedBy?.name || "Pemohon tidak tersedia"
                  : `${cost.project?.name || "Proyek tidak tersedia"} · ${cost.requestedBy?.name || "Pemohon tidak tersedia"}`
              }
            >
              {projectId ? null : `${cost.project?.name || "Proyek tidak tersedia"} · `}
              {cost.requestedBy?.name || "Pemohon tidak tersedia"}
            </p>
          </div>
        ),
      },
      {
        key: "category",
        label: "Kategori",
        sortable: true,
        sortValue: fieldClaimCategoryLabel,
        render: (cost) => <span className="text-support">{fieldClaimCategoryLabel(cost)}</span>,
      },
      {
        key: "createdAt",
        label: "Diajukan",
        sortable: true,
        sortValue: (cost) => new Date(cost.createdAt).getTime(),
        render: (cost) => (
          <span className="text-support tabular-nums">{fieldClaimDisplayDate(cost.createdAt)}</span>
        ),
      },
      {
        key: "amount",
        label: "Nominal",
        align: "end",
        sortable: true,
        sortValue: (cost) => Number(cost.amount),
        render: (cost) => (
          <FieldClaimDesktopAmount
            amount={Number(cost.amount)}
            variant="compact"
            size="sm"
            align="right"
          />
        ),
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        sortValue: (cost) => fieldClaimDesktopStatusLabel(cost.status),
        render: (cost) => (
          <div className="space-y-1">
            <FieldClaimDesktopStatus cost={cost} />
            {cost.budgetOverrun ? (
              <p className="flex items-center gap-1 text-support text-critical">
                <AppIcon name="warning" className="icon-xs shrink-0" /> Melebihi budget
              </p>
            ) : null}
          </div>
        ),
      },
    ],
    [projectId],
  );
  const table = useExpenseDesktopTable(desktopCosts, desktopColumns, {
    query: queryState,
    initialSort: { column: "createdAt", direction: "descending" },
    filterKey: JSON.stringify([filter, desktopFilters]),
    rowKey: (cost) => cost.id,
  });
  const {
    containerRef: resultsRef,
    containerStyle: resultsStyle,
    preserveScrollPosition,
  } = usePreservedScrollHeight(filter);
  const hasNoRows = filter === "ALL" ? initialCosts.length === 0 : filteredCosts.length === 0;
  const visibleCosts = filteredCosts.slice(0, visibleLimit);
  const selectedCost = filteredCosts.find((cost) => cost.id === selectedId);

  function changeFilter(value: FilterStatus): void {
    if (!modernDesktop) preserveScrollPosition();
    setVisibleLimit(20);
    queryState.update({ page: 1 });
    onFilterChange(value);
  }

  return (
    <div className="min-w-0 space-y-sm">
      {leadingContent}
      <div hidden={!modernDesktop} inert={!modernDesktop}>
        <FieldClaimsDesktopWorkspace
          projectId={projectId}
          initialCosts={initialCosts}
          filteredCosts={desktopCosts}
          activeClaimTotal={activeClaimTotal}
          readyToPayCount={readyToPayCount}
          filter={filter}
          filterTabs={filterTabs}
          onFilterChange={changeFilter}
          filters={desktopFilters}
          onFiltersChange={setDesktopFilters}
          projectOptions={projectOptions}
          categoryOptions={categoryOptions}
          columns={desktopColumns}
          table={table}
          selectedId={selectedId}
          onSelect={setSelectedId}
          pending={pending}
          canVerify={can("verify:cost") && can("update:cost")}
          canPay={can("pay:cost")}
          canCreate={can("create:cost")}
          onOpenExpenseDrawer={onOpenExpenseDrawer}
          onScanReceipt={onScanReceipt}
          onVerify={onVerify}
          onDisburse={onDisburse}
          onOpenReceipt={onOpenReceipt}
        />
      </div>
      <div hidden={modernDesktop} inert={modernDesktop} className="space-y-sm">
        <div className="space-y-3" data-expense-overview-cluster>
          <FieldClaimsSummary
            projectId={projectId}
            needsActionCount={needsActionCount}
            readyToPayCount={readyToPayCount}
            activeClaimTotal={activeClaimTotal}
            onOpenExpenseDrawer={onOpenExpenseDrawer}
          />
        </div>

        <SegmentedTabs
          value={filter}
          onChange={changeFilter}
          ariaLabel="Filter pengeluaran"
          scrollable
          density="compact"
          options={filterTabs.map((tab) => ({
            value: tab.value,
            label: tab.label,
            count: tab.count,
          }))}
        />

        <div ref={resultsRef} style={resultsStyle}>
          {hasNoRows ? (
            <GroupedSurface>
              <EmptyState
                icon="receipt_long"
                title="Tidak Ada Pengajuan"
                description="Tidak ada pengajuan pengeluaran biaya lapangan dalam kategori filter ini."
              />
            </GroupedSurface>
          ) : (
            <div className="space-y-3">
              <SectionHeader
                title={
                  filter === "ALL"
                    ? "Pengeluaran aktif"
                    : (filterTabs.find((tab) => tab.value === filter)?.label ?? "Pengeluaran")
                }
                count={filteredCosts.length}
                countLabel="Pengajuan"
              />
              {desktop ? (
                <div
                  className={`grid items-start gap-6 ${selectedCost ? "xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.65fr)]" : ""}`}
                >
                  <DesktopTable
                    ariaLabel="Pengeluaran lapangan"
                    rows={visibleCosts}
                    rowKey={(cost) => cost.id}
                    selectedRowKey={selectedCost?.id ?? null}
                    onRowSelectionChange={(cost) => {
                      if (!pending) setSelectedId(cost?.id ?? null);
                    }}
                    columns={[
                      {
                        key: "description",
                        label: "Pengeluaran",
                        render: (cost) => (
                          <div>
                            <p className="font-semibold">{cost.description}</p>
                            <p className="text-meta text-on-surface-variant">
                              {cost.project?.name ?? "Proyek"} · {cost.requestedBy?.name ?? "—"}
                            </p>
                          </div>
                        ),
                      },
                      {
                        key: "amount",
                        label: "Nilai",
                        align: "end",
                        render: (cost) => (
                          <MoneyValue amount={Number(cost.amount)} variant="compact" size="sm" />
                        ),
                      },
                      {
                        key: "status",
                        label: "Status",
                        render: (cost) => (
                          <span>
                            {fieldClaimStatusLabel(cost.status)}
                            {cost.budgetOverrun ? (
                              <span className="block text-meta text-error">Melebihi budget</span>
                            ) : null}
                          </span>
                        ),
                      },
                    ]}
                  />
                  {selectedCost ? (
                    <section
                      aria-label="Detail pengeluaran"
                      className="min-w-0 space-y-2 xl:sticky xl:top-24"
                    >
                      <SectionHeader title="Detail pengeluaran" />
                      <GroupedSurface>
                        <FieldClaimRow
                          cost={selectedCost}
                          isOwnerOrFinance={isOwnerOrFinance}
                          pending={pending}
                          onVerify={onVerify}
                          onDisburse={onDisburse}
                          onOpenReceipt={onOpenReceipt}
                        />
                      </GroupedSurface>
                      <p className="px-3 text-meta text-on-surface-variant">
                        Buka pengeluaran untuk meninjau rincian dan bukti. Verifikasi dan pencairan
                        mengikuti otorisasi yang sama.
                      </p>
                    </section>
                  ) : null}
                </div>
              ) : (
                <GroupedSurface>
                  <div className="divide-y divide-black/5.5">
                    {visibleCosts.map((cost) => (
                      <FieldClaimRow
                        key={cost.id}
                        cost={cost}
                        isOwnerOrFinance={isOwnerOrFinance}
                        pending={pending}
                        onVerify={onVerify}
                        onDisburse={onDisburse}
                        onOpenReceipt={onOpenReceipt}
                      />
                    ))}
                  </div>
                </GroupedSurface>
              )}

              {filteredCosts.length > visibleLimit ? (
                <Button
                  type="button"
                  onClick={() => setVisibleLimit((current) => current + 20)}
                  className="min-h-12 w-full rounded-full bg-surface-container text-xs leading-4 font-bold text-on-surface"
                  variant="secondary"
                >
                  Tampilkan 20 berikutnya
                </Button>
              ) : null}

              {filter === "ALL" && (
                <FieldClaimHistory
                  costs={initialCosts}
                  expanded={historyExpanded}
                  onExpandedChange={onHistoryExpandedChange}
                  onOpenReceipt={onOpenReceipt}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldClaimsSummary({
  projectId,
  needsActionCount,
  readyToPayCount,
  activeClaimTotal,
  onOpenExpenseDrawer,
}: {
  readonly projectId?: string;
  readonly needsActionCount: number;
  readonly readyToPayCount: number;
  readonly activeClaimTotal: number;
  readonly onOpenExpenseDrawer: () => void;
}): React.JSX.Element {
  return (
    <SummarySurface
      ariaLabel="Posisi pengeluaran lapangan"
      eyebrow="Pengeluaran lapangan"
      icon="receipt_long"
      status={needsActionCount > 0 ? `${needsActionCount} perlu aksi` : "Terkendali"}
      statusTone={needsActionCount > 0 ? "warning" : "positive"}
      action={
        projectId ? (
          <Button
            type="button"
            onClick={onOpenExpenseDrawer}
            className="relative inline-flex h-8 items-center justify-center gap-1 rounded-full bg-accent/8 px-3 text-meta font-semibold text-accent outline-none after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-accent/[0.14]"
            variant="secondary"
            size="mini"
          >
            <AppIcon name="add" className="icon-xs leading-none" />
            Tambah
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-2 px-3.5 pt-3.5 pb-2">
        <div className="min-w-0">
          <p className="text-eyebrow font-semibold text-on-surface-variant/60">Total aktif</p>
          <MoneyValue amount={activeClaimTotal} variant="fullDynamic" size="lg" className="mt-1" />
        </div>
        <p className="text-meta text-on-surface-variant/70">
          Dana yang masih berada dalam alur verifikasi hingga pencairan.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 p-2">
        <SummaryFact
          label="Butuh aksi"
          value={String(needsActionCount)}
          tone={needsActionCount > 0 ? "warning" : "default"}
        />
        <SummaryFact
          label="Siap dicairkan"
          value={String(readyToPayCount)}
          tone={readyToPayCount > 0 ? "positive" : "default"}
        />
      </div>
    </SummarySurface>
  );
}
