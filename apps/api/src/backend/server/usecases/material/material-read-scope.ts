import { and, eq, inArray, isNull, or, type AnyColumn, type SQL } from "drizzle-orm";
import { db } from "@backend/db";
import { INSTANCE_TENANT_ID, project } from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";

export type MaterialReadActor = Pick<Actor, "userId" | "permissions" | "dataScope">;

/** Warehouse operators may work across projects; ASSIGNED always keeps its assignment boundary. */
export function materialProjectScope(actor: MaterialReadActor): SQL | undefined {
  return and(
    eq(project.tenantId, INSTANCE_TENANT_ID),
    actor.dataScope === "ASSIGNED"
      ? eq(project.projectManagerId, actor.userId)
      : actor.dataScope === "GLOBAL" || actor.permissions.includes("create:stock_movement")
        ? undefined
        : eq(project.id, "00000000-0000-0000-0000-000000000000"),
  );
}

export function materialProjectReferenceScope(
  column: AnyColumn,
  actor: MaterialReadActor,
  includeWarehouse: boolean = false,
): SQL | undefined {
  const projectFilter = inArray(
    column,
    db.select({ id: project.id }).from(project).where(materialProjectScope(actor)),
  );
  return includeWarehouse ? or(isNull(column), projectFilter) : projectFilter;
}
