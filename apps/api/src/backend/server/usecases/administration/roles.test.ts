import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const APP_ROOT = path.resolve(import.meta.dir, "..", "..", "..");
const WEB_ROOT = path.resolve(APP_ROOT, "..", "..", "..", "..", "apps/web");
const source = readFileSync(path.join(APP_ROOT, "server/usecases/administration/roles.ts"), "utf8");

/**
 * Invarian peran dinamis dikunci sebagai asersi sumber: badannya menyentuh
 * database di setiap jalur, dan test yang menuntut Postgres tidak akan pernah
 * berjalan di `bun run test` (lihat `lib/testing/integration-db.ts`). Yang
 * dijaga di sini adalah aturan yang paling mahal bila hilang diam-diam.
 */
describe("invarian pengelolaan peran", () => {
  test("peran Owner kebal terhadap setiap jalur penyuntingan", () => {
    // Satu penjaga bersama, bukan pemeriksaan yang diulang per fungsi — yang
    // diulang adalah yang paling mungkin terlewat di fungsi berikutnya.
    expect(source).toContain("roleId === OWNER_ROLE_ID");
    expect(source).toContain("assertManageable");
    for (const fn of [
      "updateRolePermissionsUseCase",
      "updateRoleDetailsUseCase",
      "deleteRoleUseCase",
    ]) {
      const body = source.slice(source.indexOf(`export async function ${fn}`));
      expect(body.slice(0, body.indexOf("await db.transaction"))).toContain("assertManageable");
    }
  });

  test("tidak ada jalur yang memberi izin di luar yang dimiliki pemberi", () => {
    expect(source).toContain("findEscalation");
    const create = source.slice(source.indexOf("export async function createRoleUseCase"));
    const update = source.slice(
      source.indexOf("export async function updateRolePermissionsUseCase"),
    );

    expect(create.slice(0, create.indexOf("await db.transaction"))).toContain("findEscalation");
    expect(update.slice(0, update.indexOf("await db.transaction"))).toContain("findEscalation");
  });

  test("pencabutan izin tidak ikut diperiksa sebagai eskalasi", () => {
    // Mencabut izin yang tidak dimiliki pemberi tidak menaikkan hak siapa pun;
    // memeriksanya akan mengunci Owner dari merapikan peran warisan.
    expect(source).toContain("findEscalation(actor, granted)");
  });

  test("kunci izin di luar yang ditegakkan kode ditolak", () => {
    expect(source).toContain("findUnknownKey");
    expect(source).toContain("getAllPermissionKeys");
  });

  test("hapus peran ditolak selama masih dipakai, dan menyebut jumlahnya", () => {
    const remove = source.slice(source.indexOf("export async function deleteRoleUseCase"));

    expect(remove).toContain("userCount > 0");
    expect(remove).toContain("masih dipakai ${userCount} pengguna");
    expect(remove).toContain("target.isSystem");
  });

  test("setiap perubahan menulis audit di dalam transaksinya", () => {
    for (const action of ["UPDATE_ROLE_DETAILS", "DELETE_ROLE"]) {
      expect(source).toContain(`action: "${action}"`);
    }
    // Audit izin menyimpan selisihnya, bukan sekadar keadaan akhir.
    expect(source).toContain("granted, revoked");

    /*
     * Perubahan izin memakai nama aksi yang bergantung asalnya, supaya jalur
     * kartu asisten bisa ditinjau ulang terpisah dari jalur layar. Keduanya
     * tetap satu baris audit per keputusan.
     */
    expect(source).toContain("action: AUDIT_ACTION_BY_ORIGIN[origin]");
    expect(source).toContain("action: CREATE_AUDIT_ACTION_BY_ORIGIN[origin]");
    expect(source).toContain('SCREEN: "UPDATE_ROLE_PERMISSIONS"');
    expect(source).toContain('AI_PROPOSAL: "AI_PROPOSED_ROLE_CHANGE"');
    expect(source).toContain('SCREEN: "CREATE_ROLE"');
    expect(source).toContain('AI_PROPOSAL: "AI_PROPOSED_ROLE_CREATE"');
  });

  test("identitas tidak pernah datang dari argumen klien", () => {
    expect(source).not.toMatch(/input\.(userId|actorId)\b/);
    expect(source).toContain("actor.userId");
  });
});

describe("sumber izin runtime", () => {
  const roleAccess = readFileSync(path.join(APP_ROOT, "lib/auth/role-access.ts"), "utf8");
  const permissions = readFileSync(path.join(APP_ROOT, "lib/auth/permissions.ts"), "utf8");
  const provider = readFileSync(
    path.join(WEB_ROOT, "components/auth/permissions-provider.tsx"),
    "utf8",
  );

  test("izin dibaca per request, tidak pernah ditanam ke sesi", () => {
    expect(roleAccess).toContain("cache(");
    expect(roleAccess).not.toContain("session");
  });

  test("assertPermission memakai database ketika roleId tersedia", () => {
    expect(permissions).toContain("roleHasPermission(user.roleId, permission)");
  });

  test("klien membaca izin yang sama dengan yang ditegakkan server", () => {
    // Sebelumnya komponen klien memanggil matriks kode, yang sejak peran bisa
    // disunting hanyalah nilai seed.
    expect(provider).toContain("PermissionsProvider");
    expect(provider).toContain("useCan");
  });
});
