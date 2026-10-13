import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { db } from "@backend/db";
import { bankAccount, INSTANCE_TENANT_ID } from "@backend/db/schema";
import { bankCashInputSchema } from "@atria/core/ai/bank-cash";
import {
  BankCashError,
  assertBankCashRights,
  prepareBankCashProposal,
} from "@backend/server/usecases/ai/bank-cash-context";
import type { AiToolContext } from "./context";
const message = (error: unknown): string => {
  if (error instanceof Error) {
    if (error instanceof BankCashError) return error.message;
    if (error.message === "BANK_ACCOUNT_DUPLICATE_NUMBER") return "Nomor rekening sudah terdaftar.";
    if (error.message === "DUPLICATE_BANK_REFERENCE")
      return "Referensi sudah tercatat pada rekening ini. Periksa transaksi sebelumnya.";
  }
  return "Data rekening/kas belum dapat diperiksa. Coba lagi.";
};
export function buildBankCashTools(actor: AiToolContext): ToolSet {
  return {
    getBankCashContext: tool({
      description:
        "Read-only company bank/cash account references. Search verified IDs by human account/bank/number, including inactive accounts for status/edit. One-character or multiple matches require a user choice; never invent IDs. Cash/transfer need active accounts. Balances are snapshots, not permission to post money. Accounts have no project assignment; use actual bank grants.",
      inputSchema: z
        .object({
          query: z.string().trim().min(1).max(120).optional(),
          bankAccountId: z.string().guid().optional(),
          includeInactive: z.boolean().default(false),
          offset: z.number().int().min(0).max(100000).default(0),
        })
        .strict(),
      execute: async (input) => {
        try {
          assertBankCashRights(actor);
          const rows = await db.query.bankAccount.findMany({
            where: and(
              eq(bankAccount.tenantId, INSTANCE_TENANT_ID),
              input.bankAccountId ? eq(bankAccount.id, input.bankAccountId) : undefined,
              !input.includeInactive ? eq(bankAccount.isActive, true) : undefined,
              input.query
                ? or(
                    ilike(bankAccount.name, `%${input.query}%`),
                    ilike(bankAccount.bankName, `%${input.query}%`),
                    ilike(bankAccount.accountNumber, `%${input.query}%`),
                  )
                : undefined,
            ),
            orderBy: [asc(bankAccount.name), asc(bankAccount.id)],
            limit: 21,
            offset: input.offset,
          });
          return {
            scope: "Pilihan rekening sesuai pencarian dan halaman",
            appliedFilters: {
              query: input.query ?? null,
              bankAccountId: input.bankAccountId ?? null,
              offset: input.offset,
            },
            returnedCount: Math.min(rows.length, 20),
            hasMore: rows.length > 20,
            accounts: rows.slice(0, 20).map((a) => ({
              id: a.id,
              name: a.name,
              bankName: a.bankName,
              accountNumber: a.accountNumber,
              holderName: a.holderName,
              balance: Number(a.balance),
              status: a.isActive ? "Aktif" : "Nonaktif",
              cardColorFrom: a.cardColorFrom,
              cardColorTo: a.cardColorTo,
              cardTextColor: a.cardTextColor,
            })),
            nextOffset: rows.length > 20 ? input.offset + 20 : null,
            needsDisambiguation:
              !input.bankAccountId &&
              Boolean(input.query) &&
              (input.query?.length === 1 || rows.length !== 1),
            instruction:
              "Ini hanya daftar pilihan sesuai filter/halaman, bukan seluruh rekening atau total kas perusahaan. Untuk jumlah rekening dan saldo gabungan gunakan getBankBalances.accountCount/totalAvailable. Jangan mempersempit query ke satu nama dari hasil ketika user meminta seluruh rekening. Minta user memilih rekening ambigu untuk tindakan. Tanggal, nominal dan referensi mutasi/transfer berasal dari user. Kas manual tidak menggantikan pengeluaran proyek, pembayaran vendor atau penerimaan klien.",
          };
        } catch (error: unknown) {
          return { error: message(error) };
        }
      },
    }),
    proposeBankCash: tool({
      description:
        "READ-ONLY proposal for CREATE_ACCOUNT, EDIT_ACCOUNT metadata/theme, ACCOUNT_STATUS, company CASH_MOVEMENT or TRANSFER between verified bank IDs. Never writes business records. Resolve existing accounts with getBankCashContext; ask when ambiguous. Never invent account number/holder, monetary amount, reference or transaction date. Positive opening balance requires human openingReference and openingDate; omitted opening balance defaults to zero. EDIT_ACCOUNT patch preserves unspecified fields and cannot change balance/status. Manual cash categories are owner_capital/modal pemilik, bank_fee/biaya bank, correction/koreksi kas, cash_adjustment/penyesuaian kas, other/lainnya. Project expenses, client receipts and vendor payments use their own tools. Transfer records two ledger sides in Atria; no external bank transfer. For TRANSFER use root fields fromBankAccountId, toBankAccountId, amount (number), description, transactionDate (YYYY-MM-DD), referenceNumber. CASH_MOVEMENT also uses root fields, not payload. Only CREATE_ACCOUNT uses payload and optional root openingDate. Human must review/confirm the rendered card before any save.",
      inputSchema: bankCashInputSchema,
      execute: async (input) => {
        try {
          return { proposal: await prepareBankCashProposal(actor, input) };
        } catch (error: unknown) {
          return { error: message(error) };
        }
      },
    }),
  };
}
