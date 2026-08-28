import { describe, expect, test } from "bun:test";

import { getRoleDataScope, ROLE_PERMISSIONS } from "./permissions";
import { SYSTEM_ROLES, OWNER_ROLE_ID } from "./role-constants";

/**
 * `SYSTEM_ROLES` dan `ROLE_DATA_SCOPE` menjawab pertanyaan yang sama dari dua
 * tempat: yang pertama dipakai saat menulis baris peran, yang kedua saat
 * membacanya kembali. Ketika keduanya berbeda, peran dibuat dengan cakupan yang
 * salah dan tidak ada yang melempar — pemakainya hanya melihat nol proyek.
 */
describe("peran sistem", () => {
  test("cakupan datanya sama dengan matriks yang dipakai saat membaca", () => {
    for (const role of SYSTEM_ROLES) {
      expect({ [role.name]: role.dataScope }).toEqual({
        [role.name]: getRoleDataScope(role.name),
      });
    }
  });

  test("tidak ada peran sistem yang lolos tanpa menyebut cakupan", () => {
    // Kolom `role.data_scope` bawaannya NONE dan `getRoleAccess` menerimanya
    // sebagai nilai sah, jadi cakupan yang lupa ditulis gagal tanpa suara.
    const missing = SYSTEM_ROLES.filter((role) => !role.dataScope).map((role) => role.name);
    expect(missing).toEqual([]);
  });

  test("keempatnya ditandai peran sistem", () => {
    expect(SYSTEM_ROLES.filter((role) => !role.isSystem)).toEqual([]);
  });

  test("Owner adalah peran pertama dan punya matriks izin", () => {
    expect(SYSTEM_ROLES[0].id).toBe(OWNER_ROLE_ID);
    expect((ROLE_PERMISSIONS["OWNER"] ?? []).length).toBeGreaterThan(0);
  });
});
