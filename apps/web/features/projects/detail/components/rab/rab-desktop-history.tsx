"use client";

import React from "react";
import {
  Button,
  DesktopTable,
  DesktopTablePagination,
  desktopTablePage,
  StatusBadge,
  type DesktopTableColumn,
} from "@/components/ui";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import type { ChangeOrderHistoryView, RabRevisionHistoryView } from "../../types/rap-rab-types";
import { RabDesktopAmount } from "./rab-desktop-panel";
import { useRabDesktopQuery } from "./use-rab-desktop-query";

export function RabDesktopHistory({
  revisionHistory,
  changeOrders,
  onRevision,
  onOrder,
  onApproveOrder,
  canApprove,
  pendingId,
}: {
  readonly revisionHistory: readonly RabRevisionHistoryView[];
  readonly changeOrders: readonly ChangeOrderHistoryView[];
  readonly onRevision: (id: string) => void;
  readonly onOrder: (id: string) => void;
  readonly onApproveOrder: (id: string) => void;
  readonly canApprove: boolean;
  readonly pendingId: string | null;
}): React.JSX.Element {
  const historyQuery = useRabDesktopQuery("rab-history");
  const orderQuery = useRabDesktopQuery("rab-orders");
  const historyColumns: readonly DesktopTableColumn<RabRevisionHistoryView>[] = [
    {
      key: "revision",
      label: "Revisi",
      widthPercent: 13,
      sortValue: (row) => row.revision,
      render: (row) => <span className="font-semibold">R{row.revision}</span>,
    },
    {
      key: "status",
      label: "Status",
      widthPercent: 22,
      sortValue: (row) => formatBusinessLabel(row.status),
      render: (row) => (
        <StatusBadge
          label={formatBusinessLabel(row.status)}
          tone={row.status === "APPROVED" ? "healthy" : "neutral"}
        />
      ),
    },
    {
      key: "value",
      label: "Nilai RAB",
      widthPercent: 20,
      align: "end",
      sortValue: (row) => row.value,
      render: (row) => <RabDesktopAmount amount={row.value} />,
    },
    {
      key: "context",
      label: "Keterangan",
      widthPercent: 45,
      render: (row) => (
        <p className="text-support wrap-anywhere text-on-surface-variant">
          {row.voidReason ||
            (row.status === "APPROVED"
              ? "Baseline disetujui; rincian dan jejak perubahan tersimpan."
              : row.status === "DRAFT"
                ? "Draf belum menjadi baseline kontrak."
                : "Revisi tidak lagi berlaku.")}
        </p>
      ),
    },
  ];
  const orderColumns: readonly DesktopTableColumn<ChangeOrderHistoryView>[] = [
    {
      key: "revision",
      label: "Change Order",
      widthPercent: 27,
      sortValue: (row) => row.revisedRevision,
      render: (row) => (
        <div className="space-y-1">
          <p className="font-semibold">
            R{row.baseRevision} → R{row.revisedRevision}
          </p>
          <p className="line-clamp-2 text-meta wrap-anywhere text-on-surface-variant">
            {row.scopeSummary}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      widthPercent: 22,
      sortValue: (row) => formatBusinessLabel(row.status),
      render: (row) => (
        <StatusBadge
          label={formatBusinessLabel(row.status)}
          tone={row.status === "PENDING_APPROVAL" ? "pending" : "neutral"}
        />
      ),
    },
    {
      key: "delta",
      label: "Selisih kontrak",
      widthPercent: 19,
      align: "end",
      sortValue: (row) => Number(row.valueDelta),
      render: (row) => <RabDesktopAmount amount={Number(row.valueDelta)} />,
    },
    {
      key: "author",
      label: "Diajukan oleh",
      widthPercent: 18,
      sortValue: (row) => row.createdByName,
      render: (row) => <p className="text-support wrap-anywhere">{row.createdByName}</p>,
    },
    {
      key: "action",
      label: "Keputusan",
      widthPercent: 14,
      render: (row) =>
        row.status === "PENDING_APPROVAL" && canApprove ? (
          <Button
            variant="secondary"
            size="mini"
            pending={pendingId === row.id}
            disabled={pendingId !== null}
            onClick={() => onApproveOrder(row.id)}
          >
            Setujui
          </Button>
        ) : (
          <Button variant="ghost" size="mini" onClick={() => onOrder(row.id)}>
            Rincian
          </Button>
        ),
    },
  ];
  const historySort = {
    column: historyColumns.some((column) => column.key === historyQuery.input.sort)
      ? historyQuery.input.sort
      : "order",
    direction: historyQuery.input.direction,
  };
  const orderSort = {
    column: orderColumns.some((column) => column.key === orderQuery.input.sort)
      ? orderQuery.input.sort
      : "order",
    direction: orderQuery.input.direction,
  };
  const history = desktopTablePage(
    revisionHistory,
    historyColumns,
    (row) => row.id,
    historySort,
    historyQuery.input.page,
    historyQuery.input.pageSize,
  );
  const orders = desktopTablePage(
    changeOrders,
    orderColumns,
    (row) => row.id,
    orderSort,
    orderQuery.input.page,
    orderQuery.input.pageSize,
  );
  return (
    <div className="min-w-0 space-y-4">
      <section className="min-w-0 space-y-3" aria-label="Riwayat revisi RAB">
        <div className="px-1">
          <h2 className="text-base font-semibold">Riwayat revisi</h2>
          <p className="mt-1 text-support text-on-surface-variant">
            Pilih revisi untuk membaca rincian dan jejak audit.
          </p>
        </div>
        <DesktopTable
          ariaLabel="Riwayat revisi RAB"
          rows={history.rows}
          columns={historyColumns}
          rowKey={(row) => row.id}
          layout="fixed"
          onRowAction={(row) => onRevision(row.id)}
          emptyTitle="Belum ada riwayat revisi"
          sortDescriptor={historySort}
          onSortChange={(next) =>
            historyQuery.update({ sort: String(next.column), direction: next.direction })
          }
          footer={
            <DesktopTablePagination
              total={history.total}
              page={history.page}
              pageSize={historyQuery.input.pageSize}
              onPageChange={(page) => historyQuery.update({ page })}
              onPageSizeChange={(pageSize) =>
                historyQuery.update({
                  pageSize: pageSize === 25 || pageSize === 50 ? pageSize : 10,
                })
              }
              ariaLabel="Halaman riwayat revisi RAB"
            />
          }
        />
      </section>
      <section className="min-w-0 space-y-3" aria-label="Change Order RAB">
        <h2 className="px-1 text-base font-semibold">Change Order</h2>
        <DesktopTable
          ariaLabel="Change Order RAB"
          rows={orders.rows}
          columns={orderColumns}
          rowKey={(row) => row.id}
          layout="fixed"
          onRowAction={(row) => onOrder(row.id)}
          emptyTitle="Belum ada Change Order"
          emptyDescription="Perubahan baseline yang diajukan akan tersimpan di sini."
          sortDescriptor={orderSort}
          onSortChange={(next) =>
            orderQuery.update({ sort: String(next.column), direction: next.direction })
          }
          footer={
            <DesktopTablePagination
              total={orders.total}
              page={orders.page}
              pageSize={orderQuery.input.pageSize}
              onPageChange={(page) => orderQuery.update({ page })}
              onPageSizeChange={(pageSize) =>
                orderQuery.update({ pageSize: pageSize === 25 || pageSize === 50 ? pageSize : 10 })
              }
              ariaLabel="Halaman Change Order RAB"
            />
          }
        />
      </section>
    </div>
  );
}
