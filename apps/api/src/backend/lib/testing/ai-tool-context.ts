import {
  getRoleDataScope,
  ROLE_PERMISSIONS,
  type PermissionKey,
} from "@atria/core/auth/permissions";
import type { AiToolContext } from "@backend/lib/ai/tools/context";

/**
 * Konteks tool AI untuk test.
 *
 * Test tetap menyebut nama peran karena itu yang membuat kasusnya terbaca,
 * tetapi izin dan cakupannya diturunkan dari matriks seed — bentuk yang sama
 * dengan isi `role_permission` setelah migrasi `0033`. Di produksi keduanya
 * datang dari database.
 */
export function aiToolContextForRole(
  roleName: string,
  overrides: Partial<AiToolContext> = {},
): AiToolContext {
  return {
    userId: "00000000-0000-0000-0000-000000000001",
    roleName,
    roleId: "00000000-0000-0000-0000-0000000000ff",
    permissions: (ROLE_PERMISSIONS[roleName] ?? []) as readonly PermissionKey[],
    dataScope: getRoleDataScope(roleName),
    ...overrides,
  };
}
