"use client";

import Link from "next/link";
import React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { formatCompactRp } from "@/features/expenses/components/expense-list-utils";
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
      <h1 className="text-on-surface text-[28px] leading-8 font-semibold tracking-tight max-[430px]:text-[26px]">
        Kas &amp; Tagihan
      </h1>
      <p className="text-on-surface-variant mt-1 text-xs font-medium">
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
        className="flex min-h-[64px] items-center gap-3 rounded-[22px] bg-white/88 px-3 py-2.5 shadow-[0_1px_2px_rgba(17,17,17,0.025),0_12px_28px_rgba(17,17,17,0.05)] ring-1 ring-black/2.5 backdrop-blur-xl outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/25 active:bg-white"
      >
        <span className="bg-warning/9 text-warning ring-warning/6 flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            approval
          </span>
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="text-on-surface block text-[13px] leading-[1.15] font-semibold tracking-[-0.01em]">
            {count} persetujuan menunggu
          </span>
          <span className="text-on-surface-variant/75 block truncate text-[10px] leading-[1.2]">
            Tinjau sebelum pembayaran atau pekerjaan tertahan.
          </span>
        </span>
        <span
          className="bg-surface-container-high/70 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#007AFF]"
          aria-hidden="true"
        >
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        </span>
      </Link>
    </motion.div>
  );
}
