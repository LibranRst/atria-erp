"use client";

import React from "react";

import type { MaterialMovementView } from "@/app/actions/material/operations-dashboard";
import { MoneyValue, NativeSection } from "@/components/ui/page-primitives";
import {
  formatMaterialDate,
  formatMaterialQuantity,
  formatMovementType,
} from "@/features/materials/lib/material-ui-utils";

export function Mini({
  label,
  value,
  amount,
}: {
  readonly label: string;
  readonly value?: string;
  readonly amount?: number;
}): React.JSX.Element {
  return (
    <div className="min-w-0 rounded-2xl bg-surface-container-low p-3">
      <p className="truncate text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">
        {label}
      </p>
      {typeof amount === "number" ? (
        <MoneyValue
          amount={amount}
          variant="compactWithFull"
          size="sm"
          className="mt-1"
        />
      ) : (
        <p className="mt-1 break-words font-mono text-[12px] font-bold leading-4 tabular-nums [overflow-wrap:anywhere]">
          {value}
        </p>
      )}
    </div>
  );
}

export function Section({
  title,
  children,
  contentClassName = "space-y-2",
}: {
  readonly title: string;
  readonly children: React.ReactNode;
  readonly contentClassName?: string;
}): React.JSX.Element {
  return (
    <NativeSection eyebrow={title} contentClassName={contentClassName}>
      {children}
    </NativeSection>
  );
}

export function MovementRow({
  row,
}: {
  readonly row: MaterialMovementView;
}): React.JSX.Element {
  return (
    <div className="flex min-h-[56px] items-center gap-3 py-2.5">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${movementIconTone(row)}`}
      >
        <span className="material-symbols-outlined text-[16px]">
          {movementIcon(row)}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold">
          {row.materialName}
        </span>
        <span className="block truncate text-[9px] text-on-surface-variant">
          {formatMovementType(row.movementType)} · {row.locationName}
          {row.projectName ? ` · ${row.projectName}` : ""}
        </span>
        <span className="mt-0.5 block truncate text-[9px] text-on-surface-variant/70">
          {formatMaterialDate(row.createdAt)} · {row.createdByName}
        </span>
      </span>
      <span
        className={`shrink-0 text-right font-mono text-[10px] font-extrabold tabular-nums ${row.movementDirection === "OUT" ? "text-error" : row.movementDirection === "IN" ? "text-primary" : "text-on-surface"}`}
      >
        {row.movementDirection === "OUT" ? "−" : row.movementDirection === "IN" ? "+" : ""}
        {formatMaterialQuantity(row.quantity)} {row.unit}
      </span>
    </div>
  );
}

function movementIcon(row: MaterialMovementView): string {
  if (row.movementType.includes("TRANSFER")) return "swap_horiz";
  if (row.movementType === "RESERVE") return "inventory";
  if (row.movementType === "USE") return "outbox";
  if (row.movementType === "RETURN") return "assignment_return";
  if (row.movementType === "WASTE") return "delete_sweep";
  if (row.movementType.includes("RECEIPT") || row.movementType === "STOCK_IN") {
    return "south_west";
  }
  if (row.movementDirection === "OUT") return "north_east";
  if (row.movementDirection === "IN") return "south_west";
  return "sync_alt";
}

function movementIconTone(row: MaterialMovementView): string {
  if (row.movementType === "RESERVE") return "bg-warning-light text-warning";
  if (row.movementType === "WASTE") return "bg-error-container/25 text-error";
  if (row.movementDirection === "OUT") return "bg-error/10 text-error";
  if (row.movementDirection === "IN") return "bg-primary/10 text-primary";
  return "bg-surface-container text-on-surface-variant";
}

export function ApprovalRow({
  title,
  description,
  amount,
  onApprove,
  onReject,
}: {
  readonly title: string;
  readonly description: string;
  readonly amount?: number;
  readonly onApprove: () => void;
  readonly onReject: () => void;
}): React.JSX.Element {
  return (
    <div className="rounded-[24px] bg-white p-3 shadow-[0_8px_20px_rgba(17,17,17,0.035)] ring-1 ring-warning/15">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning-light text-warning">
          <span className="material-symbols-outlined text-[18px]">priority_high</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold">{title}</span>
          <span className="mt-1 block text-[10px] leading-4 text-on-surface-variant">
            {description}
          </span>
          {typeof amount === "number" && (
            <MoneyValue
              amount={amount}
              variant="compactWithFull"
              size="sm"
              className="mt-1"
            />
          )}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onReject}
          className="min-h-11 rounded-full bg-error-container/20 text-[10px] font-bold text-error transition active:scale-[0.97]"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={onApprove}
          className="min-h-11 rounded-full bg-primary text-[10px] font-bold text-on-primary transition active:scale-[0.97]"
        >
          Approve
        </button>
      </div>
    </div>
  );
}

export function Error({
  text,
}: {
  readonly text: string;
}): React.JSX.Element {
  return (
    <p className="rounded-2xl bg-error-container/20 p-3 text-xs text-error">
      {text}
    </p>
  );
}
