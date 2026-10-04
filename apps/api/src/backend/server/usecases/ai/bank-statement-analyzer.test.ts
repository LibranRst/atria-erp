import { describe, expect, test } from "bun:test";
import * as XLSX from "xlsx";
import { analyzeBankStatementUseCase } from "./bank-statement-analyzer";
import type { Actor } from "@backend/server/actor";

describe("analyzeBankStatementUseCase", () => {
  const dummyActor = {
    userId: "00000000-0000-0000-0000-000000000001",
    roleId: "00000000-0000-0000-0000-000000000002",
    roleName: "OWNER",
  } as unknown as Actor;

  test("parses standard Atria CSV instantly with zero tokens", async () => {
    const csvContent = [
      "tanggal,deskripsi,dana_masuk,dana_keluar",
      "2026-07-20,Pembayaran termin klien,1500000,",
      "2026-07-21,Biaya admin bank,,25000",
    ].join("\n");

    const result = await analyzeBankStatementUseCase(dummyActor, {
      fileName: "mutasi.csv",
      fileContent: csvContent,
      mimeType: "text/csv",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rows).toHaveLength(2);
      expect(result.data.rows[0]).toMatchObject({
        transactionDate: "2026-07-20",
        description: "Pembayaran termin klien",
        amount: 1500000,
        type: "INFLOW",
      });
      expect(result.data.rows[1]).toMatchObject({
        transactionDate: "2026-07-21",
        description: "Biaya admin bank",
        amount: 25000,
        type: "OUTFLOW",
      });
      expect(result.data.summary.totalInflow).toBe(1500000);
      expect(result.data.summary.totalOutflow).toBe(25000);
      expect(result.data.summary.rowCount).toBe(2);
    }
  });

  test("parses standard Excel workbook directly", async () => {
    const data = [
      ["tanggal", "deskripsi", "dana_masuk", "dana_keluar"],
      ["2026-08-01", "Setoran Modal", 5000000, ""],
      ["2026-08-02", "Beli Semen", "", 120000],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const base64 = buffer.toString("base64");

    const result = await analyzeBankStatementUseCase(dummyActor, {
      fileName: "rekening-koran.xlsx",
      fileBase64: base64,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rows).toHaveLength(2);
      expect(result.data.rows[0]?.type).toBe("INFLOW");
      expect(result.data.rows[0]?.amount).toBe(5000000);
      expect(result.data.rows[1]?.type).toBe("OUTFLOW");
      expect(result.data.rows[1]?.amount).toBe(120000);
    }
  });

  test("parses multi-sheet workbook where transactions are on the second sheet", async () => {
    const coverData = [
      ["PT DEKORIA NUSANTARA"],
      ["Laporan Rekening Koran Tahunan"],
      ["Kontak: info@dekoria.local"],
    ];
    const txData = [
      ["tanggal", "deskripsi", "dana_masuk", "dana_keluar"],
      ["2026-08-15", "Termin 2 Klien", 25000000, ""],
      ["2026-08-16", "Bayar Tukang", "", 3500000],
    ];
    const wb = XLSX.utils.book_new();
    const wsCover = XLSX.utils.aoa_to_sheet(coverData);
    const wsTx = XLSX.utils.aoa_to_sheet(txData);
    XLSX.utils.book_append_sheet(wb, wsCover, "Info");
    XLSX.utils.book_append_sheet(wb, wsTx, "Mutasi");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const result = await analyzeBankStatementUseCase(dummyActor, {
      fileName: "multi-sheet.xlsx",
      fileBase64: buffer.toString("base64"),
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rows).toHaveLength(2);
      expect(result.data.rows[0]?.description).toBe("Termin 2 Klien");
      expect(result.data.rows[0]?.amount).toBe(25000000);
      expect(result.data.rows[0]?.type).toBe("INFLOW");
      expect(result.data.rows[1]?.description).toBe("Bayar Tukang");
      expect(result.data.rows[1]?.amount).toBe(3500000);
      expect(result.data.rows[1]?.type).toBe("OUTFLOW");
    }
  });

  test("parses generic BCA format with 2-digit year and CR/DB indicators", async () => {
    const bcaRows = [
      ["PT DEKORIA NUSANTARA"],
      ["No. Rekening: 1234567890"],
      ["BCA Cabang Sudirman"],
      [],
      ["Tanggal", "Keterangan", "Cabang", "Jumlah", "Tipe", "Saldo"],
      ["01/08/26", "TRF TERMIN 1 DARI CLIENT", "0010", "15.000.000,00", "CR", "15.000.000,00"],
      ["02/08/26", "BIAYA ADMIN BULANAN", "0010", "25.000,00", "DB", "14.975.000,00"],
      ["Total Saldo Akhir", "", "", "", "", "14.975.000,00"],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(bcaRows);
    XLSX.utils.book_append_sheet(wb, ws, "MutasiBCA");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const result = await analyzeBankStatementUseCase(dummyActor, {
      fileName: "mutasi-bca.xlsx",
      fileBase64: buffer.toString("base64"),
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.detectedBankName).toBe("BCA");
      expect(result.data.detectedAccountNumber).toBe("1234567890");
      expect(result.data.rows).toHaveLength(2);
      expect(result.data.rows[0]?.transactionDate).toBe("2026-08-01");
      expect(result.data.rows[0]?.amount).toBe(15000000);
      expect(result.data.rows[0]?.type).toBe("INFLOW");
      expect(result.data.rows[1]?.transactionDate).toBe("2026-08-02");
      expect(result.data.rows[1]?.amount).toBe(25000);
      expect(result.data.rows[1]?.type).toBe("OUTFLOW");
    }
  });

  test("parses generic Mandiri format CSV with Debit and Kredit columns and Indonesian dates", async () => {
    const mandiriCsv = [
      "Bank Mandiri - Rekening Giro Operasional",
      "Nomor Rekening: 9876543210",
      "",
      "Tanggal Transaksi,Uraian,Debit,Kredit,Saldo",
      "22 Jul 2026,Setoran Modal Tunai,,50.000.000,50.000.000",
      "25 Jul 2026,Beli Material Kayu Jati,7.500.000,,42.500.000",
    ].join("\n");

    const result = await analyzeBankStatementUseCase(dummyActor, {
      fileName: "mandiri.csv",
      fileContent: mandiriCsv,
      mimeType: "text/csv",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.detectedBankName).toBe("Mandiri");
      expect(result.data.detectedAccountNumber).toBe("9876543210");
      expect(result.data.rows).toHaveLength(2);
      expect(result.data.rows[0]?.transactionDate).toBe("2026-07-22");
      expect(result.data.rows[0]?.amount).toBe(50000000);
      expect(result.data.rows[0]?.type).toBe("INFLOW");
      expect(result.data.rows[1]?.transactionDate).toBe("2026-07-25");
      expect(result.data.rows[1]?.amount).toBe(7500000);
      expect(result.data.rows[1]?.type).toBe("OUTFLOW");
    }
  });

  test("normalizes diverse date formats including 2-digit years and Indonesian months", async () => {
    const { normalizeDateToIso } = await import("./bank-statement-analyzer");
    expect(normalizeDateToIso("2026-09-09")).toBe("2026-09-09");
    expect(normalizeDateToIso("22/07/2026")).toBe("2026-07-22");
    expect(normalizeDateToIso("22/07/25")).toBe("2025-07-22");
    expect(normalizeDateToIso("05/09/26")).toBe("2026-09-05");
    expect(normalizeDateToIso("22 Jul 2026")).toBe("2026-07-22");
    expect(normalizeDateToIso("22-Juli-25")).toBe("2025-07-22");
    expect(normalizeDateToIso("10 Agustus 2026")).toBe("2026-08-10");
    expect(normalizeDateToIso("7/22/26")).toBe("2026-07-22");
  });
});
