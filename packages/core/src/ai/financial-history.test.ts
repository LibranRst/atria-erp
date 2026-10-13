import { describe, expect, test } from "bun:test";
import {
  aggregateHistoricalCash,
  bindsFinancialHistoryEntity,
  aggregateHistoricalExpenses,
  compareHistoricalAmount,
  isFinancialHistoryQuestion,
  parseFinancialHistoryRequest,
} from "./financial-history";
const now = new Date("2026-10-13T10:00:00.000Z");
describe("original human financial periods", () => {
  test("Jakarta month comparison is bounded, partial, independently derived", () => {
    const result = parseFinancialHistoryRequest(
      "Bandingkan pengeluaran bulan ini dengan bulan lalu",
      now,
    );
    expect(result.error).toBeNull();
    expect(result.comparison).toBe(true);
    expect(result.periods).toMatchObject([
      {
        start: "2026-09-30T17:00:00.000Z",
        end: now.toISOString(),
        requestedEnd: "2026-10-31T17:00:00.000Z",
        isPartial: true,
      },
      { start: "2026-08-31T17:00:00.000Z", end: "2026-09-30T17:00:00.000Z", isPartial: false },
    ]);
  });
  test("today/yesterday use local midnight, even across UTC month/year", () => {
    const result = parseFinancialHistoryRequest(
      "Compare cash flow today vs yesterday",
      new Date("2025-12-31T18:00:00Z"),
    );
    expect(result.periods.map((r) => r.start)).toEqual([
      "2025-12-31T17:00:00.000Z",
      "2025-12-30T17:00:00.000Z",
    ]);
    expect(result.periods[0]?.isPartial).toBe(true);
    expect(result.periods[1]?.isPartial).toBe(false);
  });
  test("ISO/named dates and explicit inclusive date ranges", () => {
    expect(
      parseFinancialHistoryRequest("Pengeluaran 2026-09-01 sampai 2026-09-30", now).periods[0],
    ).toMatchObject({ start: "2026-08-31T17:00:00.000Z", end: "2026-09-30T17:00:00.000Z" });
    expect(
      parseFinancialHistoryRequest("Arus kas 1 September 2026 hingga 30 September 2026", now)
        .periods[0],
    ).toMatchObject({ start: "2026-08-31T17:00:00.000Z", end: "2026-09-30T17:00:00.000Z" });
    expect(parseFinancialHistoryRequest("Pengeluaran 2026-09-13", now).periods).toHaveLength(1);
    expect(
      parseFinancialHistoryRequest("Bandingkan pengeluaran September 2026 dan Oktober 2026", now)
        .periods,
    ).toHaveLength(2);
  });
  test("invalid, vague, future and too many periods require clarification", () => {
    for (const q of [
      "Pengeluaran 2026-02-30",
      "Pengeluaran September",
      "Pengeluaran 2026-11",
      "Bandingkan pengeluaran bulan ini",
      "Pengeluaran Januari 2026 Februari 2026 Maret 2026",
      "Pengeluaran 2024-01-01 sampai 2026-01-01",
    ])
      expect(parseFinancialHistoryRequest(q, now).error).not.toBeNull();
  });
  test("past snapshots and forecasts are never substituted with current values", () => {
    for (const q of [
      "Saldo bulan lalu",
      "Budget bulan lalu",
      "Stok September 2026",
      "Prediksi arus kas bulan depan",
      "Arus kas tahun ini",
      "Pengeluaran minggu lalu",
      "Bandingkan realisasi bulan ini dan bulan lalu",
    ])
      expect(parseFinancialHistoryRequest(q, now).error).not.toBeNull();
  });
  test("action/advice are untouched; read-only constraints remain factual", () => {
    expect(isFinancialHistoryQuestion("Bayar pengeluaran bulan lalu")).toBe(false);
    expect(isFinancialHistoryQuestion("Arus kas tahun ini")).toBe(true);
    expect(isFinancialHistoryQuestion("Prediksi arus kas bulan depan")).toBe(true);
    expect(isFinancialHistoryQuestion("Bagaimana cara mengurangi pengeluaran bulan ini")).toBe(
      false,
    );
    expect(
      isFinancialHistoryQuestion("Bandingkan pengeluaran bulan ini dan bulan lalu, jangan simpan"),
    ).toBe(true);
    expect(
      parseFinancialHistoryRequest("Pengeluaran bulan ini, jangan ubah budget dan stok", now).error,
    ).toBeNull();
  });
});
test("recorded expense cents stay distinct from pending, rejected and inventory asset", () => {
  const row = {
    categoryId: "material",
    categoryName: "Material",
    sourceType: "STOCK_USAGE",
    count: 1,
  };
  const result = aggregateHistoricalExpenses([
    { ...row, status: "APPROVED", amount: "400000.25" },
    { ...row, status: "VERIFIED", amount: "0.11" },
    { ...row, status: "SUBMITTED", amount: "20.22" },
    { ...row, status: "REJECTED", amount: "10.10" },
    { ...row, sourceType: "INVENTORY_PURCHASE", status: "INVENTORY_ASSET", amount: "1000000.07" },
  ]);
  expect(result.recordedExpenseAmount).toBe("400000.36");
  expect(result.pendingAmount).toBe("20.22");
  expect(result.excludedAmount).toBe("1000010.17");
  expect(result.recordedCount).toBe(2);
});
test("cash flow excludes both transfer legs, opening, adjustment and invalid classifications", () => {
  const row = { count: 1 };
  const result = aggregateHistoricalCash([
    {
      ...row,
      type: "INFLOW",
      category: "client_payment",
      referenceType: "client_payment",
      amount: "100.25",
    },
    {
      ...row,
      type: "OUTFLOW",
      category: "vendor_payment",
      referenceType: "vendor_payment",
      amount: "30.11",
    },
    {
      ...row,
      type: "INFLOW",
      category: "bank_transfer_in",
      referenceType: "bank_transfer",
      amount: "50.00",
    },
    {
      ...row,
      type: "OUTFLOW",
      category: "bank_transfer_out",
      referenceType: "bank_transfer",
      amount: "50.00",
    },
    {
      ...row,
      type: "INFLOW",
      category: "opening_balance",
      referenceType: "opening_balance",
      amount: "200.00",
    },
    { ...row, type: "OUTFLOW", category: "cash_adjustment", referenceType: null, amount: "10.00" },
    { ...row, type: "unknown", category: "other", referenceType: null, amount: "2.00" },
  ]);
  expect(result).toMatchObject({
    cashIn: "100.25",
    cashOut: "30.11",
    net: "70.14",
    transactionCount: 2,
    exclusions: {
      transfer: { amount: "100.00", count: 2 },
      opening: { amount: "200.00", count: 1 },
      adjustment: { amount: "10.00", count: 1 },
      unclassified: { amount: "2.00", count: 1 },
    },
  });
});
test("comparison zero denominator is explicit and cents don't drift", () => {
  expect(compareHistoricalAmount("50.07", "0.00")).toEqual({
    delta: "50.07",
    percent: null,
    zeroBase: true,
  });
  expect(compareHistoricalAmount("150.03", "100.02")).toEqual({
    delta: "50.01",
    percent: "50.00",
    zeroBase: false,
  });
});

test("financial target bindings distinguish whole names, UUIDs and longer prefixes", () => {
  expect(
    bindsFinancialHistoryEntity(
      "Pengeluaran Proyek QA Lain bulan ini",
      "Proyek QA",
      "00000000-0000-4000-8000-000000000000",
    ),
  ).toBe(false);
  expect(
    bindsFinancialHistoryEntity(
      "Pengeluaran Proyek QA bulan ini",
      "Proyek QA",
      "00000000-0000-4000-8000-000000000000",
    ),
  ).toBe(true);
  expect(
    bindsFinancialHistoryEntity(
      "Pengeluaran Proyek QA 2026-10",
      "Proyek QA",
      "00000000-0000-4000-8000-000000000000",
    ),
  ).toBe(true);
  expect(
    bindsFinancialHistoryEntity("Pengeluaran SuperProyek QA bulan ini", "Proyek QA", "a"),
  ).toBe(false);
});

test("common Indonesian day dates/ranges never collapse into a whole month", () => {
  for (const q of ["Pengeluaran 12 Oktober 2026", "Pengeluaran tanggal 12/10/2026"]) {
    const request = parseFinancialHistoryRequest(q, now);
    expect(request.periods).toHaveLength(1);
    expect(request.periods[0]).toMatchObject({
      start: "2026-10-11T17:00:00.000Z",
      end: "2026-10-12T17:00:00.000Z",
    });
  }
  expect(parseFinancialHistoryRequest("Pengeluaran 1-13 Okt 2026", now).periods[0]).toMatchObject({
    start: "2026-09-30T17:00:00.000Z",
    end: now.toISOString(),
    isPartial: true,
  });
  expect(parseFinancialHistoryRequest("Pengeluaran tanggal 12 Oktober", now).error).not.toBeNull();
  expect(parseFinancialHistoryRequest("Pengeluaran 31/02/2026", now).error).not.toBeNull();
  expect(
    parseFinancialHistoryRequest("Pengeluaran 30/09/2026 hingga 12/10/2026", now).periods[0],
  ).toMatchObject({ start: "2026-09-29T17:00:00.000Z", end: "2026-10-12T17:00:00.000Z" });
});
test("quoted entity names with action words are data, commands outside remain commands", () => {
  expect(isFinancialHistoryQuestion('Pengeluaran proyek "Bayar Transfer QA" bulan ini')).toBe(true);
  expect(isFinancialHistoryQuestion('Bayar pengeluaran proyek "Bayar Transfer QA" bulan ini')).toBe(
    false,
  );
});

test("live expense consumption-cost question is not an inventory snapshot", () => {
  const question =
    "Uji AI v1 final: bandingkan pengeluaran Proyek Operasional QA bulan Oktober2026 dengan September2026. Pisahkan biaya pemakaian stok dari pembelian persediaan; jangan simpan perubahan.";
  expect(isFinancialHistoryQuestion(question)).toBe(true);
  const request = parseFinancialHistoryRequest(question, now);
  expect(request.error).toBeNull();
  expect(request.domains).toEqual(["expenses"]);
  expect(request.periods).toHaveLength(2);
  expect(request.periods[0].start).toBe("2026-09-30T17:00:00.000Z");
  for (const addition of [
    "Sebutkan juga stok fisik saat akhir September 2026.",
    "Berapa stok tersedia kemarin?",
    "Sertakan saldo bulan lalu.",
    "Lihat realisasi budget bulan lalu.",
  ])
    expect(parseFinancialHistoryRequest(`${question} ${addition}`, now).error).toContain(
      "snapshot terverifikasi",
    );
});

test("negative use-current-balance constraint remains a factual snapshot question", () => {
  const question =
    "Berapa saldo Rekening Operasional QA pada akhir September 2026? Jangan gunakan saldo saat ini sebagai pengganti, dan jangan simpan perubahan.";
  expect(isFinancialHistoryQuestion(question)).toBe(true);
  expect(parseFinancialHistoryRequest(question, now).error).toContain("snapshot terverifikasi");
  expect(isFinancialHistoryQuestion("Gunakan stok material untuk proyek bulan ini")).toBe(false);
  expect(
    isFinancialHistoryQuestion(
      "Jangan menggunakan saldo saat ini sebagai pengganti saldo bulan lalu",
    ),
  ).toBe(true);
});
