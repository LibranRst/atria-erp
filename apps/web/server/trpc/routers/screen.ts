import "server-only";

import { getApprovalsPageData } from "@/features/approvals/server/get-approvals-page-data";
import { getExpensesPageData } from "@/features/expenses/server/get-expenses-page-data";
import { getNewExpensePageData } from "@/features/expenses/server/get-new-expense-page-data";
import { getFinanceDashboardPageData } from "@/features/finance-dashboard/server/get-finance-dashboard-page-data";
import { getMobileHomeRoute } from "@/features/navigation/server/get-mobile-home-route";
import { getProjectListPageData } from "@/features/projects/list/server/get-project-list-page-data";
import { createTRPCRouter } from "@/server/trpc/init";
import { activeProcedure } from "@/server/trpc/procedures";
import { getProjectOverviewData } from "@/server/usecases/project/get-project-overview";
import { projectOverviewInputSchema } from "@atria/core/validations/project";

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
  home: activeProcedure.query(({ ctx }) => getMobileHomeRoute(ctx.actor!)),
  ledger: activeProcedure.query(({ ctx }) => getFinanceDashboardPageData(ctx.actor!)),
  approvals: activeProcedure.query(({ ctx }) => getApprovalsPageData(ctx.actor!)),
  expenses: activeProcedure.query(({ ctx }) => getExpensesPageData(ctx.actor!)),
  newExpense: activeProcedure.query(({ ctx }) => getNewExpensePageData(ctx.actor!)),
  projects: activeProcedure.query(({ ctx }) => getProjectListPageData(ctx.actor!)),
  projectOverview: activeProcedure
    .input(projectOverviewInputSchema)
    .query(({ ctx, input }) => getProjectOverviewData(ctx.actor!, input.projectId)),
});
