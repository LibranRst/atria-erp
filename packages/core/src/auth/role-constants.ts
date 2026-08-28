/**
 * Empat peran bawaan, lengkap dengan cakupan datanya.
 *
 * `dataScope` ikut di sini karena kolom `role.data_scope` bawaannya `NONE`, dan
 * `getRoleAccess` menerima `NONE` sebagai nilai yang sah — tanpa cadangan. Peran
 * yang dibuat tanpa menyebut cakupan karena itu tidak terlihat rusak; ia hanya
 * melihat nol proyek. Nilainya wajib sama dengan `ROLE_DATA_SCOPE` di
 * `permissions.ts`, dan `role-constants.test.ts` yang menjaganya tetap sama.
 */
export const SYSTEM_ROLES = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "owner",
    description: "Pemilik perusahaan dan approver utama.",
    dataScope: "GLOBAL",
    isSystem: true,
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "finance_admin",
    description: "Finance, verifikasi, pembayaran, dan rekonsiliasi.",
    dataScope: "GLOBAL",
    isSystem: true,
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    name: "project_manager",
    description: "Pengelola proyek dan pengaju biaya.",
    dataScope: "ASSIGNED",
    isSystem: true,
  },
  {
    id: "00000000-0000-0000-0000-000000000004",
    name: "purchasing",
    description: "Purchasing dan material control.",
    dataScope: "NONE",
    isSystem: true,
  },
] as const;

export const OWNER_ROLE_ID = SYSTEM_ROLES[0].id;
export const STAFF_ROLE_IDS = new Set<string>(SYSTEM_ROLES.map((role) => role.id));
