import { describe, expect, test } from "bun:test";

import { PERMISSION_GROUPS } from "@atria/core/auth/permission-catalog";
import type { PermissionKey } from "@atria/core/auth/permissions";
import type { ManagedRole } from "@/server/usecases/administration/roles";
import {
  arePermissionsDirty,
  buildPermissionGroups,
  DATA_SCOPE_OPTIONS,
  describeDataScope,
  describePermissionRow,
  formatRoleName,
  isDetailsDirty,
  normalizeRoleName,
  summarizeRole,
  toRoleDraft,
  togglePermission,
} from "./role-editor";

function role(overrides: Partial<ManagedRole> = {}): ManagedRole {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    name: "SITE_SUPERVISOR",
    description: "Pengawas lapangan.",
    dataScope: "ASSIGNED",
    isSystem: false,
    isOwnerRole: false,
    userCount: 2,
    permissions: ["view:cost", "create:cost"],
    ...overrides,
  };
}

const editorSheetPath = new URL("../components/roles/role-editor-sheet.tsx", import.meta.url);
const createSheetPath = new URL("../components/roles/role-create-sheet.tsx", import.meta.url);
const managerPath = new URL("../components/roles/role-access-manager.tsx", import.meta.url);

describe("Layar peran", () => {
  test("merender setiap sakelar dan menonaktifkan yang terkunci", async () => {
    const source = await Bun.file(editorSheetPath).text();

    // Menyembunyikan izin yang terkunci akan membuat peran tampak punya lebih
    // sedikit akses daripada yang sebenarnya.
    expect(source).toContain("group.toggles.map");
    expect(source).toContain("disabled={toggle.locked}");
    expect(source).not.toContain("toggles.filter");
  });

  test("mengunci peran Owner alih-alih menyembunyikannya", async () => {
    const editor = await Bun.file(editorSheetPath).text();
    const manager = await Bun.file(managerPath).text();

    expect(manager).toContain("readOnly={selected?.isOwnerRole === true}");
    expect(editor).toContain("hideSubmit={readOnly}");
    expect(editor).toContain("lockEverything: readOnly");
  });

  test("memakai bahasa panel yang sama dengan sisa sheet untuk cakupan data", async () => {
    const [editor, create] = await Promise.all([
      Bun.file(editorSheetPath).text(),
      Bun.file(createSheetPath).text(),
    ]);

    // Diperiksa pada daftar impor, bukan seluruh berkas: komentar yang
    // menjelaskan mengapa primitif itu ditinggalkan bukan pemakaiannya.
    for (const source of [editor, create]) {
      const imports = source.slice(0, source.indexOf('from "@/components/ui"'));
      expect(imports).not.toContain("OptionChoiceGroup");
      expect(source).toContain('role="radiogroup"');
      expect(source).toContain('selectionMode="radio"');
    }
  });

  test("tidak mencetak label select dua kali", async () => {
    const source = await Bun.file(createSheetPath).text();
    const wrapped = /<FormField[^>]*>\s*<AdaptiveSelect/.test(source);

    // `AdaptiveSelect` merender labelnya sendiri; membungkusnya dengan
    // `FormField` berlabel sama mencetak "Salin izin dari" dua kali.
    expect(wrapped).toBe(false);
  });

  test("menyegarkan daftar setelah setiap mutasi", async () => {
    const source = await Bun.file(managerPath).text();
    const saves = source.split("await load();").length - 1;

    // Simpan, buat, dan hapus masing-masing harus membaca ulang: izin efektif
    // sebuah peran berubah, bukan hanya barisnya.
    expect(saves).toBe(3);
  });
});

describe("Penyunting peran", () => {
  test("menampilkan setiap kunci izin, bukan hanya yang menyala", () => {
    const groups = buildPermissionGroups(["view:cost"], ["view:cost"]);
    const shown = groups.flatMap((group) => group.toggles).length;
    const catalogued = PERMISSION_GROUPS.flatMap((group) => group.permissions).length;

    expect(shown).toBe(catalogued);
  });

  test("mengunci izin yang tidak dipegang penyunting", () => {
    const groups = buildPermissionGroups([], ["view:cost"]);
    const toggles = groups.flatMap((group) => group.toggles);

    expect(toggles.find((toggle) => toggle.key === "view:cost")?.locked).toBe(false);
    expect(toggles.find((toggle) => toggle.key === "pay:cost")?.locked).toBe(true);
  });

  test("menyorot saran tanpa mengubah satu pun nilai sakelar", () => {
    const groups = buildPermissionGroups(["view:cost"], ["view:cost", "pay:cost"], {
      suggestions: { grant: ["pay:cost"], revoke: ["view:cost"] },
    });
    const toggles = groups.flatMap((group) => group.toggles);
    const pay = toggles.find((toggle) => toggle.key === "pay:cost");
    const view = toggles.find((toggle) => toggle.key === "view:cost");

    expect(pay?.suggested).toBe("grant");
    expect(pay?.checked).toBe(false);
    expect(view?.suggested).toBe("revoke");
    expect(view?.checked).toBe(true);
  });

  test("berhenti menyorot saran yang sudah dikerjakan", () => {
    // Setelah pengguna menekan sakelarnya, sorotan yang bertahan akan terbaca
    // sebagai pekerjaan yang belum selesai.
    const groups = buildPermissionGroups(["pay:cost"], ["view:cost", "pay:cost"], {
      suggestions: { grant: ["pay:cost"], revoke: ["view:cost"] },
    });
    const toggles = groups.flatMap((group) => group.toggles);

    expect(toggles.find((toggle) => toggle.key === "pay:cost")?.suggested).toBeUndefined();
    expect(toggles.find((toggle) => toggle.key === "view:cost")?.suggested).toBeUndefined();
    expect(groups.every((group) => group.suggestedCount === 0)).toBe(true);
  });

  test("menghitung saran per grup untuk dibuka lebih dulu", () => {
    const groups = buildPermissionGroups([], [], {
      suggestions: { grant: ["pay:cost", "view:cost"], revoke: [] },
    });
    const expenses = groups.find((group) => group.key === "expenses");

    expect(expenses?.suggestedCount).toBe(2);
    expect(groups.find((group) => group.key === "material")?.suggestedCount).toBe(0);
  });

  test("membedakan terkunci dari sekadar mati", () => {
    /*
     * Keduanya tampil sebagai kotak kosong. Tanpa keterangan, "Anda tidak boleh
     * mengubah ini" tidak bisa dibedakan dari "peran ini memang tidak
     * memilikinya" — dua hal yang menuntut tindakan berbeda.
     */
    const groups = buildPermissionGroups([], ["view:cost"], {
      suggestions: { grant: ["pay:cost"], revoke: [] },
    });
    const toggles = groups.flatMap((group) => group.toggles);
    const rowOf = (key: string) => {
      const toggle = toggles.find((item) => item.key === key)!;
      return describePermissionRow(toggle);
    };

    expect(rowOf("view:cost")).toBe("view:cost");
    expect(rowOf("approve:cost")).toBe("Terkunci · approve:cost");
    // Saran menang atas "terkunci": itu yang perlu dibaca lebih dulu.
    expect(rowOf("pay:cost")).toBe("Disarankan ditambah · pay:cost");
  });

  test("mengunci seluruh sakelar pada peran yang hanya bisa dibaca", () => {
    const groups = buildPermissionGroups(["view:cost"], ["view:cost", "pay:cost"], {
      lockEverything: true,
    });

    expect(groups.flatMap((group) => group.toggles).every((toggle) => toggle.locked)).toBe(true);
  });

  test("menghitung izin aktif per grup", () => {
    const groups = buildPermissionGroups(["view:cost", "create:cost"], []);
    const expenses = groups.find((group) => group.key === "expenses");

    expect(expenses?.activeCount).toBe(2);
    expect(expenses?.totalCount).toBeGreaterThan(2);
  });

  test("menyalakan dan mematikan izin tanpa duplikat", () => {
    const once = togglePermission(["view:cost"], "pay:cost", true);
    const twice = togglePermission(once, "pay:cost", true);

    expect(twice).toEqual(once);
    expect(togglePermission(once, "pay:cost", false)).toEqual(["view:cost"]);
  });

  test("tidak menganggap nama tampilan sebagai perubahan", () => {
    // Draft memakai "Site Supervisor"; server menyimpan "SITE_SUPERVISOR".
    // Tanpa normalisasi, membuka sheet lalu menutupnya akan terlihat kotor.
    const target = role();

    expect(isDetailsDirty(target, toRoleDraft(target))).toBe(false);
    expect(normalizeRoleName("Site Supervisor")).toBe("SITE_SUPERVISOR");
  });

  test("mendeteksi perubahan detail dan izin secara terpisah", () => {
    const target = role();
    const draft = toRoleDraft(target);

    expect(isDetailsDirty(target, { ...draft, dataScope: "GLOBAL" })).toBe(true);
    expect(arePermissionsDirty(target, { ...draft, dataScope: "GLOBAL" })).toBe(false);

    const swapped: readonly PermissionKey[] = ["create:cost", "view:cost"];
    expect(arePermissionsDirty(target, { ...draft, permissions: swapped })).toBe(false);
    expect(arePermissionsDirty(target, { ...draft, permissions: ["view:cost"] })).toBe(true);
  });

  test("memberi label peran bawaan dan peran buatan tanpa tabel pencarian", () => {
    expect(formatRoleName("OWNER")).toBe("Owner");
    expect(formatRoleName("FINANCE_ADMIN")).toBe("Finance Admin");
    expect(formatRoleName("PROJECT_MANAGER")).toBe("Project Manager");
    expect(formatRoleName("PURCHASING")).toBe("Purchasing");
    expect(formatRoleName("SITE_SUPERVISOR")).toBe("Site Supervisor");
  });

  test("meringkas jumlah izin dan pemakainya", () => {
    expect(summarizeRole(role())).toBe("2 izin · 2 pengguna");
    expect(summarizeRole(role({ userCount: 0 }))).toBe("2 izin · Belum dipakai");
  });

  test("memakai label cakupan pendek di baris daftar dan label penuh di penyunting", () => {
    // Baris daftar berbagi ruang dengan dua fakta lain pada 320 px; formulir
    // punya satu baris penuh untuk tiap pilihan.
    expect(describeDataScope("ASSIGNED")).toBe("Proyek ditugaskan");
    expect(DATA_SCOPE_OPTIONS.find((option) => option.value === "ASSIGNED")?.label).toBe(
      "Proyek yang ditugaskan",
    );
  });
});
