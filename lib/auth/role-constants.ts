export const SYSTEM_ROLES = [
  { id: "00000000-0000-0000-0000-000000000001", name: "owner", description: "Pemilik perusahaan dan approver utama." },
  { id: "00000000-0000-0000-0000-000000000002", name: "finance_admin", description: "Finance, verifikasi, pembayaran, dan rekonsiliasi." },
  { id: "00000000-0000-0000-0000-000000000003", name: "project_manager", description: "Pengelola proyek dan pengaju biaya." },
  { id: "00000000-0000-0000-0000-000000000004", name: "purchasing", description: "Purchasing dan material control." },
] as const;

export const OWNER_ROLE_ID = SYSTEM_ROLES[0].id;
export const STAFF_ROLE_IDS = new Set<string>(SYSTEM_ROLES.map((role) => role.id));

