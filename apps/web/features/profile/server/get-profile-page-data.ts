import "server-only";

import { getDeveloperAccountSimulationState } from "@/app/actions/developer-account-simulation";
import {
  countAccessibleProfileModules,
  formatProfileRole,
  getProfileInitials,
  summarizeProfileAccess,
  type ProfileAccessGroup,
} from "@/features/profile/utils/profile-access";
import type { DeveloperAccountSimulationState } from "@atria/core/auth/developer-account-simulation";
import { resolveRoleName, ROLE_PERMISSIONS, type PermissionKey } from "@/lib/auth/permissions";
import { requireServerSession } from "@/lib/server/session";

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

function getProfileRoleStatus(roleName: string): ProfileRoleStatus {
  if (roleName === "OWNER") return "PRIMARY";
  if (roleName === "FINANCE_ADMIN") return "APPROVED";
  if (roleName === "PROJECT_MANAGER") return "PENDING";
  return "DRAFT";
}

export async function getProfilePageData(): Promise<ProfilePageData> {
  const session = await requireServerSession();
  const roleName = await resolveRoleName(session.user.roleId);
  const permissions: readonly PermissionKey[] = ROLE_PERMISSIONS[roleName] ?? [];
  const accessGroups = summarizeProfileAccess(permissions);
  const displayName = session.user.name || "Pengguna Atria";
  const simulation = roleName === "OWNER" ? await getDeveloperAccountSimulationState() : null;

  return {
    displayName,
    displayEmail: session.user.email || "Email belum tersedia",
    imageUrl: session.user.image,
    initials: getProfileInitials(displayName),
    roleLabel: formatProfileRole(roleName),
    roleStatus: getProfileRoleStatus(roleName),
    isActive: session.user.isActive,
    accessibleModuleCount: countAccessibleProfileModules(accessGroups),
    accessGroups,
    canAccessSettings: permissions.includes("view:settings"),
    developerSimulation: simulation?.success && simulation.data.enabled ? simulation.data : null,
  };
}
