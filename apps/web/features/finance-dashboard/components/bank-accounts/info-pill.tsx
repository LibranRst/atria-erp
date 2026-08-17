import React from "react";

import { MetricPill } from "@/components/ui";
export function InfoPill({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.JSX.Element {
  return <MetricPill label={label} value={value} valueSize="sm" wrapMode="truncate" mono={false} />;
}
