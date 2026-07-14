"use client";

import Link from "next/link";
import React from "react";

import { MoneyValue } from "@/components/ui/page-primitives";
import { cn } from "@/lib/utils/cn";

export function SectionAction({
  href,
  label,
}: {
  readonly href: string;
  readonly label: string;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      className="inline-flex h-8 shrink-0 items-center rounded-full bg-primary/5 border border-primary/10 px-3.5 text-[10px] font-extrabold text-primary active:scale-[0.97] transition-all"
    >
      {label}
    </Link>
  );
}

export function OverviewPreviewSection({
  title,
  href,
  action,
  children,
  contentClassName = "",
  unframed = false,
}: {
  readonly title: string;
  readonly href: string;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly contentClassName?: string;
  readonly unframed?: boolean;
}): React.JSX.Element {
  return (
    <section className="space-y-2.5">
      <div className="flex min-h-8 items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-[17px] font-semibold leading-6 text-on-surface">
            {title}
          </h2>
          {action}
        </div>
        <SectionAction href={href} label="Lihat semua" />
      </div>
      {unframed ? (
        <div className={contentClassName}>{children}</div>
      ) : (
        <div
          className={cn(
            `overflow-hidden rounded-[28px] bg-white p-3 shadow-[0_12px_28px_rgba(17,17,17,0.04)] ring-1 ring-outline-variant/10`,
            contentClassName,
          )}
        >
          {children}
        </div>
      )}
    </section>
  );
}

type DashboardMetricTone = "default" | "positive" | "warning" | "danger";

export type DashboardMetricItem = {
  readonly label: string;
  readonly value: string;
  readonly kind?: "money";
  readonly amount?: number;
  readonly tone?: DashboardMetricTone;
  readonly fullValue?: string;
};

function dashboardMetricToneClass(
  tone: DashboardMetricTone = "default",
): string {
  if (tone === "positive") return "text-primary";
  if (tone === "warning") return "text-secondary";
  if (tone === "danger") return "text-error";
  return "text-on-surface";
}

function dashboardMetricMoneyTone(
  tone: DashboardMetricTone = "default",
): "default" | "primary" | "warning" | "danger" {
  if (tone === "positive") return "primary";
  if (tone === "warning") return "warning";
  if (tone === "danger") return "danger";
  return "default";
}

function DashboardMetricDot({
  tone = "default",
}: {
  readonly tone?: DashboardMetricTone;
}): React.JSX.Element {
  if (tone === "default") {
    return (
      <span
        className="h-1.5 w-1.5 rounded-full bg-outline-variant/50"
        aria-hidden="true"
      />
    );
  }
  if (tone === "positive") {
    return (
      <span
        className="h-1.5 w-1.5 rounded-full bg-primary"
        aria-hidden="true"
      />
    );
  }
  if (tone === "warning") {
    return (
      <span
        className="h-1.5 w-1.5 rounded-full bg-secondary"
        aria-hidden="true"
      />
    );
  }
  return (
    <span className="h-1.5 w-1.5 rounded-full bg-error" aria-hidden="true" />
  );
}

function DashboardSummaryStrip({
  metrics,
}: {
  readonly metrics: readonly DashboardMetricItem[];
}): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_12px_28px_rgba(17,17,17,0.04)] ring-1 ring-outline-variant/10">
      <div className="grid grid-cols-3 divide-x divide-outline-variant/10">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="min-w-0 px-2.5 py-2.5 min-[390px]:px-3"
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <DashboardMetricDot tone={metric.tone} />
              <p className="truncate text-[9px] leading-normal font-bold text-on-surface-variant/65">
                {metric.label}
              </p>
            </div>
            {metric.kind === "money" && typeof metric.amount === "number" ? (
              <MoneyValue
                amount={metric.amount}
                variant="compactWithFull"
                tone={dashboardMetricMoneyTone(metric.tone)}
                size="sm"
                className="mt-1"
              />
            ) : (
              <p
                className={`financial-amount mt-1 truncate font-mono text-[12px] leading-none font-black min-[390px]:text-[14px] ${dashboardMetricToneClass(metric.tone)}`}
                title={metric.fullValue}
              >
                {metric.value}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardTabShell({
  metrics,
  children,
}: {
  readonly metrics: readonly DashboardMetricItem[];
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="space-y-lg">
      <DashboardSummaryStrip metrics={metrics} />
      {children}
    </div>
  );
}

export function DashboardDetailSection({
  title,
  href,
  actionLabel = "Lihat semua",
  children,
  contentClassName = "",
}: {
  readonly title: string;
  readonly href?: string;
  readonly actionLabel?: string;
  readonly children: React.ReactNode;
  readonly contentClassName?: string;
}): React.JSX.Element {
  return (
    <section className="space-y-2.5">
      <div className="flex min-h-8 items-center justify-between gap-3 px-1">
        <h2 className="min-w-0 truncate text-[17px] font-semibold leading-6 text-on-surface">
          {title}
        </h2>
        {href ? <SectionAction href={href} label={actionLabel} /> : null}
      </div>
      <div
        className={`overflow-hidden rounded-[28px] bg-white shadow-[0_12px_28px_rgba(17,17,17,0.04)] ring-1 ring-outline-variant/10 ${contentClassName}`}
      >
        {children}
      </div>
    </section>
  );
}

export function DashboardRowGroup({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return <div className="divide-y divide-outline-variant/35">{children}</div>;
}
