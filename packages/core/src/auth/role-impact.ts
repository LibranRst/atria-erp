import {
  CRITICAL_PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  getAllCatalogPermissionKeys,
} from "./permission-catalog";
import type { PermissionKey } from "./permissions";

/**
 * Matematika dampak perubahan peran — murni, tanpa akses database.
 *
 * Dipisahkan dari tool AI supaya bisa diuji langsung dan dipakai ulang oleh
 * layar "Peran & akses" nanti: pertanyaan "apa yang rusak kalau ini dicabut"
 * sama pentingnya di dalam penyunting seperti di dalam percakapan.
 */

export type PermissionChange = {
  /** Izin yang benar-benar bertambah — permintaan yang sudah dipegang dibuang. */
  readonly added: readonly PermissionKey[];
  readonly removed: readonly PermissionKey[];
  readonly after: ReadonlySet<PermissionKey>;
};

export function resolvePermissionChange(
  held: ReadonlySet<PermissionKey>,
  grant: readonly PermissionKey[],
  revoke: readonly PermissionKey[],
): PermissionChange {
  const added = grant.filter((key) => !held.has(key));
  const removed = revoke.filter((key) => held.has(key));
  const after = new Set(held);
  for (const key of added) after.add(key);
  for (const key of removed) after.delete(key);
  return { added, removed, after };
}

export type ModuleDelta = {
  readonly gained: readonly string[];
  readonly lost: readonly string[];
};

/**
 * Modul yang menyeberangi nol.
 *
 * Ini satu-satunya perubahan yang mengubah apa yang **terlihat** seseorang.
 * Menambah izin kelima di modul yang sudah terbuka tidak memindahkan apa pun di
 * layarnya; menghapus izin terakhirnya membuat seluruh modul menghilang.
 */
export function computeModuleDelta(
  before: ReadonlySet<PermissionKey>,
  after: ReadonlySet<PermissionKey>,
): ModuleDelta {
  const gained: string[] = [];
  const lost: string[] = [];

  for (const group of PERMISSION_GROUPS) {
    const had = group.permissions.some((key) => before.has(key));
    const has = group.permissions.some((key) => after.has(key));
    if (!had && has) gained.push(group.title);
    if (had && !has) lost.push(group.title);
  }

  return { gained, lost };
}

export type PermissionModuleSummary = {
  readonly module: string;
  readonly granted: readonly string[];
  readonly missing: readonly string[];
};

export function summarizePermissionsByModule(
  held: ReadonlySet<PermissionKey>,
): readonly PermissionModuleSummary[] {
  return PERMISSION_GROUPS.map((group) => ({
    module: group.title,
    granted: group.permissions.filter((key) => held.has(key)).map((key) => PERMISSION_LABELS[key]),
    missing: group.permissions.filter((key) => !held.has(key)).map((key) => PERMISSION_LABELS[key]),
  }));
}

export type CriticalGap = {
  readonly permission: string;
  readonly consequence: string;
};

/**
 * Izin kritis yang kehilangan pemegang terakhirnya.
 *
 * `stillCovered` dijawab pemanggil karena hanya ia yang tahu isi database;
 * yang murni di sini adalah penilaian mana yang layak diperingatkan sama sekali.
 */
export function describeCriticalGaps(
  removed: readonly PermissionKey[],
  stillCovered: (permission: PermissionKey) => boolean,
): readonly CriticalGap[] {
  const gaps: CriticalGap[] = [];
  for (const key of removed) {
    const consequence = CRITICAL_PERMISSIONS[key];
    if (!consequence) continue;
    if (stillCovered(key)) continue;
    gaps.push({ permission: PERMISSION_LABELS[key], consequence });
  }
  return gaps;
}

export function isKnownPermissionKey(value: string): value is PermissionKey {
  return (getAllCatalogPermissionKeys() as readonly string[]).includes(value);
}

/** Saran kunci terdekat ketika sebuah nama izin ditebak dan meleset. */
export function suggestPermissionKeys(value: string, limit = 5): readonly PermissionKey[] {
  const needle = value.trim().toLowerCase();
  if (needle.length === 0) return [];

  return getAllCatalogPermissionKeys()
    .filter((key) => {
      const label = PERMISSION_LABELS[key].toLowerCase();
      return key.includes(needle) || needle.includes(key) || label.includes(needle);
    })
    .slice(0, limit);
}

export function describeDataScopeForAi(scope: string): string {
  if (scope === "GLOBAL") return "seluruh proyek";
  if (scope === "ASSIGNED") return "hanya proyek yang ditugaskan";
  return "tanpa akses daftar proyek";
}
