import superjson from "superjson";
import type { ActionResponse } from "@atria/core/types/action-response";
import type {
  DashboardDesktopInput,
  DashboardDesktopData,
} from "@atria/core/finance/dashboard-desktop";
import type { DashboardCashFlowTrend } from "@atria/core/finance/dashboard-cash-flow";
async function read<T>(params: URLSearchParams): Promise<ActionResponse<T>> {
  const response = await fetch(`/api/finance/dashboard-desktop?${params.toString()}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  return superjson.parse<ActionResponse<T>>(await response.text());
}
export function readDesktopDashboard(
  input: DashboardDesktopInput,
): Promise<ActionResponse<DashboardDesktopData>> {
  const params = new URLSearchParams(
    Object.entries(input).map(([key, value]) => [key, String(value)]),
  );
  return read<DashboardDesktopData>(params);
}
export function readDesktopCashFlow(
  months: 6 | 12,
): Promise<ActionResponse<DashboardCashFlowTrend>> {
  return read<DashboardCashFlowTrend>(
    new URLSearchParams({ kind: "trend", months: String(months) }),
  );
}
