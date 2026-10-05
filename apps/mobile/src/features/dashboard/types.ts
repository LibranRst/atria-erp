import type { trpcClient } from "@/lib/trpc-client";

export type DashboardReady = Extract<
  Awaited<ReturnType<typeof trpcClient.screen.ledger.query>>,
  { readonly status: "ready" }
>;
export type DashboardOverview = DashboardReady["overview"];
export type CashDue = DashboardOverview["dashboardDetails"]["cashDue"][number];
export type MaterialIssue = DashboardOverview["dashboardDetails"]["materials"][number];
export type RiskyProject = DashboardOverview["riskyProjects"][number];
export type CashTransaction = DashboardOverview["recentTransactions"][number];
