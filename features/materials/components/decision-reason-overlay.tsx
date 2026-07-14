"use client";

import React from "react";

import { Textarea } from "@/components/ui";
import type { MaterialOperationDecision } from "@/features/materials/components/material-dashboard-types";

type DecisionReasonOverlayProps = {
  readonly decision: MaterialOperationDecision | null;
  readonly reason: string;
  readonly onReasonChange: (value: string) => void;
};

export function DecisionReasonOverlay({
  decision,
  reason,
  onReasonChange,
}: DecisionReasonOverlayProps): React.JSX.Element | null {
  if (
    !decision ||
    (!decision.type.includes("REJECT") && !decision.type.includes("REQUEST"))
  ) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-28 z-[100] mx-auto w-[calc(100%-2rem)] max-w-sm">
      <Textarea
        autoFocus
        rows={3}
        value={reason}
        onChange={onReasonChange}
        className="bg-white shadow-xl ring-1 ring-outline-variant/20"
        placeholder="Alasan minimal 10 karakter"
        aria-label="Alasan keputusan material"
        aria-invalid={reason.trim().length > 0 && reason.trim().length < 10}
      />
    </div>
  );
}
