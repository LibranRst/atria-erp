import { createTRPCRouter } from "@backend/server/trpc/init";
import { activeProcedure } from "@backend/server/trpc/procedures";
import { payFieldRequestUseCase } from "@backend/server/usecases/finance/pay-field-request";
import { saveExpenseDraftUseCase } from "@backend/server/usecases/finance/save-expense-draft";
import { submitExpenseDraftUseCase } from "@backend/server/usecases/finance/submit-expense-draft";
import {
  saveExpenseDraftSchema,
  submitExpenseDraftSchema,
} from "@atria/core/validations/expense-draft";
import { payFieldRequestSchema } from "@atria/core/validations/finance";

/**
 * Cerminan `app/actions/finance/**`. Setiap prosedur hanya mendelegasikan ke
 * use-case yang sama dengan Server Action-nya — tidak boleh ada logika bisnis
 * di lapisan ini.
 */
export const financeRouter = createTRPCRouter({
  saveExpenseDraft: activeProcedure
    .meta({ permission: "create:cost" })
    .input(saveExpenseDraftSchema)
    .mutation(({ ctx, input }) => saveExpenseDraftUseCase(ctx.actor!, input)),
  submitExpenseDraft: activeProcedure
    .meta({ permission: "create:cost" })
    .input(submitExpenseDraftSchema)
    .mutation(({ ctx, input }) => submitExpenseDraftUseCase(ctx.actor!, input)),
  payFieldRequest: activeProcedure
    .meta({ permission: "pay:cost" })
    .input(payFieldRequestSchema)
    .mutation(({ ctx, input }) => payFieldRequestUseCase(ctx.actor!, input)),
});
