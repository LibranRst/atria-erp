import { z } from "zod";

export const companyBudgetPolicySchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("configured"),
    companyName: z.string(),
    source: z.object({
      label: z.literal("Pengaturan Budget"),
      href: z.literal("/settings/budget"),
      settingId: z.string(),
      settingName: z.string(),
    }),
    budgetCapRatio: z.number().positive().max(1),
    targetGrossMarginPercentage: z.number().min(0).max(100),
    categories: z.array(
      z.object({
        code: z.string(),
        name: z.string(),
        ratioPercentage: z.number().min(0).max(1),
      }),
    ),
  }),
  z.object({
    status: z.enum(["unconfigured", "unavailable", "forbidden"]),
    message: z.string(),
  }),
]);

export type CompanyBudgetPolicy = z.infer<typeof companyBudgetPolicySchema>;
