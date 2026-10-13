import type { PermissionKey } from "@atria/core/auth/permissions";

export type AdminNavigationItem = { readonly href: string; readonly label: string };

export function adminNavigation(
  permissions: readonly PermissionKey[],
): readonly AdminNavigationItem[] {
  return permissions.includes("view:budget") ? [{ href: "/projects", label: "Proyek" }] : [];
}

export function adminPageLabel(pathname: string): string {
  if (pathname === "/account") return "Akun saya";
  if (/^\/projects\/[^/]+\/budget$/.test(pathname)) return "Budget proyek";
  if (/^\/projects\/[^/]+$/.test(pathname)) return "Detail proyek";
  return "Proyek";
}

export function avatarInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part): string => part.slice(0, 1).toUpperCase())
      .join("") || "A"
  );
}
