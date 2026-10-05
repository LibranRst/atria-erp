"use client";

import React from "react";
import { Table, type SortDescriptor, type Selection } from "@heroui/react";
import { cx } from "../form/form-control-utils";
import { AppIcon } from "../icon/app-icon";

export type DesktopTableColumn<Row extends object> = {
  readonly key: string;
  readonly label: string;
  readonly render: (row: Row) => React.ReactNode;
  readonly align?: "start" | "end";
  readonly sortable?: boolean;
  readonly sortValue?: (row: Row) => string | number;
};

export type DesktopTableProps<Row extends object> = {
  readonly ariaLabel: string;
  readonly columns: readonly DesktopTableColumn<Row>[];
  readonly rows: readonly Row[];
  readonly rowKey: (row: Row) => string;
  readonly rowHref?: (row: Row) => string;
  readonly onRowAction?: (row: Row) => void;
  readonly selectedRowKey?: string;
  readonly emptyTitle?: string;
  readonly emptyDescription?: string;
  readonly footer?: React.ReactNode;
  readonly className?: string;
  readonly sortDescriptor?: SortDescriptor;
  readonly onSortChange?: (descriptor: SortDescriptor) => void;
};

/** Real table semantics and keyboard row actions are owned by HeroUI/React Aria. */
export function DesktopTable<Row extends object>({
  ariaLabel,
  columns,
  rows,
  rowKey,
  rowHref,
  onRowAction,
  selectedRowKey,
  emptyTitle = "Belum ada data",
  emptyDescription,
  footer,
  className,
  sortDescriptor,
  onSortChange,
}: DesktopTableProps<Row>): React.JSX.Element {
  const [internalSort, setInternalSort] = React.useState<SortDescriptor>();
  const effectiveSort = sortDescriptor ?? internalSort;
  const sortedRows = React.useMemo((): readonly Row[] => {
    const column = columns.find((item) => item.key === effectiveSort?.column);
    if (!column?.sortValue || !effectiveSort) return rows;
    const getValue = column.sortValue;
    const collator = new Intl.Collator("id-ID", { numeric: true, sensitivity: "base" });
    return [...rows].sort((left: Row, right: Row): number => {
      const a = getValue(left),
        b = getValue(right);
      const compared =
        typeof a === "number" && typeof b === "number"
          ? a - b
          : collator.compare(String(a), String(b));
      return effectiveSort.direction === "descending" ? -compared : compared;
    });
  }, [columns, effectiveSort, rows]);
  const selectRow = (keys: Selection): void => {
    if (keys === "all") return;
    const key = keys.values().next().value;
    const row = rows.find((item: Row): boolean => rowKey(item) === String(key));
    if (row) onRowAction?.(row);
  };
  const onAction = React.useCallback(
    (key: React.Key): void => {
      const row = rows.find((item: Row): boolean => rowKey(item) === String(key));
      if (row) onRowAction?.(row);
    },
    [rows, rowKey, onRowAction],
  );

  return (
    <Table variant="primary" className={cx("atria-desktop-table min-w-0", className)}>
      <Table.ScrollContainer>
        <Table.Content
          aria-label={ariaLabel}
          selectionMode={onRowAction && selectedRowKey !== undefined ? "single" : "none"}
          selectionBehavior="replace"
          disallowEmptySelection={Boolean(onRowAction && selectedRowKey !== undefined)}
          selectedKeys={selectedRowKey === undefined ? undefined : new Set([selectedRowKey])}
          onSelectionChange={selectRow}
          onRowAction={onRowAction ? onAction : undefined}
          sortDescriptor={effectiveSort}
          onSortChange={(next: SortDescriptor): void => {
            if (onSortChange) onSortChange(next);
            else setInternalSort(next);
          }}
        >
          <Table.Header columns={columns}>
            {(column: DesktopTableColumn<Row>): React.JSX.Element => (
              <Table.Column
                id={column.key}
                textValue={column.label}
                isRowHeader={column.key === columns[0]?.key}
                allowsSorting={Boolean(column.sortValue || (column.sortable && onSortChange))}
                className={column.align === "end" ? "text-end" : "text-start"}
              >
                {({
                  sortDirection,
                }: {
                  readonly sortDirection?: "ascending" | "descending";
                }): React.JSX.Element =>
                  column.sortValue || (column.sortable && onSortChange) ? (
                    <Table.SortableColumnHeader
                      sortDirection={sortDirection}
                      indicator={<AppIcon name="expand_more" aria-hidden="true" />}
                    >
                      {column.label}
                    </Table.SortableColumnHeader>
                  ) : (
                    <span>{column.label}</span>
                  )
                }
              </Table.Column>
            )}
          </Table.Header>
          <Table.Body
            items={sortedRows}
            dependencies={[selectedRowKey]}
            renderEmptyState={(): React.JSX.Element => (
              <div className="space-y-1 px-5 py-10 text-center">
                <p className="text-sm font-semibold text-on-surface">{emptyTitle}</p>
                {emptyDescription ? <p className="text-xs text-muted">{emptyDescription}</p> : null}
              </div>
            )}
          >
            {(row: Row): React.JSX.Element => (
              <Table.Row
                id={rowKey(row)}
                href={rowHref?.(row)}
                columns={columns}
                data-atria-selected={rowKey(row) === selectedRowKey ? "true" : undefined}
                className={onRowAction || rowHref ? "cursor-pointer" : undefined}
              >
                {(column: DesktopTableColumn<Row>): React.JSX.Element => (
                  <Table.Cell
                    className={column.align === "end" ? "text-end tabular-nums" : "text-start"}
                  >
                    {column.key === columns[0]?.key && rowKey(row) === selectedRowKey ? (
                      <span className="sr-only" aria-current="true">
                        Ditampilkan dalam rincian.{" "}
                      </span>
                    ) : null}
                    {column.render(row)}
                  </Table.Cell>
                )}
              </Table.Row>
            )}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
      {footer ? <Table.Footer>{footer}</Table.Footer> : null}
    </Table>
  );
}
