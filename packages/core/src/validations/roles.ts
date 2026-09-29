import { z } from "zod";

/**
 * Skema pengelolaan peran.
 *
 * Kunci izin tidak divalidasi di sini terhadap daftar tertutup — server yang
 * memeriksanya terhadap kunci yang benar-benar ditegakkan kode, karena hanya
 * server yang tahu daftar itu lengkap.
 */
// ID sistem menggunakan UUID PostgreSQL tetap tanpa bit versi RFC 4122.
// Sama dengan validasi roleId pada administrasi pengguna; existence/RBAC tetap
// diperiksa server setelah validasi bentuk identifier.
const uuid = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "ID peran tidak valid.",
  );

const roleName = z
  .string()
  .trim()
  .min(3, "Nama peran minimal 3 karakter.")
  .max(50, "Nama peran maksimal 50 karakter.")
  .regex(/^[A-Za-z][A-Za-z0-9 _-]*$/, "Nama peran hanya boleh huruf, angka, spasi, - dan _.");

export const roleDataScopeSchema = z.enum(["GLOBAL", "ASSIGNED", "NONE"]);

export const createRoleSchema = z.object({
  name: roleName,
  description: z.string().trim().max(255).optional(),
  dataScope: roleDataScopeSchema,
  /** Kosong itu sah: peran tanpa izin adalah tempat bertengger yang aman. */
  permissions: z.array(z.string().min(1)).max(200),
  /** Menyalin izin dari peran lain — cara nyata membuat peran baru. */
  duplicateFromRoleId: uuid.optional(),
});

export const updateRolePermissionsSchema = z.object({
  roleId: uuid,
  permissions: z.array(z.string().min(1)).max(200),
});

export const updateRoleDetailsSchema = z.object({
  roleId: uuid,
  name: roleName,
  description: z.string().trim().max(255).optional(),
  dataScope: roleDataScopeSchema,
});

export const deleteRoleSchema = z.object({ roleId: uuid });

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;
export type UpdateRoleDetailsInput = z.infer<typeof updateRoleDetailsSchema>;
export type DeleteRoleInput = z.infer<typeof deleteRoleSchema>;
