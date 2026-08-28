import type { PermissionKey } from "./permissions";

/**
 * Kontrak tautan dari kartu chat ke penyunting peran.
 *
 * Ditulis satu kali dan dipakai dua arah: asisten menyusun tautannya, layar
 * membacanya kembali. Kalau kedua sisi menulis nama parameternya sendiri-sendiri,
 * kartu akan mengarah ke penyunting yang membuka peran yang benar tanpa satu pun
 * sakelar tersorot — gagal diam-diam, persis mode kegagalan yang paling sulit
 * disadari.
 */

export const ROLE_DEEP_LINK_PARAMS = {
  /** Tab entitas di workspace Administrasi. */
  workspace: "admin",
  role: "role",
  grant: "grant",
  revoke: "revoke",
  /** Membuka sheet "Peran baru" dengan isian awal. */
  newRole: "newRole",
  name: "name",
  scope: "scope",
} as const;

export const ROLE_WORKSPACE_VALUE = "roles";

export type RoleReviewLink = {
  readonly roleId: string;
  readonly grant?: readonly PermissionKey[];
  readonly revoke?: readonly PermissionKey[];
};

export function buildRoleEditorHref(link: RoleReviewLink): string {
  const params = new URLSearchParams([
    ["tab", "organization"],
    [ROLE_DEEP_LINK_PARAMS.workspace, ROLE_WORKSPACE_VALUE],
    [ROLE_DEEP_LINK_PARAMS.role, link.roleId],
  ]);
  if (link.grant && link.grant.length > 0) {
    params.set(ROLE_DEEP_LINK_PARAMS.grant, link.grant.join(","));
  }
  if (link.revoke && link.revoke.length > 0) {
    params.set(ROLE_DEEP_LINK_PARAMS.revoke, link.revoke.join(","));
  }
  return `/settings?${params.toString()}`;
}

/** Membaca daftar kunci dari satu parameter. Nilai kosong menghasilkan daftar kosong. */
export function parsePermissionKeyList(value: string | null): readonly string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export type RoleCreateLink = {
  readonly name?: string;
  readonly dataScope?: string;
};

/**
 * Tautan ke sheet "Peran baru" dengan isian awal.
 *
 * Dipakai ketika sebuah permintaan pembuatan peran ditolak jalur asisten —
 * penolakan yang tidak menawarkan jalan keluar hanya memindahkan pekerjaan
 * mencari ke pengguna. Izin sengaja tidak ikut: sheet pembuatan memang tidak
 * punya daftar sakelar, dan mengirim parameter yang tidak dibaca siapa pun
 * adalah janji yang tidak ditepati.
 */
export function buildRoleCreateHref(link: RoleCreateLink = {}): string {
  const params = new URLSearchParams([
    ["tab", "organization"],
    [ROLE_DEEP_LINK_PARAMS.workspace, ROLE_WORKSPACE_VALUE],
    [ROLE_DEEP_LINK_PARAMS.newRole, "1"],
  ]);
  if (link.name) params.set(ROLE_DEEP_LINK_PARAMS.name, link.name);
  if (link.dataScope) params.set(ROLE_DEEP_LINK_PARAMS.scope, link.dataScope);
  return `/settings?${params.toString()}`;
}
