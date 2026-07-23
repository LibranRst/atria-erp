"use client";

import React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

import type { DashboardMaterialIssue } from "@/features/finance-dashboard/types/dashboard-types";
import { formatShortDate } from "@/features/finance-dashboard/utils/dashboard-formatters";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { AppIcon } from "@/components/ui/icon/app-icon";

const dashboardRowPressScale = { scale: 0.985 } as const;

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
  const quantityLabel =
    item.type === "RAP_SHORTAGE"
      ? `${Math.max(0, (item.requiredStock ?? 0) - item.availableStock).toLocaleString("id-ID")} ${item.unit}`
      : item.type === "LOW_STOCK"
        ? `${item.availableStock.toLocaleString("id-ID")} ${item.unit}`
        : item.quantity !== null
          ? `${item.quantity.toLocaleString("id-ID")} ${item.unit}`
          : null;
  const fulfillmentTarget =
    item.type === "RAP_SHORTAGE"
      ? item.requiredStock
      : item.type === "LOW_STOCK"
        ? item.minimumStock
        : null;

  if (compact) {
    return (
      <motion.div
        whileTap={reduceMotion ? undefined : dashboardRowPressScale}
        transition={transitionSpringSnappy}
      >
        <Link
          href={item.href}
          className="block rounded-[22px] px-3.5 py-3 outline-none focus-visible:ring-2 focus-visible:ring-accent/25 active:bg-black/2.5 max-[430px]:px-3"
        >
          <div className="flex items-start gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${item.severity === "CRITICAL" ? "bg-error/7.5 text-error ring-error/5" : "bg-warning/9 text-warning ring-warning/6"}`}
            >
              <AppIcon name="inventory_2" className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p
                  className={`truncate text-[10px] font-semibold ${item.severity === "CRITICAL" ? "text-error" : "text-warning"}`}
                >
                  {label}
                </p>
                {quantityLabel ? (
                  <span className="financial-amount shrink-0 font-mono text-[10px] font-bold text-on-surface">
                    Kurang {quantityLabel}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 truncate text-[13px] font-semibold tracking-[-0.01em] text-on-surface">
                {item.materialName}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-on-surface-variant/75">
                {item.description}
              </p>
            </div>
          </div>

          <div className="mt-3 flex min-h-9 items-center gap-3 rounded-[15px] bg-surface-container-low/70 px-3 py-2 text-[9px] font-semibold text-on-surface-variant">
            <span className="min-w-0 flex-1 truncate">
              Tersedia{" "}
              <strong className="font-mono text-on-surface">
                {item.availableStock.toLocaleString("id-ID")} {item.unit}
              </strong>
            </span>
            {fulfillmentTarget !== null ? (
              <span className="shrink-0">
                Dibutuhkan{" "}
                <strong className="font-mono text-on-surface">
                  {fulfillmentTarget.toLocaleString("id-ID")} {item.unit}
                </strong>
              </span>
            ) : null}
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-accent shadow-sm"
              aria-hidden="true"
            >
              <AppIcon name="chevron_right" className="text-[15px]" />
            </span>
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
        : "bg-surface-container-high/70 text-on-surface-variant ring-black/[0.035]";

  return (
    <motion.div
      whileTap={reduceMotion ? undefined : dashboardRowPressScale}
      transition={transitionSpringSnappy}
      className="px-2.5 py-1.5"
    >
      <Link
        href={item.href}
        className="block rounded-[20px] px-2 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-accent/25 active:bg-black/2.5"
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ${issueToneClass}`}
          >
            <AppIcon
              name={item.type === "WASTE" || item.type === "ADJUSTMENT" ? "history" : "inventory_2"}
              className="text-[18px]"
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p
                className={`truncate text-[9px] font-semibold ${item.severity === "CRITICAL" ? "text-error" : item.severity === "WARNING" ? "text-warning" : "text-on-surface-variant"}`}
              >
                {label}
              </p>
              {quantityLabel ? (
                <span className="financial-amount shrink-0 font-mono text-[10px] font-bold text-on-surface">
                  {quantityLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-[13px] font-semibold tracking-[-0.01em] text-on-surface">
              {item.materialName}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-on-surface-variant/75">
              {item.description}
            </p>
          </div>
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-high/70 text-accent"
            aria-hidden="true"
          >
            <AppIcon name="chevron_right" className="text-[16px]" />
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 pl-12 text-[9px] font-semibold text-on-surface-variant/70">
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
