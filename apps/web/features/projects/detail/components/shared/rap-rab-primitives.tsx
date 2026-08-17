"use client";

import React from "react";

import { MetricPill, MoneyMetricPill, MoneyValueVariant, PanelSection } from "@/components/ui";
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
  variant,
}: {
  readonly label: string;
  readonly value: number;
  readonly prefix?: string;
  readonly danger?: boolean;
  readonly variant?: MoneyValueVariant;
}): React.JSX.Element {
  return (
    <MoneyMetricPill
      label={label}
      amount={value}
      prefix={prefix}
      tone={danger ? "danger" : "default"}
      variant={variant}
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
