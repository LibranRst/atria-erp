import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
/** Manual and AI entry points share active-account checks after deterministic locks.
 * Metadata/status writers can read inactive accounts; movements must reject them before posting. */
const APP_ROOT = path.resolve(import.meta.dir, "..", "..");
const source = (relative: string): string => readFileSync(path.join(APP_ROOT, relative), "utf8");
describe("cash movement guards", () => {
  test("manual cash entry points delegate to the shared transactional writer", () => {
    const module = source("app/actions/finance/bank-account-movements.ts");
    expect(module).toContain("postManualCashMovementTx");
    expect(module).toContain("transferBetweenBankAccountsTx");
    expect(module.match(/db\.transaction/g)?.length).toBe(2);
  });
  test("shared movement writers check every locked account before ledger writes", () => {
    const writer = source("server/usecases/finance/bank-cash-writer.ts");
    expect(writer).toContain('if (!row.isActive) throw new Error("BANK_ACCOUNT_INACTIVE")');
    const cash = writer
      .split("export async function postManualCashMovementTx")[1]
      .split("export async function transferBetweenBankAccountsTx")[0];
    const transfer = writer.split("export async function transferBetweenBankAccountsTx")[1];
    expect(cash.indexOf("lockBankAccounts")).toBeLessThan(cash.indexOf("assertCashAccount"));
    expect(cash.indexOf("assertCashAccount")).toBeLessThan(cash.indexOf("mutateBalance"));
    expect(transfer.match(/assertCashAccount/g)?.length).toBe(2);
    expect(transfer.lastIndexOf("assertCashAccount")).toBeLessThan(
      transfer.indexOf("mutateBalance"),
    );
  });
});
