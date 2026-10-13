"use client";

import React from "react";
import Link from "@/lib/navigation/workspace-link";
import { motion, useReducedMotion } from "framer-motion";
import {
  formatDashboardMaterialQuantity,
  hasDashboardMaterialStockContext,
} from "@atria/core/presentation/dashboard-material-quantity";

import type { DashboardMaterialIssue } from "@/features/finance-dashboard/types/dashboard-types";
import { formatShortDate } from "@/features/finance-dashboard/utils/dashboard-formatters";
import { transitionSpringSnappy, buttonTapActiveScale } from "@/lib/utils/motion";
import { AppIcon, DuotoneIconTile } from "@/components/ui";
const dashboardRowPressScale = { scale: buttonTapActiveScale } as const;

export function MaterialIssueRow({
  item,
  compact = false,
}: {
  readonly item: DashboardMaterialIssue;
  readonly compact?: boolean;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const label =
    item.type === "RAP_SHORTAGE"
      ? "RAP belum terpenuhi"
      : item.type === "LOW_STOCK"
        ? "Stok rendah"
        : item.type === "REVERSAL_REQUEST"
          ? "Perlu keputusan"
          : item.type === "WASTE"
            ? "Material terbuang"
            : "Penyesuaian stok";
  const quantityLabel = formatDashboardMaterialQuantity(item, compact);
  const stockContext = hasDashboardMaterialStockContext(item);
  const fulfillmentTarget =
    item.type === "RAP_SHORTAGE"
      ? item.requiredStock
      : item.type === "LOW_STOCK"
        ? item.minimumStock
        : null;

  if (compact) {
    return (
      <motion.div
        tabIndex={-1}
        whileTap={reduceMotion ? undefined : dashboardRowPressScale}
        transition={transitionSpringSnappy}
      >
        <Link
          href={item.href}
          className="block rounded-[22px] px-3.5 py-3 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-black/2.5 max-[430px]:px-3"
        >
          <div className="flex items-start gap-3">
            <DuotoneIconTile
              name="inventory_2"
              tone={item.severity === "CRITICAL" ? "critical" : "attention"}
              className="h-9 w-9"
              iconClassName="h-4.5 w-4.5"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p
                  className={`truncate text-meta font-semibold ${item.severity === "CRITICAL" ? "text-error" : "text-warning"}`}
                >
                  {label}
                </p>
                {quantityLabel ? (
                  <span className="financial-amount shrink-0 font-mono text-meta font-bold text-on-surface">
                    {quantityLabel}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 truncate text-row font-semibold tracking-[-0.01em] text-on-surface">
                {item.materialName}
              </p>
              <p className="mt-0.5 truncate text-meta text-on-surface-variant/75">
                {item.description}
              </p>
            </div>
          </div>

          <div className="mt-3 flex min-h-9 items-center gap-3 rounded-inset bg-surface-container-low px-3 py-2 text-eyebrow font-semibold text-on-surface-variant">
            <span className="min-w-0 flex-1 truncate">
              {stockContext ? (
                <>
                  Tersedia{" "}
                  <strong className="font-mono text-on-surface">
                    {item.availableStock.toLocaleString("id-ID")} {item.unit}
                  </strong>
                </>
              ) : (
                (item.projectName ?? item.locationName ?? "Tinjau")
              )}
            </span>
            {fulfillmentTarget !== null ? (
              <span className="shrink-0">
                {item.type === "LOW_STOCK" ? "Minimum" : "Dibutuhkan"}{" "}
                <strong className="font-mono text-on-surface">
                  {fulfillmentTarget.toLocaleString("id-ID")} {item.unit}
                </strong>
              </span>
            ) : null}
            <AppIcon name="chevron_right" className="icon-sm shrink-0 text-on-surface-variant/55" />
          </div>
        </Link>
      </motion.div>
    );
  }

  const issueToneClass =
    item.severity === "CRITICAL"
      ? "bg-error/7.5 text-error ring-error/5"
      : item.severity === "WARNING"
        ? "bg-warning/9 text-warning ring-warning/6"
        : "bg-surface-container-high/70 text-on-surface-variant ring-ring-subtle";

  return (
    <motion.div
      tabIndex={-1}
      whileTap={reduceMotion ? undefined : dashboardRowPressScale}
      transition={transitionSpringSnappy}
      className="px-2.5 py-1.5"
    >
      <Link
        href={item.href}
        className="block rounded-inset px-2 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-black/2.5"
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${issueToneClass}`}
          >
            <AppIcon
              name={item.type === "WASTE" || item.type === "ADJUSTMENT" ? "history" : "inventory_2"}
              className="icon-md"
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p
                className={`truncate text-eyebrow font-semibold ${item.severity === "CRITICAL" ? "text-error" : item.severity === "WARNING" ? "text-warning" : "text-on-surface-variant"}`}
              >
                {label}
              </p>
              {quantityLabel ? (
                <span className="financial-amount shrink-0 font-mono text-meta font-bold text-on-surface">
                  {quantityLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-row font-semibold tracking-[-0.01em] text-on-surface">
              {item.materialName}
            </p>
            <p className="mt-0.5 line-clamp-2 text-meta text-on-surface-variant/75">
              {item.description}
            </p>
          </div>
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-high/70 text-accent"
            aria-hidden="true"
          >
            <AppIcon name="chevron_right" className="icon-sm" />
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 pl-12 text-eyebrow font-semibold text-on-surface-variant/70">
          <span className="truncate">{item.projectName ?? item.locationName ?? "-"}</span>
          <span className="shrink-0">
            {item.type === "RAP_SHORTAGE"
              ? `Tersedia ${item.availableStock.toLocaleString("id-ID")}`
              : item.type === "LOW_STOCK"
                ? `Minimum ${(item.minimumStock ?? 0).toLocaleString("id-ID")}`
                : item.createdAt
                  ? formatShortDate(item.createdAt)
                  : "Tinjau"}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
