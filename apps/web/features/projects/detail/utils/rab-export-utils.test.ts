import { describe, expect, it } from "bun:test";
import { buildRabExcelRows } from "./rab-export-utils";
import type {
  RabBundleView,
  RabEstimateView,
  RabItemView,
} from "../types/rap-rab-types";

describe("rab-export-utils", () => {
  const mockBundle: RabBundleView = {
    id: "bundle-1",
    clientLabel: "Paket Kitchen Set Minimalis",
    description: "Bahan plywood finishing HPL Taco, termasuk sink dan rak piring",
    quantity: "1",
    unit: "set",
    unitPrice: "45000000",
    lineTotal: "45000000",
    displayOrder: 1,
    isHidden: false,
    itemIds: ["item-1", "item-2"],
  };

  const mockItem1: RabItemView = {
    id: "item-1",
    sourceType: "RAP_MATERIAL",
    itemNature: "PRODUCTION",
    sourceProjectRapItemId: "rap-item-1",
    sourceProjectCategoryPlanItemId: null,
    clientLabel: "Kabinet Atas Plywood HPL",
    description: "Finishing luar HPL Taco Woodgrain",
    quantity: "3",
    unit: "m1",
    unitPrice: "2500000",
    lineTotal: "7500000",
    displayOrder: 1,
    isHidden: false,
    isBundle: false,
    bundleId: "bundle-1",
    sourceRevision: 1,
    sourceUpdatedAt: new Date(),
  };

  const mockItem2: RabItemView = {
    id: "item-2",
    sourceType: "RAP_MATERIAL",
    itemNature: "PRODUCTION",
    sourceProjectRapItemId: "rap-item-2",
    sourceProjectCategoryPlanItemId: null,
    clientLabel: "Kabinet Bawah & Top Table Solid Surface",
    description: "Sink undermount stainless",
    quantity: "3",
    unit: "m1",
    unitPrice: "3500000",
    lineTotal: "10500000",
    displayOrder: 2,
    isHidden: false,
    isBundle: false,
    bundleId: "bundle-1",
    sourceRevision: 1,
    sourceUpdatedAt: new Date(),
  };

  const mockStandaloneItem: RabItemView = {
    id: "item-3",
    sourceType: "MANUAL",
    itemNature: "PRODUCTION",
    sourceProjectRapItemId: null,
    sourceProjectCategoryPlanItemId: null,
    clientLabel: "Partisi Kisi-kisi Kayu Solid Kamper",
    description: "Finishing melamic natural doff",
    quantity: "6",
    unit: "m2",
    unitPrice: "1800000",
    lineTotal: "10800000",
    displayOrder: 3,
    isHidden: false,
    isBundle: false,
    bundleId: null,
    sourceRevision: null,
    sourceUpdatedAt: null,
  };

  const mockServiceItem: RabItemView = {
    id: "item-4",
    sourceType: "MANUAL",
    itemNature: "SERVICE_FEE",
    sourceProjectRapItemId: null,
    sourceProjectCategoryPlanItemId: null,
    clientLabel: "Jasa Desain 3D, Gambar Kerja, & Supervisi Proyek",
    description: "Konsultasi material dan asistensi lapangan",
    quantity: "1",
    unit: "ls",
    unitPrice: "12000000",
    lineTotal: "12000000",
    displayOrder: 4,
    isHidden: false,
    isBundle: false,
    bundleId: null,
    sourceRevision: null,
    sourceUpdatedAt: null,
  };

  const mockRabEstimate: RabEstimateView = {
    id: "rab-1",
    sourceProjectRapId: "rap-1",
    supersedesRabEstimateId: null,
    status: "APPROVED",
    revision: 1,
    title: "RAB Interior Apartemen Bassura",
    clientNotes: "Harga sudah termasuk pengiriman dan instalasi di lokasi proyek.",
    approvedValue: "67800000",
    items: [mockItem1, mockItem2, mockStandaloneItem, mockServiceItem],
    bundles: [mockBundle],
  };

  it("builds structured rows for Excel containing project, client, items, bundles, and totals", () => {
    const rows = buildRabExcelRows(mockRabEstimate, {
      projectName: "Bassura City Tower C",
      projectNumber: "PRJ-2026-001",
      clientName: "Ibu Amanda",
      clientPhone: "08123456789",
      projectAddress: "Jl. Basuki Rahmat No. 1, Jakarta Timur",
    });

    expect(rows.length).toBeGreaterThan(15);
    // Header validations
    expect(rows[0][0]).toBe("STUDIO INTERIOR & ARCHITECTURE");
    expect(rows[1][0]).toBe("RENCANA ANGGARAN BIAYA (RAB)");

    // Project & client metadata
    const flatString = JSON.stringify(rows);
    expect(flatString).toContain("Bassura City Tower C");
    expect(flatString).toContain("Ibu Amanda");
    expect(flatString).toContain("RAB/PRJ-2026-001/R1");

    // Bundle row included
    expect(flatString).toContain("PAKET KITCHEN SET MINIMALIS");
    expect(flatString).toContain("45000000");

    // Standalone item included
    expect(flatString).toContain("Partisi Kisi-kisi Kayu Solid Kamper");
    expect(flatString).toContain("10800000");

    // Service fee included
    expect(flatString).toContain("JASA DESAIN & SUPERVISI");
    expect(flatString).toContain("12000000");

    // Grand total: bundle (45jt) + standalone (10.8jt) + service (12jt) = 67.800.000
    const totalRow = rows.find((r) => r[5] === "TOTAL NILAI RAB");
    expect(totalRow).toBeDefined();
    expect(totalRow?.[6]).toBe(67_800_000);
  });

  it("enforces Client-Safe Invariant: never exposes internal RAP cost or vendor notes in Excel rows", () => {
    const rows = buildRabExcelRows(mockRabEstimate, {
      projectName: "Bassura City Tower C",
      clientName: "Ibu Amanda",
    });

    const flat = JSON.stringify(rows);
    expect(flat).not.toContain("costPerUnit");
    expect(flat).not.toContain("margin");
    expect(flat).not.toContain("markup");
    expect(flat).not.toContain("rap-item-1");
    expect(flat).not.toContain("vendorId");
  });

  it("builds styled Excel workbook with custom theme color, formatting, and client-safe rows", async () => {
    const { buildRabStyledWorkbook, hexToArgb } = await import("./rab-export-utils");
    const customConfig = {
      themeColor: "#97371F", // Terracotta
      companyName: "Studio Dekoria Custom",
      companyTagline: "Artisan Build",
      companyAddress: "Jl. Senopati No. 10",
      companyPhone: "+62 811-222-333",
      logoType: "text" as const,
      docTitle: "PENAWARAN RAB INTERIOR",
      paymentTermsNotes: "• Termin 1: 50%\n• Termin 2: 50%",
      signeePreparedByTitle: "STUDIO DEKORIA",
      signeePreparedByName: "Budi Santoso",
      signeeApprovedByName: "Ibu Amanda",
    };

    const workbook = await buildRabStyledWorkbook(
      mockRabEstimate,
      {
        projectName: "Bassura City Tower C",
        projectNumber: "PRJ-2026-001",
        clientName: "Ibu Amanda",
      },
      customConfig,
    );

    const ws = workbook.getWorksheet("RAB Klien");
    expect(ws).toBeDefined();

    // Check company name row and theme color applied
    const companyCell = ws?.getCell("A1");
    expect(companyCell?.value).toBe("STUDIO DEKORIA CUSTOM");
    const themeArgb = hexToArgb("#97371F");
    expect(themeArgb).toBe("FF97371F");
    expect(companyCell?.font?.color?.argb).toBe(themeArgb);

    // Check header row styling (Row 11)
    const headerCell = ws?.getRow(11).getCell(1);
    expect(headerCell?.value).toBe("No.");
    expect(headerCell?.fill).toMatchObject({
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: themeArgb },
    });

    // Check currency number format on line totals
    // Row 12 should be bundle row
    const bundleTotalCell = ws?.getRow(12).getCell(7);
    expect(bundleTotalCell?.value).toBe(45000000);
    expect(bundleTotalCell?.numFmt).toBe('"Rp "#,##0');

    // Check Grand Total row
    let foundTotal = false;
    ws?.eachRow((row) => {
      if (row.getCell(6).value === "TOTAL NILAI RAB") {
        foundTotal = true;
        expect(row.getCell(7).value).toBe(67800000);
        expect(row.getCell(7).numFmt).toBe('"Rp "#,##0');
        expect(row.getCell(7).fill).toMatchObject({
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: themeArgb },
        });
      }
    });
    expect(foundTotal).toBe(true);

    // Enforce Client-Safe Invariant across all cell values
    let cellValuesDump = "";
    ws?.eachRow((row) => {
      row.eachCell((cell) => {
        cellValuesDump += ` ${String(cell.value)}`;
      });
    });
    expect(cellValuesDump).not.toContain("costPerUnit");
    expect(cellValuesDump).not.toContain("margin");
    expect(cellValuesDump).not.toContain("markup");
    expect(cellValuesDump).not.toContain("rap-item-1");
    expect(cellValuesDump).not.toContain("vendorId");
  });

  it("handles document config defaults and reset cleanly", async () => {
    const { DEFAULT_RAB_CONFIG, resetRabConfig } = await import("./rab-export-utils");
    expect(DEFAULT_RAB_CONFIG.themeColor).toBe("#181817");
    expect(DEFAULT_RAB_CONFIG.companyName).toBe("STUDIO INTERIOR");

    const resetCfg = resetRabConfig("Pak Hendra");
    expect(resetCfg.themeColor).toBe("#181817");
    expect(resetCfg.signeeApprovedByName).toBe("Pak Hendra");
  });

  it("embeds raster logo image into Excel workbook when logoType is image", async () => {
    const { buildRabStyledWorkbook } = await import("./rab-export-utils");
    // 1x1 transparent PNG data URL
    const mockPngDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const workbook = await buildRabStyledWorkbook(
      mockRabEstimate,
      {
        projectName: "Bassura City Tower C",
        clientName: "Ibu Amanda",
      },
      {
        themeColor: "#181817",
        companyName: "STUDIO INTERIOR",
        companyTagline: "ARCHITECTURE & BUILD",
        companyAddress: "Jakarta",
        companyPhone: "08123456789",
        logoType: "image",
        logoDataUrl: mockPngDataUrl,
        docTitle: "RAB",
        paymentTermsNotes: "• DP 50%",
        signeePreparedByTitle: "LEAD",
        signeePreparedByName: "Director",
        signeeApprovedByName: "Ibu Amanda",
      },
    );

    const ws = workbook.getWorksheet("RAB Klien");
    expect(ws).toBeDefined();
    // ExcelJS workbook.model.media should contain the embedded image
    const media = (workbook.model as { media?: unknown[] })?.media;
    expect(media).toBeDefined();
    expect(media?.length).toBeGreaterThan(0);
  });

  it("handles optimizeLogoDataUrl gracefully for SVG and non-browser environments", async () => {
    const { optimizeLogoDataUrl } = await import("./rab-export-utils");
    const svgData = "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=";
    const resultSvg = await optimizeLogoDataUrl(svgData);
    expect(resultSvg).toBe(svgData);

    const plain = "not-an-image";
    const resultPlain = await optimizeLogoDataUrl(plain);
    expect(resultPlain).toBe(plain);
  });
});
