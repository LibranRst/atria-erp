import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { bankAccount, projectCost } from "@/db/schema";
import type { ApprovalDetail } from "@atria/core/finance/approval-types";
import { getPendingApprovalDetails, rankPendingApprovals } from "@/lib/finance/approval-details";
import type { Actor } from "@/server/actor";

export type ApprovalsPageData =
  | {
      readonly status: "restricted";
    }
  | {
      readonly status: "ready";
      readonly approvals: readonly ApprovalDetail[];
      readonly canEmergencyOverride: boolean;
      readonly referenceDateIso: string;
      readonly bankAccounts: readonly {
        readonly id: string;
        readonly name: string;
        readonly bankName: string;
        readonly accountNumber: string;
        readonly balance: string;
      }[];
      readonly paymentCandidates: readonly {
        readonly id: string;
        readonly amount: string;
        readonly description: string;
        readonly budgetOverrun: boolean;
        readonly projectName: string;
      }[];
    };

export async function getApprovalsPageData(actor: Actor): Promise<ApprovalsPageData> {
  const roleName = actor.roleName;
  if (roleName !== "OWNER" && roleName !== "FINANCE_ADMIN") {
    return { status: "restricted" };
  }

  const referenceDate = new Date();
  const [pendingDetails, accounts, payableCosts] = await Promise.all([
    getPendingApprovalDetails(),
    db.query.bankAccount.findMany({
      where: eq(bankAccount.isActive, true),
      orderBy: [desc(bankAccount.balance)],
    }),
    db.query.projectCost.findMany({
      where: eq(projectCost.status, "APPROVED"),
      with: { project: true },
      orderBy: [desc(projectCost.updatedAt)],
    }),
  ]);
  const approvals = rankPendingApprovals(pendingDetails, referenceDate);

  return {
    status: "ready",
    approvals:
      roleName === "FINANCE_ADMIN"
        ? approvals.filter((item) => item.type === "inventory_opening")
        : approvals,
    canEmergencyOverride: roleName === "OWNER",
    referenceDateIso: referenceDate.toISOString(),
    bankAccounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      balance: account.balance,
    })),
    paymentCandidates: payableCosts.map((cost) => ({
      id: cost.id,
      amount: cost.amount,
      description: cost.description,
      budgetOverrun: cost.budgetOverrun,
      projectName: cost.project?.name ?? "Proyek tidak tersedia",
    })),
  };
}
