import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, pool } from "../src/backend/db";
import { role, rolePermission, user } from "../src/backend/db/schema";

const target = new URL(process.env.ATRIA_TEST_DATABASE_URL ?? "http://invalid");
if (
  target.hostname !== "127.0.0.1" ||
  target.port !== "32774" ||
  target.pathname !== "/atria_audit_reconciliation" ||
  process.env.NODE_ENV === "production"
)
  throw new Error("Named disposable preview only.");
const mode = z.enum(["revoke", "restore"]).parse(process.argv[2]);
const qa = await db.query.user.findFirst({
  where: eq(user.email, "reconciliation-qa@fixture.invalid"),
});
if (!qa?.roleId) throw new Error("Synthetic actor required.");
const qaRole = await db.query.role.findFirst({ where: eq(role.id, qa.roleId) });
if (!qaRole || qaRole.isSystem || !qaRole.name.startsWith("QA Rekonsiliasi "))
  throw new Error("Synthetic custom role required.");
if (mode === "revoke")
  await db
    .delete(rolePermission)
    .where(
      and(eq(rolePermission.roleId, qaRole.id), eq(rolePermission.permissionKey, "manage:users")),
    );
else
  await db
    .insert(rolePermission)
    .values({ roleId: qaRole.id, permissionKey: "manage:users" })
    .onConflictDoNothing();
console.log(JSON.stringify({ mode, permission: "manage:users", roleId: qaRole.id }));
await pool.end();
