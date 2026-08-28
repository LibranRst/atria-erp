import "server-only";

import { db } from "@/db";
import { role, rolePermission, user } from "@/db/schema";
import { tool } from "ai";
import { and, eq, ilike, inArray, or } from "drizzle-orm";
import { z } from "zod";

import { PERMISSION_LABELS } from "@atria/core/auth/permission-catalog";
import { formatRoleLabel } from "@atria/core/presentation/role-label";
import { buildRoleCreateHref, buildRoleEditorHref } from "@atria/core/auth/role-deep-link";
import {
  describeForbiddenProposal,
  describePermissionEffect,
  findForbiddenProposalPermissions,
} from "@atria/core/auth/ai-role-proposal";
import {
  computeModuleDelta,
  describeCriticalGaps,
  describeDataScopeForAi,
  isKnownPermissionKey,
  resolvePermissionChange,
  suggestPermissionKeys,
  summarizePermissionsByModule,
} from "@atria/core/auth/role-impact";
import type { PermissionKey } from "@atria/core/auth/permissions";
import { hasPermission, permissionDenied, type AiToolContext } from "./context";
import { roleReviewOutputSchema } from "../tool-output";

/**
 * Tool kecerdasan peran — read-only, tanpa satu pun jalan menulis.
 *
 * Keputusannya tercatat di `docs/plans/2026-08-25-ai-role-intelligence.md`:
 * asisten menjelaskan dan mensimulasikan, manusia yang menyunting di layar
 * "Peran & akses". Yang sulit dari mengubah izin bukan menekan sakelarnya,
 * melainkan mengetahui sakelar mana dan apa yang rusak — dan itu pekerjaan
 * membaca.
 */

const MAX_NAMES = 12;

async function permissionsOfRole(roleId: string): Promise<Set<PermissionKey>> {
  const rows = await db.query.rolePermission.findMany({
    where: eq(rolePermission.roleId, roleId),
    columns: { permissionKey: true },
  });
  return new Set(rows.map((row) => row.permissionKey as PermissionKey));
}

type RoleChangeAnalysis =
  | { readonly ok: false; readonly result: Record<string, unknown> }
  | {
      readonly ok: true;
      readonly roleId: string;
      readonly roleName: string;
      readonly added: readonly PermissionKey[];
      readonly removed: readonly PermissionKey[];
      readonly result: Record<string, unknown>;
    };

/**
 * Analisis dampak yang dipakai dua tool.
 *
 * `analyzeRoleChangeImpact` mengembalikannya apa adanya; `suggestRoleReview`
 * menempelkan tautan penyunting di atasnya. Menyalinnya akan membuat kartu
 * serah-terima memperlihatkan angka yang berbeda dari analisis yang baru saja
 * dibacakan asisten di kalimat sebelumnya.
 */
async function analyzeRoleChange(
  context: AiToolContext,
  roleName: string,
  grant: readonly string[],
  revoke: readonly string[],
): Promise<RoleChangeAnalysis> {
  if (!hasPermission(context, "manage:roles")) {
    return { ok: false, result: permissionDenied("simulasi perubahan peran") };
  }

  const normalized = roleName.trim().toUpperCase().replaceAll(" ", "_");
  const roles = await db.query.role.findMany({ limit: 50 });
  const match = roles.find((row) => row.name.toUpperCase() === normalized);
  if (!match) {
    return {
      ok: false,
      result: {
        error: `Peran "${roleName}" tidak ditemukan.`,
        availableRoles: roles.map((row) => row.name.toUpperCase()),
      },
    };
  }

  const unknown = [...grant, ...revoke].filter((key) => !isKnownPermissionKey(key));
  if (unknown.length > 0) {
    return { ok: false, result: { error: `Izin tidak dikenal: ${unknown.join(", ")}.` } };
  }

  const held = await permissionsOfRole(match.id);
  const change = resolvePermissionChange(held, grant as PermissionKey[], revoke as PermissionKey[]);
  const { added, removed } = change;
  if (added.length === 0 && removed.length === 0) {
    return {
      ok: false,
      result: { roleName: match.name.toUpperCase(), noChange: true },
    };
  }

  const affected = await db.query.user.findMany({
    where: and(eq(user.roleId, match.id), eq(user.isActive, true)),
    columns: { name: true },
  });
  const moduleDelta = computeModuleDelta(held, change.after);

  // Anti-eskalasi: server menolak pemberian izin yang tidak dipegang pemberinya.
  // Dilaporkan di sini supaya tidak ditemukan saat menyimpan.
  const blockedGrants = added.filter((key) => !hasPermission(context, key));

  /*
   * Pemegang terakhir dihitung terhadap pengguna AKTIF di seluruh perusahaan,
   * bukan terhadap peran ini saja. Peran lain yang memegang izinnya tetapi
   * tidak punya satu pun pemegang aktif tidak menutup apa pun — di situlah
   * lubangnya biasa lolos dari perhatian.
   */
  const coverage = new Map<PermissionKey, boolean>();
  for (const key of removed) {
    const otherRoles = await db.query.rolePermission.findMany({
      where: eq(rolePermission.permissionKey, key),
      columns: { roleId: true },
    });
    const remainingRoleIds = otherRoles
      .map((row) => row.roleId)
      .filter((roleId) => roleId !== match.id);
    if (remainingRoleIds.length === 0) {
      coverage.set(key, false);
      continue;
    }
    const stillActive = await db.query.user.findMany({
      where: and(inArray(user.roleId, remainingRoleIds), eq(user.isActive, true)),
      columns: { id: true },
      limit: 1,
    });
    coverage.set(key, stillActive.length > 0);
  }
  const criticalGaps = describeCriticalGaps(removed, (key) => coverage.get(key) === true);

  return {
    ok: true,
    roleId: match.id,
    roleName: match.name.toUpperCase(),
    added,
    removed,
    result: {
      roleName: match.name.toUpperCase(),
      affectedUsers: affected.length,
      affectedNames: affected.map((row) => row.name).slice(0, MAX_NAMES),
      granted: added.map((key) => PERMISSION_LABELS[key]),
      revoked: removed.map((key) => PERMISSION_LABELS[key]),
      modulesGained: moduleDelta.gained,
      modulesLost: moduleDelta.lost,
      blockedGrants: blockedGrants.map((key) => ({
        permission: PERMISSION_LABELS[key],
        reason: "Anda sendiri tidak memegang izin ini, jadi server akan menolaknya.",
      })),
      criticalGaps,
      appliedBy: "Perubahan ini belum diterapkan. Terapkan di Pengaturan › Tim, Vendor & Peran.",
    },
  };
}

export function buildRoleTools(context: AiToolContext) {
  return {
    explainUserAccess: tool({
      description:
        "Explain what a person can and cannot do in the ERP, grouped by module, based on their role's effective permissions. Use this to answer questions like 'what am I allowed to do?' or 'why can't Budi disburse a vendor payment?'. Omit `person` to explain the current user. Read-only: it never changes permissions.",
      inputSchema: z.object({
        person: z
          .string()
          .min(2)
          .optional()
          .describe(
            "Name or email of the person to explain. Omit to explain the person asking. Requires user administration rights to inspect someone else.",
          ),
      }),
      execute: async ({ person }) => {
        const inspectingSelf = person === undefined;
        if (
          !inspectingSelf &&
          !hasPermission(context, "manage:users") &&
          !hasPermission(context, "manage:roles")
        ) {
          return permissionDenied("hak akses pengguna lain");
        }

        const matches = inspectingSelf
          ? await db.query.user.findMany({
              where: eq(user.id, context.userId),
              with: { role: true },
              limit: 1,
            })
          : await db.query.user.findMany({
              where: or(ilike(user.name, `%${person}%`), ilike(user.email, `%${person}%`)),
              with: { role: true },
              limit: 6,
            });

        if (matches.length === 0) {
          return { error: `Tidak ada pengguna yang cocok dengan "${person ?? ""}".` };
        }
        if (matches.length > 1) {
          return {
            needsDisambiguation: true,
            candidates: matches.map((row) => ({ name: row.name, email: row.email })),
          };
        }

        const target = matches[0]!;
        const held = await permissionsOfRole(target.roleId);

        return {
          person: { name: target.name, email: target.email, isActive: target.isActive },
          roleName: target.role.name.toUpperCase(),
          projectScope: describeDataScopeForAi(target.role.dataScope),
          totalGranted: held.size,
          modules: summarizePermissionsByModule(held),
        };
      },
    }),

    whoCanDo: tool({
      description:
        "List which roles and which active people hold a given permission key. Use for questions like 'who can approve budgets?' or 'who is allowed to pay vendor bills?'. Read-only.",
      inputSchema: z.object({
        permissionKey: z
          .string()
          .min(3)
          .describe("Permission key such as approve:cost, pay:vendor_bill, or manage:users."),
      }),
      execute: async ({ permissionKey }) => {
        if (!hasPermission(context, "manage:roles")) {
          return permissionDenied("daftar pemegang izin di seluruh organisasi");
        }
        if (!isKnownPermissionKey(permissionKey)) {
          return {
            error: `Izin "${permissionKey}" tidak dikenal.`,
            didYouMean: suggestPermissionKeys(permissionKey),
          };
        }

        const holders = await db.query.rolePermission.findMany({
          where: eq(rolePermission.permissionKey, permissionKey),
          columns: { roleId: true },
        });
        if (holders.length === 0) {
          return {
            permission: PERMISSION_LABELS[permissionKey],
            permissionKey,
            roles: [],
            warning: "Tidak ada satu pun peran yang memegang izin ini.",
          };
        }

        const roleIds = holders.map((row) => row.roleId);
        const [roles, people] = await Promise.all([
          db.query.role.findMany({ where: inArray(role.id, roleIds) }),
          db.query.user.findMany({
            where: and(inArray(user.roleId, roleIds), eq(user.isActive, true)),
            columns: { name: true, roleId: true },
          }),
        ]);

        return {
          permission: PERMISSION_LABELS[permissionKey],
          permissionKey,
          roles: roles.map((row) => ({
            roleName: row.name.toUpperCase(),
            activeHolders: people
              .filter((holder) => holder.roleId === row.id)
              .map((holder) => holder.name)
              .slice(0, MAX_NAMES),
          })),
        };
      },
    }),

    analyzeRoleChangeImpact: tool({
      description:
        "Simulate a permission change on a role WITHOUT applying it, and report the consequences: who is affected, which modules the role gains or loses, which grants the current user is not allowed to make, and — most importantly — which critical permissions would be left with nobody in the company able to perform them. Use before advising any permission change. This tool never writes; the human applies changes in Settings.",
      inputSchema: z.object({
        roleName: z.string().min(2).describe("Name of the role to simulate, e.g. FINANCE_ADMIN."),
        grant: z.array(z.string()).default([]).describe("Permission keys to add."),
        revoke: z.array(z.string()).default([]).describe("Permission keys to remove."),
      }),
      execute: async ({ roleName, grant, revoke }) => {
        const analysis = await analyzeRoleChange(context, roleName, grant, revoke);
        return analysis.result;
      },
    }),

    proposeRoleChange: tool({
      description:
        "Prepare a role permission change for the user to confirm and apply directly from chat. Call this ONLY after analyzeRoleChangeImpact and only when the user has clearly asked to apply the change. Some permissions are refused on this path entirely — money movement, user administration, role administration, and self-approval override — and the assistant must direct the user to Settings for those. This tool does NOT write; the human confirms on the card.",
      inputSchema: z.object({
        roleName: z.string().min(2).describe("Name of the role to change."),
        grant: z.array(z.string()).default([]).describe("Permission keys to add."),
        revoke: z.array(z.string()).default([]).describe("Permission keys to remove."),
        reason: z
          .string()
          .min(5)
          .max(200)
          .describe("One sentence in Bahasa Indonesia explaining why."),
      }),
      execute: async ({ roleName, grant, revoke, reason }) => {
        const analysis = await analyzeRoleChange(context, roleName, grant, revoke);
        if (!analysis.ok) return analysis.result;

        /*
         * Pagar jalur asisten diperiksa di sini juga, bukan hanya saat
         * konfirmasi. Kartu yang tampil lalu ditolak servernya adalah janji
         * yang dilanggar — dan model tidak akan belajar apa pun darinya.
         */
        const forbidden = findForbiddenProposalPermissions([
          ...analysis.added,
          ...analysis.removed,
        ]);
        if (forbidden.length > 0) {
          return {
            error: describeForbiddenProposal(forbidden),
            useInstead:
              "Panggil suggestRoleReview untuk menyerahkannya ke layar Peran & akses.",
          };
        }

        const criticalGaps = analysis.result.criticalGaps as { consequence: string }[];
        if (criticalGaps.length > 0) {
          return {
            error: `Tidak dapat diterapkan lewat asisten: setelah ini ${criticalGaps[0]!.consequence}.`,
            useInstead:
              "Panggil suggestRoleReview supaya keputusannya diambil di layar Peran & akses.",
          };
        }

        if ((analysis.result.blockedGrants as unknown[]).length > 0) {
          return {
            error: "Anda tidak memegang sebagian izin yang akan diberikan, jadi server akan menolaknya.",
          };
        }

        return {
          proposal: {
            kind: "ROLE_PERMISSION_CHANGE" as const,
            roleId: analysis.roleId,
            roleName: formatRoleLabel(analysis.roleName),
            reason,
            affectedUsers: analysis.result.affectedUsers as number,
            affectedNames: analysis.result.affectedNames as string[],
            grant: analysis.added.map((key) => ({
              key,
              label: PERMISSION_LABELS[key],
              effect: describePermissionEffect(key, "grant"),
            })),
            revoke: analysis.removed.map((key) => ({
              key,
              label: PERMISSION_LABELS[key],
              effect: describePermissionEffect(key, "revoke"),
            })),
            modulesGained: analysis.result.modulesGained as string[],
            modulesLost: analysis.result.modulesLost as string[],
            editorHref: buildRoleEditorHref({
              roleId: analysis.roleId,
              grant: analysis.added,
              revoke: analysis.removed,
            }),
          },
        };
      },
    }),

    proposeCreateRole: tool({
      description:
        "Prepare a brand new role for the user to confirm and create from chat. A new role has zero holders, so creating it changes nobody's access until a human assigns someone in Settings — which the assistant cannot do. Permissions that move money, administer users or roles, or override self-approval are refused here: say so plainly and hand off with the returned href instead of silently dropping them.",
      inputSchema: z.object({
        name: z.string().min(3).max(50).describe("Role name, e.g. Site Supervisor."),
        description: z.string().max(255).optional().describe("One sentence in Bahasa Indonesia."),
        dataScope: z
          .enum(["GLOBAL", "ASSIGNED", "NONE"])
          .describe(
            "GLOBAL sees every project, ASSIGNED only projects the person is responsible for, NONE no project list at all (warehouse-style work).",
          ),
        permissions: z
          .array(z.string())
          .default([])
          .describe("Permission keys the new role should start with. Empty is valid."),
      }),
      execute: async ({ name, description, dataScope, permissions }) => {
        if (!hasPermission(context, "manage:roles")) {
          return permissionDenied("pembuatan peran");
        }

        if (!/^[A-Za-z][A-Za-z0-9 _-]*$/.test(name.trim())) {
          return { error: "Nama peran hanya boleh huruf, angka, spasi, - dan _." };
        }

        const normalized = name.trim().toUpperCase().replaceAll(" ", "_");
        const existing = await db.query.role.findMany({ limit: 50 });
        if (existing.some((row) => row.name.toUpperCase() === normalized)) {
          return { error: `Peran "${normalized}" sudah ada.` };
        }

        const unknown = permissions.filter((key) => !isKnownPermissionKey(key));
        if (unknown.length > 0) {
          return { error: `Izin tidak dikenal: ${unknown.join(", ")}.` };
        }
        const keys = permissions as PermissionKey[];

        /*
         * Ditolak seluruhnya, bukan disaring diam-diam.
         *
         * "Bikin peran seperti Finance Admin" membawa `pay:cost`. Membuangnya
         * tanpa bilang akan menghasilkan peran yang dikira mirip Finance Admin
         * padahal tidak — dan selisihnya baru ketahuan saat seseorang sudah
         * ditugaskan ke dalamnya.
         */
        const forbidden = findForbiddenProposalPermissions(keys);
        if (forbidden.length > 0) {
          return {
            error: describeForbiddenProposal(forbidden),
            href: buildRoleCreateHref({ name: name.trim(), dataScope }),
            useInstead:
              "Sampaikan penolakan ini apa adanya dan arahkan pengguna membuat perannya di layar lewat href di atas.",
          };
        }

        const blocked = keys.filter((key) => !hasPermission(context, key));
        if (blocked.length > 0) {
          return {
            error: `Anda tidak memegang ${blocked.map((key) => PERMISSION_LABELS[key]).join(", ")}, jadi izin itu tidak dapat Anda berikan.`,
          };
        }

        return {
          proposal: {
            kind: "CREATE_ROLE" as const,
            name: normalized,
            displayName: name.trim(),
            description: description?.trim() ?? "",
            dataScope,
            scopeEffect: describeDataScopeForAi(dataScope),
            permissions: keys.map((key) => ({
              key,
              label: PERMISSION_LABELS[key],
              effect: describePermissionEffect(key, "grant"),
            })),
            editorHref: buildRoleCreateHref({ name: name.trim(), dataScope }),
          },
        };
      },
    }),

    suggestRoleReview: tool({
      description:
        "Hand a permission change over to the human by producing a card that deep-links into the role editor with the suggested switches pre-highlighted but NOT applied. Call this after analyzeRoleChangeImpact when the user actually wants to proceed. You cannot apply permission changes yourself; this is how you finish such a conversation.",
      inputSchema: z.object({
        roleName: z.string().min(2).describe("Name of the role to open, e.g. PROJECT_MANAGER."),
        grant: z.array(z.string()).default([]).describe("Permission keys suggested to add."),
        revoke: z.array(z.string()).default([]).describe("Permission keys suggested to remove."),
        reason: z
          .string()
          .min(5)
          .max(200)
          .describe("One sentence in Bahasa Indonesia explaining why this change was suggested."),
      }),
      execute: async ({ roleName, grant, revoke, reason }) => {
        const analysis = await analyzeRoleChange(context, roleName, grant, revoke);
        if (!analysis.ok) return analysis.result;

        return roleReviewOutputSchema.parse({
          roleId: analysis.roleId,
          roleName: analysis.roleName,
          reason,
          href: buildRoleEditorHref({
            roleId: analysis.roleId,
            grant: analysis.added,
            revoke: analysis.removed,
          }),
          grant: analysis.added.map((key) => ({ key, label: PERMISSION_LABELS[key] })),
          revoke: analysis.removed.map((key) => ({ key, label: PERMISSION_LABELS[key] })),
          affectedUsers: analysis.result.affectedUsers as number,
          criticalGaps: analysis.result.criticalGaps as { permission: string; consequence: string }[],
          blockedGrants: (
            analysis.result.blockedGrants as { permission: string; reason: string }[]
          ).map((entry) => entry.permission),
        });
      },
    }),
  };
}
