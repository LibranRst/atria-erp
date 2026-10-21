import { actorCan } from "@backend/lib/auth/permissions";
import { getFieldCostApprovalThresholdRupiah } from "@backend/lib/finance/approval-thresholds";
import { desc, eq } from "drizzle-orm";

import { db } from "@backend/db";
import { bankAccount, projectCost, projectChangeOrder } from "@backend/db/schema";
import type { ApprovalDetail } from "@atria/core/finance/approval-types";
import {
  getPendingApprovalDetails,
  rankPendingApprovals,
} from "@backend/lib/finance/approval-details";

import type { Actor } from "@backend/server/actor";

export type PendingChangeOrderSummary = {
  readonly id: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly valueDelta: string;
  readonly reason: string;
  readonly createdByName: string;
  readonly createdAt: string;
  readonly baseRevision: number;
  readonly revisedRevision: number;
};

export type ApprovalsPageData =
  | {
      readonly status: "restricted";
    }
  | {
      readonly status: "ready";
      readonly approvals: readonly ApprovalDetail[];
      readonly pendingChangeOrders: readonly PendingChangeOrderSummary[];
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
  if (!actorCan(actor, "view:approval_queue") || actor.dataScope !== "GLOBAL") {
    return { status: "restricted" };
  }

  const referenceDate = new Date();
  const canApproveRab = actorCan(actor, "approve:rab");
  const [pendingDetails, accounts, payableCosts, rawChangeOrders] = await Promise.all([
    getPendingApprovalDetails(),
    actorCan(actor, "view:bank_account")
      ? db.query.bankAccount.findMany({
          where: eq(bankAccount.isActive, true),
          orderBy: [desc(bankAccount.balance)],
        })
      : Promise.resolve([]),
    actorCan(actor, "pay:cost") && actorCan(actor, "view:cost")
      ? db.query.projectCost.findMany({
          where: eq(projectCost.status, "APPROVED"),
          with: { project: true },
          orderBy: [desc(projectCost.updatedAt)],
        })
      : Promise.resolve([]),
    canApproveRab
      ? db.query.projectChangeOrder.findMany({
          where: eq(projectChangeOrder.status, "PENDING_APPROVAL"),
          with: {
            project: { columns: { id: true, name: true } },
            createdBy: { columns: { name: true } },
            baseRab: { columns: { revision: true } },
            revisedRab: { columns: { revision: true } },
          },
          orderBy: [desc(projectChangeOrder.createdAt)],
        })
      : Promise.resolve([]),
  ]);
  const approvals = rankPendingApprovals(
    pendingDetails,
    referenceDate,
    await getFieldCostApprovalThresholdRupiah(),
  );

  const pendingChangeOrders: PendingChangeOrderSummary[] = rawChangeOrders.map((order) => ({
    id: order.id,
    projectId: order.projectId,
    projectName: order.project?.name ?? "Proyek",
    valueDelta: order.valueDelta,
    reason: order.reason,
    createdByName: order.createdBy?.name ?? "Staff",
    createdAt: order.createdAt.toISOString(),
    baseRevision: order.baseRab?.revision ?? 1,
    revisedRevision: order.revisedRab?.revision ?? 2,
  }));

  return {
    status: "ready",
    approvals: actorCan(actor, "decide:all_approvals")
      ? approvals
      : approvals.filter((item) => item.type === "inventory_opening"),
    pendingChangeOrders,
    canEmergencyOverride: actorCan(actor, "override:self_approval"),
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
