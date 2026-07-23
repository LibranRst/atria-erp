import type { FinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";

export type DashboardTone = "critical" | "warning" | "positive" | "neutral";
export type DashboardAction = FinanceDashboardOverview["actions"][number];
export type DashboardRiskyProject = FinanceDashboardOverview["riskyProjects"][number];
export type DashboardCategory = FinanceDashboardOverview["categories"][number];
export type DashboardTransaction = FinanceDashboardOverview["recentTransactions"][number];
export type DashboardPageTab = FinanceDashboardOverview["dashboardTabs"]["defaultTab"];
export type DashboardCashDue = FinanceDashboardOverview["dashboardDetails"]["cashDue"][number];
export type DashboardMaterialIssue =
  FinanceDashboardOverview["dashboardDetails"]["materials"][number];
