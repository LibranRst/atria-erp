import { createHash } from "node:crypto";
import type { Actor } from "@backend/server/actor";
import type { FinanceTransaction } from "../finance/mutation-access";
import {
  administrationProposalSchema,
  projectScopeLabel,
  type AdministrationInput,
  type AdministrationProposal,
} from "@atria/core/ai/administration";
import { CRITICAL_PERMISSIONS, PERMISSION_LABELS } from "@atria/core/auth/permission-catalog";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import {
  projectAdministrationChange,
  roleKeys,
  type AdministrationState,
  AdministrationChangeError,
} from "../administration/change-writer";
function fingerprint(
  state: AdministrationState,
  input: AdministrationInput,
  authority: boolean,
): string {
  const ids =
    input.action === "STAFF_CHANGES"
      ? new Set(input.users.map((r) => r.userId))
      : new Set(state.users.filter((u) => u.roleId === input.roleId).map((u) => u.id));
  const roles = new Set(
    input.action === "STAFF_CHANGES"
      ? state.users.filter((u) => ids.has(u.id)).map((u) => u.roleId)
      : [input.roleId],
  );
  if (input.action === "STAFF_CHANGES")
    for (const row of input.users) if (row.patch.roleId) roles.add(row.patch.roleId);
  const criticalRoles = new Set(
    state.permissions
      .filter((p) => Object.hasOwn(CRITICAL_PERMISSIONS, p.permissionKey))
      .map((p) => p.roleId),
  );
  const criticalUsers = new Set(
    state.users.filter((u) => criticalRoles.has(u.roleId)).map((u) => u.id),
  );
  const data = {
    users: state.users.filter((u) => ids.has(u.id)),
    roles: state.roles.filter((r) => roles.has(r.id)),
    permissions: state.permissions.filter((r) => roles.has(r.roleId)),
    members: state.members.filter(
      (m) => ids.has(m.userId) || (input.action !== "STAFF_CHANGES" && roles.has(m.roleId)),
    ),
    sessions: authority ? state.sessions.filter((s) => ids.has(s.userId)) : [],
    projects: state.projects.filter((p) => p.projectManagerId && ids.has(p.projectManagerId)),
    coverage: authority
      ? {
          users: state.users
            .filter((u) => criticalUsers.has(u.id))
            .map((u) => ({ id: u.id, roleId: u.roleId, isActive: u.isActive })),
          roles: state.roles
            .filter((r) => criticalRoles.has(r.id))
            .map((r) => ({ id: r.id, dataScope: r.dataScope })),
          permissions: state.permissions.filter((p) =>
            Object.hasOwn(CRITICAL_PERMISSIONS, p.permissionKey),
          ),
          members: state.members.filter((m) => criticalUsers.has(m.userId)),
        }
      : null,
  };
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}
export async function prepareAdministrationProposal(
  actor: Actor,
  input: AdministrationInput,
  reader?: Pick<FinanceTransaction, "query">,
): Promise<AdministrationProposal> {
  const p = await projectAdministrationChange(actor, input, "AI_PROPOSAL", reader);
  const rows: AdministrationProposal["rows"] = [];
  let sessions = 0;
  if (input.action === "STAFF_CHANGES") {
    for (const item of input.users) {
      const before = p.state.users.find((u) => u.id === item.userId),
        after = p.nextUsers.find((u) => u.id === item.userId);
      if (!before || !after) throw new AdministrationChangeError("CONFLICT", "Staf berubah.");
      const oldRole = p.state.roles.find((r) => r.id === before.roleId),
        newRole = p.nextRoles.find((r) => r.id === after.roleId);
      if (!oldRole || !newRole) throw new AdministrationChangeError("CONFLICT", "Peran berubah.");
      const changes: AdministrationProposal["rows"][number]["changes"] = [];
      if (before.name !== after.name)
        changes.push({ label: "Nama staf", before: before.name, after: after.name });
      if (before.roleId !== after.roleId)
        changes.push({
          label: "Peran",
          before: formatBusinessLabel(oldRole.name),
          after: formatBusinessLabel(newRole.name),
        });
      if (before.isActive !== after.isActive)
        changes.push({
          label: "Status akun",
          before: before.isActive ? "Aktif" : "Nonaktif",
          after: after.isActive ? "Aktif" : "Nonaktif",
        });
      if (oldRole.dataScope !== newRole.dataScope)
        changes.push({
          label: "Cakupan proyek",
          before: projectScopeLabel(oldRole.dataScope),
          after: projectScopeLabel(newRole.dataScope),
        });
      const oldKeys = before.isActive ? roleKeys(p.state, oldRole.id) : [],
        newKeys = after.isActive ? roleKeys(p.state, newRole.id) : [];
      const count = p.state.sessions.filter((s) => s.userId === before.id).length;
      const access = before.roleId !== after.roleId || before.isActive !== after.isActive;
      if (access) sessions += count;
      if (!changes.length) continue;
      rows.push({
        id: before.id,
        title: before.name,
        meta: before.email,
        changes,
        added: newKeys.filter((k) => !oldKeys.includes(k)).map((k) => PERMISSION_LABELS[k]),
        removed: oldKeys.filter((k) => !newKeys.includes(k)).map((k) => PERMISSION_LABELS[k]),
        facts: [
          {
            label: "Proyek tetap terkait",
            value: p.state.projects.filter((pr) => pr.projectManagerId === before.id).length,
          },
          ...(access ? [{ label: "Sesi login diakhiri", value: count }] : []),
        ],
      });
    }
  } else {
    const before = p.state.roles.find((r) => r.id === input.roleId),
      after = p.nextRoles.find((r) => r.id === input.roleId);
    if (!before || !after) throw new AdministrationChangeError("CONFLICT", "Peran berubah.");
    const people = p.state.users.filter((u) => u.roleId === before.id);
    if (people.length > 200)
      throw new AdministrationChangeError(
        "VALIDATION_ERROR",
        "Peran memiliki lebih dari200 akun. Tinjau melalui Pengaturan.",
      );
    const changes: AdministrationProposal["rows"][number]["changes"] = [];
    if (input.action === "ROLE_DELETE")
      changes.push({ label: "Peran", before: "Tersedia", after: "Dihapus" });
    else {
      if (before.name !== after.name)
        changes.push({
          label: "Nama peran",
          before: formatBusinessLabel(before.name),
          after: formatBusinessLabel(after.name),
        });
      if (before.description !== after.description)
        changes.push({
          label: "Deskripsi",
          before: before.description || "—",
          after: after.description || "—",
        });
      if (before.dataScope !== after.dataScope)
        changes.push({
          label: "Cakupan proyek",
          before: projectScopeLabel(before.dataScope),
          after: projectScopeLabel(after.dataScope),
        });
    }
    sessions = p.authorityChanged
      ? p.state.sessions.filter((s) => people.some((u) => u.id === s.userId)).length
      : 0;
    rows.push({
      id: before.id,
      title: formatBusinessLabel(before.name),
      meta: before.isSystem ? "Peran sistem" : "Peran kustom",
      changes,
      facts: [
        { label: "Akun terkait", value: people.length },
        {
          label: input.action === "ROLE_DELETE" ? "Jumlah izin" : "Izin tetap",
          value: roleKeys(p.state, before.id).length,
        },
      ],
      added: [],
      removed:
        input.action === "ROLE_DELETE"
          ? roleKeys(p.state, before.id).map((k) => PERMISSION_LABELS[k])
          : [],
    });
    if (p.authorityChanged)
      for (const person of people)
        rows.push({
          id: person.id,
          title: person.name,
          meta: person.email,
          changes: [
            {
              label: "Cakupan proyek",
              before: projectScopeLabel(before.dataScope),
              after: projectScopeLabel(after.dataScope),
            },
          ],
          facts: [{ label: "Status akun", value: person.isActive ? "Aktif" : "Nonaktif" }],
          added: [],
          removed: [],
        });
  }
  const title =
    input.action === "STAFF_CHANGES"
      ? "Perubahan staf"
      : input.action === "ROLE_DELETE"
        ? "Hapus peran"
        : "Detail peran";
  return administrationProposalSchema.parse({
    kind: "ADMINISTRATION",
    input,
    title,
    entityName:
      input.action === "STAFF_CHANGES"
        ? rows.length === 1
          ? rows[0].title
          : `${rows.length} staf`
        : rows[0].title,
    effect:
      input.action === "ROLE_DELETE"
        ? "Menghapus peran kustom yang tidak terpakai. Akun, proyek dan riwayat bisnis tetap."
        : p.authorityChanged
          ? "Akses diperbarui dan sesi terkait diakhiri. Penugasan proyek, sandi serta riwayat bisnis tetap."
          : "Detail administrasi diperbarui. Izin, cakupan, sesi login serta riwayat bisnis tetap.",
    expectedContext: fingerprint(p.state, input, p.authorityChanged),
    sensitive: p.authorityChanged || input.action === "ROLE_DELETE",
    summary: [
      {
        label: input.action === "STAFF_CHANGES" ? "Staf berubah" : "Peran",
        value: input.action === "STAFF_CHANGES" ? rows.length : rows[0].title,
      },
      ...(input.action === "ROLE_DETAILS"
        ? [
            {
              label: "Akun terdampak",
              value: rows.length > 1 ? rows.length - 1 : Number(rows[0].facts[0]?.value ?? 0),
            },
          ]
        : []),
      ...(p.authorityChanged ? [{ label: "Sesi diakhiri", value: sessions }] : []),
    ],
    rows,
  });
}
