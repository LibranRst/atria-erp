import { z } from "zod";
import type { PermissionKey } from "../auth/permissions";
import { updateRoleDetailsSchema } from "../validations/roles";
const id = z.string().guid();
const reason = z.string().trim().min(10, "Jelaskan alasan perubahan minimal10 karakter.").max(1000);
const staffPatch = z
  .object({
    name: z.string().trim().min(2).max(255).optional(),
    roleId: id.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (p) => Object.values(p).some((v) => v !== undefined),
    "Pilih data staf yang ingin diubah.",
  );
const rolePatch = z
  .object({
    name: updateRoleDetailsSchema.shape.name.optional(),
    description: z.string().trim().max(255).nullable().optional(),
    dataScope: updateRoleDetailsSchema.shape.dataScope.optional(),
  })
  .strict()
  .refine(
    (p) => Object.values(p).some((v) => v !== undefined),
    "Pilih detail peran yang ingin diubah.",
  );
export const administrationInputSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("STAFF_CHANGES"),
      users: z
        .array(z.object({ userId: id, patch: staffPatch }).strict())
        .min(1)
        .max(50)
        .refine(
          (rows) => new Set(rows.map((r) => r.userId)).size === rows.length,
          "Staf yang sama tidak boleh berulang.",
        ),
      reason,
    })
    .strict(),
  z.object({ action: z.literal("ROLE_DETAILS"), roleId: id, patch: rolePatch, reason }).strict(),
  z.object({ action: z.literal("ROLE_DELETE"), roleId: id, reason }).strict(),
]);
const fact = z.object({ label: z.string(), value: z.union([z.string(), z.number()]) });
const change = z.object({ label: z.string(), before: z.string(), after: z.string() });
export const ADMINISTRATION_KIND = "ADMINISTRATION";
export const administrationProposalSchema = z
  .object({
    kind: z.literal(ADMINISTRATION_KIND),
    input: administrationInputSchema,
    title: z.string(),
    entityName: z.string(),
    effect: z.string(),
    expectedContext: z.string().length(64),
    sensitive: z.boolean(),
    summary: z.array(fact),
    rows: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          meta: z.string(),
          changes: z.array(change),
          facts: z.array(fact),
          added: z.array(z.string()),
          removed: z.array(z.string()),
        }),
      )
      .max(201),
  })
  .strict();
export const administrationIdentitySchema = z
  .object({ conversationId: id, toolCallId: z.string().min(1).max(200) })
  .strict();
export type AdministrationInput = z.infer<typeof administrationInputSchema>;
export type AdministrationProposal = z.infer<typeof administrationProposalSchema>;
export type AdministrationView = {
  readonly proposal: AdministrationProposal;
  readonly status: "READY" | "STALE" | "EXPIRED" | "CONFIRMED";
  readonly resultId: string | null;
};
export function administrationPermission(input: AdministrationInput): PermissionKey {
  return input.action === "STAFF_CHANGES" ? "manage:users" : "manage:roles";
}
export function projectScopeLabel(scope: string): string {
  return scope === "GLOBAL"
    ? "Semua proyek"
    : scope === "ASSIGNED"
      ? "Proyek yang ditugaskan"
      : "Tanpa akses proyek";
}
