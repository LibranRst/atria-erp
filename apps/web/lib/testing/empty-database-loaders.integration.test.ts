import { ROLE_PERMISSIONS } from "@atria/core/auth/permissions";
import { SYSTEM_ROLES } from "@atria/core/auth/role-constants";
import { beforeAll, expect, it, mock } from "bun:test";

import { getApprovalsPageData } from "@/features/approvals/server/get-approvals-page-data";
import { getExpensesPageData } from "@/features/expenses/server/get-expenses-page-data";
import { getFinanceDashboardPageData } from "@/features/finance-dashboard/server/get-finance-dashboard-page-data";
import { getProjectListPageData } from "@/features/projects/list/server/get-project-list-page-data";
import { getSettingsPageData } from "@/features/settings/server/get-settings-page-data";
import { getReconciliationWorkspace } from "@/app/actions/finance/reconciliation-workspace";
import { getMaterialOperationsDashboard } from "@/app/actions/material/operations-dashboard";
import { auth } from "@/lib/auth";
import type { Actor } from "@/server/actor";
import { describeEmptyIntegration } from "@/lib/testing/integration-db";
import { db } from "@/db";
import { role } from "@/db/schema";

/**
 * Keadaan awal `docs/guide/financial_workflow_guide.md`: Owner baru saja dibuat
 * lewat `/setup`, dan belum ada satu pun proyek, rekening, atau transaksi.
 *
 * Nol baris adalah bentuk data yang paling mudah meruntuhkan loader — reduce
 * atas array kosong, pembagian dengan nol, `rows[0]` yang undefined — dan tidak
 * satu pun test aksi menyentuhnya, karena aksi selalu menulis sesuatu lebih
 * dulu. Kalau salah satu loader ini melempar, pengguna terbentur pada klik
 * pertamanya, sebelum sempat mengikuti runbook.
 *
 * Dijalankan dengan mengarahkan `ATRIA_TEST_EMPTY_DATABASE_URL` ke database
 * yang sudah dimigrasikan tetapi belum di-seed.
 */

mock.module("next/headers", () => ({ cookies: () => ({ toString: () => "mocked-cookies" }) }));
mock.module("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const OWNER: Actor = {
  userId: "11111111-1111-1111-1111-111111111111",
  roleId: "00000000-0000-0000-0000-000000000001",
  roleName: "OWNER",
  name: "Owner Pertama",
  email: "owner@example.com",
  isActive: true,
  mustChangePassword: false,
  sessionId: "test-session",
  permissions: ROLE_PERMISSIONS["OWNER"] ?? [],
  dataScope: "GLOBAL",
  developerActorUserId: null,
};

(auth.api as unknown as { getSession: unknown }).getSession = async (): Promise<unknown> => ({
  session: {
    id: "mock-session-id",
    userId: OWNER.userId,
    expiresAt: new Date(Date.now() + 3_600_000),
    token: "mock-token",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  user: {
    id: OWNER.userId,
    roleId: OWNER.roleId,
    name: OWNER.name,
    email: OWNER.email,
    emailVerified: true,
    isActive: true,
    mustChangePassword: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
});

const LOADERS: ReadonlyArray<readonly [string, () => Promise<unknown>]> = [
  ["dashboard", () => getFinanceDashboardPageData(OWNER)],
  ["expenses", () => getExpensesPageData(OWNER)],
  ["daftar proyek", () => getProjectListPageData(OWNER)],
  ["approvals", () => getApprovalsPageData(OWNER)],
  ["settings", () => getSettingsPageData()],
  ["reconciliation", () => getReconciliationWorkspace()],
  ["materials", () => getMaterialOperationsDashboard()],
];

describeEmptyIntegration("page loaders pada database kosong", () => {
  /**
   * `/setup` menanam `SYSTEM_ROLES` sebelum membuat Owner pertama, jadi baris
   * peran selalu ada begitu ada orang yang bisa memanggil loader sama sekali.
   *
   * Tanpa langkah ini suite menguji keadaan yang tidak pernah terjadi: database
   * tanpa satu pun baris `role`, di mana `getRoleAccess` mengembalikan `null`
   * dan setiap loader berpagar izin melempar FORBIDDEN. Yang gagal bukan
   * aplikasinya, melainkan panggung yang dipasang keliru — dan kegagalan itu
   * membuat jaring pengaman ini tidak pernah bisa dijalankan.
   *
   * `role_permission` sengaja dibiarkan kosong. Itulah keadaan sesudah reset,
   * dan cadangan ke matriks kode di `getRoleAccess` memang dirancang untuk
   * menutupnya — suite ini sekaligus membuktikan cadangan itu bekerja.
   */
  beforeAll(async () => {
    await db
      .insert(role)
      .values([...SYSTEM_ROLES])
      .onConflictDoNothing();
  });

  for (const [label, load] of LOADERS) {
    it(`loader ${label} bertahan tanpa satu baris pun`, async () => {
      expect(await load()).toBeDefined();
    });
  }
});
