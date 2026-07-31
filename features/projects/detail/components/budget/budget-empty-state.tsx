"use client";

import React from "react";
import { AppIcon } from "@/components/ui/icon/app-icon";

export function BudgetEmptyState({
  canManage,
  isPending,
  error,
  onCreateBudget,
}: {
  readonly canManage: boolean;
  readonly isPending: boolean;
  readonly error: string | null;
  readonly onCreateBudget: () => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center space-y-md rounded-[28px] border border-outline-variant/20 bg-white p-md py-10 text-center shadow-surface select-none">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <AppIcon name="description" className="text-[28px]" />
      </div>
      <div className="space-y-xs">
        <h3 className="font-title-md text-on-surface">RAB Belum Tersedia</h3>
        <p className="max-w-70 font-sans text-[14px] leading-margin-mobile font-normal text-on-surface-variant">
          Rencana Anggaran Biaya (RAB) proyek belum dibuat untuk proyek ini.
        </p>
      </div>
      {canManage && (
        <button
          type="button"
          onClick={onCreateBudget}
          disabled={isPending}
          className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-6 text-xs font-bold text-white shadow-primary transition active:scale-[0.98] disabled:opacity-50"
        >
          {isPending ? (
            <span className="animate-pulse">Membuat Draf...</span>
          ) : (
            <>
              <AppIcon name="add" className="text-[16px]" />
              <span>Buat Rencana Anggaran (RAB)</span>
            </>
          )}
        </button>
      )}
      {error && <p className="text-xs font-medium text-error">{error}</p>}
    </div>
  );
}
