import { roleNameHasPermission, getRoleDataScopeByName } from "@backend/lib/auth/role-access";
import { desc, eq } from "drizzle-orm";
import { db } from "@backend/db";
import { auditLog } from "@backend/db/schema";
import { assertProjectAccess } from "@backend/lib/auth/scoping";
import type { ActivityFact, ActivityStatusTone } from "@atria/core/activity-detail/types";

export type ActivityUser = { readonly id: string; readonly roleId: string };
export type AuditEvidence = { readonly actorName: string; readonly action: string } | null;

export function statusTone(status: string): ActivityStatusTone {
  const value = status.toUpperCase();
  if (["POSTED", "PAID", "COMPLETED", "APPROVED", "VERIFIED", "RECONCILED"].includes(value))
    return "SUCCESS";
  if (["REJECTED", "FAILED", "VOID", "REVERSED", "OVERDUE"].includes(value)) return "DANGER";
  if (["PENDING", "PENDING_APPROVAL", "SUBMITTED", "PROCESSING", "DRAFT"].includes(value))
    return "PENDING";
  if (["PARTIALLY_PAID", "ADJUSTMENT", "WASTE"].includes(value)) return "WARNING";
  return "NEUTRAL";
}

export function fact(label: string, value: ActivityFact["value"]): ActivityFact {
  return { label, value };
}

export function total(
  items: readonly { readonly quantity: string; readonly unitCost: string }[],
): number {
  return items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitCost), 0);
}

export async function latestAudit(targetTable: string, targetId: string): Promise<AuditEvidence> {
  const row = await db.query.auditLog.findFirst({
    where: (table, { and }) =>
      and(eq(table.targetTable, targetTable), eq(table.targetId, targetId)),
    with: { user: { columns: { name: true } } },
    orderBy: [desc(auditLog.createdAt)],
    columns: { action: true },
  });
  return row ? { actorName: row.user.name, action: row.action } : null;
}

export async function requireProject(
  projectId: string,
  user: ActivityUser,
  roleName: string,
): Promise<void> {
  await assertProjectAccess(projectId, user.id, roleName);
}

export async function enforceAssignedProject(
  projectId: string,
  user: ActivityUser,
  roleName: string,
): Promise<void> {
  if ((await getRoleDataScopeByName(roleName)) === "ASSIGNED") {
    await requireProject(projectId, user, roleName);
  }
}

export async function canLinkProject(roleName: string): Promise<boolean> {
  return await roleNameHasPermission(roleName, "view:project");
}
