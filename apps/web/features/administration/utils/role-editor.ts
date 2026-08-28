import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  type PermissionGroupKey,
} from "@atria/core/auth/permission-catalog";
import type { PermissionKey, RoleDataScope } from "@atria/core/auth/permissions";
import { formatRoleLabel } from "@atria/core/presentation/role-label";
import type { ManagedRole } from "@/server/usecases/administration/roles";

export type RoleDraft = {
  readonly name: string;
  readonly description: string;
  readonly dataScope: RoleDataScope;
  readonly permissions: readonly PermissionKey[];
};

export type PermissionSuggestion = "grant" | "revoke";

export type RoleSuggestions = {
  readonly grant: readonly PermissionKey[];
  readonly revoke: readonly PermissionKey[];
};

export type PermissionToggle = {
  readonly key: PermissionKey;
  readonly label: string;
  readonly checked: boolean;
  /** Izin yang tidak dipegang penyunting tidak bisa ia berikan (anti-eskalasi). */
  readonly locked: boolean;
  /**
   * Saran dari asisten, bila baris ini termasuk yang ditunjuk tautannya.
   *
   * Sekadar sorotan: nilai sakelarnya tidak ikut berubah. Menerapkannya
   * otomatis akan mengubah tautan menjadi jalan pintas menulis izin, yang
   * justru dihindari rancangan ini.
   */
  readonly suggested?: PermissionSuggestion;
};

export type PermissionGroupView = {
  readonly key: PermissionGroupKey;
  readonly title: string;
  readonly description: string;
  readonly iconName: string;
  readonly toggles: readonly PermissionToggle[];
  readonly activeCount: number;
  readonly totalCount: number;
  readonly suggestedCount: number;
};

export const DATA_SCOPE_OPTIONS: ReadonlyArray<{
  readonly value: RoleDataScope;
  readonly label: string;
  /** Bentuk pendek untuk baris daftar, tempat ia berbagi ruang dengan dua fakta lain. */
  readonly shortLabel: string;
  readonly description: string;
}> = [
  {
    value: "GLOBAL",
    label: "Seluruh proyek",
    shortLabel: "Semua proyek",
    description: "Melihat dan mengerjakan setiap proyek perusahaan.",
  },
  {
    value: "ASSIGNED",
    label: "Proyek yang ditugaskan",
    shortLabel: "Proyek ditugaskan",
    description: "Hanya proyek tempat ia terdaftar sebagai penanggung jawab.",
  },
  {
    value: "NONE",
    label: "Tanpa daftar proyek",
    shortLabel: "Tanpa proyek",
    description: "Untuk pekerjaan lintas proyek seperti gudang.",
  },
];

export function describeDataScope(scope: RoleDataScope): string {
  return DATA_SCOPE_OPTIONS.find((option) => option.value === scope)?.shortLabel ?? scope;
}

/**
 * Dipakai ulang dari core supaya layar dan kartu usulan AI mengeja nama peran
 * dengan cara yang sama.
 */
export { formatRoleLabel as formatRoleName };

export function toRoleDraft(role: ManagedRole): RoleDraft {
  return {
    name: formatRoleLabel(role.name),
    description: role.description ?? "",
    dataScope: role.dataScope,
    permissions: role.permissions,
  };
}

/**
 * Susun sakelar izin per grup katalog.
 *
 * Izin yang tidak dipegang penyunting ditampilkan **terkunci**, bukan
 * disembunyikan: server akan menolaknya (`findEscalation`), dan menyembunyikan
 * baris hanya akan membuat peran tampak punya lebih sedikit izin daripada yang
 * sebenarnya — persis kesalahan yang membuat layar izin berbahaya.
 */
export function buildPermissionGroups(
  selected: readonly PermissionKey[],
  editorPermissions: readonly PermissionKey[],
  options: { readonly lockEverything?: boolean; readonly suggestions?: RoleSuggestions } = {},
): readonly PermissionGroupView[] {
  const active = new Set<PermissionKey>(selected);
  const held = new Set<PermissionKey>(editorPermissions);
  const toGrant = new Set<PermissionKey>(options.suggestions?.grant ?? []);
  const toRevoke = new Set<PermissionKey>(options.suggestions?.revoke ?? []);

  return PERMISSION_GROUPS.map((group) => {
    const toggles = group.permissions.map((key) => ({
      key,
      label: PERMISSION_LABELS[key],
      checked: active.has(key),
      locked: options.lockEverything === true || !held.has(key),
      // Saran yang sudah dikerjakan berhenti disorot: menyala untuk yang
      // disarankan ditambah, mati untuk yang disarankan dicabut.
      suggested: toGrant.has(key)
        ? active.has(key)
          ? undefined
          : ("grant" as const)
        : toRevoke.has(key)
          ? active.has(key)
            ? ("revoke" as const)
            : undefined
          : undefined,
    }));

    return {
      key: group.key,
      title: group.title,
      description: group.description,
      iconName: group.iconName,
      toggles,
      activeCount: toggles.filter((toggle) => toggle.checked).length,
      totalCount: toggles.length,
      suggestedCount: toggles.filter((toggle) => toggle.suggested !== undefined).length,
    };
  });
}

export function togglePermission(
  selected: readonly PermissionKey[],
  key: PermissionKey,
  next: boolean,
): readonly PermissionKey[] {
  if (next) return selected.includes(key) ? selected : [...selected, key];
  return selected.filter((item) => item !== key);
}

function sameKeys(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const set = new Set(left);
  return right.every((key) => set.has(key));
}

export function isDetailsDirty(role: ManagedRole, draft: RoleDraft): boolean {
  return (
    normalizeRoleName(draft.name) !== role.name.toUpperCase() ||
    draft.description.trim() !== (role.description ?? "") ||
    draft.dataScope !== role.dataScope
  );
}

export function arePermissionsDirty(role: ManagedRole, draft: RoleDraft): boolean {
  return !sameKeys(role.permissions, draft.permissions);
}

/**
 * Server menormalkan nama peran dengan cara ini juga
 * (`server/usecases/administration/roles.ts`). Klien menirunya supaya
 * "Site Supervisor" tidak terlihat sebagai perubahan setiap kali sheet dibuka.
 */
export function normalizeRoleName(name: string): string {
  return name.trim().toUpperCase().replaceAll(" ", "_");
}

export function summarizeRole(role: ManagedRole): string {
  const users = role.userCount === 0 ? "Belum dipakai" : `${role.userCount} pengguna`;
  return `${role.permissions.length} izin · ${users}`;
}

/**
 * Keterangan baris izin.
 *
 * Kunci mentahnya berguna bagi yang mencocokkan dengan perilaku sistem, tetapi
 * ia bukan satu-satunya hal yang perlu diketahui tentang sebuah baris. Saran
 * dari asisten dan alasan sebuah sakelar terkunci ikut di sini — sebelumnya
 * saran memakai label di sisi kanan yang memepet judul sampai membungkus tiga
 * baris, dan "terkunci" tidak dinyatakan sama sekali sehingga tak bisa
 * dibedakan dari "mati".
 */
export function describePermissionRow(toggle: PermissionToggle): string {
  if (toggle.suggested === "grant") return `Disarankan ditambah · ${toggle.key}`;
  if (toggle.suggested === "revoke") return `Disarankan dicabut · ${toggle.key}`;
  if (toggle.locked) return `Terkunci · ${toggle.key}`;
  return toggle.key;
}
