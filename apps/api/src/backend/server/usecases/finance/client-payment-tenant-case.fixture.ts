import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { mock } from "bun:test";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import type { RecordClientPaymentInput } from "@atria/core/validations/budget";

const postgres = new PGlite();
await postgres.exec(
  (await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema))).join(";\n"),
);
const database = drizzle(postgres, { schema });
mock.module("@backend/db", () => ({ db: database }));
mock.module("@backend/server/services/notification-service", () => ({
  scheduleNotificationPush: (): void => {},
}));
const { recordClientPaymentTx } = await import("./record-client-payment");
const { db } = await import("@backend/db");
const own = schema.INSTANCE_TENANT_ID;
const foreign = crypto.randomUUID();
const keys = {
  role: crypto.randomUUID(),
  user: crypto.randomUUID(),
  otherUser: crypto.randomUUID(),
  client: crypto.randomUUID(),
  project: crypto.randomUUID(),
  foreignProject: crypto.randomUUID(),
  account: crypto.randomUUID(),
  foreignAccount: crypto.randomUUID(),
  invoice: crypto.randomUUID(),
  foreignInvoice: crypto.randomUUID(),
  foreignProjectInvoice: crypto.randomUUID(),
  receiptLedger: crypto.randomUUID(),
  foreignLedger: crypto.randomUUID(),
};
const actor: Actor = {
  userId: keys.user,
  roleId: keys.role,
  roleName: "PAYMENT_FIXTURE",
  name: "Payment fixture",
  email: "payment-fixture@example.invalid",
  isActive: true,
  mustChangePassword: false,
  sessionId: "fixture",
  permissions: ["reconcile:client_invoice"],
  dataScope: "GLOBAL",
  developerActorUserId: null,
};
const input: RecordClientPaymentInput = {
  clientInvoiceId: keys.invoice,
  bankAccountId: keys.account,
  amountPaid: 0.1,
  referenceNumber: "FOREIGN-REFERENCE-DOES-NOT-CONFLICT",
  paymentDate: new Date("2026-10-15T05:00:00.000Z"),
};

async function snapshot(): Promise<unknown> {
  return {
    accounts: await database.select().from(schema.bankAccount),
    invoices: await database.select().from(schema.clientInvoice),
    receipts: await database.select().from(schema.clientPayment),
    ledger: await database.select().from(schema.cashTransaction),
    audit: await database.select().from(schema.auditLog),
    notifications: await database.select().from(schema.notification),
    conditions: await database.select().from(schema.notificationCondition),
  };
}

async function record(
  patch: Partial<RecordClientPaymentInput> = {},
  caller: Actor = actor,
): Promise<Awaited<ReturnType<typeof recordClientPaymentTx>>> {
  return db.transaction((tx) => recordClientPaymentTx(tx, caller, { ...input, ...patch }));
}

try {
  await database.insert(schema.tenant).values([
    { id: own, name: "Disposable payment", slug: "disposable-payment" },
    { id: foreign, name: "Foreign payment", slug: "foreign-payment" },
  ]);
  await database
    .insert(schema.role)
    .values({ id: keys.role, name: actor.roleName, dataScope: "GLOBAL" });
  await database.insert(schema.user).values([
    { id: keys.user, roleId: keys.role, name: actor.name, email: actor.email },
    {
      id: keys.otherUser,
      roleId: keys.role,
      name: "Other",
      email: "other-payment@example.invalid",
    },
  ]);
  await database.insert(schema.client).values({
    id: keys.client,
    name: "Client",
    email: "client-payment@example.invalid",
    phone: "-",
  });
  await database.insert(schema.project).values([
    {
      id: keys.project,
      clientId: keys.client,
      name: "Own",
      projectManagerId: keys.user,
      status: "ACTIVE",
      totalContractValue: "100.75",
    },
    {
      id: keys.foreignProject,
      tenantId: foreign,
      clientId: keys.client,
      name: "Foreign",
      status: "ACTIVE",
      totalContractValue: "100.75",
    },
  ]);
  await database.insert(schema.bankAccount).values([
    {
      id: keys.account,
      name: "Own",
      bankName: "Fixture",
      accountNumber: "OWN",
      holderName: "Fixture",
      balance: "1000.00",
    },
    {
      id: keys.foreignAccount,
      tenantId: foreign,
      name: "Foreign",
      bankName: "Fixture",
      accountNumber: "FOREIGN",
      holderName: "Fixture",
      balance: "2000.00",
    },
  ]);
  await database.insert(schema.clientInvoice).values([
    {
      id: keys.invoice,
      projectId: keys.project,
      invoiceNumber: "OWN-INV",
      stage: "DP",
      amount: "100.75",
      dueDate: new Date(),
      status: "PARTIALLY_PAID",
    },
    {
      id: keys.foreignInvoice,
      tenantId: foreign,
      projectId: keys.project,
      invoiceNumber: "FOREIGN-INV",
      stage: "DP",
      status: "UNPAID",
      amount: "100.75",
      dueDate: new Date(),
    },
    {
      id: keys.foreignProjectInvoice,
      projectId: keys.foreignProject,
      invoiceNumber: "FOREIGN-PROJECT-INV",
      stage: "DP",
      status: "UNPAID",
      amount: "100.75",
      dueDate: new Date(),
    },
  ]);
  await database.insert(schema.cashTransaction).values([
    {
      id: keys.receiptLedger,
      bankAccountId: keys.account,
      type: "INFLOW",
      category: "client_payment",
      amount: "20.15",
      description: "Existing receipt",
      reconciled: true,
      reconciliationDate: new Date(),
      reconciledById: keys.user,
    },
    {
      id: keys.foreignLedger,
      tenantId: foreign,
      bankAccountId: keys.foreignAccount,
      type: "INFLOW",
      category: "client_payment",
      amount: "999.00",
      description: "Foreign receipt",
      bankReference: input.referenceNumber,
    },
  ]);
  await database.insert(schema.clientPayment).values([
    {
      clientInvoiceId: keys.invoice,
      bankAccountId: keys.account,
      cashTransactionId: keys.receiptLedger,
      receivedById: keys.user,
      amountPaid: "20.15",
      paymentDate: new Date(),
      referenceNumber: "EXISTING",
    },
    {
      tenantId: foreign,
      clientInvoiceId: keys.invoice,
      bankAccountId: keys.foreignAccount,
      cashTransactionId: keys.foreignLedger,
      receivedById: keys.user,
      amountPaid: "999.00",
      paymentDate: new Date(),
      referenceNumber: "FOREIGN",
    },
  ]);
  const initial = await snapshot();
  await assert.rejects(record({ clientInvoiceId: keys.foreignInvoice }), /INVOICE_NOT_FOUND/);
  assert.deepEqual(await snapshot(), initial);
  await assert.rejects(record({ clientInvoiceId: keys.foreignProjectInvoice }), /FORBIDDEN/);
  assert.deepEqual(await snapshot(), initial);
  await assert.rejects(record({ bankAccountId: keys.foreignAccount }), /FORBIDDEN/);
  assert.deepEqual(await snapshot(), initial);
  await assert.rejects(record({}, { ...actor, permissions: [] }), /FORBIDDEN/);
  await assert.rejects(
    record({}, { ...actor, userId: keys.otherUser, dataScope: "ASSIGNED" }),
    /FORBIDDEN/,
  );
  assert.deepEqual(await snapshot(), initial);
  await assert.rejects(record({ amountPaid: 80.61 }), /PAYMENT_EXCEEDS_INVOICE_OUTSTANDING/);
  assert.deepEqual(await snapshot(), initial);

  const oldReconciled = await database.query.cashTransaction.findFirst({
    where: eq(schema.cashTransaction.id, keys.receiptLedger),
  });
  const result = await record();
  assert.equal(result.newBalance, "1000.10");
  const payment = await database.query.clientPayment.findFirst({
    where: eq(schema.clientPayment.id, result.paymentId),
  });
  assert.equal(payment?.amountPaid, "0.10");
  assert.equal(payment?.tenantId, own);
  const newLedger = await database.query.cashTransaction.findFirst({
    where: eq(schema.cashTransaction.referenceId, result.paymentId),
  });
  assert.equal(newLedger?.amount, "0.10");
  assert.equal(newLedger?.reconciled, false);
  assert.equal(newLedger?.tenantId, own);
  assert.deepEqual(
    await database.query.cashTransaction.findFirst({
      where: eq(schema.cashTransaction.id, keys.receiptLedger),
    }),
    oldReconciled,
  );
  assert.equal(
    (
      await database.query.clientInvoice.findFirst({
        where: eq(schema.clientInvoice.id, keys.invoice),
      })
    )?.status,
    "PARTIALLY_PAID",
  );
  assert.equal((await database.select().from(schema.auditLog)).length, 2);
  const afterReceipt = await snapshot();
  await assert.rejects(record(), /DUPLICATE_BANK_REFERENCE/);
  assert.deepEqual(await snapshot(), afterReceipt);
  await record({ amountPaid: 80.5, referenceNumber: "SETTLE-EXACT-CENTS" });
  assert.equal(
    (
      await database.query.clientInvoice.findFirst({
        where: eq(schema.clientInvoice.id, keys.invoice),
      })
    )?.status,
    "PAID",
  );
  assert.equal(
    (await database.query.bankAccount.findFirst({ where: eq(schema.bankAccount.id, keys.account) }))
      ?.balance,
    "1080.60",
  );
  assert.equal(
    (
      await database.query.bankAccount.findFirst({
        where: eq(schema.bankAccount.id, keys.foreignAccount),
      })
    )?.balance,
    "2000.00",
  );
  const settled = await snapshot();
  await assert.rejects(record({ referenceNumber: "CLOSED" }), /INVOICE_CLOSED/);
  assert.deepEqual(await snapshot(), settled);
  console.log("Client payment tenant and cents checks passed");
} finally {
  await postgres.close();
}
