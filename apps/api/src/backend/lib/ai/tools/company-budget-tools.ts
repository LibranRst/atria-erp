import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { db } from "@backend/db";
import { calculateTargetGross } from "@atria/core/budget/excel-budget";
import { getCompanyIdentity } from "@backend/lib/company/identity";
import {
  readBudgetAllocationSnapshot,
  type BudgetAllocationSnapshot,
} from "@backend/lib/budget/allocation-defaults";
import {
  companyBudgetPolicySchema,
  type CompanyBudgetPolicy,
} from "@atria/core/ai/company-budget-policy";
import { hasPermission, type AiToolContext } from "./context";

type PolicyReader = {
  readonly readAllocation: () => Promise<BudgetAllocationSnapshot>;
  readonly readCompany: () => Promise<{ readonly name: string }>;
};
const policyReader: PolicyReader = {
  readAllocation: () => readBudgetAllocationSnapshot(db),
  readCompany: getCompanyIdentity,
};

export async function readCompanyBudgetPolicy(
  context: AiToolContext,
  reader: PolicyReader = policyReader,
): Promise<CompanyBudgetPolicy> {
  if (!hasPermission(context, "view:settings")) {
    return {
      status: "forbidden",
      message: "Peran Anda tidak memiliki akses ke Pengaturan Budget perusahaan.",
    };
  }
  try {
    const [snapshot, company] = await Promise.all([reader.readAllocation(), reader.readCompany()]);
    if (!snapshot.settingId || snapshot.settingName === null) {
      return {
        status: "unconfigured",
        message:
          "Pengaturan Budget aktif belum lengkap. Nilai fallback aplikasi bukan kebijakan perusahaan yang telah ditetapkan.",
      };
    }
    return companyBudgetPolicySchema.parse({
      status: "configured",
      companyName: company.name,
      source: {
        label: "Pengaturan Budget",
        href: "/settings/budget",
        settingId: snapshot.settingId,
        settingName: snapshot.settingName,
      },
      budgetCapRatio: snapshot.budgetCapRatio,
      targetGrossMarginPercentage:
        Math.round(calculateTargetGross(100, snapshot.budgetCapRatio * 100).percentage * 10_000) /
        10_000,
      categories: snapshot.categories.map(({ code, name, ratioPercentage }) => ({
        code,
        name,
        ratioPercentage,
      })),
    });
  } catch {
    return {
      status: "unavailable",
      message:
        "Pengaturan Budget belum dapat dibaca. Jangan menebak target margin perusahaan dari nilai default atau proyek lain.",
    };
  }
}

export function buildCompanyBudgetTools(context: AiToolContext): ToolSet {
  return {
    getCompanyBudgetDefaults: tool({
      description:
        "Read the active company's budget cap, derived target gross margin and category allocation defaults from Settings. Use for company policy/default questions, never infer policy from a project's budget or industry assumptions. Read-only; reports missing/unavailable Settings explicitly.",
      inputSchema: z.object({}),
      execute: async () => {
        const policy = await readCompanyBudgetPolicy(context);
        return policy.status === "configured" ? policy : { ...policy, error: policy.message };
      },
    }),
  };
}
