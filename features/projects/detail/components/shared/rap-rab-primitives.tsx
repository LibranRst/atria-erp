"use client";

import React from "react";

import { MetricPill, MoneyMetricPill } from "@/components/ui/feedback/page-primitives";
import { PanelSection } from "@/components/ui/feedback/main-surface";

export { PanelSection as NativePanel };

export function MiniMetric({
  label,
  value,
  danger = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly danger?: boolean;
}): React.JSX.Element {
  return (
    <MetricPill
      label={label}
      value={value}
      tone={danger ? "danger" : "default"}
      wrapMode="truncate"
    />
  );
}

export function MiniMoneyMetric({
  label,
  value,
  prefix,
  danger = false,
}: {
  readonly label: string;
  readonly value: number;
  readonly prefix?: string;
  readonly danger?: boolean;
}): React.JSX.Element {
  return (
    <MoneyMetricPill
      label={label}
      amount={value}
      prefix={prefix}
      tone={danger ? "danger" : "default"}
    />
  );
}

export function RabMoneyBlock({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}): React.JSX.Element {
  return <MoneyMetricPill label={label} amount={value} variant="fullDynamic" valueSize="md" />;
}

export function rabSourceLabel(sourceType: string): string {
  if (sourceType === "RAP_MATERIAL") return "Material";
  if (sourceType === "CATEGORY_PLAN") return "Paket kerja";
  return "Manual";
}
