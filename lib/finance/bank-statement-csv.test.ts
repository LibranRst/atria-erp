import { describe, expect, test } from "bun:test";

import { parseBankStatementCsv } from "@/lib/finance/bank-statement-csv";

describe("parseBankStatementCsv", () => {
  test("parses canonical comma CSV with inflow and outflow rows", () => {
    const rows = parseBankStatementCsv(
      [
        "tanggal,deskripsi,dana_masuk,dana_keluar",
        '2026-07-20,"Pembayaran klien, termin 1",1.250.000,',
        "21/07/2026,Biaya admin bank,,25.000",
      ].join("\n"),
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ amount: "1250000.00", type: "INFLOW" });
    expect(rows[1]).toMatchObject({ amount: "25000.00", type: "OUTFLOW" });
  });

  test("supports semicolon CSV and escaped quotes", () => {
    const [row] = parseBankStatementCsv(
      [
        "tanggal;deskripsi;dana_masuk;dana_keluar",
        '22-07-2026;"Transfer ""Vendor""";;1500000.00',
      ].join("\n"),
    );

    expect(row?.description).toBe('Transfer "Vendor"');
    expect(row?.amount).toBe("1500000.00");
    expect(row?.type).toBe("OUTFLOW");
  });

  test("rejects ambiguous direction and missing headers", () => {
    expect(() =>
      parseBankStatementCsv(
        "tanggal,deskripsi,dana_masuk,dana_keluar\n2026-07-20,Transfer,1000,1000",
      ),
    ).toThrow("isi tepat satu");
    expect(() => parseBankStatementCsv("tanggal,deskripsi\n2026-07-20,Transfer")).toThrow(
      "Kolom wajib belum ada",
    );
  });
});
