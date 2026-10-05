import type { db } from "@backend/db";
import { project } from "@backend/db/schema";
import { actorCan } from "@backend/lib/auth/permissions";
import type { Actor } from "@backend/server/actor";
import type { PermissionKey } from "@atria/core/auth/permissions";
import { eq } from "drizzle-orm";

export type FinanceTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function assertFinancePermission(actor: Actor, permission: PermissionKey): void {
  if (!actorCan(actor, permission) || actor.dataScope === "NONE") {
    throw new Error("FORBIDDEN: Anda tidak memiliki akses untuk tindakan ini.");
  }
}

/** Keep project assignment stable while the protected mutation is in flight. */
export async function lockFinanceProject(
  tx: FinanceTransaction,
  actor: Actor,
  projectId: string,
): Promise<typeof project.$inferSelect> {
  const [record] = await tx.select().from(project).where(eq(project.id, projectId)).for("update");
  if (!record) throw new Error("PROJECT_NOT_FOUND");
  if (
    actor.dataScope === "NONE" ||
    (actor.dataScope === "ASSIGNED" && record.projectManagerId !== actor.userId)
  ) {
    throw new Error("FORBIDDEN: Anda tidak ditugaskan pada proyek ini.");
  }
  return record;
}
