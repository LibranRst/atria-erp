"use client";

import React from "react";
import { AppIcon } from "@/components/ui";
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
          <AppIcon name="error" className="text-[18px] text-error" />
          <div className="leading-relaxed">{error}</div>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-surface-container-low p-3.5 text-xs font-medium text-primary">
          <AppIcon name="check_circle" className="text-[18px] text-primary" />
          <div className="leading-relaxed">{success}</div>
        </div>
      )}
      {rejectedNotes && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-container p-3.5 text-xs font-medium text-warning">
          <AppIcon name="info" className="text-[18px] text-warning" />
          <div className="leading-relaxed">
            <strong className="mb-0.5 block">Catatan Penolakan Owner:</strong>
            {rejectedNotes}
          </div>
        </div>
      )}
    </>
  );
}
