"use client";

import Link from "next/link";
import React from "react";

type DashboardStatusTone = "critical" | "warning" | "positive" | "neutral";

const summaryStatusTone: Record<DashboardStatusTone, string> = {
  critical: "bg-error/7.5 text-error ring-error/8",
  warning: "bg-warning/9 text-warning ring-warning/8",
  positive: "bg-success/8 text-success ring-success/8",
  neutral: "bg-surface-container-high/70 text-on-surface-variant ring-black/[0.035]",
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
      className="relative isolate overflow-hidden rounded-[26px] bg-white/88 p-4 shadow-[0_1px_2px_rgba(17,17,17,0.025),0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 backdrop-blur-xl max-[430px]:rounded-[24px] max-[430px]:p-3.5"
      aria-label={ariaLabel}
    >
      <span
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/90"
        aria-hidden="true"
      />
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="bg-surface-container-high/65 text-on-surface-variant flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] ring-1 ring-black/[0.035]">
            <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
              {icon}
            </span>
          </span>
          <p className="text-on-surface-variant/60 min-w-0 truncate text-[10px] font-bold tracking-[0.13em] uppercase">
            {eyebrow}
          </p>
        </div>
        {status ? (
          <span
            className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[9px] font-semibold ring-1 ${summaryStatusTone[statusTone]}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {status}
          </span>
        ) : null}
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
  return (
    <Link
      href={href}
      className="relative inline-flex h-8 shrink-0 items-center gap-0.5 rounded-full bg-[#007AFF]/8 px-3 text-[10px] font-semibold text-[#007AFF] outline-none after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] focus-visible:ring-2 focus-visible:ring-[#007AFF]/30 active:bg-[#007AFF]/[0.14]"
    >
      {label}
      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
        chevron_right
      </span>
    </Link>
  );
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
          <h2 className="text-on-surface truncate text-[17px] leading-6 font-bold tracking-[-0.015em] max-[430px]:text-[15px] max-[430px]:leading-5">
            {title}
          </h2>
          {action}
        </div>
        <SectionAction href={href} label="Lihat semua" />
      </div>
      <div
        className={`relative isolate overflow-hidden rounded-[26px] bg-white/88 shadow-[0_1px_2px_rgba(17,17,17,0.025),0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 backdrop-blur-xl max-[430px]:rounded-[24px] ${contentClassName}`}
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
        <h2 className="text-on-surface min-w-0 truncate text-[17px] leading-6 font-bold tracking-[-0.015em] max-[430px]:text-[15px] max-[430px]:leading-5">
          {title}
        </h2>
        {href ? <SectionAction href={href} label={actionLabel} /> : null}
      </div>
      <div
        className={`relative isolate overflow-hidden rounded-[26px] bg-white/88 shadow-[0_1px_2px_rgba(17,17,17,0.025),0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 backdrop-blur-xl max-[430px]:rounded-[24px] ${contentClassName}`}
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
          className="pointer-events-none absolute inset-y-0 left-[54px] w-px bg-black/11 max-[430px]:left-[50px]"
          aria-hidden="true"
        />
        <div className="relative">{children}</div>
      </div>
    );
  }

  return <div className="divide-y divide-black/5.5">{children}</div>;
}
