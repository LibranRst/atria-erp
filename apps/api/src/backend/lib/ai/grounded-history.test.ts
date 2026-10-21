import { expect, test } from "bun:test";
import {
  aggregateHistoricalCash,
  aggregateHistoricalExpenses,
  parseFinancialHistoryRequest,
  type FinancialHistoryOutput,
} from "@atria/core/ai/financial-history";
import { renderGroundedHistory } from "./grounded-history";
import type { GroundedToolObservation } from "./grounded-facts";
const asOf = "2026-10-13T10:00:00.000Z";
const question = "Bandingkan pengeluaran dan arus kas bulan ini dengan bulan lalu";
function report(q: string = question): FinancialHistoryOutput {
  return {
    kind: "financial-history",
    asOf,
    timeZone: "Asia/Jakarta",
    scope: { kind: "company", label: "Seluruh catatan perusahaan ini" },
    comparison: /Bandingkan/.test(q),
    issues: [],
    periods: parseFinancialHistoryRequest(q, new Date(asOf)).periods.map((p, index) => ({
      ...p,
      expenses: aggregateHistoricalExpenses(
        index
          ? []
          : [
              {
                categoryId: "material",
                categoryName: "Material",
                sourceType: "STOCK_USAGE",
                status: "APPROVED",
                amount: "400000.25",
                count: 2,
              },
              {
                categoryId: "material",
                categoryName: "Material",
                sourceType: "INVENTORY_PURCHASE",
                status: "INVENTORY_ASSET",
                amount: "1000000.07",
                count: 1,
              },
            ],
      ),
      cash: aggregateHistoricalCash(
        index
          ? []
          : [
              {
                type: "OUTFLOW",
                category: "vendor_payment",
                referenceType: "vendor_payment",
                amount: "1000000.07",
                count: 1,
              },
              {
                type: "OUTFLOW",
                category: "bank_transfer_out",
                referenceType: "bank_transfer",
                amount: "50.11",
                count: 1,
              },
              {
                type: "INFLOW",
                category: "bank_transfer_in",
                referenceType: "bank_transfer",
                amount: "50.11",
                count: 1,
              },
            ],
      ),
    })),
  };
}
function observed(value: unknown): readonly GroundedToolObservation[] {
  return [{ toolName: "getFinancialHistory", toolCallId: "h-1", input: {}, output: value }];
}
test("history exposes exact cash vs expense cents and exclusions, basis, counts and zero comparison", () => {
  const result = renderGroundedHistory(question, observed(report()));
  expect(result?.status).toBe("verified");
  expect(result?.text).toContain("Rp 400.000,25");
  expect(result?.text).toContain("Rp 1.000.000,07");
  expect(result?.text).toContain("transfer internal Rp 100,22 (2 transaksi)");
  expect(result?.text).toContain("persentase tidak dihitung");
  expect(result?.text).toContain("tanggal biaya");
  expect(result?.text).toContain("berjalan");
  expect(result?.sources[0]?.query.periods).toHaveLength(2);
});
test("wrong model date ranges cannot bind the original period", () => {
  const value = report();
  value.periods[0] = { ...value.periods[0], start: "2026-01-01T00:00:00.000Z" };
  expect(renderGroundedHistory(question, observed(value))?.status).toBe("waiting");
  expect(renderGroundedHistory(question, observed(value))?.text).not.toContain("400.000");
});
test("wrong named scope and global scope for named project never become verified", () => {
  const q = "Pengeluaran Proyek A bulan ini",
    value = report(q);
  value.scope = { kind: "project", projectId: "wrong", projectName: "Proyek B", label: "Proyek B" };
  expect(renderGroundedHistory(q, observed(value))?.status).toBe("waiting");
  value.scope = { kind: "company", label: "Seluruh perusahaan" };
  expect(renderGroundedHistory(q, observed(value))?.status).toBe("waiting");
});
test("forbidden, invalid or absent current read stays explicit without using historical/model text", () => {
  expect(renderGroundedHistory(question, [], [])?.status).toBe("error");
  expect(
    renderGroundedHistory(
      question,
      observed({ error: "Proyek tidak ditemukan atau di luar akses Anda." }),
    )?.text,
  ).toContain("di luar akses");
  expect(
    renderGroundedHistory(question, observed({ text: "pengeluaran Rp 25 juta" }))?.status,
  ).toBe("waiting");
  expect(renderGroundedHistory(question, [])?.status).toBe("waiting");
});
test("a partial denied domain remains partial even when other facts succeed", () => {
  const value = report();
  value.issues = ["Arus kas perusahaan tidak tersedia untuk izin ini."];
  for (const p of value.periods) delete p.cash;
  const result = renderGroundedHistory(question, observed(value));
  expect(result?.status).toBe("partial");
  expect(result?.text).toContain("400.000,25");
  expect(result?.text).toContain("tidak tersedia");
});
test("current snapshots/forecasts unsupported; ordinary current facts/action/advice untouched", () => {
  expect(
    renderGroundedHistory("Saldo bulan lalu", observed({ error: "Snapshot saldo belum tersedia." }))
      ?.text,
  ).toContain("belum tersedia");
  expect(renderGroundedHistory("Berapa saldo rekening sekarang?", [])).toBeNull();
  expect(renderGroundedHistory("Bayar pengeluaran bulan lalu", [])).toBeNull();
});
test("explicit named project report and category/status filters use current groups", () => {
  const q = "Pengeluaran Material disetujui Proyek A bulan ini",
    value = report(q);
  value.scope = { kind: "project", projectId: "a", projectName: "Proyek A", label: "Proyek A" };
  const result = renderGroundedHistory(q, observed(value));
  expect(result?.status).toBe("verified");
  expect(result?.text).toContain("Rp 400.000,25");
  expect(result?.text).not.toContain("Rp 1.000.000,07");
});

test("names with Operasional do not incidentally filter category; explicitly absent category returns zero", () => {
  const q = "Pengeluaran Proyek Operasional QA bulan ini",
    value = report(q);
  value.scope = {
    kind: "project",
    projectName: "Proyek Operasional QA",
    projectId: "00000000-0000-4000-8000-000000000000",
    label: "Proyek Operasional QA",
  };
  for (const p of value.periods)
    if (p.expenses) {
      p.expenses.groups.push({
        categoryId: "ops",
        categoryName: "Operasional",
        status: "APPROVED",
        sourceType: "CASH_EXPENSE",
        count: 1,
        amount: "100.05",
      });
      p.expenses.recordedExpenseAmount = "400100.30";
      p.expenses.recordedCount = 3;
    }
  expect(renderGroundedHistory(q, observed(value))?.text).toContain("Rp 400.100,30");
  const materialOnly = report("Pengeluaran Tukang bulan ini");
  const result = renderGroundedHistory("Pengeluaran Tukang bulan ini", observed(materialOnly));
  expect(result?.text).toContain("Rp 0");
  expect(result?.text).not.toContain("400.000");
});
test("short project name does not bind longer human-named target", () => {
  const q = "Pengeluaran Proyek QA Lain bulan ini",
    value = report(q);
  value.scope = {
    kind: "project",
    projectName: "Proyek QA",
    projectId: "00000000-0000-4000-8000-000000000000",
    label: "Proyek QA",
  };
  expect(renderGroundedHistory(q, observed(value))?.status).toBe("waiting");
});

test("unsupported past snapshots are permanent policy errors even with no history read or a current balance", () => {
  const q = "Berapa saldo Rekening QA pada akhir September 2026?";
  const freshBank: GroundedToolObservation = {
    toolName: "getBankBalances",
    toolCallId: "balance",
    input: {},
    output: {
      totalAvailable: { amount: 25000000 },
      accounts: [{ accountId: "qa", accountName: "Rekening QA", balance: { amount: 25000000 } }],
    },
  };
  for (const observations of [[], [freshBank]]) {
    const result = renderGroundedHistory(q, observations, undefined, new Date(asOf));
    expect(result?.status).toBe("error");
    expect(result?.text).toContain("snapshot terverifikasi");
    expect(result?.text).not.toContain("25.000.000");
    expect(result?.sources).toEqual([]);
  }
  expect(
    renderGroundedHistory("Prediksi arus kas bulan depan", [], undefined, new Date(asOf))?.status,
  ).toBe("error");
});

test("consumption expense costs remain verifiable, mixed past stock quantities remain unsupported", () => {
  const q =
    "Bandingkan pengeluaran Proyek Operasional QA bulan Oktober 2026 dengan September 2026. Pisahkan biaya pemakaian stok dari pembelian persediaan; jangan simpan perubahan.";
  const value = report(q);
  value.comparison = true;
  value.scope = {
    kind: "project",
    projectName: "Proyek Operasional QA",
    projectId: "00000000-0000-4000-8000-000000000000",
    label: "Proyek Operasional QA",
  };
  expect(renderGroundedHistory(q, observed(value))?.status).toBe("verified");
  const mixed = renderGroundedHistory(
    `${q} Sebutkan juga stok fisik saat akhir September 2026.`,
    observed(value),
  );
  expect(mixed?.status).toBe("error");
  expect(mixed?.text).toContain("snapshot terverifikasi");
  expect(mixed?.text).not.toContain("400.000");
});
