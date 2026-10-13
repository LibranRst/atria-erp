import { summarizeApprovals } from "@atria/core/finance/approval-summary";
import { fixtureDesktopPage } from "./dashboard-desktop-fixture";
import {
  buildCashFlowTrend,
  dashboardCashFlowInputSchema,
} from "@atria/core/finance/dashboard-cash-flow";
import { dashboardDesktopInputSchema } from "@atria/core/finance/dashboard-desktop";
/** Loopback-only synthetic API for the unified web review. Never imported by app routes. */
import type { WebRpcOperation, WebRpcResult } from "@atria/api/contract";
import type { FinanceDashboardOverview } from "@atria/core/finance/dashboard-contracts";
import { buildFinanceDashboardCore } from "@atria/core/finance/dashboard-overview";
import superjson from "superjson";
import { z } from "zod";
import {
  createFixtureAPI,
  QA_BRIDGE_SECRET,
  QA_EMAIL,
  QA_PASSWORD,
} from "../../admin/e2e/fixture-api";

export { QA_BRIDGE_SECRET, QA_EMAIL, QA_PASSWORD };

const rpcInputSchema = z.object({ operation: z.string(), args: z.array(z.unknown()) }).strict();
const actorEnvelopeSchema = z.object({
  ok: z.literal(true),
  data: z
    .object({
      userId: z.string(),
      name: z.string(),
      roleName: z.string(),
      mustChangePassword: z.boolean(),
      permissions: z.array(z.string()),
      dataScope: z.enum(["GLOBAL", "ASSIGNED", "NONE"]),
    })
    .nullable(),
});
const categorySchema = z.object({
  code: z.enum(["MATERIAL", "TUKANG", "OPERASIONAL", "LAIN_LAIN", "SUBCON"]),
  name: z.string(),
  allocatedAmount: z.number(),
  pendingAmount: z.number(),
  actualAmount: z.number(),
  paidAmount: z.number(),
  sortOrder: z.number(),
});
const stateSchema = z.object({
  options: z.object({
    empty: z.boolean(),
    onboarding: z.enum(["none", "setup", "review"]),
  }),
  budget: z.object({
    projectId: z.string(),
    projectName: z.string(),
    contractValue: z.number(),
    internalBudget: z.number(),
    targetGrossAmount: z.number(),
    categories: z.array(categorySchema),
  }),
});
type FixtureActor = NonNullable<z.infer<typeof actorEnvelopeSchema>["data"]>;
type FixtureState = z.infer<typeof stateSchema>;
type FinancePage =
  WebRpcResult<"features/finance-dashboard/server/get-finance-dashboard-page-data.getFinanceDashboardPageData">;

function homeDestination(actor: FixtureActor, state: FixtureState): string {
  if (state.options.onboarding === "setup") return "/onboarding?step=welcome";
  if (state.options.onboarding === "review") return "/onboarding/review";
  return actor.permissions.includes("view:ledger") ? "/ledger" : "/projects";
}

function rpcResult<K extends WebRpcOperation>(_operation: K, data: WebRpcResult<K>): Response {
  return new Response(
    superjson.stringify({ ok: true, data, revalidatePaths: [], invalidations: [] }),
    {
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    },
  );
}
function rpcFailure(
  code: "UNAUTHORIZED" | "FORBIDDEN" | "VALIDATION_ERROR",
  message: string,
): Response {
  return new Response(superjson.stringify({ ok: false, error: { code, message } }), {
    status: code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : 400,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/** Uses the same pure calculations as the real API; all input is labelled synthetic. */
function financeOverview(actor: FixtureActor, state: FixtureState): FinanceDashboardOverview {
  const generatedAt = new Date();
  const budget = state.budget;
  const core = buildFinanceDashboardCore({
    decidesCostApprovals: actor.permissions.includes("approve:cost"),
    cashAvailable: state.options.empty ? 0 : 100_000_000,
    receivables: [],
    payables: [],
    projects: state.options.empty
      ? []
      : [
          {
            projectId: budget.projectId,
            projectName: budget.projectName.replace(" Admin", ""),
            financialHealth: "HEALTHY",
            contractValue: budget.contractValue,
            internalBudget: budget.internalBudget,
            targetGrossAmount: budget.targetGrossAmount,
            categories: budget.categories,
          },
          {
            projectId: "10000000-0000-4000-8000-000000000002",
            projectName: "Renovasi Pengujian",
            financialHealth: "WARNING",
            contractValue: 120_000_000,
            internalBudget: 84_000_000,
            targetGrossAmount: 36_000_000,
            categories: [
              {
                code: "MATERIAL",
                name: "Material",
                allocatedAmount: 84_000_000,
                pendingAmount: 0,
                actualAmount: 76_000_000,
                paidAmount: 65_000_000,
                sortOrder: 0,
              },
            ],
          },
        ],
    pendingApprovals: 0,
    materialShortageCount: 0,
    lowStockCount: 0,
    now: generatedAt,
  });
  const overview: FinanceDashboardOverview = {
    ...core,
    role: actor.roleName,
    generatedAt,
    dataQuality: { partial: false, unavailableSources: [] },
    bankAccounts: state.options.empty
      ? []
      : [
          {
            id: "40000000-0000-4000-8000-000000000001",
            name: "Rekening Pengujian",
            bankName: "BANK UJI",
            accountNumber: "0000000000",
            holderName: "Data Sintetis Atria",
            balance: 100_000_000,
            cardColorFrom: "#18181b",
            cardColorTo: "#3a3a40",
            cardTextColor: "light",
            isActive: true,
            recentTransactions: [],
          },
        ],
    dashboardTabs: {
      ...core.dashboardTabs,
      counts: { ...core.dashboardTabs.counts, accounts: state.options.empty ? 0 : 1 },
    },
    dashboardDetails: {
      approvals: [],
      approvalSummary: { totalCount: 0, criticalCount: 0, waitingLongCount: 0, totalAmount: 0 },
      cashDue: [],
      cashDueGroups: [],
      budgetRisks: core.riskyProjects,
      materials: [],
    },
    stockIssues: {
      materialShortageCount: 0,
      lowStockCount: 0,
      totalStockValue: 0,
      reusableStockValue: 0,
    },
    recentTransactions: [],
  };
  if (!state.options.empty && actor.permissions.includes("view:approval_queue")) {
    const approvalPage = fixtureDesktopPage(overview, false, { tab: "approvals", pageSize: 50 });
    if (approvalPage.tab === "approvals")
      return {
        ...overview,
        summary: {
          ...overview.summary,
          payablesOutstanding: 350_000_000,
          receivablesOutstanding: 325_000_000,
          payablesDueSoon: 150_000_000,
        },
        stockIssues: {
          ...overview.stockIssues,
          materialShortageCount: 9,
          lowStockCount: 9,
          totalStockValue: 500_000_000,
          reusableStockValue: 350_000_000,
        },
        dashboardTabs: {
          ...overview.dashboardTabs,
          counts: { ...overview.dashboardTabs.counts, approvals: approvalPage.total },
        },
        dashboardDetails: {
          ...overview.dashboardDetails,
          approvals: approvalPage.rows.slice(0, 5),
          approvalSummary: summarizeApprovals(approvalPage.rows, generatedAt),
        },
      };
  }
  return overview;
}
function financePage(actor: FixtureActor, state: FixtureState): FinancePage {
  if (!actor.permissions.includes("view:ledger")) return { status: "restricted" };
  if (actor.dataScope !== "GLOBAL")
    return { status: "error", message: "Dashboard pengujian memerlukan cakupan global." };
  return {
    status: "ready",
    overview: financeOverview(actor, state),
    userName: actor.name,
    setup: null,
  };
}

const additionalOperations = new Set<string>([
  "app/actions/finance/dashboard-desktop.getFinanceDashboardDesktopTabData",
  "app/actions/finance/dashboard-desktop.getFinanceDashboardCashFlowTrend",
  "features/navigation/server/home-destination.resolveHomeDestination",
  "features/finance-dashboard/server/get-finance-dashboard-page-data.getFinanceDashboardPageData",
  "app/actions/finance/dashboard-overview.getFinanceDashboardOverview",
  "app/actions/auth-navigation.getPostLoginRedirectDestination",
  "app/actions/notifications/get-notifications.getNotificationsAction",
  "app/actions/notifications/list-notifications.listNotificationsAction",
  "app/actions/notifications/mark-read.markNotificationReadAction",
  "app/actions/notifications/mark-read.markAllNotificationsReadAction",
]);

/** Composes the existing isolated auth/Project/Budget fixture, including its exact QA state schema. */
export function createUnifiedFixtureAPI(options: { readonly dashboardReadDelayMs?: number } = {}): {
  readonly fetch: (request: Request) => Promise<Response>;
} {
  const base = createFixtureAPI();
  return {
    fetch: async (request: Request): Promise<Response> => {
      const url = new URL(request.url);
      if (url.pathname !== "/api/internal/web-rpc" || request.method !== "POST")
        return base.fetch(request);
      let input: z.infer<typeof rpcInputSchema>;
      try {
        input = rpcInputSchema.parse(superjson.parse<unknown>(await request.clone().text()));
      } catch {
        return rpcFailure("VALIDATION_ERROR", "Payload pengujian tidak valid.");
      }
      if (!additionalOperations.has(input.operation)) return base.fetch(request);
      if (request.headers.get("x-atria-bridge-secret") !== QA_BRIDGE_SECRET)
        return rpcFailure("UNAUTHORIZED", "Kredensial bridge pengujian tidak valid.");
      try {
        const actorResponse = await base.fetch(
          new Request(url, {
            method: "POST",
            headers: request.headers,
            body: superjson.stringify({ operation: "server/actor.resolveActor", args: [] }),
          }),
        );
        if (!actorResponse.ok) return actorResponse;
        const actor = actorEnvelopeSchema.parse(
          superjson.parse<unknown>(await actorResponse.text()),
        ).data;
        if (!actor) return rpcFailure("UNAUTHORIZED", "Sesi pengujian tidak valid.");
        if (
          actor.mustChangePassword &&
          input.operation === "app/actions/auth-navigation.getPostLoginRedirectDestination"
        )
          return rpcResult(input.operation, "/profile/password");
        if (actor.mustChangePassword)
          return rpcFailure(
            "FORBIDDEN",
            "MUST_CHANGE_PASSWORD: Pengujian memerlukan perubahan kata sandi.",
          );
        const stateResponse = await base.fetch(new Request(new URL("/__qa/state", url)));
        const state = stateSchema.parse(await stateResponse.json());
        if (
          options.dashboardReadDelayMs &&
          [
            "app/actions/finance/dashboard-desktop.getFinanceDashboardDesktopTabData",
            "app/actions/finance/dashboard-desktop.getFinanceDashboardCashFlowTrend",
            "features/finance-dashboard/server/get-finance-dashboard-page-data.getFinanceDashboardPageData",
            "app/actions/finance/dashboard-overview.getFinanceDashboardOverview",
          ].includes(input.operation)
        )
          await new Promise<void>((resolve) => setTimeout(resolve, options.dashboardReadDelayMs));
        switch (input.operation) {
          case "app/actions/finance/dashboard-desktop.getFinanceDashboardDesktopTabData": {
            const query = dashboardDesktopInputSchema.parse(input.args[0]);
            if (
              (query.tab === "budget" && !actor.permissions.includes("view:budget")) ||
              (query.tab === "materials" && !actor.permissions.includes("view:inventory"))
            )
              return rpcResult(input.operation, {
                success: false,
                error: { code: "FORBIDDEN", message: "Akses modul tidak tersedia." },
              });
            if (!actor.permissions.includes("view:ledger") || actor.dataScope !== "GLOBAL")
              return rpcFailure("FORBIDDEN", "Akses tidak tersedia.");
            if (query.tab === "approvals" && !actor.permissions.includes("view:approval_queue"))
              return rpcFailure("FORBIDDEN", "Akses persetujuan tidak tersedia.");
            return rpcResult(input.operation, {
              success: true,
              data: fixtureDesktopPage(financeOverview(actor, state), state.options.empty, query),
            });
          }
          case "app/actions/finance/dashboard-desktop.getFinanceDashboardCashFlowTrend": {
            const query = dashboardCashFlowInputSchema.parse(input.args[0]);
            if (!actor.permissions.includes("view:ledger") || actor.dataScope !== "GLOBAL")
              return rpcFailure("FORBIDDEN", "Akses tidak tersedia.");
            const now = new Date();
            const groups = Array.from({ length: query.months }, (_, i) =>
              state.options.empty
                ? []
                : [
                    {
                      type: "INFLOW",
                      category: "client_payment",
                      referenceType: "client_payment",
                      amount: String(90000000 + i * 7500000),
                      count: 3,
                    },
                    {
                      type: "OUTFLOW",
                      category: "vendor_payment",
                      referenceType: "vendor_payment",
                      amount: String(58000000 + i * 5500000),
                      count: 5,
                    },
                    {
                      type: "INFLOW",
                      category: "correction",
                      referenceType: "manual_cash_movement",
                      amount: "2500000",
                      count: 1,
                    },
                  ],
            );
            return rpcResult(input.operation, {
              success: true,
              data: buildCashFlowTrend(query.months, now, groups),
            });
          }

          case "features/navigation/server/home-destination.resolveHomeDestination":
            return rpcResult(input.operation, homeDestination(actor, state));
          case "features/finance-dashboard/server/get-finance-dashboard-page-data.getFinanceDashboardPageData":
            return rpcResult(input.operation, financePage(actor, state));
          case "app/actions/finance/dashboard-overview.getFinanceDashboardOverview": {
            const page = financePage(actor, state);
            return rpcResult(
              input.operation,
              page.status === "ready"
                ? { success: true, data: page.overview }
                : {
                    success: false,
                    error: {
                      code: "FORBIDDEN",
                      message: "Dashboard pengujian tidak tersedia untuk akses ini.",
                    },
                  },
            );
          }
          case "app/actions/auth-navigation.getPostLoginRedirectDestination": {
            const hints = z
              .object({ returnTo: z.string().optional(), surface: z.literal("mobile").optional() })
              .optional()
              .parse(input.args[0]);
            const home = homeDestination(actor, state);
            const requested = hints?.returnTo;
            const destination =
              requested?.startsWith("/") &&
              !requested.startsWith("//") &&
              !/[\\\r\n]/.test(requested) &&
              state.options.onboarding === "none"
                ? requested
                : home;
            const target = new URL(destination, "https://atria.invalid");
            if (hints?.surface === "mobile") target.searchParams.set("surface", "mobile");
            return rpcResult(input.operation, `${target.pathname}${target.search}${target.hash}`);
          }
          case "app/actions/notifications/get-notifications.getNotificationsAction":
            return rpcResult(input.operation, {
              success: true,
              data: {
                unreadCount: 0,
                actionRequiredCount: 0,
                informationalUnreadCount: 0,
                items: [],
              },
            });
          case "app/actions/notifications/list-notifications.listNotificationsAction":
            return rpcResult(input.operation, {
              success: true,
              data: { items: [], hasMore: false, nextCursor: null },
            });
          case "app/actions/notifications/mark-read.markNotificationReadAction":
            z.object({ id: z.string().min(1) }).parse(input.args[0]);
            return rpcResult(input.operation, { success: true, data: { success: true } });
          case "app/actions/notifications/mark-read.markAllNotificationsReadAction":
            return rpcResult(input.operation, { success: true, data: { success: true } });
        }
        return base.fetch(request);
      } catch {
        return rpcFailure("VALIDATION_ERROR", "Data pengujian tidak valid.");
      }
    },
  };
}

if (import.meta.main) {
  const port = z.coerce
    .number()
    .int()
    .min(1024)
    .max(65535)
    .parse(process.env.ATRIA_QA_API_PORT ?? "3441");
  const dashboardReadDelayMs = z.coerce
    .number()
    .min(0)
    .max(10000)
    .parse(process.env.ATRIA_QA_DASHBOARD_READ_DELAY_MS ?? "0");
  const api = createUnifiedFixtureAPI({ dashboardReadDelayMs });
  Bun.serve({ hostname: "127.0.0.1", port, fetch: api.fetch });
  console.log(`Synthetic unified web QA API listening on http://127.0.0.1:${port}`);
}
