"use client";

import React from "react";
import { motion } from "framer-motion";

import type {
  ExpenseFormProject,
  ExpenseLine,
  InventoryLocationOption,
} from "./expense-form-types";
import { ExpenseLineEditor } from "./expense-line-editor";
import { isExpenseLineComplete } from "./expense-form-utils";
import { transitionSpringSnappy } from "@/lib/utils/motion";

type BudgetCategory = NonNullable<
  NonNullable<ExpenseFormProject["canonicalBudgets"]>[number]["categories"]
>[number];

export function ExpenseFormNotice({
  tone,
  icon,
  children,
  onDismiss,
}: {
  readonly tone: "error" | "success" | "warning";
  readonly icon: string;
  readonly children: React.ReactNode;
  readonly onDismiss?: () => void;
}): React.JSX.Element {
  const toneClass = {
    error: "bg-error-container/20 text-error ring-error/20",
    success: "bg-primary/8 text-primary ring-primary/20",
    warning: "bg-warning/10 text-warning ring-warning/20",
  }[tone];

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-xs font-medium ring-1 ${toneClass}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1 leading-5">{children}</div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          aria-label="Tutup pemberitahuan"
        >
          <span className="material-symbols-outlined text-[17px]">close</span>
        </button>
      ) : null}
    </div>
  );
}

export function ExpenseItemsSection({
  disabled,
  selectedProjectId,
  lines,
  budgetCategories,
  materialOptions,
  rapItems,
  categoryPlanItems,
  defaultInventoryLocationId,
  inventoryLocations,
  onAdd,
  onDuplicate,
  onRemove,
  onMove,
  onRestore,
  onUpdate,
}: {
  readonly disabled: boolean;
  readonly selectedProjectId: string;
  readonly lines: ExpenseLine[];
  readonly budgetCategories: BudgetCategory[];
  readonly materialOptions: NonNullable<ExpenseFormProject["materialOptions"]>;
  readonly rapItems: NonNullable<ExpenseFormProject["rapItems"]>;
  readonly categoryPlanItems: NonNullable<ExpenseFormProject["categoryPlanItems"]>;
  readonly defaultInventoryLocationId: string;
  readonly inventoryLocations: InventoryLocationOption[];
  readonly onAdd: () => void;
  readonly onDuplicate: (key: string) => void;
  readonly onRemove: (key: string) => void;
  readonly onMove: (key: string, direction: -1 | 1) => void;
  readonly onRestore: (line: ExpenseLine, index: number) => void;
  readonly onUpdate: (line: ExpenseLine) => void;
}): React.JSX.Element {
  const [editingKey, setEditingKey] = React.useState<string | null>(null);
  const [removed, setRemoved] = React.useState<{
    readonly line: ExpenseLine;
    readonly index: number;
  } | null>(null);
  const removalTimer = React.useRef<number | null>(null);
  const editingLine = lines.find((line) => line.key === editingKey) ?? null;

  React.useEffect(
    () => () => {
      if (removalTimer.current) window.clearTimeout(removalTimer.current);
    },
    [],
  );

  function removeWithUndo(line: ExpenseLine, index: number): void {
    onRemove(line.key);
    setRemoved({ line, index });
    if (removalTimer.current) window.clearTimeout(removalTimer.current);
    removalTimer.current = window.setTimeout(() => setRemoved(null), 5_000);
  }

  function undoRemove(): void {
    if (!removed) return;
    onRestore(removed.line, removed.index);
    setRemoved(null);
    if (removalTimer.current) window.clearTimeout(removalTimer.current);
  }

  return (
    <div className="space-y-2.5">
      <div className="space-y-2">
        {lines.map((line, index) => {
          const category = budgetCategories.find(
            (item) => item.id === line.projectBudgetCategoryId,
          );
          const complete = isExpenseLineComplete(line, category?.code);
          const quantity = Number(line.quantity) || 0;
          const unitPrice = Number(line.unitPrice) || 0;
          return (
            <motion.div
              layout
              key={line.key}
              transition={transitionSpringSnappy}
              className="overflow-hidden rounded-3xl bg-surface-container-lowest p-2 shadow-[0_10px_28px_rgba(17,17,17,0.035)] ring-1 ring-outline-variant/15"
            >
              <button
                type="button"
                data-expense-incomplete={complete ? undefined : "true"}
                onClick={() => setEditingKey(line.key)}
                disabled={disabled}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50"
              >
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${complete ? "bg-primary" : "bg-warning"}`}
                  aria-label={complete ? "Item lengkap" : "Item belum lengkap"}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-xs font-bold text-on-surface">
                      {line.description.trim() || `Item ${index + 1}`}
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold text-on-surface-variant">
                      {category?.name ?? "Pilih kategori"}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-on-surface-variant">
                    {quantity || "–"} × Rp {unitPrice.toLocaleString("id-ID")} ·{" "}
                    {complete ? "Lengkap" : "Perlu diperiksa"}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-xs font-bold text-on-surface tabular-nums">
                    Rp {(Number(line.amount) || 0).toLocaleString("id-ID")}
                  </span>
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                    chevron_right
                  </span>
                </span>
              </button>
              <div className="flex items-center justify-end gap-1 px-1">
                <RowAction
                  label="Naikkan item"
                  icon="arrow_upward"
                  disabled={disabled || index === 0}
                  onClick={() => onMove(line.key, -1)}
                />
                <RowAction
                  label="Turunkan item"
                  icon="arrow_downward"
                  disabled={disabled || index === lines.length - 1}
                  onClick={() => onMove(line.key, 1)}
                />
                <RowAction
                  label="Duplikat item"
                  icon="content_copy"
                  disabled={disabled}
                  onClick={() => onDuplicate(line.key)}
                />
                <RowAction
                  label="Hapus item"
                  icon="delete"
                  danger
                  disabled={disabled || lines.length === 1}
                  onClick={() => removeWithUndo(line, index)}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {removed ? (
        <div className="flex min-h-12 items-center justify-between rounded-full bg-on-surface px-4 text-xs text-surface">
          <span>Item dihapus</span>
          <button
            type="button"
            onClick={undoRemove}
            className="min-h-10 rounded-full px-3 font-bold text-primary-container"
          >
            Urungkan
          </button>
        </div>
      ) : null}

      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        transition={transitionSpringSnappy}
        onClick={onAdd}
        disabled={!selectedProjectId || disabled}
        className="min-h-12 w-full rounded-full bg-surface-container px-5 text-sm font-bold text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-45"
      >
        Tambahkan Item
      </motion.button>

      {editingLine ? (
        <ExpenseLineEditor
          open
          line={editingLine}
          index={lines.findIndex((line) => line.key === editingLine.key)}
          budgetCategories={budgetCategories}
          materialOptions={materialOptions}
          rapItems={rapItems}
          categoryPlanItems={categoryPlanItems}
          defaultInventoryLocationId={defaultInventoryLocationId}
          inventoryLocations={inventoryLocations}
          onClose={() => setEditingKey(null)}
          onSave={(line) => {
            onUpdate(line);
            setEditingKey(null);
          }}
        />
      ) : null}
    </div>
  );
}

function RowAction({
  label,
  icon,
  danger = false,
  disabled,
  onClick,
}: {
  readonly label: string;
  readonly icon: string;
  readonly danger?: boolean;
  readonly disabled: boolean;
  readonly onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-12 w-12 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-25 ${danger ? "text-error" : "text-on-surface-variant"}`}
      aria-label={label}
      title={label}
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
    </button>
  );
}
