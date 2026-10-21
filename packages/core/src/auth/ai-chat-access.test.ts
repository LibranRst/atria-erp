import { describe, expect, test } from "bun:test";

import { actorHasPermission } from "./permissions";

/**
 * Siapa yang boleh membuka asisten AI adalah janji yang dikutip dua kali oleh
 * `docs/guide/seeded_demo_walkthrough.md` — bagian 12A ("tombol hanya muncul
 * untuk Owner, Finance Admin, dan PM") dan tabel negative test bagian 13.
 * Sebelumnya tidak ada satu pun test yang memakunya, sehingga menambah
 * `use:ai_chat` ke peran gudang atau sales tidak akan menggagalkan apa pun.
 */
describe("akses asisten AI", () => {
  test.each(["OWNER", "FINANCE_ADMIN", "PROJECT_MANAGER", "PURCHASING"])(
    "%s boleh membuka chat",
    (role) => {
      expect(actorHasPermission(role, "use:ai_chat")).toBe(true);
    },
  );

  test.each(["SITE_SUPERVISOR", "UNKNOWN_ROLE"])("%s tidak boleh membuka chat", (role) => {
    expect(actorHasPermission(role, "use:ai_chat")).toBe(false);
  });
});
