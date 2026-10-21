import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RabExportDocument } from "./rab-export-document";
import { RabExportCanvas } from "./rab-export-canvas";
import type { RabEstimateView } from "../../types/rap-rab-types";
import type { RabExportMetadata } from "../../utils/rab-export-utils";

describe("RabExport Components Redesign", () => {
  const mockEstimate: RabEstimateView = {
    id: "est-1",
    sourceProjectRapId: null,
    supersedesRabEstimateId: null,
    status: "APPROVED",
    revision: 1,
    title: "RAB Utama",
    clientNotes: "Uang muka 50% saat SPK",
    approvedValue: "75000000",
    bundles: [
      {
        id: "bundle-1",
        clientLabel: "Paket Kitchen Set Minimalis",
        description: "Finishing HPL Taco",
        quantity: "1",
        unit: "set",
        unitPrice: "45000000",
        lineTotal: "45000000",
        displayOrder: 1,
        isHidden: false,
        itemIds: ["item-1"],
      },
    ],
    items: [
      {
        id: "item-1",
        bundleId: "bundle-1",
        clientLabel: "Cabinet Plywood",
        description: "18mm",
        quantity: "1",
        unit: "unit",
        unitPrice: "45000000",
        lineTotal: "45000000",
        itemNature: "PRODUCTION",
        displayOrder: 1,
        sourceType: "RAP_MATERIAL",
        sourceProjectRapItemId: "mat-1",
        sourceProjectCategoryPlanItemId: null,
        isBundle: false,
        sourceRevision: null,
        sourceUpdatedAt: null,
        isHidden: false,
      },
      {
        id: "item-2",
        bundleId: null,
        clientLabel: "Jasa Supervisi & Desain 3D",
        description: null,
        quantity: "1",
        unit: "ls",
        unitPrice: "30000000",
        lineTotal: "30000000",
        itemNature: "SERVICE_FEE",
        displayOrder: 2,
        sourceType: "MANUAL",
        sourceProjectRapItemId: null,
        sourceProjectCategoryPlanItemId: null,
        isBundle: false,
        sourceRevision: null,
        sourceUpdatedAt: null,
        isHidden: false,
      },
    ],
  };

  const mockMeta: RabExportMetadata = {
    projectName: "Villa Seminyak",
    projectNumber: "PRJ-2026-001",
    clientName: "Bpk. Hendra",
    clientPhone: "+62 812-9988-7766",
    projectAddress: "Seminyak, Bali",
    date: "15 Agustus 2026",
  };

  it("renders RabExportDocument with modern architectural editorial style", () => {
    const html = renderToStaticMarkup(
      <RabExportDocument rabEstimate={mockEstimate} meta={mockMeta} />,
    );

    expect(html).toContain("Villa Seminyak");
    expect(html).toContain("Bpk. Hendra");
    expect(html).toContain("RAB RESMI");
    expect(html).toContain("Paket Kitchen Set Minimalis");
    expect(html).toContain("Jasa Supervisi &amp; Desain 3D");
    expect(html).toContain("75.000.000");
    // Verifies print styles tag presence
    expect(html).toContain("@media print");
  });

  it("renders RabExportCanvas with floating fit controls and pill style", () => {
    const html = renderToStaticMarkup(
      <RabExportCanvas>
        <div id="test-content">Document Content</div>
      </RabExportCanvas>,
    );

    expect(html).toContain("Fit Lebar");
    expect(html).toContain("Fit Halaman");
    expect(html).toContain("Document Content");
  });

  it("implements shared responsive FormSheet with footer actions and ActionMenu in rab-export-drawer.tsx", async () => {
    const drawerPath = new URL("./rab-export-drawer.tsx", import.meta.url);
    const source = await Bun.file(drawerPath).text();

    expect(source).toContain("<FormSheet");
    expect(source).toContain("footer={footer}");
    expect(source).toContain("<ActionMenu");
    expect(source).toContain("<SheetFooterActions");
    expect(source).toContain("Format dokumen");
    expect(source).toContain("buildRabPdfBlob");
    expect(source).toContain("<SegmentedTabs");
    expect(source).toContain('title="Tema Warna Dokumen"');
    expect(source).toContain('title="Identitas Studio & Kop Surat"');
    expect(source).toContain('title="Judul dan ketentuan"');
    expect(source).toContain('title="Penyiap dan penerima"');
    // Ensures no nested card wrapper
    expect(source).not.toContain("rounded-2xl bg-surface-container-lowest p-4 ring-1");
    expect(source).toContain('label="Warna Aksen Dokumen"');
    expect(source).toContain("<CustomColorPicker");
    expect(source).toContain("presets={RAB_THEME_PRESETS}");
    expect(source).not.toContain('type="color"');
  });
});
