import { describe, expect, it } from "bun:test";
import {
  deriveExpensePaymentReference,
  deriveInvoicePrefill,
  derivePaymentReference,
  deriveProjectCode,
  deriveSuggestedVendorBillNumber,
  deriveVendorCode,
  deriveVendorPaymentReference,
  generateSuggestedInvoiceNumber,
} from "./invoice-prefill";

describe("deriveProjectCode", () => {
  it("mengekstraksi kode dari nama lokasi yang dikenal", () => {
    expect(deriveProjectCode("Fit-Out Interior Studio Bassura City — Unit 18B")).toBe("BSR");
    expect(deriveProjectCode("Renovasi Rumah Tinggal Menteng")).toBe("MNT");
    expect(deriveProjectCode("Interior Office Sudirman Tower")).toBe("SDR");
    expect(deriveProjectCode("Apartemen Senopati Penthouse")).toBe("SNP");
    expect(deriveProjectCode("Workshop & Gudang Cikarang")).toBe("CKR");
  });

  it("menangani nama proyek umum dengan ekstraksi huruf penting", () => {
    expect(deriveProjectCode("Grand Batavia Living")).toBe("GBL");
    expect(deriveProjectCode("Delta Silicon")).toBe("DES");
  });

  it("menangani fallback jika nama pendek atau kosong", () => {
    expect(deriveProjectCode("")).toBe("PRJ");
    expect(deriveProjectCode("   ")).toBe("PRJ");
  });
});

describe("generateSuggestedInvoiceNumber", () => {
  it("menghasilkan nomor invoice dengan format kanonis INV/YYYY/MM/KODE-00X", () => {
    const fixedDate = new Date("2026-09-07T12:00:00Z");
    const result = generateSuggestedInvoiceNumber({
      projectCode: "BSR",
      sequence: 1,
      date: fixedDate,
    });
    expect(result).toBe("INV/2026/09/BSR-001");
  });

  it("memformat sequence multi-digit dengan rapi", () => {
    const fixedDate = new Date("2026-10-15T12:00:00Z");
    const result = generateSuggestedInvoiceNumber({
      projectCode: "MNT",
      sequence: 12,
      date: fixedDate,
    });
    expect(result).toBe("INV/2026/10/MNT-012");
  });
});

describe("deriveInvoicePrefill", () => {
  const fixedDate = new Date("2026-09-07T10:00:00Z");

  it("menghasilkan prefill DP 50% saat belum ada invoice yang terbit", () => {
    const prefill = deriveInvoicePrefill({
      projectName: "Fit-Out Interior Studio Bassura City — Unit 18B",
      totalContractValue: 50_000_000,
      existingInvoices: [],
      currentDate: fixedDate,
    });

    expect(prefill.projectCode).toBe("BSR");
    expect(prefill.suggestedInvoiceNumber).toBe("INV/2026/09/BSR-001");
    expect(prefill.suggestedStage).toBe("DP");
    expect(prefill.suggestedAmount).toBe(25_000_000);
    expect(prefill.totalContractValue).toBe(50_000_000);
    expect(prefill.totalInvoiced).toBe(0);
    expect(prefill.remainingUnbilled).toBe(50_000_000);
    expect(prefill.suggestedNotes).toContain("DP 50%");
    expect(prefill.presets.length).toBe(6);
    expect(prefill.presets[0].amount).toBe(25_000_000);
    expect(prefill.presets[1].label).toBe("35% Progress");
    expect(prefill.presets[1].amount).toBe(17_500_000);
  });

  it("menyarankan PROGRESS_1 ketika DP sudah ada dan sisa masih besar", () => {
    const prefill = deriveInvoicePrefill({
      projectName: "Fit-Out Interior Studio Bassura City — Unit 18B",
      totalContractValue: 50_000_000,
      existingInvoices: [{ amount: 25_000_000, stage: "DP", status: "PAID" }],
      currentDate: fixedDate,
    });

    expect(prefill.suggestedInvoiceNumber).toBe("INV/2026/09/BSR-002");
    expect(prefill.suggestedStage).toBe("PROGRESS_1");
    expect(prefill.suggestedAmount).toBe(15_000_000); // 30% dari 50jt
    expect(prefill.totalInvoiced).toBe(25_000_000);
    expect(prefill.remainingUnbilled).toBe(25_000_000);
  });

  it("menyarankan PELUNASAN ketika sisa tagihan <= 25% dari kontrak", () => {
    const prefill = deriveInvoicePrefill({
      projectName: "Fit-Out Interior Studio Bassura City — Unit 18B",
      totalContractValue: 50_000_000,
      existingInvoices: [
        { amount: 25_000_000, stage: "DP", status: "PAID" },
        { amount: 15_000_000, stage: "PROGRESS_1", status: "PAID" },
      ],
      currentDate: fixedDate,
    });

    expect(prefill.suggestedInvoiceNumber).toBe("INV/2026/09/BSR-003");
    expect(prefill.suggestedStage).toBe("PELUNASAN");
    expect(prefill.suggestedAmount).toBe(10_000_000); // Sisa 10jt
    expect(prefill.remainingUnbilled).toBe(10_000_000);
    expect(prefill.suggestedNotes).toContain("Pelunasan akhir");
  });

  it("mengabaikan invoice berstatus VOID", () => {
    const prefill = deriveInvoicePrefill({
      projectName: "Fit-Out Interior Studio Bassura City — Unit 18B",
      totalContractValue: 50_000_000,
      existingInvoices: [{ amount: 25_000_000, stage: "DP", status: "VOID" }],
      currentDate: fixedDate,
    });

    expect(prefill.suggestedInvoiceNumber).toBe("INV/2026/09/BSR-001");
    expect(prefill.suggestedStage).toBe("DP");
    expect(prefill.suggestedAmount).toBe(25_000_000);
    expect(prefill.totalInvoiced).toBe(0);
  });
});

describe("derivePaymentReference", () => {
  it("menghasilkan TRF-BCA-HENDRA-DP dari nama klien dan bank BCA", () => {
    const ref = derivePaymentReference({
      bankName: "BCA Operasional Dekoria",
      clientName: "Bpk. Hendra Gunawan",
      stage: "DP",
      invoiceNumber: "INV/2026/09/BSR-001",
    });
    expect(ref).toBe("TRF-BCA-HENDRA-DP");
  });

  it("menyesuaikan kode bank saat bank diubah ke Mandiri", () => {
    const ref = derivePaymentReference({
      bankName: "Mandiri Giro Dekoria",
      clientName: "Bpk. Hendra Gunawan",
      stage: "DP",
      invoiceNumber: "INV/2026/09/BSR-001",
    });
    expect(ref).toBe("TRF-MDR-HENDRA-DP");
  });

  it("menggunakan kode proyek jika nama klien tidak tersedia", () => {
    const ref = derivePaymentReference({
      bankName: "BCA",
      projectName: "Fit-Out Interior Studio Bassura City — Unit 18B",
      stage: "PROGRESS_1",
    });
    expect(ref).toBe("TRF-BCA-BSR-PRG1");
  });

  it("mengekstrak kode proyek dari nomor invoice jika nama proyek/klien tidak diisi", () => {
    const ref = derivePaymentReference({
      bankName: "Kas Kecil Lapangan",
      invoiceNumber: "INV/2026/09/BSR-001",
      stage: "PELUNASAN",
    });
    expect(ref).toBe("TRF-KAS-BSR-LUNAS");
  });
});

describe("deriveVendorCode", () => {
  it("mengekstraksi kode dari vendor-vendor yang dikenal", () => {
    expect(deriveVendorCode("PT Sumber Abadi Panel & HPL")).toBe("SA");
    expect(deriveVendorCode("PT Cahaya Mas Panel")).toBe("CMP");
    expect(deriveVendorCode("PT Sinar Kaca & Electrical")).toBe("SK");
    expect(deriveVendorCode("CV Batu Prima Countertop")).toBe("BPC");
    expect(deriveVendorCode("PT Hafele Hardware Indonesia")).toBe("HAFELE");
    expect(deriveVendorCode("CV Marmer Indah Sentosa")).toBe("MARMER");
    expect(deriveVendorCode("PT Kaca Nusantara Prima")).toBe("KACA");
  });

  it("menghasilkan kode inisial untuk nama vendor multi-kata umum", () => {
    expect(deriveVendorCode("Toko Bangunan Berkah Mandiri")).toBe("BM");
    expect(deriveVendorCode("UD Mitra Jaya Abadi")).toBe("MJA");
  });

  it("menghasilkan singkatan kata untuk vendor kata tunggal", () => {
    expect(deriveVendorCode("Aica")).toBe("AICA");
    expect(deriveVendorCode("Holcim")).toBe("HOLCIM");
  });

  it("menangani fallback jika nama vendor kosong", () => {
    expect(deriveVendorCode("")).toBe("VND");
    expect(deriveVendorCode("   ")).toBe("VND");
    expect(deriveVendorCode(null)).toBe("VND");
  });
});

describe("deriveSuggestedVendorBillNumber", () => {
  const fixedDate = new Date("2026-09-08T10:00:00Z");

  it("menghasilkan nomor tagihan standar untuk PT Sumber Abadi sesuai panduan alur B5.2", () => {
    const result = deriveSuggestedVendorBillNumber({
      vendorName: "PT Sumber Abadi Panel & HPL",
      projectName: "Fit-Out Interior Studio Bassura City — Unit 18B",
      date: fixedDate,
    });
    expect(result).toBe("INV-SA-2026-8891");
  });

  it("menghasilkan nomor tagihan standar untuk vendor lain", () => {
    const result = deriveSuggestedVendorBillNumber({
      vendorName: "CV Batu Prima Countertop",
      projectName: "Fit-Out Interior Studio Bassura City — Unit 18B",
      date: fixedDate,
    });
    expect(result).toBe("INV-BPC-2026-001");
  });

  it("menghargai sequence kustom jika diberikan", () => {
    const result = deriveSuggestedVendorBillNumber({
      vendorName: "PT Sumber Abadi Panel & HPL",
      date: fixedDate,
      sequence: 5,
    });
    expect(result).toBe("INV-SA-2026-005");
  });

  it("menghasilkan format BILL berbasis proyek jika vendor belum dipilih", () => {
    const result = deriveSuggestedVendorBillNumber({
      projectName: "Fit-Out Interior Studio Bassura City — Unit 18B",
      date: fixedDate,
    });
    expect(result).toBe("BILL-BSR-2026-001");
  });

  it("menghasilkan format BILL generik jika vendor dan proyek kosong", () => {
    const result = deriveSuggestedVendorBillNumber({
      date: fixedDate,
    });
    expect(result).toBe("BILL-2026-001");
  });
});

describe("deriveVendorPaymentReference", () => {
  it("menghasilkan nomor referensi standar untuk pembayaran PT Sumber Abadi sesuai alur B5.3", () => {
    const result = deriveVendorPaymentReference({
      bankName: "BCA Operasional Dekoria",
      vendorName: "PT Sumber Abadi Panel & HPL",
      billNumber: "INV-SA-2026-8891",
    });
    expect(result).toBe("TRF-BCA-VND-SA01");
  });

  it("menghasilkan nomor referensi subkon untuk Marmer dan Kaca sesuai alur B8.3", () => {
    expect(
      deriveVendorPaymentReference({
        bankName: "BCA",
        vendorName: "CV Marmer Indah Sentosa",
      }),
    ).toBe("TRF-BCA-SUB-MARMER");

    expect(
      deriveVendorPaymentReference({
        bankName: "BCA",
        vendorName: "PT Kaca Nusantara Prima",
      }),
    ).toBe("TRF-BCA-SUB-KACA");
  });

  it("menghasilkan nomor referensi tukang sesuai alur B7.3", () => {
    expect(
      deriveVendorPaymentReference({
        bankName: "BCA",
        vendorName: "Mandor Tukang Kayu",
        categoryCode: "TUKANG",
      }),
    ).toBe("TRF-BCA-TKG-FINAL");
  });

  it("menghasilkan nomor referensi vendor umum dengan kode bank Mandiri", () => {
    expect(
      deriveVendorPaymentReference({
        bankName: "Mandiri Giro",
        vendorName: "CV Batu Prima Countertop",
      }),
    ).toBe("TRF-MDR-VND-BPC01");
  });
});

describe("deriveExpensePaymentReference", () => {
  it("menghasilkan nomor referensi pencairan biaya lapangan operasional", () => {
    const result = deriveExpensePaymentReference({
      bankName: "BCA Operasional",
      projectName: "Fit-Out Interior Studio Bassura City — Unit 18B",
      categoryCode: "OPERASIONAL",
    });
    expect(result).toBe("TRF-BCA-BSR-OPS");
  });

  it("menghasilkan nomor referensi biaya lapangan umum", () => {
    const result = deriveExpensePaymentReference({
      bankName: "Kas Kecil Lapangan",
      projectName: "Renovasi Rumah Menteng",
    });
    expect(result).toBe("TRF-KAS-MNT-EXP");
  });

  it("menghasilkan nomor referensi kas kecil operasional sesuai panduan alur B8.2", () => {
    const refPickup = deriveExpensePaymentReference({
      bankName: "Kas Kecil Lapangan / Workshop",
      projectName: "Fit-Out Interior Studio Bassura City — Unit 18B",
      categoryCode: "OPERASIONAL",
      costTitle: "Sewa Pickup & BBM Pengiriman Workshop ke Site Bassura",
    });
    expect(refPickup).toBe("KAS-OPS-BSR-01");

    const refDeposit = deriveExpensePaymentReference({
      bankName: "Kas Kecil Lapangan / Workshop",
      projectName: "Fit-Out Interior Studio Bassura City — Unit 18B",
      categoryCode: "OPERASIONAL",
      costTitle: "Izin Fit-Out & Deposit Kerja Pengelola Apartemen",
    });
    expect(refDeposit).toBe("KAS-OPS-BSR-02");

    const refKonsumsi = deriveExpensePaymentReference({
      bankName: "Kas Kecil Lapangan / Workshop",
      projectName: "Fit-Out Interior Studio Bassura City — Unit 18B",
      categoryCode: "OPERASIONAL",
      costTitle: "Konsumsi Lembur Tukang saat Instalasi Malam",
    });
    expect(refKonsumsi).toBe("KAS-OPS-BSR-03");
  });
});
