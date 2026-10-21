import { eq } from "drizzle-orm";
/** Synthetic, loopback-only Browser fixtures backed by the real reconciliation operations. */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { db, pool } from "../src/backend/db";
import {
  account,
  bankAccount,
  user,
  role,
  rolePermission,
  cashTransaction,
  aiConversation,
  aiMessage,
} from "../src/backend/db/schema";
import {
  importStatementRowsTx,
  setReconciliationExceptionTx,
} from "../src/backend/server/usecases/finance/reconciliation-writer";
import { prepareReconciliationProposal } from "../src/backend/server/usecases/ai/reconciliation-context";
import type { ReconciliationInput } from "@atria/core/ai/bank-reconciliation";
import type { PermissionKey } from "@atria/core/auth/permissions";
const target = new URL(process.env.ATRIA_TEST_DATABASE_URL ?? "http://invalid");
if (
  target.protocol !== "postgresql:" ||
  target.hostname !== "127.0.0.1" ||
  target.pathname !== "/atria_audit_reconciliation" ||
  process.env.NODE_ENV === "production"
)
  throw new Error("Only the named disposable reconciliation database is allowed.");
const permissions: PermissionKey[] = [
  "use:ai_chat",
  "view:bank_account",
  "reconcile:ledger",
  "view:ledger",
  "view:project",
];
const [qaRole] = await db
  .insert(role)
  .values({ name: `QA Rekonsiliasi ${randomUUID().slice(0, 8)}`, dataScope: "GLOBAL" })
  .returning();
await db
  .insert(rolePermission)
  .values(permissions.map((permissionKey) => ({ roleId: qaRole.id, permissionKey })));
const existingUser = await db.query.user.findFirst({
  where: eq(user.email, "reconciliation-qa@fixture.invalid"),
});
const qaUser =
  existingUser ??
  (
    await db
      .insert(user)
      .values({
        name: "QA Rekonsiliasi · data sintetis",
        email: "reconciliation-qa@fixture.invalid",
        emailVerified: true,
        roleId: qaRole.id,
        isActive: true,
        mustChangePassword: false,
      })
      .returning()
  )[0]!;
if (!existingUser)
  await db.insert(account).values({
    id: randomUUID(),
    accountId: qaUser.id,
    userId: qaUser.id,
    providerId: "credential",
    password: await hashPassword("Reconciliation-QA-2026!"),
  });
const [bank] = await db
  .insert(bankAccount)
  .values({
    name: "Rekening QA Rekonsiliasi",
    bankName: "Bank QA",
    accountNumber: `QA-RECONCILIATION-${randomUUID().slice(0, 8)}`,
    holderName: "Data sintetis",
    balance: "5000000.00",
  })
  .returning();
const mutations = Array.from({ length: 6 }, (_, i) => ({
  transactionDate: "2026-10-11",
  description: i < 4 ? `Mutasi QA REF-${i + 1}` : `Mutasi QA ambigu ${i + 1}`,
  amount: i < 4 ? (i + 1) * 10000 : 250000,
  type: "OUTFLOW" as const,
  source: "Fixture sintetis · mutasi bank",
}));
const imported = await db.transaction((tx) =>
  importStatementRowsTx(tx, qaUser.id, {
    bankAccountId: bank.id,
    fileName: "Mutasi QA tersimpan",
    rows: mutations.map((r) => ({ ...r, transactionDate: new Date(r.transactionDate) })),
  }),
);
for (const [i, m] of mutations.entries())
  await db.insert(cashTransaction).values({
    bankAccountId: bank.id,
    type: m.type,
    amount: m.amount.toFixed(2),
    description: i < 4 ? `Catatan Atria QA ${i + 1}` : `Catatan Atria ambigu ${i + 1}`,
    category: "other",
    bankReference: i < 4 ? `REF-${i + 1}` : null,
    createdAt: new Date("2026-10-11"),
  });
const extras = await db
  .insert(cashTransaction)
  .values(
    [35000, 45000].map((amount, i) => ({
      bankAccountId: bank.id,
      type: "OUTFLOW",
      amount: amount.toFixed(2),
      description: `Pengecualian QA ${i + 1}`,
      category: "other",
      createdAt: new Date("2026-10-11"),
    })),
  )
  .returning();
await db.transaction((tx) =>
  setReconciliationExceptionTx(tx, qaUser.id, {
    cashTransactionId: extras[1].id,
    reason: "Bukti bank belum diterima · data sintetis",
  }),
);
const actor = { userId: qaUser.id, permissions, dataScope: "GLOBAL" as const };
const inputs: ReconciliationInput[] = [
  {
    action: "IMPORT",
    bankAccountId: bank.id,
    fileName: "Impor QA · data sintetis",
    rows: [
      mutations[0]!,
      {
        transactionDate: "2026-10-12",
        description: "Mutasi baru QA masuk",
        amount: 65000,
        type: "INFLOW",
        source: "Fixture sintetis",
      },
      {
        transactionDate: "2026-10-12",
        description: "Mutasi baru QA keluar",
        amount: 85000,
        type: "OUTFLOW",
        source: "Fixture sintetis",
      },
    ],
  },
  { action: "MATCH", bankAccountId: bank.id, statementRowIds: imported.rowIds },
  {
    action: "MARK_EXCEPTION",
    bankAccountId: bank.id,
    cashTransactionId: extras[0].id,
    reason: "Menunggu bukti mutasi bank · data sintetis",
  },
  { action: "CLEAR_EXCEPTION", bankAccountId: bank.id, cashTransactionId: extras[1].id },
];
const [conversation] = await db
  .insert(aiConversation)
  .values({ userId: qaUser.id, title: "QA rekonsiliasi lengkap · database disposable" })
  .returning();
await db.insert(aiMessage).values({
  conversationId: conversation.id,
  role: "user",
  parts: [
    {
      type: "text",
      text: "Contoh QA data sintetis untuk impor, pasangan ambigu dan pengecualian. Semua penyimpanan di database disposable; data dev tetap.",
    },
  ],
});
const parts: unknown[] = [
  {
    type: "text",
    text: "Data sintetis pada database disposable. Semua card memakai proof dan operation backend nyata. Empat pasangan siap disarankan, dua mutasi perlu pilihan kandidat. Kas tetap saat impor/rekonsiliasi.",
  },
];
for (const input of inputs)
  parts.push({
    type: "tool-proposeBankReconciliation",
    toolCallId: randomUUID(),
    state: "output-available",
    input,
    output: { proposal: await prepareReconciliationProposal(actor, input) },
  });
await db.insert(aiMessage).values({ conversationId: conversation.id, role: "assistant", parts });
console.log(
  JSON.stringify({
    email: qaUser.email,
    conversationId: conversation.id,
    bankAccountId: bank.id,
    fixture: "disposable synthetic reconciliation",
  }),
);
await pool.end();
