import { ZodError } from "zod";
import type { ActionResponse } from "@atria/core/types/action-response";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@backend/db";
import {
  tenant,
  tenantMember,
  role,
  rolePermission,
  user,
  session,
  auditLog,
  project,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import type { FinanceTransaction } from "../finance/mutation-access";
import { actorCan } from "@backend/lib/auth/permissions";
import {
  administrationInputSchema,
  administrationPermission,
  type AdministrationInput,
} from "@atria/core/ai/administration";
import { OWNER_ROLE_ID } from "@atria/core/auth/role-constants";
import type { PermissionKey } from "@atria/core/auth/permissions";
import { isKnownPermissionKey } from "@atria/core/auth/role-impact";
import { CRITICAL_PERMISSIONS, PERMISSION_LABELS } from "@atria/core/auth/permission-catalog";
import {
  findForbiddenProposalPermissions,
  describeForbiddenProposal,
} from "@atria/core/auth/ai-role-proposal";
export class AdministrationChangeError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR",
    message: string,
  ) {
    super(message);
  }
}
export type AdministrationOrigin = "SCREEN" | "AI_PROPOSAL";
type Reader = Pick<FinanceTransaction, "query">;
export type AdministrationState = {
  readonly roles: (typeof role.$inferSelect)[];
  readonly permissions: (typeof rolePermission.$inferSelect)[];
  readonly users: (typeof user.$inferSelect)[];
  readonly members: (typeof tenantMember.$inferSelect)[];
  readonly sessions: { userId: string }[];
  readonly projects: {
    id: string;
    name: string;
    projectManagerId: string | null;
    status: string;
  }[];
};
export function assertAdministrationRights(
  actor: Actor,
  input: AdministrationInput,
  origin: AdministrationOrigin,
): void {
  if (
    !actor.isActive ||
    !actorCan(actor, administrationPermission(input)) ||
    (origin === "AI_PROPOSAL" && !actorCan(actor, "use:ai_chat"))
  )
    throw new AdministrationChangeError(
      "FORBIDDEN",
      "Izin administrasi tidak tersedia atau telah berubah.",
    );
}
/** Shared stable lock owner: manual and AI role/staff mutations take the same order. */
export async function lockAdministrationTx(tx: FinanceTransaction): Promise<void> {
  const [company] = await tx
    .select({ id: tenant.id })
    .from(tenant)
    .where(eq(tenant.id, INSTANCE_TENANT_ID))
    .for("update");
  if (!company) throw new AdministrationChangeError("NOT_FOUND", "Perusahaan tidak ditemukan.");
  await tx.select({ id: role.id }).from(role).orderBy(asc(role.id)).for("update");
  await tx.select({ id: user.id }).from(user).orderBy(asc(user.id)).for("update");
  await tx
    .select({ id: tenantMember.id })
    .from(tenantMember)
    .orderBy(asc(tenantMember.id))
    .for("update");
}
export async function readAdministrationState(reader: Reader = db): Promise<AdministrationState> {
  const [roles, permissions, users, members, sessions, projects] = await Promise.all([
    reader.query.role.findMany({ orderBy: [asc(role.id)] }),
    reader.query.rolePermission.findMany({
      orderBy: [asc(rolePermission.roleId), asc(rolePermission.permissionKey)],
    }),
    reader.query.user.findMany({ orderBy: [asc(user.id)] }),
    reader.query.tenantMember.findMany({ orderBy: [asc(tenantMember.id)] }),
    reader.query.session.findMany({ columns: { userId: true }, orderBy: [asc(session.userId)] }),
    reader.query.project.findMany({
      where: eq(project.tenantId, INSTANCE_TENANT_ID),
      columns: { id: true, name: true, projectManagerId: true, status: true },
      orderBy: [asc(project.id)],
    }),
  ]);
  return { roles, permissions, users, members, sessions, projects };
}
export function roleKeys(state: AdministrationState, id: string): PermissionKey[] {
  return state.permissions
    .filter((r) => r.roleId === id)
    .map((r) => {
      if (!isKnownPermissionKey(r.permissionKey))
        throw new AdministrationChangeError(
          "CONFLICT",
          "Peran memiliki konfigurasi izin yang tidak dikenal. Periksa di Pengaturan.",
        );
      return r.permissionKey;
    });
}
export function localMember(
  state: AdministrationState,
  id: string,
): typeof tenantMember.$inferSelect {
  const m = state.members.find((m) => m.userId === id && m.tenantId === INSTANCE_TENANT_ID);
  if (!m)
    throw new AdministrationChangeError("NOT_FOUND", "Staf tidak ditemukan dalam perusahaan Anda.");
  if (state.members.some((m) => m.userId === id && m.tenantId !== INSTANCE_TENANT_ID))
    throw new AdministrationChangeError(
      "FORBIDDEN",
      "Akun terkait perusahaan lain. Ubah melalui administrasi akun yang sesuai.",
    );
  return m;
}
/** Refresh authority from locked rows, not the request's earlier permission cache. */
export function refreshAdministrationActor(
  actor: Actor,
  state: AdministrationState,
  permission: PermissionKey,
  ai = false,
): Actor {
  const current = state.users.find((u) => u.id === actor.userId);
  const member = localMember(state, actor.userId);
  const currentRole = state.roles.find((r) => r.id === current?.roleId);
  if (
    !current?.isActive ||
    !member.isActive ||
    !currentRole ||
    member.roleId !== current.roleId ||
    current.roleId !== actor.roleId
  ) {
    throw new AdministrationChangeError(
      "FORBIDDEN",
      "Akun atau akses administrasi Anda berubah. Masuk kembali dan periksa izin.",
    );
  }
  const refreshed: Actor = {
    ...actor,
    isActive: current.isActive,
    mustChangePassword: current.mustChangePassword,
    roleName: currentRole.name.toUpperCase(),
    permissions: roleKeys(state, currentRole.id),
    dataScope:
      currentRole.dataScope === "GLOBAL" || currentRole.dataScope === "ASSIGNED"
        ? currentRole.dataScope
        : "NONE",
  };
  if (!actorCan(refreshed, permission) || (ai && !actorCan(refreshed, "use:ai_chat"))) {
    throw new AdministrationChangeError(
      "FORBIDDEN",
      "Izin administrasi tidak tersedia atau telah berubah.",
    );
  }
  return refreshed;
}
export function normalizedRoleName(name: string): string {
  return name.trim().toUpperCase().replaceAll(" ", "_");
}
function scopeRank(scope: string): number {
  return scope === "GLOBAL" ? 2 : scope === "ASSIGNED" ? 1 : 0;
}
function noEscalation(
  actor: Actor,
  added: readonly PermissionKey[],
  beforeScope: string,
  afterScope: string,
): void {
  if (added.some((k) => !actorCan(actor, k)))
    throw new AdministrationChangeError(
      "FORBIDDEN",
      "Anda tidak dapat memberikan akses yang tidak Anda miliki.",
    );
  if (
    scopeRank(afterScope) > scopeRank(beforeScope) &&
    scopeRank(afterScope) > scopeRank(actor.dataScope)
  )
    throw new AdministrationChangeError("FORBIDDEN", "Cakupan baru melampaui cakupan proyek Anda.");
}
export function assertRoleLocal(state: AdministrationState, id: string): void {
  if (
    state.members.some((m) => m.roleId === id && m.tenantId !== INSTANCE_TENANT_ID) ||
    state.users.some(
      (u) =>
        u.roleId === id &&
        !state.members.some((m) => m.userId === u.id && m.tenantId === INSTANCE_TENANT_ID),
    )
  )
    throw new AdministrationChangeError(
      "FORBIDDEN",
      "Peran terkait akun di luar perusahaan ini. Periksa melalui administrasi yang sesuai.",
    );
}
function coverage(
  state: AdministrationState,
  users: AdministrationState["users"],
  roles: AdministrationState["roles"],
  key: PermissionKey,
  updatedMembers: ReadonlySet<string> = new Set(),
): boolean {
  return users.some(
    (u) =>
      u.isActive &&
      state.members.some(
        (m) =>
          m.userId === u.id &&
          m.tenantId === INSTANCE_TENANT_ID &&
          (updatedMembers.has(u.id) ? u.isActive : m.isActive),
      ) &&
      state.permissions.some((p) => p.roleId === u.roleId && p.permissionKey === key) &&
      (![
        "verify:cost",
        "approve:budget",
        "approve:cost",
        "pay:cost",
        "pay:vendor_bill",
        "approve:rab",
        "reconcile:client_invoice",
        "create:project",
        "activate:project",
      ].includes(key) ||
        roles.find((r) => r.id === u.roleId)?.dataScope !== "NONE"),
  );
}
export type AdministrationProjection = {
  readonly state: AdministrationState;
  readonly nextUsers: AdministrationState["users"];
  readonly nextRoles: AdministrationState["roles"];
  readonly input: AdministrationInput;
  readonly authorityChanged: boolean;
};
export async function projectAdministrationChange(
  actor: Actor,
  raw: AdministrationInput,
  origin: AdministrationOrigin = "AI_PROPOSAL",
  reader: Reader = db,
): Promise<AdministrationProjection> {
  const input = administrationInputSchema.parse(raw);
  assertAdministrationRights(actor, input, origin);
  const state = await readAdministrationState(reader);
  actor = refreshAdministrationActor(
    actor,
    state,
    administrationPermission(input),
    origin === "AI_PROPOSAL",
  );
  const nextUsers = state.users.map((u) => ({ ...u }));
  const nextRoles = state.roles.map((r) => ({ ...r }));
  let changed = false,
    authorityChanged = false;
  if (input.action === "STAFF_CHANGES") {
    for (const item of input.users) {
      const before = state.users.find((u) => u.id === item.userId),
        after = nextUsers.find((u) => u.id === item.userId);
      if (!before || !after)
        throw new AdministrationChangeError("NOT_FOUND", "Staf tidak ditemukan.");
      const member = localMember(state, before.id);
      if (member.roleId !== before.roleId || member.isActive !== before.isActive)
        throw new AdministrationChangeError(
          "CONFLICT",
          "Status atau peran keanggotaan staf tidak konsisten. Periksa di Pengaturan.",
        );
      const oldRole = state.roles.find((r) => r.id === before.roleId),
        newRole = state.roles.find((r) => r.id === (item.patch.roleId ?? before.roleId));
      if (!oldRole || !newRole)
        throw new AdministrationChangeError("NOT_FOUND", "Peran tidak ditemukan.");
      const newActive = item.patch.isActive ?? before.isActive;
      const roleChanged = newRole.id !== oldRole.id,
        activeChanged = newActive !== before.isActive;
      if (
        origin === "AI_PROPOSAL" &&
        (before.roleId === OWNER_ROLE_ID || newRole.id === OWNER_ROLE_ID)
      )
        throw new AdministrationChangeError(
          "FORBIDDEN",
          "Akun dan penetapan Owner dikelola melalui Pengaturan, bukan usulan chat.",
        );
      if (before.id === actor.userId && (!newActive || (origin === "AI_PROPOSAL" && roleChanged)))
        throw new AdministrationChangeError(
          "FORBIDDEN",
          "Akun sendiri tidak dapat dinonaktifkan atau diganti perannya lewat alur ini.",
        );
      const oldKeys = before.isActive ? roleKeys(state, oldRole.id) : [],
        newKeys = newActive ? roleKeys(state, newRole.id) : [];
      const added = newKeys.filter((k) => !oldKeys.includes(k));
      noEscalation(
        actor,
        added,
        before.isActive ? oldRole.dataScope : "NONE",
        newActive ? newRole.dataScope : "NONE",
      );
      if (origin === "AI_PROPOSAL" && (roleChanged || (!before.isActive && newActive))) {
        const forbidden = findForbiddenProposalPermissions([
          ...added,
          ...(roleChanged ? oldKeys.filter((k) => !newKeys.includes(k)) : []),
        ]);
        if (forbidden.length)
          throw new AdministrationChangeError("FORBIDDEN", describeForbiddenProposal(forbidden));
      }
      after.name = item.patch.name ?? before.name;
      after.roleId = newRole.id;
      after.isActive = newActive;
      changed ||= after.name !== before.name || roleChanged || activeChanged;
      authorityChanged ||= roleChanged || activeChanged;
    }
    if (
      input.users.some((item) => {
        const before = state.users.find((u) => u.id === item.userId),
          after = nextUsers.find((u) => u.id === item.userId);
        return (
          before?.roleId === OWNER_ROLE_ID &&
          before.isActive &&
          (after?.roleId !== OWNER_ROLE_ID || !after?.isActive)
        );
      }) &&
      !nextUsers.some(
        (u) =>
          u.roleId === OWNER_ROLE_ID &&
          u.isActive &&
          state.members.some((m) => m.userId === u.id && m.tenantId === INSTANCE_TENANT_ID),
      )
    )
      throw new AdministrationChangeError(
        "FORBIDDEN",
        "Owner aktif terakhir tidak dapat dinonaktifkan atau diubah perannya.",
      );
  } else {
    const before = state.roles.find((r) => r.id === input.roleId),
      after = nextRoles.find((r) => r.id === input.roleId);
    if (!before || !after)
      throw new AdministrationChangeError("NOT_FOUND", "Peran tidak ditemukan.");
    if (before.id === OWNER_ROLE_ID)
      throw new AdministrationChangeError("FORBIDDEN", "Peran Owner tidak dapat diubah.");
    assertRoleLocal(state, before.id);
    if (input.action === "ROLE_DELETE") {
      if (before.isSystem)
        throw new AdministrationChangeError("FORBIDDEN", "Peran sistem tidak dapat dihapus.");
      const refs = state.users.filter((u) => u.roleId === before.id).length,
        memberRefs = state.members.filter((m) => m.roleId === before.id).length;
      if (refs || memberRefs)
        throw new AdministrationChangeError(
          "CONFLICT",
          `Peran masih terkait ${Math.max(refs, memberRefs)} akun, termasuk yang nonaktif. Pindahkan penetapannya lebih dulu.`,
        );
      changed = true;
    } else {
      after.name =
        input.patch.name === undefined ||
        normalizedRoleName(input.patch.name) === normalizedRoleName(before.name)
          ? before.name
          : normalizedRoleName(input.patch.name);
      after.description =
        input.patch.description === undefined ? before.description : input.patch.description;
      after.dataScope = input.patch.dataScope ?? before.dataScope;
      if (before.isSystem && after.name !== before.name)
        throw new AdministrationChangeError("FORBIDDEN", "Nama peran sistem tidak dapat diubah.");
      if (
        state.roles.some(
          (r) =>
            r.id !== before.id && normalizedRoleName(r.name) === normalizedRoleName(after.name),
        )
      )
        throw new AdministrationChangeError("CONFLICT", "Nama peran sudah dipakai.");
      if (after.dataScope !== before.dataScope) {
        if (origin === "AI_PROPOSAL" && before.id === actor.roleId)
          throw new AdministrationChangeError(
            "FORBIDDEN",
            "Cakupan peran sendiri diubah melalui Pengaturan.",
          );
        noEscalation(actor, [], before.dataScope, after.dataScope);
        if (origin === "AI_PROPOSAL") {
          const forbidden = findForbiddenProposalPermissions(roleKeys(state, before.id));
          if (forbidden.length)
            throw new AdministrationChangeError("FORBIDDEN", describeForbiddenProposal(forbidden));
        }
        authorityChanged = true;
      }
      changed =
        after.name !== before.name ||
        after.description !== before.description ||
        after.dataScope !== before.dataScope;
    }
  }
  if (authorityChanged) {
    for (const key of Object.keys(CRITICAL_PERMISSIONS)) {
      if (!isKnownPermissionKey(key)) continue;
      if (
        coverage(state, state.users, state.roles, key) &&
        !coverage(
          state,
          nextUsers,
          nextRoles,
          key,
          input.action === "STAFF_CHANGES"
            ? new Set(input.users.map((item) => item.userId))
            : new Set(),
        )
      )
        throw new AdministrationChangeError(
          "CONFLICT",
          `Perubahan menyisakan nol pemegang aktif untuk ${PERMISSION_LABELS[key]}. Siapkan pengganti terlebih dahulu.`,
        );
    }
  }
  if (!changed)
    throw new AdministrationChangeError(
      "VALIDATION_ERROR",
      "Data sudah sesuai; tidak ada perubahan untuk disimpan.",
    );
  return { state, nextUsers, nextRoles, input, authorityChanged };
}
export async function writeAdministrationChangeTx(
  tx: FinanceTransaction,
  actor: Actor,
  raw: AdministrationInput,
  origin: AdministrationOrigin = "AI_PROPOSAL",
): Promise<string> {
  await lockAdministrationTx(tx);
  const p = await projectAdministrationChange(actor, raw, origin, tx);
  const now = new Date();
  if (p.input.action === "STAFF_CHANGES") {
    for (const item of p.input.users) {
      const before = p.state.users.find((u) => u.id === item.userId),
        after = p.nextUsers.find((u) => u.id === item.userId);
      if (!before || !after) throw new AdministrationChangeError("CONFLICT", "Staf berubah.");
      if (
        before.name === after.name &&
        before.roleId === after.roleId &&
        before.isActive === after.isActive
      )
        continue;
      await tx
        .update(user)
        .set({ name: after.name, roleId: after.roleId, isActive: after.isActive, updatedAt: now })
        .where(eq(user.id, after.id));
      if (before.roleId !== after.roleId || before.isActive !== after.isActive) {
        await tx
          .update(tenantMember)
          .set({ roleId: after.roleId, isActive: after.isActive, updatedAt: now })
          .where(
            and(eq(tenantMember.tenantId, INSTANCE_TENANT_ID), eq(tenantMember.userId, after.id)),
          );
      }
      if (before.roleId !== after.roleId || before.isActive !== after.isActive)
        await tx.delete(session).where(eq(session.userId, after.id));
      await tx.insert(auditLog).values({
        tenantId: INSTANCE_TENANT_ID,
        userId: actor.userId,
        action: "UPDATE_STAFF_USER",
        targetTable: "user",
        targetId: after.id,
        originalState: JSON.stringify(before),
        newState: JSON.stringify({ ...after, reason: p.input.reason, origin }),
      });
    }
    return p.input.users[0].userId;
  }
  const roleId = p.input.roleId;
  const before = p.state.roles.find((r) => r.id === roleId);
  if (!before) throw new AdministrationChangeError("CONFLICT", "Peran berubah.");
  if (p.input.action === "ROLE_DELETE") {
    await tx.delete(role).where(eq(role.id, before.id));
    await tx.insert(auditLog).values({
      tenantId: INSTANCE_TENANT_ID,
      userId: actor.userId,
      action: "DELETE_ROLE",
      targetTable: "role",
      targetId: before.id,
      originalState: JSON.stringify({ ...before, permissions: roleKeys(p.state, before.id) }),
      newState: JSON.stringify({ reason: p.input.reason, origin, deleted: true }),
    });
    return before.id;
  }
  const after = p.nextRoles.find((r) => r.id === before.id);
  if (!after) throw new AdministrationChangeError("CONFLICT", "Peran berubah.");
  await tx
    .update(role)
    .set({
      name: after.name,
      description: after.description,
      dataScope: after.dataScope,
      updatedAt: now,
    })
    .where(eq(role.id, before.id));
  if (p.authorityChanged) {
    const ids = p.state.users.filter((u) => u.roleId === before.id).map((u) => u.id);
    if (ids.length) await tx.delete(session).where(inArray(session.userId, ids));
  }
  await tx.insert(auditLog).values({
    tenantId: INSTANCE_TENANT_ID,
    userId: actor.userId,
    action: "UPDATE_ROLE_DETAILS",
    targetTable: "role",
    targetId: before.id,
    originalState: JSON.stringify(before),
    newState: JSON.stringify({ ...after, reason: p.input.reason, origin }),
  });
  return before.id;
}

export function administrationChangeFailure(error: unknown): ActionResponse<never> {
  return {
    success: false,
    error: {
      code:
        error instanceof AdministrationChangeError
          ? error.code
          : error instanceof ZodError
            ? "VALIDATION_ERROR"
            : "TRANSACTION_FAILED",
      message:
        error instanceof AdministrationChangeError
          ? error.message
          : error instanceof ZodError
            ? "Data administrasi tidak valid."
            : "Perubahan belum tersimpan. Periksa sumber dan coba lagi.",
    },
  };
}

export function assertNewStaffRole(actor: Actor, state: AdministrationState, id: string): void {
  actor = refreshAdministrationActor(actor, state, "manage:users");
  const target = state.roles.find((r) => r.id === id);
  if (!target) throw new AdministrationChangeError("NOT_FOUND", "Peran tidak ditemukan.");
  if (id === OWNER_ROLE_ID && actor.roleId !== OWNER_ROLE_ID)
    throw new AdministrationChangeError(
      "FORBIDDEN",
      "Penetapan Owner memerlukan Owner yang berwenang.",
    );
  assertRoleLocal(state, id);
  noEscalation(actor, roleKeys(state, id), "NONE", target.dataScope);
}
export function assertRoleScopeGrant(actor: Actor, scope: string): void {
  noEscalation(actor, [], "NONE", scope);
}
export async function verifyRolePermissionSnapshotTx(
  tx: FinanceTransaction,
  actor: Actor,
  id: string,
  expected: Date,
  before: ReadonlySet<string>,
  after: ReadonlySet<string>,
  ai: boolean,
): Promise<void> {
  const state = await readAdministrationState(tx),
    target = state.roles.find((r) => r.id === id);
  actor = refreshAdministrationActor(actor, state, "manage:roles", ai);
  if (
    !target ||
    target.updatedAt.getTime() !== expected.getTime() ||
    JSON.stringify(roleKeys(state, id).toSorted()) !== JSON.stringify([...before].toSorted())
  )
    throw new AdministrationChangeError(
      "CONFLICT",
      "Peran atau izin berubah. Muat ulang sebelum menyimpan.",
    );
  assertRoleLocal(state, id);
  const added = [...after].filter((k) => !before.has(k));
  for (const key of added)
    if (!isKnownPermissionKey(key) || !actorCan(actor, key))
      throw new AdministrationChangeError("FORBIDDEN", "Izin baru melampaui kewenangan Anda.");
  if (ai) {
    for (const key of before) {
      if (!isKnownPermissionKey(key) || !CRITICAL_PERMISSIONS[key] || after.has(key)) continue;
      const next = {
        ...state,
        permissions: state.permissions.filter((p) => p.roleId !== id || after.has(p.permissionKey)),
      };
      if (
        coverage(state, state.users, state.roles, key) &&
        !coverage(next, state.users, state.roles, key)
      )
        throw new AdministrationChangeError(
          "CONFLICT",
          `Tidak ada pemegang aktif pengganti untuk ${PERMISSION_LABELS[key]}.`,
        );
    }
  }
}
