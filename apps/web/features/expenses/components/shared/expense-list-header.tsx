"use client";
import { AppIcon } from "@/components/ui";
import Link from "@/lib/navigation/workspace-link";
import React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { formatCompactRp } from "@/features/expenses/utils/expense-list-utils";
import { transitionSpringSnappy, buttonTapActiveScale } from "@/lib/utils/motion";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";

const expensePressScale = { scale: buttonTapActiveScale } as const;

export function FinanceInboxHeader({
  activeClaimTotal,
  fieldClaimTotal,
  assignedScope = false,
}: {
  readonly activeClaimTotal: number;
  readonly fieldClaimTotal: number;
  readonly assignedScope?: boolean;
}): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  if (desktop) {
    return (
      <header className="min-w-0 space-y-1">
        <h1 className="text-title font-semibold tracking-tight text-on-surface">Pengeluaran</h1>
        <p className="text-support text-on-surface-variant">
          {assignedScope
            ? "Pengeluaran yang Anda ajukan dan tagihan pada proyek penugasan."
            : "Kelola biaya lapangan, tagihan vendor, dan rencana pembayaran proyek."}
        </p>
      </header>
    );
  }
  return (
    <div className="min-w-0 px-1">
      <h1 className="text-title font-semibold tracking-tight text-on-surface">Kas &amp; Tagihan</h1>
      <p className="mt-1 text-xs font-medium text-on-surface-variant">
        Aktif {formatCompactRp(activeClaimTotal)} · Total tercatat{" "}
        {formatCompactRp(fieldClaimTotal)}
      </p>
    </div>
  );
}

export function PendingApprovalsBanner({ count }: { readonly count: number }): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const desktop = useWorkspacePresentation() === "desktop";
  if (desktop) {
    return (
      <Link
        href="/ledger?tab=approvals"
        className="flex min-h-10 items-center gap-2 rounded-full bg-surface-container-low px-3 py-2 text-support text-on-surface-variant outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        <AppIcon name="approval" className="icon-sm shrink-0" />
        <span className="min-w-0 flex-1">{count} persetujuan menunggu keputusan Anda</span>
        <span className="shrink-0 font-semibold text-on-surface">Tinjau</span>
        <AppIcon name="arrow_forward" className="icon-sm shrink-0" />
      </Link>
    );
  }
  return (
    <motion.div
      whileTap={reduceMotion ? undefined : expensePressScale}
      transition={transitionSpringSnappy}
    >
      <Link
        href="/ledger?tab=approvals"
        className="flex min-h-16 items-center gap-3 rounded-[22px] bg-white/88 px-3 py-2.5 shadow-surface ring-1 ring-ring-subtle backdrop-blur-xl outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-white"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-warning/9 text-warning ring-1 ring-warning/6">
          <AppIcon name="approval" className="icon-md" />
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="block text-support leading-[1.15] font-semibold tracking-[-0.01em] text-on-surface">
            {count} persetujuan menunggu
          </span>
          <span className="block truncate text-meta leading-[1.2] text-on-surface-variant/75">
            Tinjau sebelum pembayaran atau pekerjaan tertahan.
          </span>
        </span>
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-high/70 text-accent"
          aria-hidden="true"
        >
          <AppIcon name="chevron_right" className="icon-sm" />
        </span>
      </Link>
    </motion.div>
  );
}
