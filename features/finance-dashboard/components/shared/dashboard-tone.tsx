"use client";

import React from "react";

import type {
  DashboardCategory,
  DashboardRiskyProject,
  DashboardTone,
} from "@/features/finance-dashboard/types/dashboard-types";

export function dashboardToneClasses(tone: DashboardTone): {
  readonly surface: string;
  readonly icon: string;
  readonly progress: string;
  readonly text: string;
} {
  if (tone === "critical") {
    return {
      surface: "bg-error-container/15 ring-1 ring-error/10",
      icon: "bg-error text-white",
      progress: "bg-error",
      text: "text-error",
    };
  }
  if (tone === "warning") {
    return {
      surface: "bg-secondary-container/15 ring-1 ring-secondary/10",
      icon: "bg-secondary text-white",
      progress: "bg-secondary",
      text: "text-secondary",
    };
  }
  if (tone === "positive") {
    return {
      surface: "bg-primary/5 ring-1 ring-primary/10",
      icon: "bg-primary text-on-primary",
      progress: "bg-primary",
      text: "text-primary",
    };
  }
  return {
    surface: "bg-surface-container-low ring-1 ring-outline-variant/10",
    icon: "bg-white text-on-surface-variant shadow-sm",
    progress: "bg-primary",
    text: "text-on-surface",
  };
}

export function severityTone(severity: string): DashboardTone {
  return severity === "CRITICAL" ? "critical" : "warning";
}

export function projectTone(project: DashboardRiskyProject): DashboardTone {
  if (project.effectiveHealth === "CRITICAL") return "critical";
  if (project.effectiveHealth === "HEALTHY") return "positive";
  return "warning";
}

export function categoryTone(category: DashboardCategory): DashboardTone {
  if (category.status === "OVER_BUDGET" || category.status === "CRITICAL") return "critical";
  if (category.status === "WATCH") return "warning";
  return "positive";
}

export function ProgressBar({
  value,
  tone = "positive",
  className = "mt-3",
}: {
  readonly value: number;
  readonly tone?: DashboardTone;
  readonly className?: string;
}): React.JSX.Element {
  const classes = dashboardToneClasses(tone);
  return (
    <div className={`${className} h-1.5 overflow-hidden rounded-full bg-white/90`}>
      <div
        className={`h-full rounded-full ${classes.progress}`}
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  );
}
