import { ROLE_PERMISSIONS, type PermissionKey } from "@atria/core/auth/permissions";
import { describe, it, expect } from "bun:test";
import { actorCan, resolveRoleName } from "./permissions";
import { scopeProjectQuery, assertProjectAccess, assertProjectIsOperational } from "./scoping";
import { eq } from "drizzle-orm";

async function assertFixturePermission(
  user: { readonly role: string },
  permission: PermissionKey,
): Promise<void> {
  if (!actorCan({ permissions: ROLE_PERMISSIONS[user.role.toUpperCase()] ?? [] }, permission)) {
    throw new Error("FORBIDDEN");
  }
}

describe("Atria ERP RBAC - permissions.ts", () => {
  // Test Role Name Resolution
  describe("resolveRoleName", () => {
    it("harus menyelesaikan UUID peran statis secara instan", async () => {
      const ownerRoleName = await resolveRoleName("00000000-0000-0000-0000-000000000001");
      const pmRoleName = await resolveRoleName("00000000-0000-0000-0000-000000000003");

      expect(ownerRoleName).toBe("OWNER");
      expect(pmRoleName).toBe("PROJECT_MANAGER");
    });
  });

  // Kontrak nilai seed; enforcement database diuji di effective-permissions.test.ts.
  describe("seed permission contract", () => {
    it("harus mengizinkan OWNER melakukan tindakan apa pun", async () => {
      const ownerUser = { id: "user-owner-id", role: "owner" };

      // Harus lolos tanpa melempar error
      await expect(assertFixturePermission(ownerUser, "reconcile:ledger")).resolves.toBeUndefined();
      await expect(
        assertFixturePermission(ownerUser, "delete:bank_account"),
      ).resolves.toBeUndefined();
    });

    it("harus memvalidasi izin FINANCE_ADMIN dengan benar", async () => {
      const financeUser = { id: "user-fin-id", role: "finance_admin" };

      // Diizinkan rekonsiliasi ledger
      await expect(
        assertFixturePermission(financeUser, "reconcile:ledger"),
      ).resolves.toBeUndefined();

      // Ditolak menghapus bank account
      await expect(assertFixturePermission(financeUser, "delete:bank_account")).rejects.toThrow(
        "FORBIDDEN",
      );

      // Diizinkan mengelola budget setup dan Settings defaults
      await expect(assertFixturePermission(financeUser, "create:budget")).resolves.toBeUndefined();
      await expect(assertFixturePermission(financeUser, "update:budget")).resolves.toBeUndefined();
      await expect(assertFixturePermission(financeUser, "approve:budget")).resolves.toBeUndefined();
      await expect(assertFixturePermission(financeUser, "view:settings")).resolves.toBeUndefined();
      await expect(
        assertFixturePermission(financeUser, "manage:budget_settings"),
      ).resolves.toBeUndefined();
      await expect(
        assertFixturePermission(financeUser, "manage:item_library"),
      ).resolves.toBeUndefined();
      await expect(assertFixturePermission(financeUser, "manage:vendors")).resolves.toBeUndefined();
      await expect(assertFixturePermission(financeUser, "manage:users")).rejects.toThrow(
        "FORBIDDEN",
      );
    });

    it("harus membatasi izin PROJECT_MANAGER hanya pada pengajuan biaya dan draf anggaran", async () => {
      const pmUser = { id: "user-pm-id", role: "project_manager" };

      // Diizinkan membuat draf anggaran
      await expect(assertFixturePermission(pmUser, "create:budget")).resolves.toBeUndefined();
      await expect(assertFixturePermission(pmUser, "create:cost")).resolves.toBeUndefined();

      // Ditolak melakukan rekonsiliasi kas
      await expect(assertFixturePermission(pmUser, "reconcile:ledger")).rejects.toThrow(
        "FORBIDDEN",
      );
      await expect(assertFixturePermission(pmUser, "view:settings")).rejects.toThrow("FORBIDDEN");
    });

    it("harus memberi Purchasing akses material dan membatasi akses ledger", async () => {
      const purchasingUser = {
        id: "user-purchasing-id",
        role: "purchasing",
      };

      await expect(
        assertFixturePermission(purchasingUser, "view:inventory"),
      ).resolves.toBeUndefined();
      await expect(
        assertFixturePermission(purchasingUser, "reserve:stock"),
      ).resolves.toBeUndefined();
      await expect(assertFixturePermission(purchasingUser, "waste:stock")).resolves.toBeUndefined();
      await expect(
        assertFixturePermission(purchasingUser, "transfer:stock"),
      ).resolves.toBeUndefined();
      await expect(
        assertFixturePermission(purchasingUser, "create:stock_count"),
      ).resolves.toBeUndefined();
      await expect(assertFixturePermission(purchasingUser, "adjust:stock")).rejects.toThrow(
        "FORBIDDEN",
      );
      await expect(
        assertFixturePermission(purchasingUser, "view:settings"),
      ).resolves.toBeUndefined();
      await expect(
        assertFixturePermission(purchasingUser, "manage:material_settings"),
      ).resolves.toBeUndefined();
      await expect(
        assertFixturePermission(purchasingUser, "manage:budget_settings"),
      ).rejects.toThrow("FORBIDDEN");
      await expect(assertFixturePermission(purchasingUser, "reconcile:ledger")).rejects.toThrow(
        "FORBIDDEN",
      );
    });

    it("harus membatasi PM agar hanya membaca inventory dan RAP tanpa mutasi stock global", async () => {
      const pmUser = { id: "user-pm-id", role: "project_manager" };

      await expect(assertFixturePermission(pmUser, "view:inventory")).resolves.toBeUndefined();
      await expect(assertFixturePermission(pmUser, "view:rap")).resolves.toBeUndefined();
      await expect(assertFixturePermission(pmUser, "reserve:stock")).rejects.toThrow("FORBIDDEN");
    });
  });
});

import { db } from "@/db";
import { project } from "@/db/schema";
import { describeIntegration } from "@/lib/testing/integration-db";

describeIntegration("Atria ERP Project Scoping - scoping.ts", () => {
  // `resolveRoleName` menelan error database dan mengembalikan "UNKNOWN", jadi
  // tanpa database test ini akan lulus karena koneksi gagal — bukan karena
  // barisnya memang tidak ada. Karena itu ia ikut tergerbang.
  it("harus mengembalikan UNKNOWN untuk UUID peran acak yang tidak terdaftar", async () => {
    const unknownRoleName = await resolveRoleName("00000000-9999-9999-9999-000000000000");
    expect(unknownRoleName).toBe("UNKNOWN");
  });

  // Test scopeProjectQuery
  describe("scopeProjectQuery", () => {
    it("harus mengembalikan undefined untuk OWNER dan FINANCE_ADMIN agar tidak difilter", async () => {
      const ownerFilter = await scopeProjectQuery("user-owner-id", "OWNER");
      const finFilter = await scopeProjectQuery("user-fin-id", "FINANCE_ADMIN");

      expect(ownerFilter).toBeUndefined();
      expect(finFilter).toBeUndefined();
    });

    it("harus mengembalikan filter PM yang sesuai untuk PROJECT_MANAGER", async () => {
      const pmFilter = await scopeProjectQuery("user-pm-id", "PROJECT_MANAGER");

      expect(pmFilter).toBeDefined();

      // Mengompilasi filter Drizzle ORM ke SQL nyata untuk diverifikasi
      const query = db.select().from(project).where(pmFilter).toSQL();
      expect(query.sql).toContain("project_manager_id");
      expect(query.params).toContain("user-pm-id");
    });
  });

  // Test assertProjectAccess menggunakan Seed Data
  describe("assertProjectAccess", () => {
    const BUDI_PM_ID = "33333333-3333-3333-3333-333333333331";
    const SITI_PM_ID = "33333333-3333-3333-3333-333333333332";
    const MENTENG_PROJECT_ID = "77777777-7777-7777-7777-777777777771";
    const SUDIRMAN_PROJECT_ID = "77777777-7777-7777-7777-777777777772";

    it("harus mengizinkan OWNER dan FINANCE_ADMIN mengakses proyek apa pun", async () => {
      const ownerRoleId = "00000000-0000-0000-0000-000000000001";
      await expect(
        assertProjectAccess(MENTENG_PROJECT_ID, "any-id", ownerRoleId),
      ).resolves.toBeUndefined();
    });

    it("harus mengizinkan PM mengakses proyek yang ditugaskan kepadanya", async () => {
      const pmRoleId = "00000000-0000-0000-0000-000000000003";
      // Budi ditugaskan di proyek Menteng
      await expect(
        assertProjectAccess(MENTENG_PROJECT_ID, BUDI_PM_ID, pmRoleId),
      ).resolves.toBeUndefined();
      // Siti ditugaskan di proyek Sudirman
      await expect(
        assertProjectAccess(SUDIRMAN_PROJECT_ID, SITI_PM_ID, pmRoleId),
      ).resolves.toBeUndefined();
    });

    it("harus menolak PM mengakses proyek yang ditugaskan kepada PM lain", async () => {
      const pmRoleId = "00000000-0000-0000-0000-000000000003";
      // Budi mencoba mengakses proyek Sudirman (ditugaskan ke Siti)
      await expect(assertProjectAccess(SUDIRMAN_PROJECT_ID, BUDI_PM_ID, pmRoleId)).rejects.toThrow(
        "UNAUTHORIZED",
      );
      // Siti mencoba mengakses proyek Menteng (ditugaskan ke Budi)
      await expect(assertProjectAccess(MENTENG_PROJECT_ID, SITI_PM_ID, pmRoleId)).rejects.toThrow(
        "UNAUTHORIZED",
      );
    });
  });

  describe("assertProjectIsOperational", () => {
    const MENTENG_PROJECT_ID = "77777777-7777-7777-7777-777777777771";

    it("menolak proyek Draft dan mengizinkan proyek Aktif", async () => {
      await expect(assertProjectIsOperational(MENTENG_PROJECT_ID)).resolves.toBeUndefined();

      await db.update(project).set({ status: "DRAFT" }).where(eq(project.id, MENTENG_PROJECT_ID));
      try {
        await expect(assertProjectIsOperational(MENTENG_PROJECT_ID)).rejects.toThrow(
          "PROJECT_NOT_ACTIVE",
        );
      } finally {
        await db
          .update(project)
          .set({ status: "ACTIVE" })
          .where(eq(project.id, MENTENG_PROJECT_ID));
      }
    });
  });
});
