import type { ProjectOverviewTab } from "../components/overview/project-overview";

export const fullMoney = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function shortMoney(value: number): string {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (absolute >= 1_000_000_000)
    return `${sign}Rp ${(absolute / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`;
  if (absolute >= 1_000_000)
    return `${sign}Rp ${(absolute / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  return `${sign}Rp ${absolute.toLocaleString("id-ID")}`;
}

export function statusTone(status: string): "APPROVED" | "DRAFT" | "WARNING" | "CRITICAL" {
  if (status === "CRITICAL" || status === "OVER_BUDGET") return "CRITICAL";
  if (status === "WARNING" || status === "WATCH" || status === "ON_HOLD") return "WARNING";
  if (status === "DRAFT") return "DRAFT";
  return "APPROVED";
}

export function categoryTab(code: string): ProjectOverviewTab {
  if (code === "OPERASIONAL" || code === "LAIN_LAIN") return "expenses";
  return "rap";
}

export function fallbackProjectGradient(projectName: string): string {
  const fallbackGradients = [
    "bg-linear-to-tr from-neutral-900 via-neutral-800 to-neutral-700",
    "bg-linear-to-tr from-slate-900 via-slate-800 to-slate-700",
    "bg-linear-to-tr from-zinc-900 via-zinc-800 to-zinc-700",
  ];
  return fallbackGradients[projectName.length % fallbackGradients.length];
}
