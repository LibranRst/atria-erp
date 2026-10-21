import { test, expect, beforeAll, beforeEach, afterAll, spyOn } from "bun:test";
import { randomUUID } from "node:crypto";
import { eq, and, count, asc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@backend/db";
import {
  tenant,
  role,
  rolePermission,
  user,
  tenantMember,
  session,
  project,
  client,
  aiConversation,
  aiMessage,
  aiProposalConfirmation,
  auditLog,
  bankAccount,
  projectBudgets,
  projectCost,
  cashTransaction,
  stockMovement,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { resolveActor, type Actor } from "@backend/server/actor";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { withTestRequest } from "@backend/lib/testing/request";
import { getAllPermissionKeys } from "@backend/lib/auth/role-access";
import { OWNER_ROLE_ID } from "@atria/core/auth/role-constants";
import type { PermissionKey } from "@atria/core/auth/permissions";
import {
  administrationInputSchema,
  type AdministrationInput,
  type AdministrationProposal,
} from "@atria/core/ai/administration";
import { prepareAdministrationProposal } from "@backend/server/usecases/ai/administration-context";
import * as writers from "@backend/server/usecases/administration/change-writer";
import { getAiAdministrationProposal, confirmAiAdministrationProposal } from "./administration";
import { updateStaffUser } from "@backend/app/actions/administration-staff";
import {
  updateRoleDetails,
  deleteRole,
  updateRolePermissions,
} from "@backend/app/actions/administration-roles";
import { buildAdministrationTools } from "@backend/lib/ai/tools/administration-tools";
import type { ActionResponse } from "@atria/core/types/action-response";
const prefix = `ADMIN-${randomUUID().slice(0, 8)}`,
  reason = "Perubahan administrasi sesuai keputusan pengguna";
const api = auth.api as unknown as { getSession: unknown },
  original = api.getSession;
type Person = {
  id: string;
  roleId: string;
  name: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
};
let owner: Person,
  limited: Person,
  other: Person,
  staff: Person,
  second: Person,
  readerRole: string,
  newRole: string,
  unusedRole: string;
function as(p: Person): void {
  api.getSession = async () => ({
    user: p,
    session: { id: randomUUID(), userId: p.id, expiresAt: new Date(Date.now() + 3600000) },
  });
}
function ok<T>(r: ActionResponse<T>): T {
  if (!r.success) throw new Error(r.error.message);
  return r.data;
}
async function actor(): Promise<Actor> {
  const a = await withTestRequest(resolveActor)();
  if (!a) throw new Error("actor");
  return a;
}
async function makeRole(
  keys: readonly PermissionKey[],
  scope = "ASSIGNED",
  system = false,
): Promise<string> {
  const [r] = await db
    .insert(role)
    .values({ name: `${prefix}-${randomUUID().slice(0, 12)}`, dataScope: scope, isSystem: system })
    .returning();
  if (keys.length)
    await db
      .insert(rolePermission)
      .values(keys.map((permissionKey) => ({ roleId: r.id, permissionKey })));
  return r.id;
}
async function person(
  roleId: string,
  active = true,
  tenantId = INSTANCE_TENANT_ID,
): Promise<Person> {
  const [u] = await db
    .insert(user)
    .values({
      name: `${prefix} Staf`,
      email: `${randomUUID()}@fixture.invalid`,
      roleId,
      isActive: active,
      mustChangePassword: false,
    })
    .returning();
  await db.insert(tenantMember).values({ tenantId, userId: u.id, roleId, isActive: active });
  return {
    id: u.id,
    roleId,
    name: u.name,
    email: u.email,
    isActive: active,
    mustChangePassword: false,
  };
}
async function proof(raw: unknown): Promise<{
  proposal: AdministrationProposal;
  identity: { conversationId: string; toolCallId: string };
  messageId: string;
}> {
  const input = administrationInputSchema.parse(raw),
    a = await actor(),
    proposal = await prepareAdministrationProposal(a, input);
  const [c] = await db
    .insert(aiConversation)
    .values({ userId: a.userId, title: prefix })
    .returning();
  const toolCallId = randomUUID(),
    name =
      input.action === "STAFF_CHANGES"
        ? "proposeStaffChanges"
        : input.action === "ROLE_DETAILS"
          ? "proposeRoleDetails"
          : "proposeRoleDeletion";
  const [m] = await db
    .insert(aiMessage)
    .values({
      conversationId: c.id,
      role: "assistant",
      parts: [
        { type: `tool-${name}`, state: "output-available", toolCallId, output: { proposal } },
      ],
    })
    .returning();
  return { proposal, identity: { conversationId: c.id, toolCallId }, messageId: m.id };
}
const save = withTestRequest(confirmAiAdministrationProposal),
  read = withTestRequest(getAiAdministrationProposal);
const edit = (patch: unknown, id = staff.id): AdministrationInput =>
  administrationInputSchema.parse({
    action: "STAFF_CHANGES",
    users: [{ userId: id, patch }],
    reason,
  });
async function login(p: Person): Promise<void> {
  await db.insert(session).values({
    id: randomUUID(),
    token: randomUUID(),
    userId: p.id,
    expiresAt: new Date(Date.now() + 3600000),
    updatedAt: new Date(),
  });
}
async function invariant(): Promise<string> {
  return JSON.stringify({
    banks: await db.query.bankAccount.findMany({ orderBy: [asc(bankAccount.id)] }),
    budgets: await db.query.projectBudgets.findMany({ orderBy: [asc(projectBudgets.id)] }),
    costs: await db.query.projectCost.findMany({ orderBy: [asc(projectCost.id)] }),
    cash: (await db.select({ n: count() }).from(cashTransaction))[0].n,
    stock: (await db.select({ n: count() }).from(stockMovement))[0].n,
    projects: await db.query.project.findMany({ orderBy: [asc(project.id)] }),
  });
}
describeIntegration("AI staff and role administration", () => {
  beforeAll(async () => {
    await db
      .insert(tenant)
      .values({
        id: INSTANCE_TENANT_ID,
        name: "Administration disposable",
        slug: `admin-${randomUUID()}`,
      })
      .onConflictDoNothing();
    await db
      .insert(role)
      .values({ id: OWNER_ROLE_ID, name: "OWNER", dataScope: "GLOBAL", isSystem: true })
      .onConflictDoNothing();
    await db
      .insert(rolePermission)
      .values(
        getAllPermissionKeys().map((permissionKey) => ({ roleId: OWNER_ROLE_ID, permissionKey })),
      )
      .onConflictDoNothing();
    owner = await person(OWNER_ROLE_ID);
    limited = await person(await makeRole(["use:ai_chat", "manage:users"], "NONE"));
    other = await person(await makeRole(["use:ai_chat", "manage:users", "manage:roles"], "GLOBAL"));
  });
  beforeEach(async () => {
    as(owner);
    readerRole = await makeRole(["view:project"]);
    newRole = await makeRole(["view:project", "create:cost"]);
    unusedRole = await makeRole([], "NONE");
    staff = await person(readerRole);
    second = await person(readerRole);
  });
  afterAll(() => {
    api.getSession = original;
  });
  test("name-only patch preserves credentials, role, membership, sessions and business history with replay", async () => {
    await login(staff);
    const before = await invariant(),
      p = await proof(edit({ name: "Nama staf diperbaiki" }));
    expect(ok(await read(p.identity)).status).toBe("READY");
    const results = await Promise.all([save(p.identity), save(p.identity)]);
    expect(results.every((r) => r.success)).toBe(true);
    expect(results.filter((r) => r.success && r.data.alreadyConfirmed)).toHaveLength(1);
    const u = await db.query.user.findFirst({ where: eq(user.id, staff.id) });
    expect(u?.name).toBe("Nama staf diperbaiki");
    expect(u?.email).toBe(staff.email);
    expect(u?.roleId).toBe(readerRole);
    expect(await db.query.session.findMany({ where: eq(session.userId, staff.id) })).toHaveLength(
      1,
    );
    expect(await invariant()).toBe(before);
    expect(ok(await read(p.identity)).status).toBe("CONFIRMED");
  });
  test("explicit role change syncs membership, revokes sessions and discloses exact access delta", async () => {
    await login(staff);
    const p = await proof(edit({ roleId: newRole }));
    expect(p.proposal.sensitive).toBe(true);
    expect(p.proposal.rows[0].added.length).toBe(1);
    expect((await save(p.identity)).success).toBe(true);
    expect((await db.query.user.findFirst({ where: eq(user.id, staff.id) }))?.roleId).toBe(newRole);
    expect(
      (await db.query.tenantMember.findFirst({ where: eq(tenantMember.userId, staff.id) }))?.roleId,
    ).toBe(newRole);
    expect(await db.query.session.findMany({ where: eq(session.userId, staff.id) })).toHaveLength(
      0,
    );
  });
  test("deactivate/reactivate preserves assignment IDs and synchronizes membership without changing passwords", async () => {
    const [c] = await db
      .insert(client)
      .values({ name: prefix, phone: "000", email: `${randomUUID()}@fixture.invalid` })
      .returning();
    const [pj] = await db
      .insert(project)
      .values({
        name: prefix,
        location: "QA",
        clientId: c.id,
        projectManagerId: staff.id,
        status: "ACTIVE",
        totalContractValue: "100",
      })
      .returning();
    await login(staff);
    const before = await invariant(),
      p = await proof(edit({ isActive: false }));
    expect(p.proposal.rows[0].facts[0].value).toBe(1);
    expect((await save(p.identity)).success).toBe(true);
    expect(
      (await db.query.tenantMember.findFirst({ where: eq(tenantMember.userId, staff.id) }))
        ?.isActive,
    ).toBe(false);
    expect(
      (await db.query.project.findFirst({ where: eq(project.id, pj.id) }))?.projectManagerId,
    ).toBe(staff.id);
    expect(await invariant()).toBe(before);
    const restore = await proof(edit({ isActive: true }));
    expect((await save(restore.identity)).success).toBe(true);
  });
  test("whole batch rejects last active critical-holder removal and rolls back every companion change", async () => {
    const previous = await db.query.rolePermission.findMany({
      where: eq(rolePermission.permissionKey, "verify:cost"),
    });
    await db.delete(rolePermission).where(eq(rolePermission.permissionKey, "verify:cost"));
    try {
      const critical = await makeRole(["verify:cost"]),
        a = await person(critical),
        b = await person(critical);
      await expect(
        prepareAdministrationProposal(
          await actor(),
          administrationInputSchema.parse({
            action: "STAFF_CHANGES",
            users: [
              { userId: a.id, patch: { isActive: false } },
              { userId: b.id, patch: { isActive: false } },
            ],
            reason,
          }),
        ),
      ).rejects.toThrow("pemegang aktif");
      expect((await db.query.user.findFirst({ where: eq(user.id, a.id) }))?.isActive).toBe(true);
    } finally {
      if (previous.length)
        await db
          .insert(rolePermission)
          .values(previous.map((r) => ({ roleId: r.roleId, permissionKey: r.permissionKey })))
          .onConflictDoNothing();
    }
  });
  test("Owner, self-lockout, escalation and sensitive assignment cannot use chat shortcuts", async () => {
    await expect(
      prepareAdministrationProposal(await actor(), edit({ name: "Ganti" }, owner.id)),
    ).rejects.toThrow("Owner");
    await expect(
      prepareAdministrationProposal(await actor(), edit({ roleId: OWNER_ROLE_ID })),
    ).rejects.toThrow("Owner");
    const self = await proof(edit({ name: "Nama kedua" }));
    as(limited);
    expect((await save(self.identity)).success).toBe(false);
    await expect(
      prepareAdministrationProposal(await actor(), edit({ roleId: newRole })),
    ).rejects.toThrow("akses");
    await expect(
      prepareAdministrationProposal(await actor(), edit({ isActive: false }, limited.id)),
    ).rejects.toThrow("sendiri");
    as(owner);
    const sensitive = await makeRole(["view:project", "pay:cost"]);
    await expect(
      prepareAdministrationProposal(await actor(), edit({ roleId: sensitive })),
    ).rejects.toThrow("tidak dapat diubah");
  });
  test("tenant/multi-company and inconsistent membership blockers are explicit", async () => {
    const [t] = await db
      .insert(tenant)
      .values({ name: prefix, slug: `foreign-${randomUUID()}` })
      .returning();
    const foreign = await person(readerRole, true, t.id);
    await expect(
      prepareAdministrationProposal(await actor(), edit({ name: "No" }, foreign.id)),
    ).rejects.toThrow("perusahaan Anda");
    await db
      .insert(tenantMember)
      .values({ tenantId: t.id, userId: staff.id, roleId: staff.roleId });
    await expect(
      prepareAdministrationProposal(await actor(), edit({ name: "No" })),
    ).rejects.toThrow("perusahaan lain");
    await db
      .delete(tenantMember)
      .where(and(eq(tenantMember.tenantId, t.id), eq(tenantMember.userId, staff.id)));
    await db.update(tenantMember).set({ isActive: false }).where(eq(tenantMember.userId, staff.id));
    await expect(
      prepareAdministrationProposal(await actor(), edit({ name: "No" })),
    ).rejects.toThrow("tidak konsisten");
  });
  test("role metadata preserves permissions; scope changes expose affected users and revoke sessions", async () => {
    await login(staff);
    const p = await proof({
      action: "ROLE_DETAILS",
      roleId: readerRole,
      patch: { description: "Deskripsi peran baru", dataScope: "GLOBAL" },
      reason,
    });
    expect(p.proposal.rows.length).toBe(3);
    const keys = await db.query.rolePermission.findMany({
      where: eq(rolePermission.roleId, readerRole),
    });
    expect((await save(p.identity)).success).toBe(true);
    expect(
      await db.query.rolePermission.findMany({ where: eq(rolePermission.roleId, readerRole) }),
    ).toEqual(keys);
    expect(await db.query.session.findMany({ where: eq(session.userId, staff.id) })).toHaveLength(
      0,
    );
    expect((await db.query.role.findFirst({ where: eq(role.id, readerRole) }))?.dataScope).toBe(
      "GLOBAL",
    );
  });
  test("duplicate names, system/Owner roles, own/sensitive scope and scope escalation are guarded", async () => {
    const r = await db.query.role.findFirst({ where: eq(role.id, newRole) });
    await expect(
      prepareAdministrationProposal(
        await actor(),
        administrationInputSchema.parse({
          action: "ROLE_DETAILS",
          roleId: readerRole,
          patch: { name: r?.name },
          reason,
        }),
      ),
    ).rejects.toThrow("sudah dipakai");
    const system = await makeRole([], "NONE", true);
    await expect(
      prepareAdministrationProposal(
        await actor(),
        administrationInputSchema.parse({
          action: "ROLE_DETAILS",
          roleId: system,
          patch: { name: "RenameSystem" },
          reason,
        }),
      ),
    ).rejects.toThrow("sistem");
    await expect(
      prepareAdministrationProposal(
        await actor(),
        administrationInputSchema.parse({ action: "ROLE_DELETE", roleId: system, reason }),
      ),
    ).rejects.toThrow("sistem");
    await expect(
      prepareAdministrationProposal(
        await actor(),
        administrationInputSchema.parse({
          action: "ROLE_DETAILS",
          roleId: OWNER_ROLE_ID,
          patch: { description: "Owner edit" },
          reason,
        }),
      ),
    ).rejects.toThrow("Owner");
    as(other);
    await expect(
      prepareAdministrationProposal(
        await actor(),
        administrationInputSchema.parse({
          action: "ROLE_DETAILS",
          roleId: other.roleId,
          patch: { dataScope: "NONE" },
          reason,
        }),
      ),
    ).rejects.toThrow("sendiri");
    as(owner);
  });
  test("deletion rejects inactive user/member references; unused role deletes with audit and replay after missing source", async () => {
    await db.update(user).set({ isActive: false }).where(eq(user.id, staff.id));
    await db.update(tenantMember).set({ isActive: false }).where(eq(tenantMember.userId, staff.id));
    await expect(
      prepareAdministrationProposal(
        await actor(),
        administrationInputSchema.parse({ action: "ROLE_DELETE", roleId: readerRole, reason }),
      ),
    ).rejects.toThrow("termasuk yang nonaktif");
    const p = await proof({ action: "ROLE_DELETE", roleId: unusedRole, reason });
    expect((await save(p.identity)).success).toBe(true);
    expect(await db.query.role.findFirst({ where: eq(role.id, unusedRole) })).toBeUndefined();
    expect(ok(await read(p.identity)).status).toBe("CONFIRMED");
    expect(ok(await save(p.identity)).alreadyConfirmed).toBe(true);
    expect(
      await db.query.auditLog.findFirst({
        where: and(eq(auditLog.targetId, unusedRole), eq(auditLog.action, "DELETE_ROLE")),
      }),
    ).toBeDefined();
  });
  test("stale manual changes, new role holder, expiry, identity tampering and revoked grants block saving", async () => {
    const p = await proof(edit({ name: "AI name" }));
    ok(
      await withTestRequest(updateStaffUser)({
        userId: staff.id,
        name: "Manual name",
        roleId: staff.roleId,
        isActive: true,
      }),
    );
    expect(ok(await read(p.identity)).status).toBe("STALE");
    expect((await save(p.identity)).success).toBe(false);
    const del = await proof({ action: "ROLE_DELETE", roleId: unusedRole, reason });
    await person(unusedRole);
    expect((await save(del.identity)).success).toBe(false);
    const expired = await proof(edit({ name: "New name" }));
    await db
      .update(aiMessage)
      .set({ createdAt: new Date(Date.now() - 31 * 86400000) })
      .where(eq(aiMessage.id, expired.messageId));
    expect(ok(await read(expired.identity)).status).toBe("EXPIRED");
    expect((await save({ ...expired.identity, userId: staff.id })).success).toBe(false);
    const revoked = await proof(edit({ name: "Revoke" }));
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, OWNER_ROLE_ID),
          eq(rolePermission.permissionKey, "manage:users"),
        ),
      );
    expect((await save(revoked.identity)).success).toBe(false);
    await db
      .insert(rolePermission)
      .values({ roleId: OWNER_ROLE_ID, permissionKey: "manage:users" });
  });
  test("batch failure rolls back users, membership, sessions, audit and receipt", async () => {
    await login(staff);
    const p = await proof({
      action: "STAFF_CHANGES",
      users: [
        { userId: staff.id, patch: { name: "AA", isActive: false } },
        { userId: second.id, patch: { name: "BB" } },
      ],
      reason,
    });
    const originalWriter = writers.writeAdministrationChangeTx;
    const fault = spyOn(writers, "writeAdministrationChangeTx").mockImplementation(
      async (...args) => {
        await originalWriter(...args);
        throw new Error("Injected rollback");
      },
    );
    try {
      expect((await save(p.identity)).success).toBe(false);
    } finally {
      fault.mockRestore();
    }
    expect((await db.query.user.findFirst({ where: eq(user.id, staff.id) }))?.isActive).toBe(true);
    expect(await db.query.session.findMany({ where: eq(session.userId, staff.id) })).toHaveLength(
      1,
    );
    expect(
      await db.query.aiProposalConfirmation.findFirst({
        where: eq(aiProposalConfirmation.toolCallId, p.identity.toolCallId),
      }),
    ).toBeUndefined();
  });
  test("manual role operations share guards and serialized edits stale existing proof", async () => {
    const p = await proof({
      action: "ROLE_DETAILS",
      roleId: readerRole,
      patch: { description: "AI desc" },
      reason,
    });
    const r = await db.query.role.findFirst({ where: eq(role.id, readerRole) });
    if (!r) throw new Error("role");
    ok(
      await withTestRequest(updateRoleDetails)({
        roleId: r.id,
        name: r.name,
        description: "Manual",
        dataScope: "ASSIGNED",
      }),
    );
    expect((await save(p.identity)).success).toBe(false);
    expect((await withTestRequest(deleteRole)({ roleId: readerRole })).success).toBe(false);
    expect(
      (
        await withTestRequest(updateRolePermissions)({
          roleId: readerRole,
          permissions: ["view:project", "create:cost"],
        })
      ).success,
    ).toBe(true);
  });
  test("an unrelated staff edit and new noncritical member leave a pending proposal valid", async () => {
    const membership = await db.query.tenantMember.findFirst({
      where: eq(tenantMember.userId, second.id),
    });
    const p = await proof(edit({ name: "Nama yang ditinjau" }));
    ok(
      await withTestRequest(updateStaffUser)({
        userId: second.id,
        name: "Nama staf lain",
        roleId: second.roleId,
        isActive: true,
      }),
    );
    expect(
      await db.query.tenantMember.findFirst({
        where: eq(tenantMember.userId, second.id),
      }),
    ).toEqual(membership);
    await person(unusedRole);
    expect(ok(await read(p.identity)).status).toBe("READY");
    expect((await save(p.identity)).success).toBe(true);
  });
  test("locked preparation refuses a cached actor after grant revocation or account deactivation", async () => {
    const managerRole = await makeRole(["use:ai_chat", "manage:users"], "NONE");
    const manager = await person(managerRole);
    as(manager);
    const cached = await actor();
    const input = edit({ name: "Nominal edit" });
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, managerRole),
          eq(rolePermission.permissionKey, "manage:users"),
        ),
      );
    await expect(
      db.transaction(async (tx) => {
        await writers.writeAdministrationChangeTx(tx, cached, input);
      }),
    ).rejects.toThrow("Izin administrasi");
    await db.insert(rolePermission).values({ roleId: managerRole, permissionKey: "manage:users" });
    await db.update(user).set({ isActive: false }).where(eq(user.id, manager.id));
    await db
      .update(tenantMember)
      .set({ isActive: false })
      .where(eq(tenantMember.userId, manager.id));
    await expect(
      db.transaction(async (tx) => {
        await writers.writeAdministrationChangeTx(tx, cached, input);
      }),
    ).rejects.toThrow("Akun atau akses");
    expect((await db.query.user.findFirst({ where: eq(user.id, staff.id) }))?.name).toBe(
      staff.name,
    );
    as(owner);
  });
  test("manual and AI edits serialize; competing proposals never overwrite a changed preview", async () => {
    const p = await proof(edit({ name: "Nama usulan AI" }));
    const [manual, ai] = await Promise.all([
      withTestRequest(updateStaffUser)({
        userId: staff.id,
        name: "Nama hasil manual",
        roleId: staff.roleId,
        isActive: true,
      }),
      save(p.identity),
    ]);
    expect(manual.success).toBe(true);
    expect((await db.query.user.findFirst({ where: eq(user.id, staff.id) }))?.name).toBe(
      "Nama hasil manual",
    );
    const receipts = await db.query.aiProposalConfirmation.findMany({
      where: eq(aiProposalConfirmation.toolCallId, p.identity.toolCallId),
    });
    expect(receipts).toHaveLength(ai.success ? 1 : 0);
    const first = await proof(edit({ name: "Koreksi pertama" }));
    const secondProposal = await proof(edit({ name: "Koreksi kedua" }));
    const results = await Promise.all([save(first.identity), save(secondProposal.identity)]);
    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(results.filter((result) => !result.success)).toHaveLength(1);
    expect((await db.query.user.findFirst({ where: eq(user.id, staff.id) }))?.name).toBe(
      results[0].success ? "Koreksi pertama" : "Koreksi kedua",
    );
  });
  test("lookup one character requires explicit choice; readonly proposal preparation does not mutate", async () => {
    const tools = buildAdministrationTools(await actor());
    const c = await withTestRequest(
      async () =>
        await tools.getAdministrationContext.execute?.(
          { kind: "STAFF", query: prefix.slice(0, 1), offset: 0 },
          { toolCallId: "lookup", messages: [], context: {} },
        ),
    )();
    expect(z.object({ needsDisambiguation: z.literal(true) }).parse(c).needsDisambiguation).toBe(
      true,
    );
    const before = await db.query.user.findFirst({ where: eq(user.id, staff.id) });
    const preview = await withTestRequest(
      async () =>
        await tools.proposeStaffChanges.execute?.(edit({ name: "Lookup staff" }), {
          toolCallId: "preview",
          messages: [],
          context: {},
        }),
    )();
    expect(
      z.object({ proposal: z.object({ kind: z.literal("ADMINISTRATION") }) }).parse(preview)
        .proposal.kind,
    ).toBe("ADMINISTRATION");
    expect(await db.query.user.findFirst({ where: eq(user.id, staff.id) })).toEqual(before);
  });
});
