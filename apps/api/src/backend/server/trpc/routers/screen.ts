import { getApprovalsPageData } from "@backend/features/approvals/server/get-approvals-page-data";
import { getExpensesPageData } from "@backend/features/expenses/server/get-expenses-page-data";
import { getNewExpensePageData } from "@backend/features/expenses/server/get-new-expense-page-data";
import { getFinanceDashboardPageData } from "@backend/features/finance-dashboard/server/get-finance-dashboard-page-data";
import { getMobileHomeRoute } from "@backend/features/navigation/server/get-mobile-home-route";
import { getProjectListPageData } from "@backend/features/projects/list/server/get-project-list-page-data";
import { createTRPCRouter } from "@backend/server/trpc/init";
import { activeProcedure } from "@backend/server/trpc/procedures";
import { getProjectOverviewData } from "@backend/server/usecases/project/get-project-overview";
import { projectOverviewInputSchema } from "@atria/core/validations/project";
import { selectMobileCapabilities } from "@atria/core/auth/mobile-capabilities";
import { cashActivityDetailRequestSchema } from "@atria/core/activity-detail/validation";
import { getCashActivityDetail } from "@backend/server/usecases/finance/get-cash-activity-detail";
import { TRPCError } from "@backend/server/trpc/init";

/**
 * Bootstrap per layar: satu query untuk satu layar, memakai loader yang sama
 * dengan halaman web-nya. Karena sumbernya satu, bentuk data mobile tidak bisa
 * menyimpang dari web.
 *
 * Loader melaporkan `status` (`ready` / `restricted` / `error`) alih-alih
 * melakukan `redirect()`, sehingga klien native bisa menerjemahkannya jadi
 * layar kosong yang sesuai.
 */
export const screenRouter = createTRPCRouter({
  capabilities: activeProcedure.query(({ ctx }) => selectMobileCapabilities(ctx.actor)),
  home: activeProcedure.query(({ ctx }) => getMobileHomeRoute(ctx.actor!)),
  ledger: activeProcedure.query(({ ctx }) => getFinanceDashboardPageData(ctx.actor!)),
  activityDetail: activeProcedure
    .meta({ permission: "view:ledger" })
    .input(cashActivityDetailRequestSchema)
    .query(async ({ ctx, input }) => {
      if (!ctx.actor) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sesi tidak valid." });
      const result = await getCashActivityDetail(ctx.actor, input.id);
      if (!result.success && result.error.code === "FORBIDDEN")
        throw new TRPCError({ code: "FORBIDDEN", message: result.error.message });
      return result;
    }),
  approvals: activeProcedure.query(({ ctx }) => getApprovalsPageData(ctx.actor!)),
  expenses: activeProcedure.query(({ ctx }) => getExpensesPageData(ctx.actor!)),
  newExpense: activeProcedure.query(({ ctx }) => getNewExpensePageData(ctx.actor!)),
  projects: activeProcedure.query(({ ctx }) => getProjectListPageData(ctx.actor!)),
  projectOverview: activeProcedure
    .input(projectOverviewInputSchema)
    .query(({ ctx, input }) => getProjectOverviewData(ctx.actor!, input.projectId)),
});
