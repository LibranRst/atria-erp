import superjson from "superjson";
import {
  getFinanceDashboardCashFlowTrend,
  getFinanceDashboardDesktopTabData,
} from "@/app/actions/finance/dashboard-desktop";
import { dashboardCashFlowInputSchema } from "@atria/core/finance/dashboard-cash-flow";
import { dashboardDesktopInputSchema } from "@atria/core/finance/dashboard-desktop";
import type { DashboardDesktopData } from "@atria/core/finance/dashboard-desktop";
import type { DashboardCashFlowTrend } from "@atria/core/finance/dashboard-cash-flow";
import type { ActionResponse } from "@atria/core/types/action-response";

/** Read-only route keeps late Server Action Flight payloads out of tab navigation. */
export async function GET(request: Request): Promise<Response> {
  try {
    return await readDashboard(request);
  } catch (error) {
    console.error("Desktop dashboard read failed", error);
    return new Response(
      superjson.stringify({
        success: false,
        error: { code: "INTERNAL_SERVER_ERROR", message: "Data Dashboard belum dapat dimuat." },
      }),
      {
        status: 500,
        headers: { "content-type": "application/json", "cache-control": "private, no-store" },
      },
    );
  }
}
async function readDashboard(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  let result: ActionResponse<DashboardDesktopData | DashboardCashFlowTrend>;
  if (params.get("kind") === "trend") {
    const input = dashboardCashFlowInputSchema.safeParse({
      months: Number(params.get("months") ?? 6),
    });
    if (!input.success)
      return new Response(
        superjson.stringify({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Rentang tidak valid." },
        }),
        { status: 400 },
      );
    result = await getFinanceDashboardCashFlowTrend(input.data);
  } else {
    const input = dashboardDesktopInputSchema.safeParse({
      tab: params.get("tab"),
      page: Number(params.get("page") ?? 1),
      pageSize: Number(params.get("pageSize") ?? 10),
      search: params.get("search") ?? "",
      filter: params.get("filter") ?? "all",
      bucket: params.get("bucket") ?? "all",
      sort: params.get("sort") ?? "priority",
      direction: params.get("direction") ?? "ascending",
    });
    if (!input.success)
      return new Response(
        superjson.stringify({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Filter tidak valid." },
        }),
        { status: 400 },
      );
    result = await getFinanceDashboardDesktopTabData(input.data);
  }
  return new Response(superjson.stringify(result), {
    status: result.success
      ? 200
      : result.error.code === "FORBIDDEN"
        ? 403
        : result.error.code === "UNAUTHORIZED"
          ? 401
          : 500,
    headers: { "content-type": "application/json", "cache-control": "private, no-store" },
  });
}
