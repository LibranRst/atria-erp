"use client";

import React from "react";

import type { MaterialMovementView } from "@/app/actions/material/operations-dashboard";
import { AppIcon, Button, MoneyValue, NativeSection } from "@/components/ui";
import {
  formatMaterialDate,
  formatMaterialQuantity,
  formatMovementType,
} from "@/features/materials/utils/material-ui-utils";
import {
  ActivityDetailChevron,
  useActivityDetail,
} from "@/features/activity-detail/components/activity-detail-provider";

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
      <p className="truncate text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
        {label}
      </p>
      {typeof amount === "number" ? (
        <MoneyValue amount={amount} variant="compactWithFull" size="sm" className="mt-1" />
      ) : (
        <p className="mt-1 font-mono text-[12px] font-bold wrap-anywhere wrap-break-word tabular-nums">
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

export function MovementRow({ row }: { readonly row: MaterialMovementView }): React.JSX.Element {
  const { openActivityDetail } = useActivityDetail();
  return (
    <button
      type="button"
      onClick={() => openActivityDetail({ kind: "STOCK_MOVEMENT", id: row.id })}
      className="flex min-h-16 w-full items-center gap-3 py-2.5 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low/70"
      aria-label={`Lihat detail mutasi ${row.materialName}`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ${movementIconTone(row)}`}
      >
        <AppIcon name={movementIcon(row)} className="icon-sm" />
      </span>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="block truncate text-row font-bold">{row.materialName}</span>
        <span className="block truncate text-[10px] leading-[1.3] text-on-surface-variant">
          {formatMovementType(row.movementType)} · {row.locationName}
          {row.projectName ? ` · ${row.projectName}` : ""}
        </span>
        <span className="block truncate text-eyebrow text-on-surface-variant/65">
          {formatMaterialDate(row.createdAt)} · {row.createdByName}
        </span>
      </span>
      <span
        className={`shrink-0 text-right font-mono text-[10px] font-extrabold tabular-nums ${row.movementDirection === "OUT" ? "text-error" : row.movementDirection === "IN" ? "text-primary" : "text-on-surface"}`}
      >
        {row.movementDirection === "OUT" ? "−" : row.movementDirection === "IN" ? "+" : ""}
        {formatMaterialQuantity(row.quantity)} {row.unit}
      </span>
      <ActivityDetailChevron />
    </button>
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
  detailLabel,
  onOpen,
  onApprove,
  onReject,
}: {
  readonly title: string;
  readonly description: string;
  readonly amount?: number;
  readonly detailLabel: string;
  readonly onOpen: () => void;
  readonly onApprove: () => void;
  readonly onReject: () => void;
}): React.JSX.Element {
  return (
    <div className="relative px-3.5 py-3">
      <button
        type="button"
        onClick={onOpen}
        aria-label={detailLabel}
        className="absolute inset-0 z-0 rounded-[20px] outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-surface-container-low/70"
      />
      <div className="pointer-events-none relative z-1 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-warning/9 text-warning ring-1 ring-warning/6">
          <AppIcon name="priority_high" className="icon-md" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs leading-4 font-bold">{title}</span>
          <span className="mt-0.5 block text-[10px] leading-[1.3] text-on-surface-variant">
            {description}
          </span>
          {typeof amount === "number" && (
            <MoneyValue amount={amount} variant="compactWithFull" size="sm" className="mt-1" />
          )}
        </span>
        <ActivityDetailChevron className="mt-2" />
      </div>
      <div className="relative z-10 mt-3 grid grid-cols-2 gap-2 pl-12">
        <Button type="button" onClick={onReject} variant="secondary" fullWidth className="min-w-0">
          Tolak
        </Button>
        <Button type="button" onClick={onApprove} variant="primary" fullWidth className="min-w-0">
          Setujui
        </Button>
      </div>
    </div>
  );
}

export function Error({ text }: { readonly text: string }): React.JSX.Element {
  return <p className="rounded-2xl bg-error-container/20 p-3 text-xs text-error">{text}</p>;
}
