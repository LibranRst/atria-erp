import React from "react";
import { type InlineStateTone, StatusBadge, type StatusBadgeTone } from "@/components/ui";
export type MaterialTone = InlineStateTone;

const materialBadgeTone: Record<MaterialTone, StatusBadgeTone> = {
  neutral: "neutral",
  positive: "healthy",
  warning: "warning",
  critical: "critical",
  pending: "pending",
};

export function MaterialStatusLabel({
  label,
  tone = "neutral",
  className = "",
}: {
  readonly label: string;
  readonly tone?: MaterialTone;
  readonly className?: string;
}): React.JSX.Element {
  return <StatusBadge className={className} tone={materialBadgeTone[tone]} label={label} />;
}
