import { withTestRequest } from "@backend/lib/testing/request";
import { afterAll, beforeAll, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";

import { db } from "@backend/db";
import {
  auditLog,
  rolePermission,
  role,
  user,
  tenant,
  tenantMember,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { getAllPermissionKeys } from "@backend/lib/auth/role-access";
import { auth } from "@backend/lib/auth";
import { confirmAiRoleChangeProposal } from "@backend/app/actions/ai/confirm-role-proposal";
import { createConversation } from "@backend/lib/ai/conversation-store";
import { describeIntegration } from "@backend/lib/testing/integration-db";

/**
 * Pagar jalur usulan izin lewat asisten, diuji terhadap database sungguhan.
 *
 * `ai-role-proposal-guards.test.ts` menjaga pagarnya tidak terhapus dari kode;
 * berkas ini menjaga pagarnya benar-benar menolak. Keduanya dibutuhkan: pagar
 * yang ada tetapi salah urutan sama tidak bergunanya dengan pagar yang hilang.
 */

const originalGetSession = (auth.api as unknown as { getSession: unknown }).getSession;

const OWNER_ROLE = "00000000-0000-0000-0000-000000000001";
const PROJECT_MANAGER_ROLE = "00000000-0000-0000-0000-000000000003";

const RONALD = {
  id: "11111111-1111-1111-1111-111111111111",
  roleId: OWNER_ROLE,
  email: "ronald@dekoria.com",
  name: "Ronald Wijaya",
};

function actAs(user: typeof RONALD): void {
  (auth.api as unknown as { getSession: unknown }).getSession = async (): Promise<unknown> => ({
    session: {
      id: "mock-session-id",
      userId: user.id,
      expiresAt: new Date(Date.now() + 3_600_000),
      token: "mock-token",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    user: { ...user, emailVerified: true, isActive: true },
  });
}

async function holdsPermission(roleId: string, key: string): Promise<boolean> {
  const rows = await db.query.rolePermission.findMany({
    where: eq(rolePermission.roleId, roleId),
    columns: { permissionKey: true },
  });
  return rows.some((row) => row.permissionKey === key);
}

describeIntegration("pagar konfirmasi usulan izin AI", () => {
  beforeAll(async () => {
    // Self-contained fixtures also work on the schema-only disposable database.
    await db
      .insert(tenant)
      .values({ id: INSTANCE_TENANT_ID, name: "Role guards test", slug: "role-guards-test" })
      .onConflictDoNothing();
    await db
      .insert(role)
      .values([
        { id: OWNER_ROLE, name: "OWNER", isSystem: true, dataScope: "GLOBAL" },
        {
          id: PROJECT_MANAGER_ROLE,
          name: "PROJECT_MANAGER",
          isSystem: true,
          dataScope: "ASSIGNED",
        },
      ])
      .onConflictDoNothing();
    await db
      .insert(rolePermission)
      .values(
        getAllPermissionKeys().map((permissionKey) => ({ roleId: OWNER_ROLE, permissionKey })),
      )
      .onConflictDoNothing();
    await db
      .insert(user)
      .values({ ...RONALD, isActive: true, emailVerified: true })
      .onConflictDoNothing();
    await db
      .insert(tenantMember)
      .values({
        tenantId: INSTANCE_TENANT_ID,
        userId: RONALD.id,
        roleId: OWNER_ROLE,
        isActive: true,
      })
      .onConflictDoNothing();
  });
  afterAll(
    withTestRequest(() => {
      (auth.api as unknown as { getSession: unknown }).getSession = originalGetSession;
    }),
  );

  it(
    "menolak izin pencairan uang dan tidak menulis apa pun",
    withTestRequest(async () => {
      actAs(RONALD);
      const conversation = await createConversation(RONALD.id, "Uji pagar");

      const before = await holdsPermission(PROJECT_MANAGER_ROLE, "pay:cost");
      const result = await confirmAiRoleChangeProposal({
        toolCallId: `guard-pay-${Date.now()}`,
        conversationId: conversation.id,
        roleId: PROJECT_MANAGER_ROLE,
        grant: ["pay:cost"],
        revoke: [],
      });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe("FORBIDDEN");
      expect(await holdsPermission(PROJECT_MANAGER_ROLE, "pay:cost")).toBe(before);
    }),
  );

  it(
    "menolak izin pengelolaan peran, jalur yang bisa memperluas dirinya sendiri",
    withTestRequest(async () => {
      actAs(RONALD);
      const conversation = await createConversation(RONALD.id, "Uji pagar");

      const result = await confirmAiRoleChangeProposal({
        toolCallId: `guard-roles-${Date.now()}`,
        conversationId: conversation.id,
        roleId: PROJECT_MANAGER_ROLE,
        grant: ["manage:roles"],
        revoke: [],
      });

      expect(result.success).toBe(false);
      expect(await holdsPermission(PROJECT_MANAGER_ROLE, "manage:roles")).toBe(false);
    }),
  );

  it(
    "menolak menyentuh peran Owner",
    withTestRequest(async () => {
      actAs(RONALD);
      const conversation = await createConversation(RONALD.id, "Uji pagar");

      const result = await confirmAiRoleChangeProposal({
        toolCallId: `guard-owner-${Date.now()}`,
        conversationId: conversation.id,
        roleId: OWNER_ROLE,
        grant: ["view:cost"],
        revoke: [],
      });

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe("FORBIDDEN");
    }),
  );

  it(
    "tidak menulis apa pun ketika pencabutannya no-op",
    withTestRequest(async () => {
      /*
       * Jalur "pemegang terakhir" sendiri tidak bisa dicapai dengan data seed:
       * satu-satunya peran yang memegang izin kritis seorang diri adalah Owner,
       * dan Owner sudah ditolak lebih dulu oleh pagar di atas. Yang diuji di sini
       * adalah bahwa permintaan tanpa perubahan nyata tetap tidak menulis.
       */
      actAs(RONALD);
      const conversation = await createConversation(RONALD.id, "Uji pagar");

      const result = await confirmAiRoleChangeProposal({
        toolCallId: `guard-gap-${Date.now()}`,
        conversationId: conversation.id,
        roleId: PROJECT_MANAGER_ROLE,
        // PM tidak memegangnya, jadi pencabutannya no-op dan tidak boleh menulis.
        grant: [],
        revoke: ["approve:cost"],
      });

      // Tidak ada perubahan berarti: use-case mengembalikan `updated: false`.
      expect(result).toMatchObject({ success: true });
      if (result.success) expect(result.data.alreadyConfirmed).toBe(false);
      expect(await holdsPermission(PROJECT_MANAGER_ROLE, "approve:cost")).toBe(false);
    }),
  );

  it(
    "menandai auditnya sebagai perubahan yang datang dari asisten",
    withTestRequest(async () => {
      actAs(RONALD);
      const conversation = await createConversation(RONALD.id, "Uji audit");
      const toolCallId = `guard-audit-${Date.now()}`;

      const result = await confirmAiRoleChangeProposal({
        toolCallId,
        conversationId: conversation.id,
        roleId: PROJECT_MANAGER_ROLE,
        grant: ["view:profitability"],
        revoke: [],
      });
      expect(result).toMatchObject({ success: true });

      const rows = await db.query.auditLog.findMany({
        where: eq(auditLog.targetId, PROJECT_MANAGER_ROLE),
        columns: { action: true },
      });
      expect(rows.some((row) => row.action === "AI_PROPOSED_ROLE_CHANGE")).toBe(true);

      // Kembalikan HANYA izin yang baru ditambahkan. Menghapus per peran akan
      // mengosongkan seluruh izin Project Manager di database uji.
      await db
        .delete(rolePermission)
        .where(
          and(
            eq(rolePermission.roleId, PROJECT_MANAGER_ROLE),
            eq(rolePermission.permissionKey, "view:profitability"),
          ),
        );
    }),
  );
});
