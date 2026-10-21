import type { z } from "zod";
import { createHash } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@backend/db";
import {
  INSTANCE_TENANT_ID,
  project,
  clientInvoice,
  budgetAllocationSetting,
  budgetAllocationSettingCategory,
  expenseCategory,
} from "@backend/db/schema";
import { actorCan } from "@backend/lib/auth/permissions";
import type { Actor } from "@backend/server/actor";
import type { FinanceTransaction } from "../finance/mutation-access";
import { assertBudgetDefaultsRights } from "../settings/budget-defaults-writer";
import { assertOperationalSettingsRights } from "../settings/operational-settings-writer";
import { prepareOperationalSettingsInput } from "./operational-settings-context";
import {
  financeInputSchema,
  financeInputProposalSchema,
  financeInputPermission,
  invoiceScheduleRows,
  type FinanceInput,
  type FinanceInputProposal,
} from "@atria/core/ai/finance-input";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";

export class FinanceInputError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR",
    message: string,
  ) {
    super(message);
  }
}
export function assertFinanceInputRights(
  actor: Pick<Actor, "permissions" | "dataScope">,
  input: FinanceInput,
): void {
  if (!actorCan(actor, "use:ai_chat") || !actorCan(actor, financeInputPermission(input)))
    throw new FinanceInputError("FORBIDDEN", "Izin tindakan tidak tersedia atau telah berubah.");
  if (input.action === "APPROVAL_THRESHOLDS" || input.action === "EXPENSE_CATEGORY_SETTINGS") {
    assertOperationalSettingsRights(
      actor,
      input.action === "APPROVAL_THRESHOLDS" ? "thresholds" : "categories",
    );
    if (
      input.action === "EXPENSE_CATEGORY_SETTINGS" &&
      input.patch.defaultRatio !== undefined &&
      !actorCan(actor, "manage:budget_settings")
    )
      throw new FinanceInputError(
        "FORBIDDEN",
        "Perubahan alokasi memerlukan izin default budget perusahaan.",
      );
  } else if (input.action === "BUDGET_DEFAULTS") {
    assertBudgetDefaultsRights(actor);
    if (!actorCan(actor, "view:settings"))
      throw new FinanceInputError("FORBIDDEN", "Akses pengaturan diperlukan.");
  } else if (
    actor.dataScope === "NONE" ||
    !actorCan(actor, "view:client_invoice") ||
    !actorCan(actor, "view:project")
  )
    throw new FinanceInputError("FORBIDDEN", "Akses proyek dan invoice klien diperlukan.");
}
type Connection = Pick<FinanceTransaction, "query" | "select">;
const hash = (data: unknown): string =>
  createHash("sha256").update(JSON.stringify(data)).digest("hex");
const displayDate = (value: string): string =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
const percentage = (value: number): string =>
  `${(value * 100).toLocaleString("id-ID", { maximumFractionDigits: 4 })}%`;
export async function readFinanceInputProject(
  actor: Pick<Actor, "userId" | "permissions" | "dataScope">,
  id: string,
  connection: Connection = db,
): Promise<{
  readonly project: typeof project.$inferSelect;
  readonly invoices: (typeof clientInvoice.$inferSelect)[];
}> {
  if (
    !actorCan(actor, "use:ai_chat") ||
    !actorCan(actor, "view:client_invoice") ||
    !actorCan(actor, "view:project") ||
    actor.dataScope === "NONE"
  )
    throw new FinanceInputError("FORBIDDEN", "Akses proyek dan invoice klien diperlukan.");
  const record = await connection.query.project.findFirst({
    where: and(eq(project.id, id), eq(project.tenantId, INSTANCE_TENANT_ID)),
  });
  if (!record || (actor.dataScope === "ASSIGNED" && record.projectManagerId !== actor.userId))
    throw new FinanceInputError("FORBIDDEN", "Proyek di luar akses Anda.");
  const invoices = await connection.query.clientInvoice.findMany({
    where: and(eq(clientInvoice.projectId, id), eq(clientInvoice.tenantId, INSTANCE_TENANT_ID)),
    orderBy: [asc(clientInvoice.id)],
  });
  return { project: record, invoices };
}
type BudgetDefaultsContext = typeof budgetAllocationSetting.$inferSelect & {
  categories: (typeof budgetAllocationSettingCategory.$inferSelect & {
    expenseCategory: typeof expenseCategory.$inferSelect;
  })[];
};
export async function readFinanceBudgetSettings(
  actor: Pick<Actor, "permissions" | "dataScope">,
  id?: string,
  connection: Connection = db,
): Promise<BudgetDefaultsContext> {
  assertBudgetDefaultsRights(actor);
  if (!actorCan(actor, "use:ai_chat") || !actorCan(actor, "view:settings"))
    throw new FinanceInputError("FORBIDDEN", "Akses pengaturan diperlukan.");
  const setting = await connection.query.budgetAllocationSetting.findFirst({
    where: and(
      eq(budgetAllocationSetting.tenantId, INSTANCE_TENANT_ID),
      id ? eq(budgetAllocationSetting.id, id) : eq(budgetAllocationSetting.isActive, true),
    ),
    with: {
      categories: {
        orderBy: [asc(budgetAllocationSettingCategory.id)],
        with: { expenseCategory: true },
      },
    },
  });
  if (!setting) throw new FinanceInputError("NOT_FOUND", "Default budget aktif tidak ditemukan.");
  return setting;
}
export async function prepareFinanceInput(
  actor: Pick<Actor, "userId" | "permissions" | "dataScope">,
  raw: FinanceInput,
  connection: Connection = db,
): Promise<FinanceInputProposal> {
  const input = financeInputSchema.parse(raw);
  assertFinanceInputRights(actor, input);
  if (input.action === "APPROVAL_THRESHOLDS" || input.action === "EXPENSE_CATEGORY_SETTINGS")
    return prepareOperationalSettingsInput(actor, input, connection);
  if (input.action === "BUDGET_DEFAULTS") {
    const current = await readFinanceBudgetSettings(
      actor,
      input.payload.budgetAllocationSettingId,
      connection,
    );
    const expected = new Set(current.categories.map((row) => row.id));
    if (
      input.payload.categories.length !== expected.size ||
      input.payload.categories.some((row) => !expected.has(row.budgetAllocationSettingCategoryId))
    )
      throw new FinanceInputError(
        "VALIDATION_ERROR",
        "Sertakan seluruh kategori dari pengaturan terbaru.",
      );
    const changes: FinanceInputProposal["changes"] = [];
    if (current.name !== input.payload.name.trim())
      changes.push({
        label: "Nama pengaturan",
        before: current.name,
        after: input.payload.name.trim(),
      });
    if (Number(current.budgetCapRatio) !== input.payload.budgetCapRatio)
      changes.push(
        {
          label: "Plafon internal",
          before: percentage(Number(current.budgetCapRatio)),
          after: percentage(input.payload.budgetCapRatio),
        },
        {
          label: "Target margin",
          before: percentage(1 - Number(current.budgetCapRatio)),
          after: percentage(1 - input.payload.budgetCapRatio),
        },
      );
    if ((current.notes || "") !== (input.payload.notes?.trim() || ""))
      changes.push({
        label: "Catatan",
        before: current.notes || "—",
        after: input.payload.notes?.trim() || "—",
      });
    for (const row of input.payload.categories) {
      const before = current.categories.find((c) => c.id === row.budgetAllocationSettingCategoryId);
      if (!before) throw new FinanceInputError("CONFLICT", "Kategori pengaturan berubah.");
      if (
        Number(before.ratioPercentage) !== row.ratioPercentage ||
        before.isEnabled !== row.isEnabled
      )
        changes.push({
          label: before.expenseCategory.name,
          before: before.isEnabled ? percentage(Number(before.ratioPercentage)) : "Tidak digunakan",
          after: row.isEnabled ? percentage(row.ratioPercentage) : "Tidak digunakan",
        });
    }
    if (!changes.length)
      throw new FinanceInputError(
        "VALIDATION_ERROR",
        "Default budget sudah sesuai; tidak ada perubahan untuk disimpan.",
      );
    const allocation = input.payload.categories.reduce(
      (sum, row) => sum + (row.isEnabled ? row.ratioPercentage : 0),
      0,
    );
    return financeInputProposalSchema.parse({
      kind: "FINANCE_INPUT",
      input,
      title: "Default budget perusahaan",
      entityName: current.name,
      projectId: null,
      expectedContext: hash(current),
      effect:
        "Default berlaku saat membuat budget berikutnya. Budget proyek yang sudah tersimpan tetap.",
      summary: [
        { label: "Plafon internal baru", value: percentage(input.payload.budgetCapRatio) },
        { label: "Target margin", value: percentage(1 - input.payload.budgetCapRatio) },
        { label: "Alokasi kategori", value: percentage(allocation) },
      ],
      rows: [],
      changes,
    });
  }
  const context = await readFinanceInputProject(actor, input.projectId, connection);
  const active = context.invoices.filter((row) => row.status !== "VOID");
  const contract = Number(context.project.totalContractValue);
  const billed = active.reduce((sum, row) => sum + Number(row.amount), 0);
  let rows: z.input<typeof financeInputProposalSchema>["rows"];
  if (input.action === "CREATE_INVOICE") {
    if (context.project.status !== "ACTIVE")
      throw new FinanceInputError("CONFLICT", "Invoice satuan memerlukan proyek aktif.");
    if (billed + input.amount > contract + 0.001)
      throw new FinanceInputError(
        "VALIDATION_ERROR",
        "Total invoice melebihi nilai kontrak. Selesaikan Change Order sebelum menambah tagihan.",
      );
    const duplicate = await connection.query.clientInvoice.findFirst({
      where: and(
        eq(clientInvoice.invoiceNumber, input.invoiceNumber),
        eq(clientInvoice.tenantId, INSTANCE_TENANT_ID),
      ),
    });
    if (duplicate) throw new FinanceInputError("CONFLICT", "Nomor invoice sudah terdaftar.");
    rows = [
      {
        id: "invoice-new",
        title: input.invoiceNumber,
        facts: [
          { label: "Nominal", value: input.amount, money: true },
          { label: "Tahap", value: formatBusinessLabel(input.stage) },
          { label: "Jatuh tempo", value: displayDate(input.dueDate) },
          ...(input.notes ? [{ label: "Catatan", value: input.notes }] : []),
        ],
      },
    ];
  } else {
    if (!["DRAFT", "ACTIVE"].includes(context.project.status) || active.length)
      throw new FinanceInputError(
        "CONFLICT",
        "Jadwal hanya dapat dibuat pada proyek Draft/aktif yang belum memiliki invoice aktif.",
      );
    rows = invoiceScheduleRows(contract, input.firstDueDate, input.installments).map(
      (row, index) => ({
        id: `installment-${index}`,
        title: row.label,
        facts: [
          { label: "Porsi kontrak", value: percentage(input.installments[index].percentage) },
          { label: "Nominal", value: row.amount, money: true },
          { label: "Jatuh tempo", value: displayDate(row.dueDate) },
        ],
      }),
    );
  }
  return financeInputProposalSchema.parse({
    kind: "FINANCE_INPUT",
    input,
    title: input.action === "CREATE_INVOICE" ? "Invoice klien" : "Jadwal termin klien",
    entityName: context.project.name,
    projectId: context.project.id,
    expectedContext: hash(context),
    effect:
      "Invoice dicatat sebagai belum dibayar. Pembayaran klien dicatat melalui tindakan terpisah; kas dan stok tetap.",
    summary: [
      { label: "Nilai kontrak", value: contract, money: true },
      { label: "Invoice aktif saat ini", value: billed, money: true },
      {
        label: "Tagihan baru",
        value: input.action === "CREATE_INVOICE" ? input.amount : contract,
        money: true,
      },
    ],
    rows,
    changes: [],
  });
}
