"use client";

import React from "react";
import { motion } from "framer-motion";

import type {
  ExpenseFormProject,
  ExpenseLine,
  InventoryLocationOption,
} from "@/features/expenses/types/expense-form-types";
import { ExpenseLineEditor } from "./expense-line-editor";
import { isExpenseLineComplete } from "@/features/expenses/utils/expense-form-utils";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { AppIcon } from "@/components/ui";
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
      <AppIcon name={icon} className="icon-md" />
      <div className="min-w-0 flex-1 leading-5">{children}</div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          aria-label="Tutup pemberitahuan"
        >
          <AppIcon name="close" className="text-[17px]" />
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

  const insertIndex = removed ? Math.min(removed.index, lines.length) : -1;

  const renderRemovedBanner = (): React.JSX.Element | null => {
    if (!removed) return null;
    return (
      <motion.div
        layout
        key="removed-item-banner"
        transition={transitionSpringSnappy}
        className="m-2 flex items-center justify-between gap-3 divide-y-0 rounded-3xl bg-surface-container-low/50 p-3"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-on-surface-variant/10 text-on-surface-variant">
            <AppIcon name="delete" className="text-[15px]" />
          </span>
          <span className="truncate text-xs font-medium text-on-surface-variant">
            <strong className="font-semibold text-on-surface">
              {removed.line.description.trim() || `Item #${removed.index + 1}`}
            </strong>{" "}
            dihapus
          </span>
        </div>
        <button
          type="button"
          onClick={undoRemove}
          className="flex min-h-4 shrink-0 items-center justify-center px-1.5 text-xs font-bold text-primary"
        >
          Urungkan
        </button>
      </motion.div>
    );
  };

  return (
    <div className="space-y-2.5">
      <div className="divide-y divide-outline-variant/15 overflow-hidden rounded-3xl bg-surface-container-lowest shadow-surface ring-1 ring-ring-subtle">
        {lines.map((line, index) => {
          const category = budgetCategories.find(
            (item) => item.id === line.projectBudgetCategoryId,
          );
          const complete = isExpenseLineComplete(line, category?.code);
          const quantity = Number(line.quantity) || 0;
          const unitPrice = Number(line.unitPrice) || 0;
          const isInsertHere = removed && index === insertIndex;

          return (
            <React.Fragment key={line.key}>
              {isInsertHere ? renderRemovedBanner() : null}
              <motion.div layout transition={transitionSpringSnappy} className="p-2.5">
                <button
                  type="button"
                  data-expense-incomplete={complete ? undefined : "true"}
                  onClick={() => setEditingKey(line.key)}
                  disabled={disabled}
                  className="flex w-full min-w-0 items-start gap-3 rounded-2xl p-1 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-surface-container-low disabled:opacity-50"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      complete ? "bg-primary/10 text-primary" : "bg-warning/15 text-warning"
                    }`}
                    aria-label={complete ? "Item lengkap" : "Item belum lengkap"}
                  >
                    <AppIcon
                      name={complete ? "check_circle" : "info"}
                      className="icon-md leading-none"
                    />
                  </span>

                  <span className="grid min-w-0 flex-1 gap-1">
                    <span className="line-clamp-2 text-xs leading-snug font-bold wrap-break-word text-on-surface">
                      {line.description.trim() || `Item ${index + 1}`}
                    </span>

                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="shrink-0 rounded-full bg-surface-container-low px-2 py-0.5 text-eyebrow font-semibold text-on-surface-variant/80">
                        Item #{index + 1}
                      </span>
                      {category ? (
                        <span className="shrink-0 rounded-full bg-surface-container-low px-2 py-0.5 text-eyebrow font-bold text-on-surface-variant">
                          {category.name}
                        </span>
                      ) : null}
                      <span className="truncate text-[10px] leading-tight text-on-surface-variant tabular-nums">
                        {quantity || "–"} × Rp {unitPrice.toLocaleString("id-ID")}
                        {complete ? "" : " · Perlu diperiksa"}
                      </span>
                    </span>
                  </span>

                  <AppIcon
                    name="chevron_right"
                    className="mt-0.5 icon-md shrink-0 text-on-surface-variant/60"
                  />
                </button>

                <div className="mt-2 flex items-center justify-between rounded-2xl bg-surface-container-low py-1 pr-1 pl-3">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="text-meta font-medium text-on-surface-variant/70">Total:</span>
                    <span className="truncate text-xs font-bold text-on-surface tabular-nums">
                      Rp {(Number(line.amount) || 0).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 rounded-3xl bg-surface-container-lowest ring-1 ring-ring-subtle">
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
                </div>
              </motion.div>
            </React.Fragment>
          );
        })}
        {removed && insertIndex === lines.length ? renderRemovedBanner() : null}
      </div>

      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        transition={transitionSpringSnappy}
        onClick={onAdd}
        disabled={!selectedProjectId || disabled}
        className="min-h-12 w-full rounded-full bg-surface-container px-5 text-sm font-bold text-primary outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-45"
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
      className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-surface-container-low disabled:opacity-25 ${
        danger
          ? "text-error hover:bg-error-container/20"
          : "text-on-surface-variant hover:bg-surface-container-low/50"
      }`}
      aria-label={label}
      title={label}
    >
      <AppIcon name={icon} className="icon-sm" />
    </button>
  );
}
