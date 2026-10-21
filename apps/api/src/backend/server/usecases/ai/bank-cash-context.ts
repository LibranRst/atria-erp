import { createHash } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@backend/db";
import { bankAccount, INSTANCE_TENANT_ID } from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import type { FinanceTransaction } from "@backend/server/usecases/finance/mutation-access";
import {
  assertBankNumberAvailable,
  assertBankReferenceAvailable,
} from "@backend/server/usecases/finance/bank-cash-writer";
import { fromCents, parseNumericToCents } from "@atria/core/finance/money-minor";
import {
  bankCashInputSchema,
  bankCashProposalSchema,
  bankCashPermission,
  bankMoneySchema,
  cashCategoryLabels,
  type BankCashInput,
  type BankCashProposal,
} from "@atria/core/ai/bank-cash";

type Access = Pick<Actor, "permissions" | "dataScope" | "userId">;
type Reader = Pick<FinanceTransaction, "query">;
type BankRow = typeof bankAccount.$inferSelect;
export class BankCashError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR",
    message: string,
  ) {
    super(message);
  }
}
export function assertBankCashRights(
  actor: Pick<Actor, "permissions">,
  input?: BankCashInput,
): void {
  if (
    !actor.permissions.includes("use:ai_chat") ||
    !actor.permissions.includes("view:bank_account") ||
    (input && !actor.permissions.includes(bankCashPermission(input)))
  )
    throw new BankCashError(
      "FORBIDDEN",
      "Anda tidak memiliki izin rekening atau tindakan kas ini.",
    );
}
export async function readBankCashAccount(
  actor: Access,
  id: string,
  reader: Reader = db,
): Promise<BankRow> {
  assertBankCashRights(actor);
  const row = await reader.query.bankAccount.findFirst({
    where: and(eq(bankAccount.id, id), eq(bankAccount.tenantId, INSTANCE_TENANT_ID)),
  });
  if (!row)
    throw new BankCashError("NOT_FOUND", "Rekening tidak ditemukan atau di luar akses Anda.");
  return row;
}
function balanceAfter(account: BankRow, amount: number, inflow: boolean): number {
  if (!account.isActive)
    throw new BankCashError("CONFLICT", "Rekening nonaktif tidak dapat menerima mutasi baru.");
  const next =
    parseNumericToCents(account.balance) +
    (inflow ? 1n : -1n) * parseNumericToCents(amount.toFixed(2));
  if (next < 0n) throw new BankCashError("CONFLICT", "Saldo rekening tidak mencukupi.");
  const parsed = bankMoneySchema.safeParse(Number(fromCents(next)));
  if (!parsed.success)
    throw new BankCashError("VALIDATION_ERROR", "Saldo akhir melewati batas nominal rekening.");
  return parsed.data;
}
const dateLabel = (value: string): string =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(
    new Date(value),
  );
const fact = (
  label: string,
  value: string | number,
  money = false,
): BankCashProposal["facts"][number] => ({ label, value, money });
const diff = (
  label: string,
  before: string | number,
  after: string | number,
  money = false,
): BankCashProposal["comparisons"][number] => ({ label, before, after, money });
const labels: Record<string, string> = {
  name: "Nama rekening",
  bankName: "Bank",
  accountNumber: "Nomor rekening",
  holderName: "Pemegang rekening",
  cardColorFrom: "Warna awal kartu",
  cardColorTo: "Warna akhir kartu",
  cardTextColor: "Teks kartu",
};
export async function prepareBankCashProposal(
  actor: Access,
  raw: unknown,
  reader: Reader = db,
): Promise<BankCashProposal> {
  const parsed = bankCashInputSchema.safeParse(raw);
  if (!parsed.success)
    throw new BankCashError(
      "VALIDATION_ERROR",
      "Isian rekening/kas belum lengkap atau tidak valid.",
    );
  const input = parsed.data;
  assertBankCashRights(actor, input);
  const facts: BankCashProposal["facts"] = [],
    comparisons: BankCashProposal["comparisons"] = [],
    details: BankCashProposal["details"] = [];
  let source: unknown,
    title = "",
    entityName = "",
    effect = "";
  if (input.action === "CREATE_ACCOUNT") {
    await assertBankNumberAvailable(reader, input.payload.accountNumber);
    const identities = await reader.query.bankAccount.findMany({
      where: eq(bankAccount.tenantId, INSTANCE_TENANT_ID),
      columns: { id: true, accountNumber: true },
      orderBy: [asc(bankAccount.id)],
    });
    source = identities;
    title = "Rekening baru";
    entityName = input.payload.name;
    facts.push(
      fact("Bank", input.payload.bankName),
      fact("Nomor rekening", input.payload.accountNumber),
      fact("Pemegang rekening", input.payload.holderName),
      fact("Saldo awal", input.payload.openingBalance, true),
    );
    if (input.payload.openingBalance > 0) {
      const reference = input.payload.openingReference?.trim();
      if (!input.openingDate || !reference)
        throw new BankCashError(
          "VALIDATION_ERROR",
          "Tanggal dan referensi saldo awal wajib diberikan.",
        );
      facts.push(
        fact("Tanggal saldo awal", dateLabel(input.openingDate)),
        fact("Referensi saldo awal", reference),
      );
      if (input.payload.openingNote?.trim())
        facts.push(fact("Catatan saldo awal", input.payload.openingNote.trim()));
    }
    details.push(
      fact("Warna awal kartu", input.payload.cardColorFrom),
      fact("Warna akhir kartu", input.payload.cardColorTo),
      fact("Teks kartu", input.payload.cardTextColor === "light" ? "Terang" : "Gelap"),
    );
    effect =
      input.payload.openingBalance > 0
        ? "Membuat rekening dan mencatat saldo awal di buku kas. Stok dan budget proyek tetap."
        : "Membuat rekening aktif dengan saldo nol. Kas, stok dan budget proyek tetap.";
  } else if (input.action === "EDIT_ACCOUNT" || input.action === "ACCOUNT_STATUS") {
    const a = await readBankCashAccount(actor, input.bankAccountId, reader);
    source = a;
    entityName = a.name;
    facts.push(
      fact("Bank", a.bankName),
      fact("Nomor rekening", a.accountNumber),
      fact("Saldo tersimpan", Number(a.balance), true),
    );
    if (input.action === "EDIT_ACCOUNT") {
      title = "Koreksi rekening";
      if (input.patch.accountNumber)
        await assertBankNumberAvailable(reader, input.patch.accountNumber, a.id);
      for (const [key, value] of Object.entries(input.patch)) {
        const before = Reflect.get(a, key);
        if (typeof before !== "string" || before === value) continue;
        comparisons.push(
          diff(
            labels[key] ?? "Data rekening",
            key === "cardTextColor" ? (before === "light" ? "Terang" : "Gelap") : before,
            key === "cardTextColor" ? (value === "light" ? "Terang" : "Gelap") : value,
          ),
        );
      }
      if (!comparisons.length)
        throw new BankCashError("VALIDATION_ERROR", "Tidak ada data rekening yang berubah.");
      effect =
        "Memperbarui informasi rekening. Saldo, transaksi terdahulu, stok dan budget proyek tetap.";
    } else {
      if (a.isActive === input.isActive)
        throw new BankCashError("VALIDATION_ERROR", "Status rekening sudah sesuai.");
      title = input.isActive ? "Aktifkan rekening" : "Nonaktifkan rekening";
      comparisons.push(
        diff("Status", a.isActive ? "Aktif" : "Nonaktif", input.isActive ? "Aktif" : "Nonaktif"),
      );
      effect = input.isActive
        ? "Rekening dapat dipilih kembali untuk transaksi baru. Saldo dan transaksi terdahulu tetap."
        : "Rekening tidak dapat dipilih untuk transaksi baru. Saldo tetap tersimpan; transaksi terdahulu tidak dihapus.";
    }
  } else if (input.action === "CASH_MOVEMENT") {
    const a = await readBankCashAccount(actor, input.bankAccountId, reader);
    source = a;
    entityName = a.name;
    const after = balanceAfter(a, input.amount, input.type === "INFLOW");
    await assertBankReferenceAvailable(reader, a.id, input.referenceNumber);
    title = input.type === "INFLOW" ? "Dana masuk" : "Dana keluar";
    facts.push(
      fact("Bank", a.bankName),
      fact("Nomor rekening", a.accountNumber),
      fact("Nominal", input.amount, true),
      fact("Kategori", cashCategoryLabels[input.category]),
      fact("Tanggal", dateLabel(input.transactionDate)),
      fact("Referensi", input.referenceNumber),
      fact("Keterangan", input.description),
    );
    comparisons.push(diff("Saldo rekening", Number(a.balance), after, true));
    effect =
      "Mencatat mutasi kas perusahaan di Atria. Budget proyek dan stok tetap; bukan pencatatan pembayaran proyek atau transfer bank.";
  } else {
    const from = await readBankCashAccount(actor, input.fromBankAccountId, reader),
      to = await readBankCashAccount(actor, input.toBankAccountId, reader);
    source = [from, to];
    entityName = `${from.name} → ${to.name}`;
    const fromAfter = balanceAfter(from, input.amount, false),
      toAfter = balanceAfter(to, input.amount, true);
    await assertBankReferenceAvailable(reader, from.id, input.referenceNumber);
    await assertBankReferenceAvailable(reader, to.id, input.referenceNumber);
    title = "Transfer antarrekening";
    facts.push(
      fact("Rekening sumber", `${from.bankName} · ${from.name} · ${from.accountNumber}`),
      fact("Rekening tujuan", `${to.bankName} · ${to.name} · ${to.accountNumber}`),
      fact("Nominal", input.amount, true),
      fact("Tanggal", dateLabel(input.transactionDate)),
      fact("Referensi", input.referenceNumber),
      fact("Keterangan", input.description),
    );
    comparisons.push(
      diff(`Saldo ${from.name}`, Number(from.balance), fromAfter, true),
      diff(`Saldo ${to.name}`, Number(to.balance), toAfter, true),
    );
    effect =
      "Mencatat perpindahan saldo antarrekening di Atria. Total kas, stok dan budget proyek tetap. Tidak mengirim transfer ke bank.";
  }
  return bankCashProposalSchema.parse({
    kind: "BANK_CASH",
    input,
    title,
    entityName,
    effect,
    facts,
    comparisons,
    details,
    expectedContext: createHash("sha256").update(JSON.stringify(source)).digest("hex"),
  });
}
