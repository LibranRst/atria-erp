import { describe, it, expect } from "bun:test";
import { assertPermission, resolveRoleName } from "./permissions";
import { scopeProjectQuery, assertProjectAccess } from "./scoping";

describe("Atria ERP RBAC - permissions.ts", () => {
  // Test Role Name Resolution
  describe("resolveRoleName", () => {
    it("harus menyelesaikan UUID peran statis secara instan", async () => {
      const ownerRoleName = await resolveRoleName("00000000-0000-0000-0000-000000000001");
      const pmRoleName = await resolveRoleName("00000000-0000-0000-0000-000000000003");
      
      expect(ownerRoleName).toBe("OWNER");
      expect(pmRoleName).toBe("PROJECT_MANAGER");
    });

    it("harus mengembalikan UNKNOWN untuk UUID peran acak yang tidak terdaftar", async () => {
      const unknownRoleName = await resolveRoleName("00000000-9999-9999-9999-000000000000");
      expect(unknownRoleName).toBe("UNKNOWN");
    });
  });

  // Test assertPermission
  describe("assertPermission", () => {
    it("harus mengizinkan OWNER melakukan tindakan apa pun", async () => {
      const ownerUser = { id: "user-owner-id", role: "owner" };
      
      // Harus lolos tanpa melempar error
      await expect(assertPermission(ownerUser, "reconcile:ledger")).resolves.toBeUndefined();
      await expect(assertPermission(ownerUser, "delete:bank_account")).resolves.toBeUndefined();
    });

    it("harus memvalidasi izin FINANCE_ADMIN dengan benar", async () => {
      const financeUser = { id: "user-fin-id", roleId: "00000000-0000-0000-0000-000000000002" };

      // Diizinkan rekonsiliasi ledger
      await expect(assertPermission(financeUser, "reconcile:ledger")).resolves.toBeUndefined();
      
      // Ditolak menghapus bank account
      await expect(assertPermission(financeUser, "delete:bank_account")).rejects.toThrow("FORBIDDEN");
      
      // Diizinkan mengelola budget setup dan Settings defaults
      await expect(assertPermission(financeUser, "create:budget")).resolves.toBeUndefined();
      await expect(assertPermission(financeUser, "update:budget")).resolves.toBeUndefined();
      await expect(assertPermission(financeUser, "approve:budget")).resolves.toBeUndefined();
      await expect(assertPermission(financeUser, "view:settings")).resolves.toBeUndefined();
      await expect(assertPermission(financeUser, "manage:budget_settings")).resolves.toBeUndefined();
      await expect(assertPermission(financeUser, "manage:item_library")).resolves.toBeUndefined();
    });

    it("harus membatasi izin PROJECT_MANAGER hanya pada pengajuan biaya dan draf anggaran", async () => {
      const pmUser = { id: "user-pm-id", roleId: "00000000-0000-0000-0000-000000000003" };

      // Diizinkan membuat draf anggaran
      await expect(assertPermission(pmUser, "create:budget")).resolves.toBeUndefined();
      await expect(assertPermission(pmUser, "create:cost")).resolves.toBeUndefined();

      // Ditolak melakukan rekonsiliasi kas
      await expect(assertPermission(pmUser, "reconcile:ledger")).rejects.toThrow("FORBIDDEN");
      await expect(assertPermission(pmUser, "view:settings")).rejects.toThrow("FORBIDDEN");
    });

    it("harus memberi Purchasing akses material dan membatasi akses ledger", async () => {
      const purchasingUser = { id: "user-purchasing-id", roleId: "00000000-0000-0000-0000-000000000004" };

      await expect(assertPermission(purchasingUser, "view:inventory")).resolves.toBeUndefined();
      await expect(assertPermission(purchasingUser, "reserve:stock")).resolves.toBeUndefined();
      await expect(assertPermission(purchasingUser, "waste:stock")).resolves.toBeUndefined();
      await expect(assertPermission(purchasingUser, "transfer:stock")).resolves.toBeUndefined();
      await expect(assertPermission(purchasingUser, "create:stock_count")).resolves.toBeUndefined();
      await expect(assertPermission(purchasingUser, "adjust:stock")).rejects.toThrow("FORBIDDEN");
      await expect(assertPermission(purchasingUser, "view:settings")).resolves.toBeUndefined();
      await expect(assertPermission(purchasingUser, "manage:material_settings")).resolves.toBeUndefined();
      await expect(assertPermission(purchasingUser, "manage:budget_settings")).rejects.toThrow("FORBIDDEN");
      await expect(assertPermission(purchasingUser, "reconcile:ledger")).rejects.toThrow("FORBIDDEN");
    });

    it("harus membatasi PM agar hanya membaca inventory dan RAP tanpa mutasi stock global", async () => {
      const pmUser = { id: "user-pm-id", roleId: "00000000-0000-0000-0000-000000000003" };

      await expect(assertPermission(pmUser, "view:inventory")).resolves.toBeUndefined();
      await expect(assertPermission(pmUser, "view:rap")).resolves.toBeUndefined();
      await expect(assertPermission(pmUser, "reserve:stock")).rejects.toThrow("FORBIDDEN");
    });
  });
});

import { db } from "@/db";
import { project } from "@/db/schema";

describe("Atria ERP Project Scoping - scoping.ts", () => {
  // Test scopeProjectQuery
  describe("scopeProjectQuery", () => {
    it("harus mengembalikan undefined untuk OWNER dan FINANCE_ADMIN agar tidak difilter", () => {
      const ownerFilter = scopeProjectQuery("user-owner-id", "OWNER");
      const finFilter = scopeProjectQuery("user-fin-id", "FINANCE_ADMIN");

      expect(ownerFilter).toBeUndefined();
      expect(finFilter).toBeUndefined();
    });

    it("harus mengembalikan filter PM yang sesuai untuk PROJECT_MANAGER", () => {
      const pmFilter = scopeProjectQuery("user-pm-id", "PROJECT_MANAGER");
      
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
      await expect(assertProjectAccess(MENTENG_PROJECT_ID, "any-id", ownerRoleId)).resolves.toBeUndefined();
    });

    it("harus mengizinkan PM mengakses proyek yang ditugaskan kepadanya", async () => {
      const pmRoleId = "00000000-0000-0000-0000-000000000003";
      // Budi ditugaskan di proyek Menteng
      await expect(assertProjectAccess(MENTENG_PROJECT_ID, BUDI_PM_ID, pmRoleId)).resolves.toBeUndefined();
      // Siti ditugaskan di proyek Sudirman
      await expect(assertProjectAccess(SUDIRMAN_PROJECT_ID, SITI_PM_ID, pmRoleId)).resolves.toBeUndefined();
    });

    it("harus menolak PM mengakses proyek yang ditugaskan kepada PM lain", async () => {
      const pmRoleId = "00000000-0000-0000-0000-000000000003";
      // Budi mencoba mengakses proyek Sudirman (ditugaskan ke Siti)
      await expect(assertProjectAccess(SUDIRMAN_PROJECT_ID, BUDI_PM_ID, pmRoleId)).rejects.toThrow("UNAUTHORIZED");
      // Siti mencoba mengakses proyek Menteng (ditugaskan ke Budi)
      await expect(assertProjectAccess(MENTENG_PROJECT_ID, SITI_PM_ID, pmRoleId)).rejects.toThrow("UNAUTHORIZED");
    });
  });
});
