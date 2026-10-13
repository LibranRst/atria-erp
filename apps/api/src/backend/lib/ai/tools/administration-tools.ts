import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { actorCan } from "@backend/lib/auth/permissions";
import { resolveActor, type Actor } from "@backend/server/actor";
import {
  readAdministrationState,
  localMember,
  assertRoleLocal,
  roleKeys,
  AdministrationChangeError,
  normalizedRoleName,
} from "@backend/server/usecases/administration/change-writer";
import { prepareAdministrationProposal } from "@backend/server/usecases/ai/administration-context";
import { administrationInputSchema, projectScopeLabel } from "@atria/core/ai/administration";
import { OWNER_ROLE_ID } from "@atria/core/auth/role-constants";
import { PERMISSION_LABELS } from "@atria/core/auth/permission-catalog";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { findForbiddenProposalPermissions } from "@atria/core/auth/ai-role-proposal";
import { INSTANCE_TENANT_ID } from "@backend/db/schema";
import type { AiToolContext } from "./context";
async function current(context: AiToolContext): Promise<Actor> {
  const actor = await resolveActor();
  if (!actor || actor.userId !== context.userId || !actorCan(actor, "use:ai_chat"))
    throw new AdministrationChangeError("FORBIDDEN", "Sesi atau akses chat tidak tersedia.");
  return actor;
}
function failure(error: unknown): { readonly error: string } {
  return {
    error:
      error instanceof AdministrationChangeError
        ? error.message
        : "Sumber administrasi belum dapat diperiksa. Buka Pengaturan atau coba lagi.",
  };
}
export function buildAdministrationTools(context: AiToolContext): ToolSet {
  return {
    getAdministrationContext: tool({
      description:
        "Read-only actual company staff/roles before editing staff/status/role assignment, role metadata/scope or unused-role deletion. kind STAFF requires manage:users; ROLE requires manage:roles. IDs and memberships are verified server-side.1-character search returns human choices; 20/page, stable IDs; never choose first or invent IDs. Canonical Owner and system restrictions, sensitive AI assignments, active holders and role references are authoritative. No email/password/credential changes. Current admin grants independent of project scope; scope escalation is separately protected. Existing user/role creation and governed permission tools remain separate.",
      inputSchema: z
        .object({
          kind: z.enum(["STAFF", "ROLE"]),
          id: z.string().guid().optional(),
          query: z.string().trim().min(1).max(100).optional(),
          offset: z.number().int().min(0).max(100000).default(0),
        })
        .strict(),
      execute: async (input) => {
        try {
          const actor = await current(context);
          if (!actorCan(actor, input.kind === "STAFF" ? "manage:users" : "manage:roles"))
            throw new AdministrationChangeError(
              "FORBIDDEN",
              "Izin administrasi terkait diperlukan.",
            );
          const state = await readAdministrationState();
          if (input.kind === "STAFF") {
            const matches = state.users.filter(
              (u) =>
                state.members.some((m) => m.userId === u.id && m.tenantId === INSTANCE_TENANT_ID) &&
                (!input.id || u.id === input.id) &&
                (!input.query ||
                  `${u.name} ${u.email}`
                    .toLocaleLowerCase()
                    .includes(input.query.toLocaleLowerCase())),
            );
            if (!input.id && (!input.query || input.query.length === 1 || matches.length !== 1))
              return {
                staff: matches
                  .slice(input.offset, input.offset + 20)
                  .map((u) => ({ id: u.id, name: u.name, email: u.email, isActive: u.isActive })),
                needsDisambiguation: true,
                hasMore: matches.length > input.offset + 20,
                nextOffset: matches.length > input.offset + 20 ? input.offset + 20 : null,
                instruction:
                  "Minta pengguna memilih staf yang tepat sebelum membaca rincian atau membuat patch.",
              };
            const target = matches[0];
            if (!target) throw new AdministrationChangeError("NOT_FOUND", "Staf tidak ditemukan.");
            localMember(state, target.id);
            const r = state.roles.find((r) => r.id === target.roleId);
            if (!r)
              throw new AdministrationChangeError("CONFLICT", "Peran staf belum dapat dibaca.");
            return {
              staff: {
                id: target.id,
                name: target.name,
                email: target.email,
                roleId: r.id,
                roleName: formatBusinessLabel(r.name),
                projectScope: projectScopeLabel(r.dataScope),
                isActive: target.isActive,
              },
              ownerProtected: r.id === OWNER_ROLE_ID,
              selfProtected: target.id === actor.userId,
              permissions: roleKeys(state, r.id).map((k) => PERMISSION_LABELS[k]),
              projectsRemainAssigned: state.projects.filter((p) => p.projectManagerId === target.id)
                .length,
              roleChoices: state.roles
                .filter(
                  (r) =>
                    r.id !== OWNER_ROLE_ID &&
                    findForbiddenProposalPermissions(roleKeys(state, r.id)).length === 0 &&
                    roleKeys(state, r.id).every((k) => actorCan(actor, k)),
                )
                .slice(input.offset, input.offset + 20)
                .map((r) => ({
                  id: r.id,
                  name: formatBusinessLabel(r.name),
                  scope: projectScopeLabel(r.dataScope),
                })),
              instruction:
                "Perubahan parsial mempertahankan field lain. Minta peran/status dan alasan yang belum disebutkan; Owner, password, dan penetapan izin sensitif lewat Pengaturan. Pembaruan role/status mengakhiri sesi tanpa menghapus proyek/riwayat. Untuk batch gunakan proposeStaffChanges dengan semua ID eksplisit.",
            };
          }
          const matches = state.roles.filter(
            (r) =>
              (!input.id || r.id === input.id) &&
              (!input.query ||
                `${r.name} ${formatBusinessLabel(r.name)}`
                  .toLocaleLowerCase()
                  .includes(input.query.toLocaleLowerCase()) ||
                r.name === normalizedRoleName(input.query)),
          );
          if (!input.id && (!input.query || input.query.length === 1 || matches.length !== 1))
            return {
              roles: matches.slice(input.offset, input.offset + 20).map((r) => ({
                id: r.id,
                name: formatBusinessLabel(r.name),
                scope: projectScopeLabel(r.dataScope),
                isSystem: r.isSystem,
                isOwner: r.id === OWNER_ROLE_ID,
              })),
              needsDisambiguation: true,
              hasMore: matches.length > input.offset + 20,
              nextOffset: matches.length > input.offset + 20 ? input.offset + 20 : null,
              instruction: "Minta pengguna memilih peran yang dimaksud.",
            };
          const target = matches[0];
          if (!target) throw new AdministrationChangeError("NOT_FOUND", "Peran tidak ditemukan.");
          assertRoleLocal(state, target.id);
          const people = state.users.filter((u) => u.roleId === target.id);
          const refs = state.members.filter((m) => m.roleId === target.id).length;
          return {
            role: {
              id: target.id,
              name: formatBusinessLabel(target.name),
              description: target.description,
              dataScope: target.dataScope,
              scopeLabel: projectScopeLabel(target.dataScope),
              isSystem: target.isSystem,
              isOwner: target.id === OWNER_ROLE_ID,
            },
            permissions: roleKeys(state, target.id).map((k) => PERMISSION_LABELS[k]),
            users: people
              .slice(input.offset, input.offset + 20)
              .map((u) => ({ name: u.name, isActive: u.isActive })),
            userCount: people.length,
            membershipCount: refs,
            hasMore: people.length > input.offset + 20,
            nextOffset: people.length > input.offset + 20 ? input.offset + 20 : null,
            canDelete:
              !target.isSystem && target.id !== OWNER_ROLE_ID && people.length === 0 && refs === 0,
            instruction:
              "Owner dilindungi; nama peran sistem tetap. Hapus hanya peran kustom tanpa penetapan user/membership, termasuk yang nonaktif. Scope berubah untuk seluruh anggota dan sesi diakhiri; izin tetap. Koreksi izin menggunakan tool governance yang sudah ada. Jangan menyimpan tanpa tombol pengguna.",
          };
        } catch (error: unknown) {
          return failure(error);
        }
      },
    }),
    proposeStaffChanges: tool({
      description:
        "Read-only immutable preview for1–50 explicitly chosen staff partial name/role/status patches and supplied human reason. GetAdministrationContext first, use actual IDs, preserve omissions. No email/password/Owner assignment or self-lockout. Assignment/activation cannot escalate beyond actor authority or bypass forbidden AI-sensitive roles. Project assignments/history unchanged, role/status syncs membership and revokes sessions only after human confirmation. Last active Owner/critical holders checked on entire batch. Single small documentary change saves directly; access/status needs protected confirmation; batch requires review. Conversation approval never writes.",
      inputSchema: administrationInputSchema.options[0],
      execute: async (input) => {
        try {
          return { proposal: await prepareAdministrationProposal(await current(context), input) };
        } catch (error: unknown) {
          return failure(error);
        }
      },
    }),
    proposeRoleDetails: tool({
      description:
        "Read-only immutable partial name/description/project dataScope correction using actual role ID from getAdministrationContext and supplied reason. No permission list edits. Owner protected, system role name fixed. Actor cannot widen scope beyond authority; self-scope/sensitive-role scope changes use Settings. Show all affected users and scope, sessions revoked after protected confirmation. Preserve omitted metadata and all permissions/history. Human button required, current source and active-holder checks repeated before commit.",
      inputSchema: administrationInputSchema.options[1],
      execute: async (input) => {
        try {
          return { proposal: await prepareAdministrationProposal(await current(context), input) };
        } catch (error: unknown) {
          return failure(error);
        }
      },
    }),
    proposeRoleDeletion: tool({
      description:
        "Read-only immutable proposal to permanently delete ONE explicitly selected unused custom role with supplied reason. GetAdministrationContext first. Owner/system roles blocked, any user/member reference including inactive users blocks deletion. No automatic reassignment or account deletion. Preserve business/finance/history. Exact role identity and permissions shown before protected destructive confirmation. Human must press final button; prose approval never deletes. Current source, references and authority rechecked under shared locks; successful receipt replay works even after role is gone.",
      inputSchema: administrationInputSchema.options[2],
      execute: async (input) => {
        try {
          return { proposal: await prepareAdministrationProposal(await current(context), input) };
        } catch (error: unknown) {
          return failure(error);
        }
      },
    }),
  };
}
