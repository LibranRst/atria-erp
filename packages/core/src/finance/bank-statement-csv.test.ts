import { describe, expect, test } from "bun:test";

import { parseBankStatementCsv } from "./bank-statement-csv";

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
  test("preserves exact fractional cents in both directions and legacy integer formats", () => {
    for (const [source, expected] of [
      ["100000", "100000.00"],
      ["100.000", "100000.00"],
      ["100,000", "100000.00"],
      ["Rp 100.000,25", "100000.25"],
      ["100000,25", "100000.25"],
      ["100000.25", "100000.25"],
      ["100,000.25", "100000.25"],
      ["100000,2", "100000.20"],
      ["0,25", "0.25"],
      ["0.25", "0.25"],
    ]) {
      const rows = parseBankStatementCsv(
        [
          "tanggal;deskripsi;dana_masuk;dana_keluar",
          `2026-10-17;Dana diterima;${source};`,
          `2026-10-17;Dana dibayarkan;;${source}`,
        ].join("\n"),
      );
      expect(rows[0]).toMatchObject({ amount: expected, type: "INFLOW" });
      expect(rows[1]).toMatchObject({ amount: expected, type: "OUTFLOW" });
    }
    const quoted = parseBankStatementCsv(
      'tanggal,deskripsi,dana_masuk,dana_keluar\n2026-10-17,Termin klien,"100.000,25",\n',
    );
    expect(quoted[0]?.amount).toBe("100000.25");
  });
  test("rejects malformed or ambiguous numeric grouping, excess precision, negatives and zero", () => {
    for (const value of [
      "100.00,25",
      "1000.000,25",
      "100,00.25",
      "100.000,250",
      "100000.250",
      "1,23,456",
      "1.234,5.6",
      "1 00,25",
      "1e3",
      "12rp34",
      "-100,25",
      "(100,25)",
      "Rp -100,25",
      "0",
      "0,00",
      "0.00",
    ]) {
      expect(() =>
        parseBankStatementCsv(
          `tanggal;deskripsi;dana_masuk;dana_keluar\n2026-10-17;Transfer;${value};\n`,
        ),
      ).toThrow("CSV_INVALID_AMOUNT: Baris 2:");
    }
    expect(() =>
      parseBankStatementCsv(
        "tanggal;deskripsi;dana_masuk;dana_keluar\n2026-10-17;Transfer;100,25;200,50\n",
      ),
    ).toThrow("isi tepat satu");
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
  test("rejects duplicate normalized headers and ragged records before reading amounts", () => {
    expect(() =>
      parseBankStatementCsv(
        "tanggal,deskripsi,dana_masuk,dana_keluar, DANA_MASUK \n2026-10-17,Pembayaran,1000,,2000",
      ),
    ).toThrow("Nama kolom berulang: dana_masuk");
    expect(() =>
      parseBankStatementCsv(
        "tanggal,deskripsi,dana_masuk,dana_keluar\n2026-10-17,Transfer, salah kutip,1000,",
      ),
    ).toThrow("Baris 2: jumlah kolom harus 4, ditemukan 5");
    expect(() =>
      parseBankStatementCsv("tanggal,deskripsi,dana_masuk,dana_keluar\n2026-10-17,Transfer,1000"),
    ).toThrow("Baris 2: jumlah kolom harus 4, ditemukan 3");
  });
  test("shape validation preserves BOM, semicolon delimiter, quoted commas/newlines and escaped quotes", () => {
    const rows = parseBankStatementCsv(
      '\uFEFFtanggal;deskripsi;dana_masuk;dana_keluar\r\n2026-10-17;"Transfer, termin\nuntuk ""vendor""";;1.250.000\r\n',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      description: 'Transfer, termin\nuntuk "vendor"',
      amount: "1250000.00",
      type: "OUTFLOW",
    });
  });
});
