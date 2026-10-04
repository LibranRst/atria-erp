import { withTestRequest } from "@backend/lib/testing/request";
import { getRoleDataScope, ROLE_PERMISSIONS } from "@atria/core/auth/permissions";
import { beforeAll, afterAll, expect, it } from "bun:test";
import { eq, isNull, ne, or } from "drizzle-orm";

import { db } from "@backend/db";
import { project } from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { getApprovalsPageData } from "@backend/features/approvals/server/get-approvals-page-data";
import { getExpensesPageData } from "@backend/features/expenses/server/get-expenses-page-data";
import { getFinanceDashboardPageData } from "@backend/features/finance-dashboard/server/get-finance-dashboard-page-data";
import { getProjectListPageData } from "@backend/features/projects/list/server/get-project-list-page-data";
import { getProjectDetailData } from "@backend/features/projects/detail/server/get-project-detail-data";
import { getSettingsPageData } from "@backend/features/settings/server/get-settings-page-data";
import { getReconciliationWorkspace } from "@backend/app/actions/finance/reconciliation-workspace";
import { getMaterialOperationsDashboard } from "@backend/app/actions/material/operations-dashboard";
import type { Actor } from "@backend/server/actor";
import { describeIntegration } from "@backend/lib/testing/integration-db";

/**
 * Asap untuk lapisan baca setiap rute utama.
 *
 * Test aksi membuktikan tulisan; test ini membuktikan bahwa halaman yang
 * membaca hasil tulisan itu tidak meledak. Sebuah loader yang melempar pada
 * bentuk data demo — kolom null yang tak diduga, relasi kosong — akan lolos
 * dari seluruh test aksi dan baru terlihat pada klik pertama.
 *
 * Yang diperiksa bukan isi angkanya (itu tugas suite walkthrough), melainkan
 * bahwa loader menyelesaikan pekerjaannya untuk setiap peran, dan bahwa peran
 * yang tidak berhak menerima penolakan alih-alih data.
 */

const originalGetSession = (auth.api as unknown as { getSession: unknown }).getSession;

type Persona = { readonly actor: Actor; readonly label: string };

function persona(
  label: string,
  userId: string,
  roleId: string,
  roleName: string,
  name: string,
  email: string,
): Persona {
  return {
    label,
    actor: {
      userId,
      roleId,
      roleName,
      name,
      email,
      isActive: true,
      mustChangePassword: false,
      sessionId: "test-session",
      permissions: ROLE_PERMISSIONS[roleName] ?? [],
      dataScope: getRoleDataScope(roleName),
      developerActorUserId: null,
    },
  };
}

const OWNER = persona(
  "Owner",
  "11111111-1111-1111-1111-111111111111",
  "00000000-0000-0000-0000-000000000001",
  "OWNER",
  "Ronald Wijaya",
  "ronald@dekoria.com",
);
const FINANCE = persona(
  "Finance Admin",
  "22222222-2222-2222-2222-222222222222",
  "00000000-0000-0000-0000-000000000002",
  "FINANCE_ADMIN",
  "Lisa Permata",
  "lisa@dekoria.com",
);
const PM_BUDI = persona(
  "PM Budi",
  "33333333-3333-3333-3333-333333333331",
  "00000000-0000-0000-0000-000000000003",
  "PROJECT_MANAGER",
  "Budi Santoso",
  "budi@dekoria.com",
);
const PURCHASING = persona(
  "Purchasing",
  "33333333-3333-3333-3333-333333333333",
  "00000000-0000-0000-0000-000000000004",
  "PURCHASING",
  "Agus Pratama",
  "agus@dekoria.com",
);

const ALL: readonly Persona[] = [OWNER, FINANCE, PM_BUDI, PURCHASING];

function actAs({ actor }: Persona): void {
  (auth.api as unknown as { getSession: unknown }).getSession = async (): Promise<unknown> => ({
    session: {
      id: "mock-session-id",
      userId: actor.userId,
      expiresAt: new Date(Date.now() + 3_600_000),
      token: "mock-token",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    user: {
      id: actor.userId,
      roleId: actor.roleId,
      name: actor.name,
      email: actor.email,
      emailVerified: true,
      isActive: true,
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

describeIntegration("page loaders — asap lapisan baca", () => {
  beforeAll(
    withTestRequest(() => {
      actAs(OWNER);
    }),
  );

  afterAll(
    withTestRequest(() => {
      (auth.api as unknown as { getSession: unknown }).getSession = originalGetSession;
    }),
  );

  it(
    "resolves the dashboard for every role, restricting the ones without global finance",
    withTestRequest(async () => {
      for (const p of ALL) {
        actAs(p);
        const data = await getFinanceDashboardPageData(p.actor);
        const financeRole = p === OWNER || p === FINANCE;
        expect(data.status === "restricted").toBe(!financeRole);
      }
    }),
  );

  it(
    "resolves the expenses page for every role",
    withTestRequest(async () => {
      for (const p of ALL) {
        actAs(p);
        expect(await getExpensesPageData(p.actor)).toBeDefined();
      }
    }),
  );

  it(
    "resolves the project list for every role",
    withTestRequest(async () => {
      for (const p of ALL) {
        actAs(p);
        expect(await getProjectListPageData(p.actor)).toBeDefined();
      }
    }),
  );

  it(
    "resolves the approvals page, restricting roles that cannot approve",
    withTestRequest(async () => {
      for (const p of ALL) {
        actAs(p);
        const data = await getApprovalsPageData(p.actor);
        const approver = p === OWNER || p === FINANCE;
        expect(data.status === "restricted").toBe(!approver);
      }
    }),
  );

  it(
    "resolves the reconciliation workspace for Owner and Finance",
    withTestRequest(async () => {
      for (const p of [OWNER, FINANCE]) {
        actAs(p);
        const result = await getReconciliationWorkspace();
        expect(result.success).toBe(true);
      }
    }),
  );

  it(
    "resolves the materials dashboard for Owner and Purchasing",
    withTestRequest(async () => {
      for (const p of [OWNER, PURCHASING]) {
        actAs(p);
        const result = await getMaterialOperationsDashboard();
        expect(result.success).toBe(true);
      }
    }),
  );

  it(
    "resolves the settings page for Owner",
    withTestRequest(async () => {
      actAs(OWNER);
      expect(await getSettingsPageData()).toBeDefined();
    }),
  );

  // Detail proyek adalah loader terberat: budget, RAP, RAB, stok, invoice,
  // profitability, dan closing checklist dalam satu panggilan.
  it(
    "resolves project detail for every seeded project as Owner",
    withTestRequest(async () => {
      actAs(OWNER);
      const projects = await getProjectListPageData(OWNER.actor);
      if (projects.status === "restricted") throw new Error("Owner seharusnya tidak dibatasi.");

      const ids = projects.projects.map((row) => row.id);
      // Owner melihat seluruh proyek; tanpa perbandingan ini perulangan di bawah
      // bisa lolos hanya karena daftarnya pendek.
      const allProjects = await db.select({ id: project.id }).from(project);
      expect(ids.length).toBe(allProjects.length);
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        expect(await getProjectDetailData(id)).toBeDefined();
      }
    }),
  );

  it(
    "resolves project detail for the PM who owns the project",
    withTestRequest(async () => {
      const assigned = await db.query.project.findFirst({
        where: eq(project.projectManagerId, PM_BUDI.actor.userId),
        columns: { id: true },
      });
      if (!assigned) throw new Error("Test database needs a project assigned to PM Budi.");
      actAs(PM_BUDI);
      expect(await getProjectDetailData(assigned.id)).toBeDefined();
    }),
  );

  it(
    "refuses project detail for a PM who does not own the project",
    withTestRequest(async () => {
      const unassigned = await db.query.project.findFirst({
        where: or(
          isNull(project.projectManagerId),
          ne(project.projectManagerId, PM_BUDI.actor.userId),
        ),
        columns: { id: true },
      });
      if (!unassigned)
        throw new Error("Test database needs a project outside PM Budi's assignment.");
      actAs(PM_BUDI);
      await expect(getProjectDetailData(unassigned.id)).rejects.toThrow();
    }),
  );
});
