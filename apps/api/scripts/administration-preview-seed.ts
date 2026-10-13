/** Actual administration proofs; only named disposable Browser database. */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/backend/db";
import {
  user,
  tenantMember,
  role,
  rolePermission,
  session,
  aiConversation,
  aiMessage,
  client,
  project,
  INSTANCE_TENANT_ID,
} from "../src/backend/db/schema";
import { getRoleAccess } from "../src/backend/lib/auth/role-access";
import { prepareAdministrationProposal } from "../src/backend/server/usecases/ai/administration-context";
import { writeAdministrationChangeTx } from "../src/backend/server/usecases/administration/change-writer";
import { administrationInputSchema, type AdministrationInput } from "@atria/core/ai/administration";
import type { Actor } from "../src/backend/server/actor";
import type { PermissionKey } from "@atria/core/auth/permissions";
const target = new URL(process.env.ATRIA_TEST_DATABASE_URL ?? "http://invalid");
if (
  target.hostname !== "127.0.0.1" ||
  target.port !== "32774" ||
  target.pathname !== "/atria_audit_reconciliation" ||
  process.env.NODE_ENV === "production"
)
  throw new Error("Named disposable Browser database only.");
const qa = await db.query.user.findFirst({
  where: eq(user.email, "reconciliation-qa@fixture.invalid"),
});
if (!qa?.roleId) throw new Error("QA missing");
const roleId = qa.roleId;
const grants: readonly PermissionKey[] = [
  "use:ai_chat",
  "view:settings",
  "manage:users",
  "manage:roles",
  "view:project",
  "view:material",
];
await db
  .insert(rolePermission)
  .values(grants.map((permissionKey) => ({ roleId, permissionKey })))
  .onConflictDoNothing();
await db
  .insert(tenantMember)
  .values({ tenantId: INSTANCE_TENANT_ID, userId: qa.id, roleId, isActive: true })
  .onConflictDoNothing();
const access = await getRoleAccess(roleId);
if (!access) throw new Error("QA access missing");
const actor: Actor = {
  userId: qa.id,
  roleId,
  roleName: access.roleName,
  name: qa.name,
  email: qa.email,
  isActive: true,
  mustChangePassword: false,
  permissions: access.permissions,
  dataScope: access.dataScope,
  sessionId: randomUUID(),
  developerActorUserId: null,
};
const suffix = randomUUID().slice(0, 8),
  reason = "Penataan tim proyek yang ditinjau · data sintetis";
async function makeRole(
  name: string,
  keys: readonly PermissionKey[],
  scope = "ASSIGNED",
): Promise<string> {
  const [r] = await db
    .insert(role)
    .values({
      name: `${name}_${suffix}`,
      dataScope: scope,
      description: "Referensi tim QA sintetis",
    })
    .returning();
  if (keys.length)
    await db
      .insert(rolePermission)
      .values(keys.map((permissionKey) => ({ roleId: r.id, permissionKey })));
  return r.id;
}
const base = await makeRole("QA_PEMANTAU", ["view:project"]),
  assigned = await makeRole("QA_MATERIAL", ["view:project", "view:material"]),
  scopeRole = await makeRole("QA_TIM_CAKUPAN", ["view:project"]),
  unused = await makeRole("QA_PERAN_KOSONG", [], "NONE"),
  used = await makeRole("QA_PERAN_DIPAKAI", [], "NONE");
async function person(name: string, assignedRole = base, active = true): Promise<string> {
  const [u] = await db
    .insert(user)
    .values({
      name,
      email: `${randomUUID()}@fixture.invalid`,
      roleId: assignedRole,
      isActive: active,
      mustChangePassword: false,
    })
    .returning();
  await db
    .insert(tenantMember)
    .values({ tenantId: INSTANCE_TENANT_ID, userId: u.id, roleId: assignedRole, isActive: active });
  if (active)
    await db.insert(session).values({
      id: randomUUID(),
      token: randomUUID(),
      userId: u.id,
      expiresAt: new Date(Date.now() + 86400000),
      updatedAt: new Date(),
    });
  return u.id;
}
const nameId = await person("Staf QA · koreksi nama"),
  accessId = await person("Staf QA · perubahan peran"),
  disableId = await person("Staf QA · nonaktifkan"),
  staleId = await person("Staf QA · sumber berubah");
const batch: string[] = [];
for (let i = 1; i <= 6; i++) batch.push(await person(`Staf QA · batch ${i}`));
const scopePeople = [
  await person("Staf QA · cakupan A", scopeRole),
  await person("Staf QA · cakupan B", scopeRole),
];
const [c] = await db
  .insert(client)
  .values({ name: "Klien QA administrasi", email: `${randomUUID()}@fixture.invalid`, phone: "000" })
  .returning();
await db.insert(project).values({
  name: "Proyek QA · penugasan tetap",
  clientId: c.id,
  projectManagerId: disableId,
  totalContractValue: "100000",
  status: "ACTIVE",
});
const inputs: AdministrationInput[] = [
  administrationInputSchema.parse({
    action: "STAFF_CHANGES",
    users: [{ userId: nameId, patch: { name: "Staf QA · nama diperbaiki" } }],
    reason,
  }),
  administrationInputSchema.parse({
    action: "STAFF_CHANGES",
    users: [{ userId: accessId, patch: { roleId: assigned } }],
    reason,
  }),
  administrationInputSchema.parse({
    action: "STAFF_CHANGES",
    users: [{ userId: disableId, patch: { isActive: false } }],
    reason,
  }),
  administrationInputSchema.parse({
    action: "STAFF_CHANGES",
    users: batch.map((userId, i) => ({
      userId,
      patch: { name: `Staf QA · hasil batch ${i + 1}` },
    })),
    reason,
  }),
  administrationInputSchema.parse({
    action: "ROLE_DETAILS",
    roleId: scopeRole,
    patch: { description: "Cakupan tim ditinjau untuk seluruh proyek", dataScope: "GLOBAL" },
    reason,
  }),
  administrationInputSchema.parse({
    action: "ROLE_DELETE",
    roleId: unused,
    reason: "Peran uji tidak dipakai lagi · data sintetis",
  }),
  administrationInputSchema.parse({
    action: "ROLE_DELETE",
    roleId: used,
    reason: "Peran uji masih terkait akun · data sintetis",
  }),
  administrationInputSchema.parse({
    action: "STAFF_CHANGES",
    users: [{ userId: staleId, patch: { name: "Nama usulan lama" } }],
    reason,
  }),
];
const parts: Record<string, unknown>[] = [
  {
    type: "text",
    text: "Delapan contoh administrasi memakai proof API nyata: koreksi nama, peran, nonaktifkan, batch6, cakupan role, role kosong, role yang kembali dipakai, dan sumber berubah. Semua akun/data sintetis dalam database disposable.",
  },
];
for (const input of inputs) {
  const proposal = await prepareAdministrationProposal(actor, input);
  parts.push({
    type: `tool-${input.action === "STAFF_CHANGES" ? "proposeStaffChanges" : input.action === "ROLE_DETAILS" ? "proposeRoleDetails" : "proposeRoleDeletion"}`,
    state: "output-available",
    toolCallId: randomUUID(),
    output: { proposal },
  });
}
await person("Staf QA · pemegang nonaktif", used, false);
await db.transaction((tx) =>
  writeAdministrationChangeTx(
    tx,
    actor,
    {
      action: "STAFF_CHANGES",
      users: [{ userId: staleId, patch: { name: "Nama sudah dikoreksi manual" } }],
      reason,
    },
    "SCREEN",
  ),
);
const [conversation] = await db
  .insert(aiConversation)
  .values({ userId: qa.id, title: "QA staf & role · database disposable" })
  .returning();
await db.insert(aiMessage).values([
  {
    conversationId: conversation.id,
    role: "user",
    parts: [
      {
        type: "text",
        text: "Tinjau administrasi staf dan peran. Ini data sintetis untuk preview; simpan hanya contoh yang dipilih.",
      },
    ],
  },
  { conversationId: conversation.id, role: "assistant", parts },
]);
console.log(
  JSON.stringify({
    conversationId: conversation.id,
    nameId,
    accessId,
    disableId,
    batch,
    scopeRole,
    scopePeople,
    unused,
    used,
    staleId,
  }),
);
await pool.end();
