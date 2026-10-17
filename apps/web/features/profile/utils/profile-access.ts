import type { PermissionKey } from "@atria/core/auth/permissions";
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  type PermissionGroupKey,
} from "@atria/core/auth/permission-catalog";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";

export type ProfileAccessPermission = {
  readonly key: PermissionKey;
  readonly label: string;
  readonly granted: boolean;
};

export type ProfileAccessGroup = {
  readonly key: PermissionGroupKey;
  readonly title: string;
  readonly description: string;
  readonly iconName: string;
  /** Hanya izin aktif yang benar-benar tersedia dalam workspace responsif. */
  readonly permissions: readonly ProfileAccessPermission[];
  readonly grantedCount: number;
  readonly totalCount: number;
};

/**
 * Izin yang sengaja tidak ditampilkan di Profile.
 *
 * `view:ai_brief` dipertahankan di matriks untuk kompatibilitas, tetapi AI CFO
 * belum punya permukaan mana pun (lihat CLAUDE.md dan
 * `docs/plans/2026-07-15-profile-main-surface-rework.md`). Menampilkannya berarti
 * menjanjikan akses ke layar yang tidak ada.
 *
 * `use:desktop_admin` juga hanya tersimpan untuk kompatibilitas. Tampilan
 * desktop responsif tersedia untuk semua peran; kunci lama bukan syarat akses.
 *
 * Penyaringnya harus mengenai **pembilang dan penyebut** sekaligus. Sebelumnya
 * hanya pembilang yang disaring, sehingga Owner — yang memegang kedua kunci AI —
 * membaca "1/2" dan wajar mengira ada akses yang hilang.
 *
 * Ini penyaringan presentasi, bukan otoritas: layar peran tetap memuat kunci ini
 * dari katalog penuh supaya ia bisa dicabut.
 */
const HIDDEN_PROFILE_PERMISSIONS: ReadonlySet<PermissionKey> = new Set<PermissionKey>([
  "view:ai_brief",
  "use:desktop_admin",
]);

export function summarizeProfileAccess(
  permissions: readonly PermissionKey[],
): readonly ProfileAccessGroup[] {
  const held = new Set<PermissionKey>(permissions);

  return PERMISSION_GROUPS.map((group) => {
    const visible = group.permissions
      .filter((permission) => !HIDDEN_PROFILE_PERMISSIONS.has(permission))
      .map((permission) => ({
        key: permission,
        label: PERMISSION_LABELS[permission],
        granted: held.has(permission),
      }));

    return {
      key: group.key,
      title: group.title,
      description: group.description,
      iconName: group.iconName,
      permissions: visible,
      grantedCount: visible.filter((permission) => permission.granted).length,
      totalCount: visible.length,
    };
  }).filter((group) => group.totalCount > 0);
}

export function countAccessibleProfileModules(groups: readonly ProfileAccessGroup[]): number {
  return groups.filter((group) => group.grantedCount > 0).length;
}

/** Ringkasan cakupan satu modul dalam kalimat, bukan pecahan. */
export function describeAccessCoverage(group: ProfileAccessGroup): string {
  if (group.grantedCount === 0) return "Tidak tersedia untuk peran ini";
  if (group.grantedCount === group.totalCount) return `Akses penuh · ${group.totalCount} hak`;
  return `${group.grantedCount} dari ${group.totalCount} hak`;
}

export function formatProfileRole(roleName: string): string {
  const roleLabels: Readonly<Record<string, string>> = {
    OWNER: "Owner",
    FINANCE_ADMIN: "Finance Admin",
    PROJECT_MANAGER: "Project Manager",
    PURCHASING: "Purchasing",
    DESIGNER: "Designer",
  };

  return roleLabels[roleName] ?? formatBusinessLabel(roleName);
}
