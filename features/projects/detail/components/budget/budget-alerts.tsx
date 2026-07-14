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
        <div className="flex items-start gap-3 rounded-xl border border-error/30 bg-error-container/20 p-3.5 text-xs font-medium text-error">
          <span className="material-symbols-outlined text-[18px] text-error">
            error
          </span>
          <div className="leading-relaxed">{error}</div>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-surface-container-low p-3.5 text-xs font-medium text-primary">
          <span className="material-symbols-outlined text-[18px] text-primary">
            check_circle
          </span>
          <div className="leading-relaxed">{success}</div>
        </div>
      )}
      {rejectedNotes && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs font-medium text-amber-600">
          <span className="material-symbols-outlined text-[18px] text-amber-600">
            info
          </span>
          <div className="leading-relaxed">
            <strong className="mb-0.5 block">Catatan Penolakan Owner:</strong>
            {rejectedNotes}
          </div>
        </div>
      )}
    </>
  );
}
