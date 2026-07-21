"use client";

import React from "react";

export function BudgetAlerts({
  error,
  success,
  rejectedNotes,
}: {
  readonly error: string | null;
  readonly success: string | null;
  readonly rejectedNotes: string | null;
}): React.JSX.Element {
  return (
    <>
      {error && (
        <div className="border-error/30 bg-error-container/20 text-error flex items-start gap-3 rounded-xl border p-3.5 text-xs font-medium">
          <span className="material-symbols-outlined text-error text-[18px]">error</span>
          <div className="leading-relaxed">{error}</div>
        </div>
      )}
      {success && (
        <div className="border-primary/30 bg-surface-container-low text-primary flex items-start gap-3 rounded-xl border p-3.5 text-xs font-medium">
          <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
          <div className="leading-relaxed">{success}</div>
        </div>
      )}
      {rejectedNotes && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs font-medium text-amber-600">
          <span className="material-symbols-outlined text-[18px] text-amber-600">info</span>
          <div className="leading-relaxed">
            <strong className="mb-0.5 block">Catatan Penolakan Owner:</strong>
            {rejectedNotes}
          </div>
        </div>
      )}
    </>
  );
}
