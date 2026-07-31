"use client";
import { AppIcon } from "@/components/ui/icon/app-icon";

import Link from "next/link";
import React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { formatCompactRp } from "@/features/expenses/utils/expense-list-utils";
import { transitionSpringSnappy } from "@/lib/utils/motion";

const expensePressScale = { scale: 0.985 } as const;

export function FinanceInboxHeader({
  activeClaimTotal,
  fieldClaimTotal,
}: {
  readonly activeClaimTotal: number;
  readonly fieldClaimTotal: number;
}): React.JSX.Element {
  return (
    <div className="min-w-0 px-1">
      <h1 className="text-[28px] leading-8 font-semibold tracking-tight text-on-surface max-[430px]:text-[26px]">
        Kas &amp; Tagihan
      </h1>
      <p className="mt-1 text-xs font-medium text-on-surface-variant">
        Aktif {formatCompactRp(activeClaimTotal)} · Total tercatat{" "}
        {formatCompactRp(fieldClaimTotal)}
      </p>
    </div>
  );
}

export function PendingApprovalsBanner({ count }: { readonly count: number }): React.JSX.Element {
  const reduceMotion = useReducedMotion();
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
          <AppIcon name="approval" className="text-[18px]" />
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="block text-[13px] leading-[1.15] font-semibold tracking-[-0.01em] text-on-surface">
            {count} persetujuan menunggu
          </span>
          <span className="block truncate text-[10px] leading-[1.2] text-on-surface-variant/75">
            Tinjau sebelum pembayaran atau pekerjaan tertahan.
          </span>
        </span>
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container-high/70 text-accent"
          aria-hidden="true"
        >
          <AppIcon name="chevron_right" className="text-[16px]" />
        </span>
      </Link>
    </motion.div>
  );
}
