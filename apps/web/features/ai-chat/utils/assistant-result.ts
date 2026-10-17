import type { UIMessage } from "ai";
import { z } from "zod";
import { requestUserInputSchema } from "@atria/core/ai/input-request";
import {
  getBankBalancesOutputSchema,
  getExpenseCategoriesOutputSchema,
  getMaterialShortageOutputSchema,
  getPendingApprovalsOutputSchema,
  getProjectBudgetOutputSchema,
  getProjectHealthOutputSchema,
  getProjectsAtRiskOutputSchema,
  getRecentExpensesOutputSchema,
  getUpcomingBillsOutputSchema,
  listProjectsOutputSchema,
  moneySchema,
  roleReviewOutputSchema,
} from "@atria/core/ai/tool-output";
import { readAnyProposal } from "./proposal-reader";
import { toolNameFromPartType } from "./tool-labels";

const unsupportedFactsSchema = z.object({
  status: z.literal("error"),
  sources: z.array(z.unknown()).length(0),
});
const vendorsSchema = z.object({
  vendors: z
    .array(
      z.object({
        vendorId: z.string(),
        name: z.string(),
        email: z.string().optional(),
        phone: z.string().optional(),
        bankName: z.string().optional(),
      }),
    )
    .min(1),
});
const clientsSchema = z.object({
  clients: z
    .array(
      z.object({
        clientId: z.string(),
        name: z.string(),
        companyName: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
      }),
    )
    .min(1),
});
const materialsSchema = z.object({
  materials: z
    .array(
      z.object({
        materialId: z.string(),
        name: z.string(),
        code: z.string(),
        unit: z.string(),
        categoryName: z.string(),
        totalStockOnHand: z.number(),
        totalAvailableStock: z.number(),
        averageCost: moneySchema,
      }),
    )
    .min(1),
});
const invoicesSchema = z.object({
  invoices: z
    .array(
      z.object({
        invoiceId: z.string(),
        invoiceNumber: z.string(),
        projectName: z.string(),
        clientName: z.string(),
        amount: moneySchema,
        status: z.string(),
        dueDate: z.string().nullable(),
      }),
    )
    .min(1),
});
const pendingExpensesSchema = z.object({
  pendingExpenses: z
    .array(
      z.object({
        expenseId: z.string(),
        projectName: z.string(),
        description: z.string(),
        amount: moneySchema,
        submittedBy: z.string(),
        expenseDate: z.string(),
      }),
    )
    .min(1),
});

/** Match existing read-card visibility, without importing React or its renderers. */
function hasReadCard(toolName: string, output: unknown): boolean {
  switch (toolName) {
    case "listProjects": {
      const parsed = listProjectsOutputSchema.safeParse(output);
      return parsed.success && parsed.data.projects.length > 0;
    }
    case "getProjectsAtRisk":
      // This renderer explicitly shows a useful all-safe result for an empty list.
      return getProjectsAtRiskOutputSchema.safeParse(output).success;
    case "getProjectBudget": {
      const parsed = getProjectBudgetOutputSchema.safeParse(output);
      return parsed.success && parsed.data.categories.length > 0;
    }
    case "getProjectHealth":
      return getProjectHealthOutputSchema.safeParse(output).success;
    case "getBankBalances": {
      const parsed = getBankBalancesOutputSchema.safeParse(output);
      return parsed.success && parsed.data.accounts.length > 0;
    }
    case "getPendingApprovals": {
      const parsed = getPendingApprovalsOutputSchema.safeParse(output);
      return parsed.success && parsed.data.approvals.length > 0;
    }
    case "getUpcomingBills":
    case "getUnpaidVendorBills": {
      const parsed = getUpcomingBillsOutputSchema.safeParse(output);
      return parsed.success && parsed.data.bills.length > 0;
    }
    case "getMaterialShortage": {
      const parsed = getMaterialShortageOutputSchema.safeParse(output);
      return parsed.success && parsed.data.shortages.length > 0;
    }
    case "getRecentExpenses": {
      const parsed = getRecentExpensesOutputSchema.safeParse(output);
      return parsed.success && parsed.data.expenses.length > 0;
    }
    case "getExpenseCategories": {
      const parsed = getExpenseCategoriesOutputSchema.safeParse(output);
      return parsed.success && parsed.data.categories.length > 0;
    }
    case "listVendors":
      return vendorsSchema.safeParse(output).success;
    case "listClients":
      return clientsSchema.safeParse(output).success;
    case "getMaterialCatalog":
      return materialsSchema.safeParse(output).success;
    case "getUnpaidClientInvoices":
      return invoicesSchema.safeParse(output).success;
    case "getPendingExpenseApprovals":
      return pendingExpensesSchema.safeParse(output).success;
    case "suggestRoleReview":
      return roleReviewOutputSchema.safeParse(output).success;
    default:
      return false;
  }
}

/**
 * Progress, model commentary and background reads are not a completed reply.
 * Only content the user can actually read or act on satisfies pending recovery.
 */
export function hasCompletedAssistantResult(message: UIMessage): boolean {
  if (message.role !== "assistant") return false;
  const suppressReadCards = message.parts.some(
    (part): boolean =>
      part.type === "data-grounded-facts" &&
      "data" in part &&
      unsupportedFactsSchema.safeParse(part.data).success,
  );
  return message.parts.some((part): boolean => {
    if (part.type === "text") return part.text.trim().length > 0;
    const toolName = toolNameFromPartType(part.type);
    if (!toolName || !("state" in part) || part.state !== "output-available" || !("output" in part))
      return false;
    const output: unknown = part.output;
    if (typeof output === "object" && output !== null && "error" in output) return false;
    if (readAnyProposal(output)) return true;
    if (toolName === "requestUserInput") return requestUserInputSchema.safeParse(output).success;
    return !suppressReadCards && hasReadCard(toolName, output);
  });
}
