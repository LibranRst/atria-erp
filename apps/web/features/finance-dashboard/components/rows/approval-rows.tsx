"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { AppIcon, DuotoneIconTile, MoneyValue } from "@/components/ui";
import type { ApprovalDetail } from "@atria/core/finance/approval-types";
import { transitionSpringSnappy, buttonTapActiveScale } from "@/lib/utils/motion";
const dashboardRowPressScale = { scale: buttonTapActiveScale } as const;

export function ApprovalWorkbenchRow({
  item,
  pending,
  onOpen,
}: {
  readonly item: ApprovalDetail;
  readonly pending: boolean;
  readonly onOpen: (item: ApprovalDetail) => void;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const approvalLabel =
    item.type === "project_cost"
      ? "Dana Lapangan"
      : item.type === "inventory_opening"
        ? "Saldo Stok"
        : "Vendor Payment";
  const counterpartyLabel = item.requestedBy;
  const critical = item.priority === "CRITICAL";

  return (
    <div className="px-2.5 py-1.5">
      <motion.button
        type="button"
        onClick={() => onOpen(item)}
        disabled={pending}
        whileTap={reduceMotion ? undefined : dashboardRowPressScale}
        transition={transitionSpringSnappy}
        className="min-h-12 w-full rounded-inset px-2 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-black/2.5 disabled:opacity-50"
      >
        <div className="flex items-start gap-3">
          <DuotoneIconTile
            name={
              item.type === "project_cost"
                ? "receipt_long"
                : item.type === "inventory_opening"
                  ? "inventory"
                  : "request_quote"
            }
            tone={critical ? "critical" : "attention"}
            className="h-9 w-9"
            iconClassName="icon-md"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <MoneyValue amount={item.amount} variant="fullDynamic" size="lg" />
              <span
                className={`shrink-0 text-eyebrow font-semibold ${critical ? "text-error" : "text-warning"}`}
              >
                {item.priority === "NORMAL" ? approvalLabel : item.priorityReason}
              </span>
            </div>
            <p className="mt-1 line-clamp-1 text-[12px] leading-5 font-semibold text-on-surface">
              {item.description}
            </p>
            <p className="truncate text-meta text-on-surface-variant/75">{item.projectName}</p>
          </div>
          <AppIcon
            name="chevron_right"
            className="mt-1 icon-sm shrink-0 text-on-surface-variant/55"
            aria-hidden="true"
          />
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pl-12 text-eyebrow font-semibold text-on-surface-variant/70">
          <span className="max-w-full truncate">{counterpartyLabel}</span>
          <span className="h-1 w-1 rounded-full bg-outline-variant/60" aria-hidden="true" />
          <span className="max-w-full truncate">{item.budgetItemName}</span>
          {item.receiptImageUrl ? (
            <>
              <span className="h-1 w-1 rounded-full bg-outline-variant/60" aria-hidden="true" />
              <span className="inline-flex items-center gap-1 text-primary">
                <AppIcon name="receipt_long" className="text-[13px]" />
                Nota
              </span>
            </>
          ) : null}
        </div>
      </motion.button>
    </div>
  );
}
