import { describe, expect, test } from "bun:test";

import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  getAllCatalogPermissionKeys,
} from "./permission-catalog";
import { ROLE_PERMISSIONS, type PermissionKey } from "./permissions";

/**
 * `PERMISSION_LABELS` bertipe `Record<PermissionKey, string>`, jadi TypeScript
 * sudah menjamin isinya persis sama dengan union kunci izin — tidak kurang,
 * tidak lebih. Test ini menjaga sisanya: pemetaan kunci ke grup.
 */
const ALL_KEYS = Object.keys(PERMISSION_LABELS) as PermissionKey[];

describe("Katalog izin", () => {
  test("setiap kunci izin punya tepat satu grup", () => {
    const occurrences = new Map<string, number>();
    for (const key of getAllCatalogPermissionKeys()) {
      occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
    }

    const missing = ALL_KEYS.filter((key) => !occurrences.has(key));
    const duplicated = [...occurrences.entries()]
      .filter(([, count]) => count > 1)
      .map(([key]) => key);

    // Kunci tanpa grup tidak akan pernah muncul di layar peran — ia jadi izin
    // yang tidak bisa dicabut Owner karena tidak pernah terlihat.
    expect(missing).toEqual([]);
    expect(duplicated).toEqual([]);
  });

  test("tidak memuat kunci di luar union izin", () => {
    const known = new Set<string>(ALL_KEYS);
    const unknown = getAllCatalogPermissionKeys().filter((key) => !known.has(key));

    expect(unknown).toEqual([]);
  });

  test("mencakup kunci yang tidak dipegang satu pun peran seed", () => {
    const seeded = new Set<string>(Object.values(ROLE_PERMISSIONS).flat());
    const catalog = new Set<string>(getAllCatalogPermissionKeys());

    // Justru kunci semacam ini yang paling butuh katalog: tanpa daftar
    // eksplisit, satu-satunya sumber "kunci yang ada" adalah matriks seed, dan
    // kunci yang belum dipakai peran mana pun akan hilang dari layar.
    for (const key of ALL_KEYS) {
      if (seeded.has(key)) continue;
      expect(catalog.has(key)).toBe(true);
    }
  });

  test("setiap grup punya judul, deskripsi, ikon, dan minimal satu izin", () => {
    for (const group of PERMISSION_GROUPS) {
      expect(group.title.length).toBeGreaterThan(0);
      expect(group.description.length).toBeGreaterThan(0);
      expect(group.iconName.length).toBeGreaterThan(0);
      expect(group.permissions.length).toBeGreaterThan(0);
    }
  });
});
