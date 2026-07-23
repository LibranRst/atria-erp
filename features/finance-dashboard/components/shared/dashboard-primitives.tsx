"use client";

import React from "react";
import { SectionAction as SharedSectionAction } from "@/components/ui/button/button";
import { AppIcon } from "@/components/ui/icon/app-icon";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/badge/badge";

type DashboardStatusTone = "critical" | "warning" | "positive" | "neutral";

const summaryBadgeTone: Record<DashboardStatusTone, StatusBadgeTone> = {
  critical: "critical",
  warning: "warning",
  positive: "healthy",
  neutral: "neutral",
};

export function DashboardSummarySurface({
  ariaLabel,
  eyebrow,
  icon,
  status,
  statusTone = "neutral",
  children,
}: {
  readonly ariaLabel: string;
  readonly eyebrow: string;
  readonly icon: string;
  readonly status?: string;
  readonly statusTone?: DashboardStatusTone;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section
      className="relative isolate overflow-hidden rounded-[26px] bg-white/88 p-4 shadow-[0_1px_2px_rgba(17,17,17,0.025),0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 backdrop-blur-xl max-[430px]:rounded-3xl max-[430px]:p-3.5"
      aria-label={ariaLabel}
    >
      <span
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/90"
        aria-hidden="true"
      />
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-container-high/65 text-on-surface-variant ring-1 ring-black/[0.035]">
            <AppIcon name={icon} className="text-[17px]" />
          </span>
          <p className="min-w-0 truncate text-[10px] font-bold tracking-[0.13em] text-on-surface-variant/60 uppercase">
            {eyebrow}
          </p>
        </div>
        {status ? <StatusBadge tone={summaryBadgeTone[statusTone]} label={status} /> : null}
      </div>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

export function SectionAction({
  href,
  label,
}: {
  readonly href: string;
  readonly label: string;
}): React.JSX.Element {
  return <SharedSectionAction href={href} label={label} />;
}

export function OverviewPreviewSection({
  title,
  href,
  action,
  children,
  contentClassName = "",
}: {
  readonly title: string;
  readonly href: string;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly contentClassName?: string;
}): React.JSX.Element {
  return (
    <section className="space-y-2">
      <div className="flex min-h-11 items-center justify-between gap-3 px-1 max-[430px]:min-h-10">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-[17px] leading-6 font-bold tracking-[-0.015em] text-on-surface max-[430px]:text-[15px] max-[430px]:leading-5">
            {title}
          </h2>
          {action}
        </div>
        <SectionAction href={href} label="Lihat semua" />
      </div>
      <div
        className={`relative isolate overflow-hidden rounded-[26px] bg-white/88 shadow-[0_1px_2px_rgba(17,17,17,0.025),0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 backdrop-blur-xl max-[430px]:rounded-3xl ${contentClassName}`}
      >
        {children}
      </div>
    </section>
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
    <section className="space-y-2">
      <div className="flex min-h-11 items-center justify-between gap-3 px-1 max-[430px]:min-h-10">
        <h2 className="min-w-0 truncate text-[17px] leading-6 font-bold tracking-[-0.015em] text-on-surface max-[430px]:text-[15px] max-[430px]:leading-5">
          {title}
        </h2>
        {href ? <SectionAction href={href} label={actionLabel} /> : null}
      </div>
      <div
        className={`relative isolate overflow-hidden rounded-[26px] bg-white/88 shadow-[0_1px_2px_rgba(17,17,17,0.025),0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 backdrop-blur-xl max-[430px]:rounded-3xl ${contentClassName}`}
      >
        {children}
      </div>
    </section>
  );
}

export function DashboardRowGroup({
  children,
  connected = false,
}: {
  readonly children: React.ReactNode;
  readonly connected?: boolean;
}): React.JSX.Element {
  if (connected) {
    return (
      <div className="relative">
        <span
          className="pointer-events-none absolute inset-y-0 left-13.5 w-px bg-black/11 max-[430px]:left-12.5"
          aria-hidden="true"
        />
        <div className="relative">{children}</div>
      </div>
    );
  }

  return <div className="divide-y divide-black/5.5">{children}</div>;
}
