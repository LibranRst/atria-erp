import { RAP_COST_MAX } from "@atria/core/project/rap-cost";
import { randomUUID } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { auditLog, clientInvoice, project, INSTANCE_TENANT_ID } from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import {
  assertFinancePermission,
  lockFinanceProject,
  type FinanceTransaction,
} from "./mutation-access";
import {
  createClientInvoiceSchema,
  type CreateClientInvoiceInput,
} from "@atria/core/validations/finance";
import { generateInvoiceScheduleSchema } from "@atria/core/validations/workflow-governance";
import { invoiceScheduleRows, type FinanceInput } from "@atria/core/ai/finance-input";
import { recordNotificationEvent } from "@backend/server/services/notification-events";
import type { z } from "zod";

export async function lockClientInvoiceProjectTx(
  tx: FinanceTransaction,
  actor: Actor,
  projectId: string,
): Promise<typeof project.$inferSelect> {
  assertFinancePermission(actor, "create:client_invoice");
  const record = await lockFinanceProject(tx, actor, projectId);
  if (record.tenantId !== INSTANCE_TENANT_ID)
    throw new Error("FORBIDDEN: Proyek di luar akses Anda.");
  return record;
}
async function insertInvoice(
  tx: FinanceTransaction,
  actor: Actor,
  input: {
    readonly projectId: string;
    readonly invoiceNumber: string;
    readonly amount: number;
    readonly stage: string;
    readonly dueDate: Date;
    readonly notes?: string | null;
  },
): Promise<typeof clientInvoice.$inferSelect> {
  const [created] = await tx
    .insert(clientInvoice)
    .values({
      ...input,
      amount: input.amount.toFixed(2),
      notes: input.notes || null,
      status: "UNPAID",
    })
    .returning();
  await recordNotificationEvent(tx, {
    referenceType: "client_invoice",
    referenceId: created.id,
    projectId: created.projectId,
    stage: "CREATED",
    title: "Invoice klien dibuat",
    message: created.invoiceNumber,
    permission: "view:client_invoice",
    actionUrl: `/projects/${created.projectId}?tab=payments`,
    actorId: actor.userId,
  });
  return created;
}
export async function createClientInvoiceTx(
  tx: FinanceTransaction,
  actor: Actor,
  raw: CreateClientInvoiceInput,
): Promise<typeof clientInvoice.$inferSelect> {
  const input = createClientInvoiceSchema.parse(raw);
  const proj = await lockClientInvoiceProjectTx(tx, actor, input.projectId);
  if (proj.status !== "ACTIVE")
    throw new Error("PROJECT_NOT_ACTIVE: Invoice memerlukan proyek aktif.");
  if (
    !Number.isFinite(input.amount) ||
    input.amount > RAP_COST_MAX ||
    Math.abs(input.amount * 100 - Math.round(input.amount * 100)) > 0.000001
  )
    throw new Error("Nominal invoice tidak valid.");
  const duplicate = await tx.query.clientInvoice.findFirst({
    where: and(
      eq(clientInvoice.invoiceNumber, input.invoiceNumber.trim()),
      eq(clientInvoice.tenantId, INSTANCE_TENANT_ID),
    ),
  });
  if (duplicate) throw new Error("Nomor invoice sudah terdaftar.");
  const active = await tx.query.clientInvoice.findMany({
    where: and(eq(clientInvoice.projectId, proj.id), ne(clientInvoice.status, "VOID")),
  });
  if (
    active.reduce((sum, row) => sum + Number(row.amount), 0) + input.amount >
    Number(proj.totalContractValue) + 0.001
  )
    throw new Error("INVOICE_EXCEEDS_CONTRACT_VALUE");
  const created = await insertInvoice(tx, actor, {
    ...input,
    invoiceNumber: input.invoiceNumber.trim(),
  });
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "CREATE_CLIENT_INVOICE",
    targetTable: "client_invoice",
    targetId: created.id,
    newState: JSON.stringify(created),
  });
  return created;
}
export async function generateClientInvoiceScheduleTx(
  tx: FinanceTransaction,
  actor: Actor,
  raw: z.input<typeof generateInvoiceScheduleSchema>,
): Promise<readonly (typeof clientInvoice.$inferSelect)[]> {
  const input = generateInvoiceScheduleSchema.parse(raw);
  const proj = await lockClientInvoiceProjectTx(tx, actor, input.projectId);
  if (!["DRAFT", "ACTIVE"].includes(proj.status))
    throw new Error("Proyek tidak tersedia untuk jadwal invoice.");
  const active = await tx.query.clientInvoice.findFirst({
    where: and(eq(clientInvoice.projectId, proj.id), ne(clientInvoice.status, "VOID")),
  });
  if (active) throw new Error("Jadwal invoice aktif sudah tersedia untuk proyek ini.");
  const rows = invoiceScheduleRows(
    Number(proj.totalContractValue),
    input.firstDueDate.toISOString().slice(0, 10),
    input.installments,
  );
  const token = randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase();
  const created: (typeof clientInvoice.$inferSelect)[] = [];
  for (const [index, row] of rows.entries())
    created.push(
      await insertInvoice(tx, actor, {
        projectId: proj.id,
        invoiceNumber: `INV-${proj.id.slice(0, 8).toUpperCase()}-${token}-${String(index + 1).padStart(2, "0")}`,
        amount: row.amount,
        stage: row.stage,
        dueDate: new Date(`${row.dueDate}T00:00:00.000Z`),
        notes: `${row.label} (${(input.installments[index].percentage * 100).toFixed(2)}%)`,
      }),
    );
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "GENERATE_CLIENT_INVOICE_SCHEDULE",
    targetTable: "project",
    targetId: proj.id,
    newState: JSON.stringify(created),
  });
  return created;
}
export async function writeFinanceInvoiceInputTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: Extract<FinanceInput, { action: "CREATE_INVOICE" | "CREATE_SCHEDULE" }>,
): Promise<string> {
  if (input.action === "CREATE_INVOICE")
    return (
      await createClientInvoiceTx(tx, actor, {
        ...input,
        dueDate: new Date(`${input.dueDate}T00:00:00.000Z`),
      })
    ).id;
  return (await generateClientInvoiceScheduleTx(tx, actor, input))[0].id;
}
