"use client";
import * as React from "react";
import {
  Button,
  ChoiceRow,
  ReviewCollection,
  ReviewItem,
  MoneyValue,
  StatusBadge,
} from "@/components/ui";
import type { MaterialCandidate } from "@atria/core/ai/material-import";

export function MaterialReviewList({
  rows,
  desktop,
  editable,
  pending,
  onEdit,
  activeRowId,
  editorRowId,
  editorContent,
  selectionBlocked = false,
  editingBlocked = false,
  onSelect,
  page,
  pageSize,
  rowCount,
  onPage,
}: {
  readonly rows: readonly MaterialCandidate[];
  readonly desktop: boolean;
  readonly editable: boolean;
  readonly pending: boolean;
  readonly editorRowId?: string | null;
  readonly activeRowId?: string | null;
  readonly editorContent?: React.ReactNode;
  readonly selectionBlocked?: boolean;
  readonly editingBlocked?: boolean;
  readonly onEdit: (row: MaterialCandidate) => void;
  readonly onSelect: (id: string, checked: boolean) => void;
  readonly page: number;
  readonly pageSize: number;
  readonly rowCount: number;
  readonly onPage: (anchor: number) => void;
}): React.JSX.Element {
  function label(row: MaterialCandidate): string {
    return row.materialId
      ? "Tersimpan"
      : !editable
        ? "Tidak disimpan"
        : row.issues.length
          ? "Perlu diperiksa"
          : "Siap";
  }
  function selection(row: MaterialCandidate): React.JSX.Element {
    return (
      <ChoiceRow
        compact
        presentation="review"
        indicatorShape={desktop ? "square" : "circle"}
        title={`Pilih ${row.fields.name || "material"}`}
        checked={row.selected && !row.issues.length}
        disabled={
          pending ||
          selectionBlocked ||
          Boolean(row.issues.length) ||
          Boolean(row.materialId) ||
          !editable
        }
        onChange={(checked) => onSelect(row.id, checked)}
      />
    );
  }
  return (
    <div className="space-y-3">
      <ReviewCollection ariaLabel="Review material dari asisten">
        {rows.map((row) => (
          <ReviewItem
            key={row.id}
            title={row.fields.name || "Nama belum diisi"}
            meta={`${row.fields.categoryName || "Kategori belum diisi"} · ${row.fields.unit || "Satuan belum diisi"}`}
            primaryValue={
              <div className="space-y-1">
                <p className="text-meta text-on-surface-variant">Harga acuan</p>
                <MoneyValue
                  amount={row.fields.lastPurchasePrice}
                  variant="fullDynamic"
                  size="sm"
                  align="right"
                />
              </div>
            }
            selection={editable && !row.materialId ? selection(row) : undefined}
            expanded={activeRowId === row.id}
            editable
            disabled={pending || editingBlocked}
            onToggle={editable && !row.materialId ? () => onEdit(row) : undefined}
            summary={
              <div className="space-y-1">
                <StatusBadge
                  label={label(row)}
                  tone={row.materialId ? "completed" : row.issues.length ? "pending" : "neutral"}
                />
                {row.issues.length ? <p className="text-meta">{row.issues.join(" ")}</p> : null}
              </div>
            }
            editor={editorRowId === row.id ? editorContent : undefined}
          />
        ))}
      </ReviewCollection>
      {rowCount > pageSize && (
        <nav aria-label="Halaman material" className="flex items-center justify-between gap-2">
          <Button
            variant="secondary"
            size="compact"
            disabled={page === 0 || pending}
            onClick={() => onPage((page - 1) * pageSize)}
          >
            Sebelumnya
          </Button>
          <span className="text-meta tabular-nums">
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, rowCount)} dari {rowCount}
          </span>
          <Button
            variant="secondary"
            size="compact"
            disabled={(page + 1) * pageSize >= rowCount || pending}
            onClick={() => onPage((page + 1) * pageSize)}
          >
            Berikutnya
          </Button>
        </nav>
      )}
    </div>
  );
}
