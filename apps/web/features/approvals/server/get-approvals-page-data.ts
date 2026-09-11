import { getFieldCostApprovalThresholdRupiah } from "@/lib/finance/approval-thresholds";
import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { bankAccount, projectCost, projectChangeOrder } from "@/db/schema";
import type { ApprovalDetail } from "@atria/core/finance/approval-types";
import { getPendingApprovalDetails, rankPendingApprovals } from "@/lib/finance/approval-details";
import { actorHasPermission } from "@atria/core/auth/permissions";
import type { Actor } from "@/server/actor";

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
  const roleName = actor.roleName;
  if (!actorHasPermission(roleName, "view:approval_queue")) {
    return { status: "restricted" };
  }

  const referenceDate = new Date();
  const canApproveRab = actorHasPermission(roleName, "approve:rab");
  const [pendingDetails, accounts, payableCosts, rawChangeOrders] = await Promise.all([
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
    approvals: actorHasPermission(roleName, "decide:all_approvals")
      ? approvals
      : approvals.filter((item) => item.type === "inventory_opening"),
    pendingChangeOrders,
    canEmergencyOverride: actorHasPermission(roleName, "override:self_approval"),
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
