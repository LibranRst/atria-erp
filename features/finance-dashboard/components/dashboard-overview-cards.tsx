"use client";

import Link from "next/link";
import React from "react";
import { motion } from "framer-motion";

import { MoneyValue } from "@/components/ui/page-primitives";
import type { FinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";
import type {
  DashboardCategory,
  DashboardRiskyProject,
  DashboardTone,
} from "@/features/finance-dashboard/lib/dashboard-types";
import { transitionSpringSmooth } from "@/lib/utils/motion";
import { categoryTone, ProgressBar, projectTone } from "./dashboard-tone";

export function ProjectRiskCard({
  project,
}: {
  readonly project: DashboardRiskyProject;
}): React.JSX.Element {
  const tone = projectTone(project);
  const initial = project.projectName.trim().charAt(0).toUpperCase() || "P";

  const circleColor = {
    critical: "bg-error/10 text-error",
    warning: "bg-secondary/10 text-secondary",
    positive: "bg-primary/10 text-primary",
    neutral: "bg-surface-container-high text-on-surface-variant",
  }[tone];

  return (
    <Link
      href={`/projects/${project.projectId}?tab=overview`}
      className="ring-outline-variant/10 block w-[240px] shrink-0 snap-start rounded-2xl bg-white p-3.5 shadow-[0_12px_28px_rgba(17,17,17,0.04)] ring-1 transition hover:bg-white active:scale-[0.99]"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${circleColor}`}
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-on-surface truncate text-xs leading-tight font-extrabold">
            {project.projectName}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[7px] leading-none font-extrabold tracking-wider uppercase ${
            project.effectiveHealth === "CRITICAL"
              ? "bg-error/10 text-error"
              : project.effectiveHealth === "WARNING"
                ? "bg-secondary/10 text-secondary"
                : "bg-primary/10 text-primary"
          }`}
        >
          {project.effectiveHealth}
        </span>
      </div>

      <div className="mt-3">
        <div className="text-on-surface-variant/60 mb-1 flex items-center justify-between text-[8px] leading-none font-bold tracking-wider uppercase">
          <span>Budget Terpakai</span>
          <span className="text-on-surface font-mono leading-none font-extrabold">
            {project.usedPercentage.toFixed(0)}%
          </span>
        </div>
        <ProgressBar value={project.usedPercentage} tone={tone} className="mt-0" />
      </div>

      <div className="border-on-surface-variant/10 mt-3.5 flex items-center justify-between border-t pt-2.5">
        <div className="min-w-0 flex-1">
          <span className="text-on-surface-variant/50 block text-[8px] leading-none font-bold tracking-wide uppercase">
            Sisa budget
          </span>
          <MoneyValue
            amount={project.remainingBudget}
            variant="compactWithFull"
            tone={project.remainingBudget < 0 ? "danger" : "default"}
            size="sm"
            className="mt-1"
          />
        </div>

        <span className="bg-on-surface-variant/10 mx-2.5 h-5 w-px shrink-0" />

        <div className="min-w-0 flex-1 text-right">
          <span className="text-on-surface-variant/50 block text-[8px] leading-none font-bold tracking-wide uppercase">
            Margin
          </span>
          <span className="financial-amount text-on-surface mt-1 block font-mono text-[10px] leading-none font-extrabold">
            {project.projectedMarginPercentage.toFixed(1)}%
          </span>
        </div>
      </div>
    </Link>
  );
}

export function BankAccountCard({
  account,
  onSelect,
  variant = "compact",
}: {
  readonly account: FinanceDashboardOverview["bankAccounts"][number];
  readonly onSelect?: (account: FinanceDashboardOverview["bankAccounts"][number]) => void;
  readonly variant?: "compact" | "full";
}): React.JSX.Element {
  const textClass = account.cardTextColor === "dark" ? "text-[#141414]" : "text-white";
  const inactiveClass = account.isActive ? "" : "opacity-60 grayscale";
  const full = variant === "full";

  const content = full ? (
    <div
      className={`relative flex aspect-[1.586/1] w-full flex-col overflow-hidden rounded-[28px] p-5 text-left shadow-[0_3px_6px_rgba(17,17,17,0.08),0_18px_42px_rgba(17,17,17,0.13)] ring-1 ${textClass} ${inactiveClass} ${account.cardTextColor === "dark" ? "ring-black/[0.07]" : "ring-white/16"}`}
      style={{
        backgroundImage: `linear-gradient(135deg, ${account.cardColorFrom}, ${account.cardColorTo})`,
      }}
    >
      <span
        className="pointer-events-none absolute top-0 right-0 h-32 w-32 rounded-full bg-white/12 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-white/14 ring-1 ring-white/15 backdrop-blur-sm">
          <span className="material-symbols-outlined text-[21px]" aria-hidden="true">
            account_balance
          </span>
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="truncate text-sm leading-[1.15] font-semibold tracking-[-0.01em]">
            {account.name}
          </h3>
          <p className="mt-1 truncate text-[10px] leading-[1.2] font-medium tracking-[0.08em] uppercase opacity-65">
            {account.bankName}
          </p>
        </div>
        <span
          className="material-symbols-outlined shrink-0 pt-1 text-[23px] opacity-65"
          aria-hidden="true"
        >
          contactless
        </span>
      </div>

      <div className="relative mt-auto pt-3">
        <p className="text-[9px] font-semibold tracking-[0.13em] uppercase opacity-60">
          Saldo tersedia
        </p>
        <MoneyValue
          amount={account.balance}
          variant="fullDynamic"
          tone={account.cardTextColor === "dark" ? "inherit" : "inverse"}
          size="lg"
          className="mt-1.5"
        />
      </div>

      <div className="relative mt-4 flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] font-semibold tracking-[0.16em] opacity-75">
          •••• {account.accountNumber.slice(-4)}
        </p>
        <p className="max-w-[55%] min-w-0 truncate text-right text-[9px] font-semibold tracking-widest uppercase opacity-60">
          {account.holderName}
        </p>
      </div>
    </div>
  ) : (
    <div
      className={`relative flex min-h-[120px] w-[240px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-2xl p-4 text-left shadow-[0_12px_28px_rgba(17,17,17,0.04)] transition active:scale-[0.99] ${textClass} ${inactiveClass}`}
      style={{
        backgroundImage: `linear-gradient(135deg, ${account.cardColorFrom}, ${account.cardColorTo})`,
      }}
    >
      <div className="relative z-10 flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[9px] leading-none font-bold tracking-wider uppercase opacity-75">
              {account.bankName}
            </p>
            <h3 className="mt-1 truncate text-xs leading-normal font-black tracking-tight">
              {account.name}
            </h3>
          </div>
        </div>
        <span className="material-symbols-outlined shrink-0 text-[18px] opacity-75">
          account_balance
        </span>
      </div>

      <div className="relative z-10 mt-4">
        <p className="font-mono text-[10px] leading-none tracking-[0.18em] opacity-75">
          •••• {account.accountNumber.slice(-4)}
        </p>
        <MoneyValue
          amount={account.balance}
          variant="compactWithFull"
          tone={account.cardTextColor === "dark" ? "inherit" : "inverse"}
          size="md"
          className="mt-1"
        />
      </div>
    </div>
  );

  if (!onSelect) return content;

  return (
    <button
      type="button"
      onClick={() => onSelect(account)}
      className={`focus-visible:ring-primary/30 shrink-0 text-left outline-none focus-visible:ring-2 ${
        full ? "w-full rounded-[28px]" : "rounded-2xl"
      }`}
      aria-label={`Buka rekening ${account.name}`}
    >
      {content}
    </button>
  );
}

function getCategoryIcon(code: string): {
  readonly icon: string;
  readonly color: string;
} {
  const normalized = code.toUpperCase();
  if (normalized.includes("MATERIAL"))
    return { icon: "architecture", color: "bg-blue-500/10 text-blue-600" };
  if (normalized.includes("TUKANG") || normalized.includes("LABOR"))
    return { icon: "construction", color: "bg-orange-500/10 text-orange-600" };
  if (normalized.includes("OPERASIONAL") || normalized.includes("OPERATIONAL"))
    return { icon: "local_shipping", color: "bg-green-500/10 text-green-600" };
  if (normalized.includes("SUBCON"))
    return { icon: "handshake", color: "bg-purple-500/10 text-purple-600" };
  return { icon: "more_horiz", color: "bg-slate-500/10 text-slate-600" };
}

function CircularProgress({
  value,
  size = 40,
  strokeWidth = 3.5,
  tone = "positive",
}: {
  readonly value: number;
  readonly size?: number;
  readonly strokeWidth?: number;
  readonly tone?: DashboardTone;
}): React.JSX.Element {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(Math.max(value, 0), 100);
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const toneColor = {
    critical: "stroke-error",
    warning: "stroke-secondary",
    positive: "stroke-primary",
    neutral: "stroke-outline-variant",
  }[tone];

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          className="stroke-outline-variant/40"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <motion.circle
          className={toneColor}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={transitionSpringSmooth}
          strokeLinecap="round"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <span className="text-on-surface absolute font-mono text-[9px] leading-none font-bold">
        {Math.round(percentage)}%
      </span>
    </div>
  );
}

export function CategoryHealthMeter({
  category,
  isFullWidth,
}: {
  readonly category: DashboardCategory;
  readonly isFullWidth?: boolean;
}): React.JSX.Element {
  const tone = categoryTone(category);
  const { icon, color } = getCategoryIcon(category.code);

  return (
    <div
      className={`border-outline-variant/20 top-11/12 flex flex-col justify-between gap-3 rounded-2xl border bg-white p-2 shadow-[0_14px_34px_rgba(17,17,17,0.05)] ${
        isFullWidth ? "col-span-2" : "col-span-1"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full ${color}`}>
          <span className="material-symbols-outlined text-[15px]">{icon}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-on-surface block truncate text-[11px] leading-tight font-extrabold">
            {category.name}
          </span>
        </span>
      </div>

      <div className="mt-0.5 flex items-center justify-between gap-3">
        <CircularProgress value={category.usedPercentage} tone={tone} size={40} strokeWidth={3} />
        <div className="min-w-0 text-right">
          <MoneyValue
            amount={category.remainingAmount}
            variant="compactWithFull"
            tone={category.remainingAmount < 0 ? "danger" : "default"}
            align="right"
            size="xs"
          />
          <span className="text-on-surface-variant/50 mt-0.5 block text-[8px] leading-none font-bold tracking-wider uppercase">
            tersisa
          </span>
        </div>
      </div>
    </div>
  );
}
