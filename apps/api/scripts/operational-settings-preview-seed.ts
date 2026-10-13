/** Authentic operational Settings proofs, only in the named disposable preview. */
import { randomUUID } from "node:crypto";
import { eq, asc } from "drizzle-orm";
import { db, pool } from "../src/backend/db";
import {
  user,
  rolePermission,
  expenseCategory,
  aiConversation,
  aiMessage,
  INSTANCE_TENANT_ID,
} from "../src/backend/db/schema";
import { getRoleAccess } from "../src/backend/lib/auth/role-access";
import { ensureSettingsTestFixture } from "../src/backend/lib/testing/settings-fixture";
import { prepareFinanceInput } from "../src/backend/server/usecases/ai/finance-input-context";
import { writeExpenseCategorySettingsTx } from "../src/backend/server/usecases/settings/operational-settings-writer";
import { financeInputSchema, type FinanceInput } from "@atria/core/ai/finance-input";
import type { Actor } from "../src/backend/server/actor";
import type { PermissionKey } from "@atria/core/auth/permissions";
const target = new URL(process.env.ATRIA_TEST_DATABASE_URL ?? "http://invalid");
if (
  target.protocol !== "postgresql:" ||
  target.hostname !== "127.0.0.1" ||
  target.port !== "32774" ||
  target.pathname !== "/atria_audit_reconciliation" ||
  process.env.NODE_ENV === "production"
)
  throw new Error("Only named disposable preview is allowed.");
await ensureSettingsTestFixture();
const qa = await db.query.user.findFirst({
  where: eq(user.email, "reconciliation-qa@fixture.invalid"),
});
if (!qa?.roleId) throw new Error("Synthetic QA user missing.");
const grants: readonly PermissionKey[] = [
  "use:ai_chat",
  "view:settings",
  "manage:approval_settings",
  "manage:expense_categories",
  "manage:budget_settings",
];
await db
  .insert(rolePermission)
  .values(grants.map((permissionKey) => ({ roleId: qa.roleId!, permissionKey })))
  .onConflictDoNothing();
const access = await getRoleAccess(qa.roleId);
if (!access) throw new Error("QA role missing.");
const actor: Actor = {
  userId: qa.id,
  roleId: qa.roleId,
  roleName: access.roleName,
  name: qa.name,
  email: qa.email,
  isActive: true,
  mustChangePassword: false,
  sessionId: randomUUID(),
  permissions: access.permissions,
  dataScope: access.dataScope,
  developerActorUserId: null,
};
const reason = "Kebijakan operasional yang ditinjau Owner · data sintetis";
const rows = await db.query.expenseCategory.findMany({
  where: eq(expenseCategory.tenantId, INSTANCE_TENANT_ID),
  orderBy: [asc(expenseCategory.sortOrder)],
});
const ops = rows.find((row) => row.code === "OPERASIONAL");
if (!ops) throw new Error("Core category missing.");
const prefix = randomUUID().slice(0, 8);
const [custom] = await db
  .insert(expenseCategory)
  .values({
    code: `OPS_QA_${prefix}`,
    name: "Kategori QA · koreksi lengkap",
    description: "Deskripsi awal untuk referensi katalog",
    defaultRatio: "0.010000",
    isActive: true,
  })
  .returning();
const [staleCategory] = await db
  .insert(expenseCategory)
  .values({
    code: `OPS_STALE_${prefix}`,
    name: "Kategori QA · sumber berubah",
    description: "Dokumen lama",
    defaultRatio: "0.000000",
    isActive: true,
  })
  .returning();
const inputs: FinanceInput[] = [
  financeInputSchema.parse({
    action: "APPROVAL_THRESHOLDS",
    patch: { fieldCostAmount: 100.5, vendorPaymentAmount: 6_000_000 },
    reason,
  }),
  financeInputSchema.parse({
    action: "APPROVAL_THRESHOLDS",
    patch: { fieldCostAmount: 0 },
    reason: "Seluruh pengajuan lapangan memerlukan Owner · data sintetis",
  }),
  financeInputSchema.parse({
    action: "EXPENSE_CATEGORY_SETTINGS",
    expenseCategoryId: ops.id,
    patch: {
      description:
        "Biaya operasional proyek: transportasi, konsumsi lapangan, dan kebutuhan pelaksanaan.",
    },
    reason,
  }),
  financeInputSchema.parse({
    action: "EXPENSE_CATEGORY_SETTINGS",
    expenseCategoryId: ops.id,
    patch: { defaultRatio: 0.15 },
    reason: "Alokasi Operasional untuk setup berikutnya · data sintetis",
  }),
  financeInputSchema.parse({
    action: "EXPENSE_CATEGORY_SETTINGS",
    expenseCategoryId: custom.id,
    patch: {
      name: "Kategori QA · koreksi lengkap baru",
      description: "Referensi kategori yang ditinjau sebelum digunakan kembali",
      defaultRatio: 0.02,
      isActive: false,
    },
    reason,
  }),
  financeInputSchema.parse({
    action: "EXPENSE_CATEGORY_SETTINGS",
    expenseCategoryId: staleCategory.id,
    patch: { description: "Catatan AI yang belum disimpan" },
    reason,
  }),
];
const parts: Record<string, unknown>[] = [
  {
    type: "text",
    text: "Contoh Settings operasional menggunakan sumber/proof API nyata pada database disposable. Ambang presisi, ambang nol, detail kategori, review lengkap dan sumber berubah. Seluruh data sintetis.",
  },
];
for (const input of inputs) {
  const proposal = await prepareFinanceInput(actor, input);
  parts.push({
    type:
      input.action === "APPROVAL_THRESHOLDS"
        ? "tool-proposeApprovalThresholds"
        : "tool-proposeExpenseCategorySettings",
    state: "output-available",
    toolCallId: randomUUID(),
    output: { proposal },
  });
}
await db.transaction((tx) =>
  writeExpenseCategorySettingsTx(
    tx,
    actor,
    staleCategory.id,
    { description: "Sumber sudah dikoreksi manual" },
    "Koreksi manual sintetis untuk menguji stale",
  ),
);
const [conversation] = await db
  .insert(aiConversation)
  .values({ userId: qa.id, title: "QA Settings operasional · database disposable" })
  .returning();
await db.insert(aiMessage).values([
  {
    conversationId: conversation.id,
    role: "user",
    parts: [
      {
        type: "text",
        text: "Tinjau contoh Settings operasional: ambang persetujuan dan koreksi kategori. Data sintetis untuk preview; simpan hanya contoh yang dipilih secara eksplisit.",
      },
    ],
  },
  { conversationId: conversation.id, role: "assistant", parts },
]);
console.log(
  JSON.stringify({
    conversationId: conversation.id,
    categoryId: ops.id,
    customId: custom.id,
    staleCategoryId: staleCategory.id,
    cases: inputs.length,
  }),
);
await pool.end();
