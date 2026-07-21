"use client";

import React from "react";

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
    <div className="space-y-md border-outline-variant/20 p-md flex flex-col items-center justify-center rounded-[28px] border bg-white py-10 text-center shadow-[0_14px_34px_rgba(17,17,17,0.045)] select-none">
      <div className="bg-surface-container text-on-surface-variant flex h-12 w-12 items-center justify-center rounded-full">
        <span className="material-symbols-outlined text-[28px]">description</span>
      </div>
      <div className="space-y-xs">
        <h3 className="font-title-md text-on-surface">RAB Belum Tersedia</h3>
        <p className="leading-margin-mobile text-on-surface-variant max-w-[280px] font-sans text-[14px] font-normal">
          Rencana Anggaran Biaya (RAB) proyek belum dibuat untuk proyek ini.
        </p>
      </div>
      {canManage && (
        <button
          type="button"
          onClick={onCreateBudget}
          disabled={isPending}
          className="bg-primary flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-6 text-xs font-bold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-50"
        >
          {isPending ? (
            <span className="animate-pulse">Membuat Draf...</span>
          ) : (
            <>
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Buat Rencana Anggaran (RAB)</span>
            </>
          )}
        </button>
      )}
      {error && <p className="text-error text-xs font-medium">{error}</p>}
    </div>
  );
}
