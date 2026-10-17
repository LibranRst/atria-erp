"use client";

/* THESIS: inspect the source-ranked queue and its actual effects before deciding.
 * OWN-WORLD: Atria Operate; Manrope, cool canvas, white compact panels, native
 * HeroUI tables, ink capsules and restrained semantic terracotta.
 * STORY: scan queue/counts, filter a task, read source evidence/impact, then use
 * the existing approval/rejection owner with its required reasons and guards.
 * FIRST VIEWPORT: compact header, four-fact band, peer views, inline controls,
 * six-column table and independent 18rem detail from 1280px. Narrow desktop
 * progresses list/detail; a hidden aside never creates an active first row.
 * FORM: the user's precisely approved extension of the Dashboard/Expenses
 * workspace grammar; no open concept roll or replacement visual world applies.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
 */
import React from "react";
import {
  Button,
  DesktopTable,
  DesktopTablePagination,
  FilterSelect,
  GroupedSurface,
  MoneyValue,
  SearchInput,
  SegmentedTabs,
  StatusBadge,
  desktopTablePage,
  useListDetailFocus,
  type DesktopTableColumn,
} from "@/components/ui";
import type { ApprovalQueueSummary } from "@atria/core/finance/approval-summary";
import { approvalIsCritical } from "@atria/core/finance/approval-summary";
import { useWorkspaceViewportAtLeast } from "@/lib/navigation/workspace-viewport";
import {
  approvalPriorityLabel,
  approvalQueueDate,
  approvalTypeLabel,
  filterDesktopApprovals,
} from "../../utils/approval-desktop";
import { useApprovalDesktopQuery } from "../../hooks/use-approval-desktop-query";
import type { ApprovalDecision, ApprovalItem } from "./approval-list-presentation";
import { ApprovalDesktopDetail } from "./approval-desktop-detail";

function rowKey(item: ApprovalItem): string {
  return item.id;
}

function ApprovalAmount({
  amount,
  size = "sm",
}: {
  readonly amount: number;
  readonly size?: "sm" | "lg";
}): React.JSX.Element {
  return (
    <MoneyValue
      amount={amount}
      fractionDigits={Number.isInteger(amount) ? 0 : 2}
      variant="compact"
      size={size}
    />
  );
}

export function ApprovalDesktopWorkspace({
  approvals,
  summary,
  active,
  selected,
  onSelect,
  pending,
  canDecide,
  onDecision,
  onOpenReceipt,
  referenceDateIso,
  decisionReturnFocusRef,
}: {
  readonly approvals: readonly ApprovalItem[];
  readonly summary: ApprovalQueueSummary;
  readonly active: boolean;
  readonly selected: ApprovalItem | null;
  readonly onSelect: (item: ApprovalItem | null) => void;
  readonly pending: boolean;
  readonly canDecide: (item: ApprovalItem) => boolean;
  readonly onDecision: (item: ApprovalItem, status: ApprovalDecision["status"]) => void;
  readonly onOpenReceipt: (url: string) => void;
  readonly referenceDateIso: string;
  readonly decisionReturnFocusRef?: React.RefObject<HTMLElement | null>;
}): React.JSX.Element {
  const detailAsideVisible = useWorkspaceViewportAtLeast(1280);
  const { input, update } = useApprovalDesktopQuery(active && !pending);
  const { search: query, filter, project, priority } = input;
  const queueOrder = React.useMemo(
    () => new Map(approvals.map((item, index) => [item.id, index])),
    [approvals],
  );
  const projects = React.useMemo(
    () =>
      [...new Set(approvals.map((item) => item.projectName))].sort((a, b) =>
        a.localeCompare(b, "id-ID"),
      ),
    [approvals],
  );
  const columns = React.useMemo(
    (): readonly DesktopTableColumn<ApprovalItem>[] => [
      {
        key: "subject",
        widthPercent: 25,
        label: "Pengajuan",
        sortValue: (item) => item.description,
        render: (item) => (
          <div className="max-w-56">
            <p className="line-clamp-2 font-semibold">{item.description}</p>
            <p
              className="mt-1 truncate text-support text-on-surface-variant"
              title={item.projectName}
            >
              {item.projectName}
            </p>
          </div>
        ),
      },
      {
        key: "type",
        label: "Jenis",
        widthPercent: 14,
        sortValue: approvalTypeLabel,
        render: (item) => <span className="text-support">{approvalTypeLabel(item)}</span>,
      },
      {
        key: "requester",
        widthPercent: 13,
        label: "Pengaju / vendor",
        sortValue: (item) => item.requestedBy,
        render: (item) => (
          <span className="block truncate text-support" title={item.requestedBy}>
            {item.requestedBy}
          </span>
        ),
      },
      {
        key: "amount",
        widthPercent: 14,
        label: "Nominal",
        align: "end",
        sortValue: (item) => item.amount,
        render: (item) => <ApprovalAmount amount={item.amount} />,
      },
      {
        key: "date",
        widthPercent: 14,
        label: "Masuk antrean",
        sortValue: (item) => new Date(item.createdAt).getTime(),
        render: (item) => (
          <span className="text-support whitespace-nowrap tabular-nums">
            {approvalQueueDate(item.createdAt)}
          </span>
        ),
      },
      {
        key: "priority",
        widthPercent: 20,
        label: "Prioritas",
        sortValue: (item) => queueOrder.get(item.id) ?? 0,
        render: (item) => (
          <div className="space-y-1">
            <StatusBadge
              label={approvalPriorityLabel(item)}
              tone={
                approvalIsCritical(item)
                  ? "critical"
                  : item.priority === "WARNING"
                    ? "warning"
                    : "neutral"
              }
            />
            <p className="max-w-40 text-meta text-on-surface-variant">{item.priorityReason}</p>
          </div>
        ),
      },
    ],
    [queueOrder],
  );
  const filtered = React.useMemo(
    () => filterDesktopApprovals(approvals, { query, type: filter, project, priority }),
    [approvals, filter, priority, project, query],
  );
  const result = desktopTablePage(
    filtered,
    columns,
    rowKey,
    { column: input.sort, direction: input.direction },
    input.page,
    input.pageSize,
  );
  const table = {
    ...result,
    pageSize: input.pageSize,
    sortDescriptor: { column: input.sort, direction: input.direction },
    onSortChange: (sort: {
      readonly column: React.Key;
      readonly direction: "ascending" | "descending";
    }): void => {
      const column = columns.find((item) => item.key === sort.column)?.key;
      if (
        column === "subject" ||
        column === "type" ||
        column === "requester" ||
        column === "amount" ||
        column === "date" ||
        column === "priority"
      )
        update({ sort: column, direction: sort.direction });
    },
    onPageChange: (page: number): void => update({ page }),
    onPageSizeChange: (size: number): void =>
      update({ pageSize: size === 25 || size === 50 ? size : 10 }),
  };
  React.useEffect(() => {
    if (active && !pending && input.page !== result.page) update({ page: result.page });
  }, [active, input.page, pending, result.page, update]);
  const explicitSelection = table.rows.find((item) => item.id === selected?.id);
  const context = explicitSelection;
  const { listRef, detailRef } = useListDetailFocus({
    active,
    narrow: !detailAsideVisible,
    selectionKey: context?.id ?? null,
  });
  const hasFilters = Boolean(query.trim() || filter !== "ALL" || project || priority !== "ALL");
  const sourceTime = new Date(referenceDateIso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });

  return (
    <div className="min-w-0 space-y-4">
      <GroupedSurface variant="desktopPanel">
        <dl className="grid grid-cols-2 gap-y-4 p-4 min-[1200px]:grid-cols-4">
          <div className="min-w-0 pr-4">
            <dt className="text-support text-on-surface-variant">Menunggu keputusan</dt>
            <dd className="mt-1 text-title font-semibold tabular-nums">{summary.totalCount}</dd>
          </div>
          <div className="min-w-0 border-l border-outline-variant/30 px-4">
            <dt className="text-support text-on-surface-variant">Nilai antrean</dt>
            <dd className="mt-2">
              <ApprovalAmount amount={summary.totalAmount} size="lg" />
            </dd>
          </div>
          <div className="min-w-0 pr-4 min-[1200px]:border-l min-[1200px]:border-outline-variant/30 min-[1200px]:pl-4">
            <dt className="text-support text-on-surface-variant">Prioritas kritis</dt>
            <dd
              className={`mt-1 text-title font-semibold tabular-nums ${summary.criticalCount ? "text-error" : ""}`}
            >
              {summary.criticalCount}
            </dd>
          </div>
          <div className="min-w-0 border-l border-outline-variant/30 pl-4">
            <dt className="text-support text-on-surface-variant">Menunggu ≥3 hari</dt>
            <dd className="mt-1 text-title font-semibold tabular-nums">
              {summary.waitingLongCount}
            </dd>
          </div>
        </dl>
      </GroupedSurface>

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          value={filter}
          onChange={(filter) => update({ filter })}
          ariaLabel="Jenis antrean persetujuan"
          density="compact"
          scrollable
          options={[
            { value: "ALL", label: "Semua", count: approvals.length },
            {
              value: "FIELD",
              label: "Lapangan",
              count: approvals.filter((item) => item.type === "project_cost").length,
            },
            {
              value: "VENDOR",
              label: "Vendor",
              count: approvals.filter((item) => item.type === "vendor_payment").length,
            },
            {
              value: "STOCK",
              label: "Saldo awal",
              count: approvals.filter((item) => item.type === "inventory_opening").length,
            },
            { value: "CRITICAL", label: "Risiko", count: summary.criticalCount },
          ]}
        />
        <p className="text-support text-on-surface-variant">Diperbarui {sourceTime}</p>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <SearchInput
          ariaLabel="Cari antrean persetujuan"
          placeholder="Cari pengajuan, proyek, atau pengaju…"
          value={query}
          onChange={(search) => update({ search })}
          showClear={false}
          className="min-w-56 flex-1"
        />
        <FilterSelect
          label="Proyek persetujuan"
          value={project}
          onChange={(project) => update({ project })}
          presentation="menu"
          searchable={projects.length > 8}
          options={[
            { value: "", label: "Semua proyek" },
            ...projects.map((name) => ({ value: name, label: name })),
          ]}
        />
        <FilterSelect
          label="Prioritas persetujuan"
          value={priority}
          onChange={(value) => {
            if (
              value === "ALL" ||
              value === "CRITICAL" ||
              value === "WARNING" ||
              value === "NORMAL"
            )
              update({ priority: value });
          }}
          presentation="menu"
          options={[
            { value: "ALL", label: "Semua prioritas" },
            { value: "CRITICAL", label: "Kritis" },
            { value: "WARNING", label: "Perlu perhatian" },
            { value: "NORMAL", label: "Normal" },
          ]}
        />
        {hasFilters ? (
          <Button
            size="mini"
            variant="secondary"
            onClick={() => {
              update({ search: "", filter: "ALL", project: "", priority: "ALL" });
            }}
          >
            Reset filter
          </Button>
        ) : null}
      </div>
      <div
        className={`grid min-w-0 items-start gap-4 ${context ? "xl:grid-cols-[minmax(0,1fr)_18rem]" : ""}`}
      >
        <div ref={listRef} className={`min-w-0 ${explicitSelection ? "hidden xl:block" : ""}`}>
          <DesktopTable
            ariaLabel="Antrean persetujuan"
            layout="fixed"
            columns={columns}
            rows={table.rows}
            rowKey={rowKey}
            selectedRowKey={detailAsideVisible ? (context?.id ?? null) : null}
            onRowSelectionChange={(item) => {
              if (!pending) onSelect(item);
            }}
            sortDescriptor={table.sortDescriptor}
            onSortChange={table.onSortChange}
            emptyTitle={approvals.length ? "Tidak ada pengajuan yang sesuai" : "Antrean kosong"}
            emptyDescription={
              approvals.length
                ? "Sesuaikan pencarian atau filter untuk melihat pengajuan."
                : "Tidak ada pengajuan yang tersedia untuk ditinjau saat ini."
            }
            footer={<DesktopTablePagination {...table} ariaLabel="Halaman antrean persetujuan" />}
          />
        </div>
        {context ? (
          <div ref={detailRef} className={`min-w-0 ${explicitSelection ? "" : "hidden xl:block"}`}>
            <ApprovalDesktopDetail
              decisionReturnFocusRef={decisionReturnFocusRef}
              item={context}
              pending={pending}
              canDecide={canDecide(context)}
              onBack={() => {
                if (!pending) onSelect(null);
              }}
              onOpenReceipt={onOpenReceipt}
              onDecision={onDecision}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
