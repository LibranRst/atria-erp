import { getDeveloperAccountSimulationState } from "@backend/app/actions/developer-account-simulation";
import {
  countAccessibleProfileModules,
  formatProfileRole,
  summarizeProfileAccess,
  type ProfileAccessGroup,
} from "@backend/features/profile/utils/profile-access";
import type { DeveloperAccountSimulationState } from "@atria/core/auth/developer-account-simulation";
import { getProfileInitials } from "@atria/core/presentation/user-identity";
import { resolveRoleName, type PermissionKey } from "@backend/lib/auth/permissions";
import { getRolePermissions } from "@backend/lib/auth/role-access";
import { requireServerSession } from "@backend/lib/server/session";

export type ProfileRoleStatus = "PRIMARY" | "APPROVED" | "PENDING" | "DRAFT";

export type ProfilePageData = {
  readonly displayName: string;
  readonly displayEmail: string;
  readonly imageUrl: string | null | undefined;
  readonly initials: string;
  readonly roleLabel: string;
  readonly roleStatus: ProfileRoleStatus;
  readonly isActive: boolean;
  readonly accessibleModuleCount: number;
  readonly accessGroups: readonly ProfileAccessGroup[];
  readonly canAccessSettings: boolean;
  readonly developerSimulation: DeveloperAccountSimulationState | null;
};

function getProfileRoleStatus(permissions: ReadonlySet<PermissionKey>): ProfileRoleStatus {
  // Nada badge mengikuti jangkauan wewenang, bukan nama peran, supaya peran
  // kustom mendapat nada yang masuk akal alih-alih selalu jatuh ke "DRAFT".
  if (permissions.has("decide:all_approvals")) return "PRIMARY";
  if (permissions.has("view:ledger")) return "APPROVED";
  if (permissions.has("view:project")) return "PENDING";
  return "DRAFT";
}

export async function getProfilePageData(): Promise<ProfilePageData> {
  const session = await requireServerSession();
  const roleName = await resolveRoleName(session.user.roleId);
  /*
   * Izin dibaca dari database, bukan matriks seed.
   *
   * Halaman ini menjawab "saya boleh apa saja", jadi ia harus membaca daftar
   * yang sama dengan yang ditegakkan server. Sejak izin sebuah peran bisa
   * disunting Owner, matriks kode hanya nilai awal — membacanya di sini akan
   * membuat Profile memperlihatkan akses yang sudah dicabut.
   */
  const permissions: readonly PermissionKey[] = await getRolePermissions(session.user.roleId);
  const held = new Set<PermissionKey>(permissions);
  const accessGroups = summarizeProfileAccess(permissions);
  const displayName = session.user.name || "Pengguna Atria";
  const simulation = held.has("manage:users") ? await getDeveloperAccountSimulationState() : null;

  return {
    displayName,
    displayEmail: session.user.email || "Email belum tersedia",
    imageUrl: session.user.image,
    initials: getProfileInitials(displayName),
    roleLabel: formatProfileRole(roleName),
    roleStatus: getProfileRoleStatus(held),
    isActive: session.user.isActive,
    accessibleModuleCount: countAccessibleProfileModules(accessGroups),
    accessGroups,
    canAccessSettings: held.has("view:settings"),
    developerSimulation: simulation?.success && simulation.data.enabled ? simulation.data : null,
  };
}
