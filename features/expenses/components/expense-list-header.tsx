"use client";

import Link from "next/link";
import React from "react";

import { formatCompactRp } from "@/features/expenses/components/expense-list-utils";

export function FinanceInboxHeader({
  activeClaimTotal,
  fieldClaimTotal,
}: {
  readonly activeClaimTotal: number;
  readonly fieldClaimTotal: number;
}): React.JSX.Element {
  return (
    <div className="min-w-0 px-1">
        <h1 className="text-[28px] font-semibold leading-8 tracking-tight text-on-surface">
          Finance Inbox
        </h1>
        <p className="mt-1 text-xs font-medium text-on-surface-variant">
          Aktif {formatCompactRp(activeClaimTotal)} • Total{" "}
          {formatCompactRp(fieldClaimTotal)}
        </p>
    </div>
  );
}

export function PendingApprovalsBanner({
  count,
}: {
  readonly count: number;
}): React.JSX.Element {
  return (
    <Link
      href="/approvals"
      className="pointer-events-auto flex cursor-pointer items-center justify-between rounded-[28px] border border-outline-variant/20 bg-white p-md shadow-[0_14px_34px_rgba(17,17,17,0.045)] transition-all duration-200 hover:bg-surface-container-low"
    >
      <div className="flex items-center gap-md">
        <span
          className="material-symbols-outlined text-[22px] text-primary"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          verified_user
        </span>
        <div className="min-w-0">
          <p className="font-sans text-[14px] font-bold leading-[20px] text-on-surface">
            Persetujuan Menunggu
          </p>
          <p className="font-sans text-[11px] font-medium leading-[16px] text-on-surface-variant">
            Ada {count} pengajuan yang memerlukan persetujuan Anda.
          </p>
        </div>
      </div>
      <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
        chevron_right
      </span>
    </Link>
  );
}
