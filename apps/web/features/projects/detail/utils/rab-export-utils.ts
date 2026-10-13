import { z } from "zod";
import type ExcelJS from "exceljs";
import { rabPageSlices, type RabPrintableEstimate } from "@atria/core/ai/rab-export";

export interface RabExportMetadata {
  readonly projectName: string;
  readonly projectNumber?: string;
  readonly clientName?: string;
  readonly clientPhone?: string;
  readonly clientAddress?: string;
  readonly projectAddress?: string;
  readonly date?: string;
  readonly companyName?: string;
}

export interface RabColorTheme {
  readonly id: string;
  readonly name: string;
  readonly hex: string;
}

export const RAB_THEME_PRESETS: readonly RabColorTheme[] = [
  { id: "obsidian", name: "Obsidian Black", hex: "#181817" },
  { id: "terracotta", name: "Terracotta", hex: "#97371F" },
  { id: "navy", name: "Navy Executive", hex: "#0F172A" },
  { id: "forest", name: "Forest Sage", hex: "#1C2E24" },
];

export interface RabDocumentConfig {
  readonly themeColor: string;
  readonly companyName: string;
  readonly companyTagline: string;
  readonly companyAddress: string;
  readonly companyPhone: string;
  readonly logoType: "text" | "image";
  readonly logoDataUrl?: string;
  readonly docTitle: string;
  readonly paymentTermsNotes: string;
  readonly signeePreparedByTitle: string;
  readonly signeePreparedByName: string;
  readonly signeeApprovedByName: string;
}

export const DEFAULT_RAB_CONFIG: RabDocumentConfig = {
  themeColor: "#181817",
  companyName: "Perusahaan",
  companyTagline: "",
  companyAddress: "",
  companyPhone: "",
  logoType: "text",
  logoDataUrl: "",
  docTitle: "RENCANA ANGGARAN BIAYA (RAB)",
  paymentTermsNotes: "",
  signeePreparedByTitle: "Disiapkan oleh",
  signeePreparedByName: "",
  signeeApprovedByName: "",
};

const rabDocumentConfigSchema = z.object({
  themeColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  companyName: z.string().max(255),
  companyTagline: z.string().max(500),
  companyAddress: z.string().max(2000),
  companyPhone: z.string().max(500),
  logoType: z.enum(["text", "image"]),
  logoDataUrl: z
    .string()
    .max(3_000_000)
    .refine((s) => !s || /^data:image\/(png|jpeg|webp);base64,/.test(s))
    .optional(),
  docTitle: z.string().max(500),
  paymentTermsNotes: z.string().max(10000),
  signeePreparedByTitle: z.string().max(255),
  signeePreparedByName: z.string().max(255),
  signeeApprovedByName: z.string().max(255),
});
export const RAB_CONFIG_STORAGE_KEY = "atria_rab_document_config";

export function resolveRabDocumentConfig(
  saved: unknown,
  metaClientName?: string,
  companyName?: string,
  receiver?: unknown,
): RabDocumentConfig {
  const parsed = rabDocumentConfigSchema.partial().safeParse(saved);
  const recipient = z.string().max(255).safeParse(receiver);
  return {
    ...DEFAULT_RAB_CONFIG,
    companyName: companyName || DEFAULT_RAB_CONFIG.companyName,
    ...(parsed.success ? parsed.data : {}),
    signeeApprovedByName: recipient.success ? recipient.data : metaClientName || "",
  };
}
export function loadSavedRabConfig(
  metaClientName?: string,
  companyName?: string,
  documentId?: string,
): RabDocumentConfig {
  if (typeof window === "undefined")
    return resolveRabDocumentConfig({}, metaClientName, companyName);
  try {
    const raw = localStorage.getItem(RAB_CONFIG_STORAGE_KEY);
    const receiver = documentId
      ? localStorage.getItem(`${RAB_CONFIG_STORAGE_KEY}:receiver:${documentId}`)
      : null;
    return resolveRabDocumentConfig(
      raw ? JSON.parse(raw) : {},
      metaClientName,
      companyName,
      receiver ?? undefined,
    );
  } catch {
    return resolveRabDocumentConfig({}, metaClientName, companyName);
  }
}
export function saveRabConfig(config: RabDocumentConfig, documentId?: string): void {
  if (typeof window === "undefined") return;
  try {
    const { signeeApprovedByName, ...style } = config;
    localStorage.setItem(RAB_CONFIG_STORAGE_KEY, JSON.stringify(style));
    if (documentId)
      localStorage.setItem(
        `${RAB_CONFIG_STORAGE_KEY}:receiver:${documentId}`,
        signeeApprovedByName,
      );
  } catch {
    /* Local preferences can be retried in the current workbench. */
  }
}
export function resetRabConfig(
  metaClientName?: string,
  companyName?: string,
  documentId?: string,
): RabDocumentConfig {
  if (typeof window !== "undefined")
    try {
      localStorage.removeItem(RAB_CONFIG_STORAGE_KEY);
      if (documentId) localStorage.removeItem(`${RAB_CONFIG_STORAGE_KEY}:receiver:${documentId}`);
    } catch {
      /* Keep the current editor usable. */
    }
  return resolveRabDocumentConfig({}, metaClientName, companyName);
}

export function hexToArgb(hex: string): string {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    const r = clean[0] + clean[0];
    const g = clean[1] + clean[1];
    const b = clean[2] + clean[2];
    return `FF${r}${g}${b}`.toUpperCase();
  }
  if (clean.length === 6) {
    return `FF${clean}`.toUpperCase();
  }
  return "FF181817";
}

export function formatRupiahNumber(value: number | string): string {
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "Rp 0";
  return `Rp ${num.toLocaleString("id-ID", { maximumFractionDigits: 2, minimumFractionDigits: num % 1 === 0 ? 0 : 2 })}`;
}

export function buildRabExcelRows(
  rabEstimate: RabPrintableEstimate,
  meta: RabExportMetadata,
): (string | number)[][] {
  const issueDate =
    meta.date ||
    new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  const docNumber = meta.projectNumber
    ? `RAB/${meta.projectNumber}/R${rabEstimate.revision}`
    : `RAB/R${rabEstimate.revision}`;

  const rows: (string | number)[][] = [
    [meta.companyName || DEFAULT_RAB_CONFIG.companyName],
    ["RENCANA ANGGARAN BIAYA (RAB)"],
    [],
    ["No. Dokumen", docNumber, "", "Nama Klien", meta.clientName || "-"],
    ["Tanggal", issueDate, "", "Telepon", meta.clientPhone || "-"],
    ["Proyek", meta.projectName, "", "Lokasi Proyek", meta.projectAddress || "-"],
    ["Status", rabEstimate.status === "APPROVED" ? "DISETUJUI / FINAL" : "DRAF PENAWARAN"],
    [],
    // Table Header
    [
      "No.",
      "Kategori / Paket",
      "Uraian Pekerjaan & Spesifikasi",
      "Volume",
      "Satuan",
      "Harga Satuan (Rp)",
      "Jumlah Harga (Rp)",
    ],
  ];

  let itemCounter = 1;
  let totalGrand = 0;

  // 1. Bundles (Paket Pekerjaan)
  for (const bundle of rabEstimate.bundles) {
    if (bundle.isHidden) continue;
    const bundleLineTotal = Number(bundle.lineTotal) || 0;
    totalGrand += bundleLineTotal;

    // Header baris paket
    rows.push([
      itemCounter++,
      bundle.clientLabel.toUpperCase(),
      bundle.description || "(Paket Pekerjaan Terpadu)",
      Number(bundle.quantity) || 1,
      bundle.unit || "ls",
      Number(bundle.unitPrice) || bundleLineTotal,
      bundleLineTotal,
    ]);

    // Sub-items di dalam bundle jika ada
    const childItems = rabEstimate.items.filter((it) => it.bundleId === bundle.id && !it.isHidden);
    for (const child of childItems) {
      rows.push([
        "",
        `  ↳ ${bundle.clientLabel}`,
        `• ${child.clientLabel}${child.description ? ` (${child.description})` : ""}`,
        Number(child.quantity) || 0,
        child.unit || "-",
        "-",
        "- (Termasuk Paket)",
      ]);
    }
  }

  // 2. Standalone Production Items
  const standaloneItems = rabEstimate.items.filter(
    (it) => !it.bundleId && !it.isHidden && it.itemNature === "PRODUCTION",
  );
  if (standaloneItems.length > 0) {
    rows.push(["", "PEKERJAAN FISIK & MATERIAL", "", "", "", "", ""]);
    for (const item of standaloneItems) {
      const lineTotal = Number(item.lineTotal) || 0;
      totalGrand += lineTotal;
      rows.push([
        itemCounter++,
        "Pekerjaan Produksi",
        `${item.clientLabel}${item.description ? ` - ${item.description}` : ""}`,
        Number(item.quantity) || 0,
        item.unit || "unit",
        Number(item.unitPrice) || 0,
        lineTotal,
      ]);
    }
  }

  // 3. Service Fee / Jasa Desain & Supervisi
  const serviceItems = rabEstimate.items.filter(
    (it) => !it.bundleId && !it.isHidden && it.itemNature === "SERVICE_FEE",
  );
  if (serviceItems.length > 0) {
    rows.push(["", "JASA DESAIN & SUPERVISI", "", "", "", "", ""]);
    for (const item of serviceItems) {
      const lineTotal = Number(item.lineTotal) || 0;
      totalGrand += lineTotal;
      rows.push([
        itemCounter++,
        "Jasa Profesional",
        `${item.clientLabel}${item.description ? ` - ${item.description}` : ""}`,
        Number(item.quantity) || 0,
        item.unit || "ls",
        Number(item.unitPrice) || 0,
        lineTotal,
      ]);
    }
  }

  rows.push([]);
  rows.push(["", "", "", "", "", "TOTAL NILAI RAB", totalGrand]);
  rows.push([]);

  // Catatan Pembayaran & Termin
  rows.push(["KETENTUAN PEMBAYARAN:"]);
  if (rabEstimate.clientNotes) {
    rows.push([`• ${rabEstimate.clientNotes}`]);
  }

  rows.push([]);
  rows.push(["Disiapkan Oleh:", "", "", "", "", "Disetujui Oleh:"]);
  rows.push([]);
  rows.push([]);
  rows.push(["STUDIO LEAD", "", "", "", "", meta.clientName || "KLIEN"]);

  return rows;
}

export async function exportRabToExcel(
  rabEstimate: RabPrintableEstimate,
  meta: RabExportMetadata,
): Promise<void> {
  const XLSX = await import("xlsx");
  const rows = buildRabExcelRows(rabEstimate, meta);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws["!cols"] = [
    { wch: 6 },
    { wch: 25 },
    { wch: 45 },
    { wch: 10 },
    { wch: 10 },
    { wch: 18 },
    { wch: 20 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "RAB");

  const cleanProjectName = meta.projectName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `RAB_${cleanProjectName}_R${rabEstimate.revision}.xlsx`;

  XLSX.writeFile(wb, filename);
}

export async function optimizeLogoDataUrl(
  dataUrl: string,
  maxWidth = 400,
  maxHeight = 160,
): Promise<string> {
  if (
    typeof window === "undefined" ||
    !dataUrl ||
    dataUrl.startsWith("data:image/svg+xml") ||
    !dataUrl.startsWith("data:image/")
  ) {
    return dataUrl;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxWidth && height <= maxHeight) {
        resolve(dataUrl);
        return;
      }
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/png", 0.9));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function buildRabStyledWorkbook(
  rabEstimate: RabPrintableEstimate,
  meta: RabExportMetadata,
  config?: RabDocumentConfig,
): Promise<ExcelJS.Workbook> {
  const { default: ExcelJS } = await import("exceljs");
  const cfg = config ?? {
    ...DEFAULT_RAB_CONFIG,
    companyName: meta.companyName || DEFAULT_RAB_CONFIG.companyName,
    signeeApprovedByName: meta.clientName || DEFAULT_RAB_CONFIG.signeeApprovedByName,
  };

  const themeArgb = hexToArgb(cfg.themeColor);
  const neutralBorder = {
    top: { style: "thin" as const, color: { argb: "FFE0E0E0" } },
    left: { style: "thin" as const, color: { argb: "FFE0E0E0" } },
    bottom: { style: "thin" as const, color: { argb: "FFE0E0E0" } },
    right: { style: "thin" as const, color: { argb: "FFE0E0E0" } },
  };

  const workbook = new ExcelJS.Workbook();
  workbook.creator = cfg.companyName || "STUDIO";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("RAB Klien", {
    views: [{ showGridLines: true }],
  });

  ws.columns = [
    { key: "no", width: 6 },
    { key: "category", width: 28 },
    { key: "description", width: 48 },
    { key: "quantity", width: 10 },
    { key: "unit", width: 10 },
    { key: "unitPrice", width: 18 },
    { key: "lineTotal", width: 22 },
  ];

  // Embed logo image in Excel if user uploaded a PNG/JPEG logo
  if (cfg.logoType === "image" && cfg.logoDataUrl) {
    const match = cfg.logoDataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
    if (match && match[2]) {
      try {
        const ext = match[1] === "jpg" ? "jpeg" : (match[1] as "png" | "jpeg");
        const imageId = workbook.addImage({
          base64: match[2],
          extension: ext,
        });
        ws.addImage(imageId, {
          tl: { col: 0.1, row: 0.1 },
          ext: { width: 135, height: 42 },
          editAs: "oneCell",
        });
      } catch (err: unknown) {
        console.warn("Could not embed logo image into Excel workbook:", err);
      }
    }
  }

  const issueDate =
    meta.date ||
    new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const docNumber = meta.projectNumber
    ? `RAB/${meta.projectNumber}/R${rabEstimate.revision}`
    : `RAB/R${rabEstimate.revision}`;

  // 1. Header Identitas Perusahaan
  const row1 = ws.addRow([cfg.companyName.toUpperCase()]);
  row1.getCell(1).font = { name: "Segoe UI", size: 16, bold: true, color: { argb: themeArgb } };

  const row2 = ws.addRow([cfg.companyTagline.toUpperCase()]);
  row2.getCell(1).font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF666666" } };

  const row3 = ws.addRow([`${cfg.companyAddress} • ${cfg.companyPhone}`]);
  row3.getCell(1).font = { name: "Segoe UI", size: 9, color: { argb: "FF888888" } };

  ws.addRow([]); // Blank row 4

  // 2. Judul Dokumen
  const row5 = ws.addRow([cfg.docTitle.toUpperCase()]);
  row5.getCell(1).font = { name: "Segoe UI", size: 13, bold: true, color: { argb: themeArgb } };

  // 3. Metadata Dokumen & Klien
  const metaRow1 = ws.addRow(["No. Dokumen", docNumber, "", "Nama Klien", meta.clientName || "-"]);
  metaRow1.getCell(1).font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF444444" } };
  metaRow1.getCell(2).font = { name: "Segoe UI", size: 9, bold: true };
  metaRow1.getCell(4).font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF444444" } };
  metaRow1.getCell(5).font = { name: "Segoe UI", size: 9, bold: true };

  const metaRow2 = ws.addRow(["Tanggal", issueDate, "", "Telepon", meta.clientPhone || "-"]);
  metaRow2.getCell(1).font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF444444" } };
  metaRow2.getCell(2).font = { name: "Segoe UI", size: 9 };
  metaRow2.getCell(4).font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF444444" } };
  metaRow2.getCell(5).font = { name: "Segoe UI", size: 9 };

  const metaRow3 = ws.addRow([
    "Proyek",
    meta.projectName,
    "",
    "Lokasi Proyek",
    meta.projectAddress || "-",
  ]);
  metaRow3.getCell(1).font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF444444" } };
  metaRow3.getCell(2).font = { name: "Segoe UI", size: 9 };
  metaRow3.getCell(4).font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF444444" } };
  metaRow3.getCell(5).font = { name: "Segoe UI", size: 9 };

  const metaRow4 = ws.addRow([
    "Status",
    rabEstimate.status === "APPROVED" ? "DISETUJUI / FINAL" : "DRAF PENAWARAN",
  ]);
  metaRow4.getCell(1).font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF444444" } };
  metaRow4.getCell(2).font = {
    name: "Segoe UI",
    size: 9,
    bold: true,
    color: { argb: rabEstimate.status === "APPROVED" ? "FF1C2E24" : "FF97371F" },
  };

  ws.addRow([]); // Blank row 10

  // 4. Table Header
  const headerRow = ws.addRow([
    "No.",
    "Kategori / Paket",
    "Uraian Pekerjaan & Spesifikasi",
    "Volume",
    "Satuan",
    "Harga Satuan (Rp)",
    "Jumlah Harga (Rp)",
  ]);
  headerRow.height = 26;

  for (let c = 1; c <= 7; c++) {
    const cell = headerRow.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: themeArgb } };
    cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCCCCCC" } },
      left: { style: "thin", color: { argb: "FFCCCCCC" } },
      bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
      right: { style: "thin", color: { argb: "FFCCCCCC" } },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: c === 1 ? "center" : c === 4 || c === 5 ? "center" : c >= 6 ? "right" : "left",
    };
  }

  let itemCounter = 1;
  let totalGrand = 0;

  // 5. Data: Bundles
  for (const bundle of rabEstimate.bundles) {
    if (bundle.isHidden) continue;
    const bundleLineTotal = Number(bundle.lineTotal) || 0;
    totalGrand += bundleLineTotal;

    const bRow = ws.addRow([
      itemCounter++,
      bundle.clientLabel.toUpperCase(),
      bundle.description || "(Paket Pekerjaan Terpadu)",
      Number(bundle.quantity) || 1,
      bundle.unit || "ls",
      Number(bundle.unitPrice) || bundleLineTotal,
      bundleLineTotal,
    ]);
    bRow.height = 24;

    for (let c = 1; c <= 7; c++) {
      const cell = bRow.getCell(c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF6F6F8" } };
      cell.border = neutralBorder;
      cell.font = { name: "Segoe UI", size: 10, bold: c === 2 || c === 7 };
      cell.alignment = {
        vertical: "middle",
        horizontal: c === 1 || c === 4 || c === 5 ? "center" : c >= 6 ? "right" : "left",
        wrapText: c === 3,
      };
      if (c === 6 || c === 7) {
        cell.numFmt =
          typeof cell.value === "number" && cell.value % 1 !== 0 ? '"Rp "#,##0.00' : '"Rp "#,##0';
      }
    }

    // Sub-items di dalam bundle
    const childItems = rabEstimate.items.filter((it) => it.bundleId === bundle.id && !it.isHidden);
    for (const child of childItems) {
      const cRow = ws.addRow([
        "",
        `  ↳ ${bundle.clientLabel}`,
        `• ${child.clientLabel}${child.description ? ` (${child.description})` : ""}`,
        Number(child.quantity) || 0,
        child.unit || "-",
        "-",
        "(Termasuk Paket)",
      ]);
      cRow.height = 20;

      for (let c = 1; c <= 7; c++) {
        const cell = cRow.getCell(c);
        cell.border = {
          top: { style: "thin", color: { argb: "FFF0F0F2" } },
          bottom: { style: "thin", color: { argb: "FFF0F0F2" } },
          left: { style: "thin", color: { argb: "FFF0F0F2" } },
          right: { style: "thin", color: { argb: "FFF0F0F2" } },
        };
        cell.font = {
          name: "Segoe UI",
          size: 9,
          color: { argb: "FF555555" },
          italic: c === 7,
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: c === 1 || c === 4 || c === 5 ? "center" : c >= 6 ? "right" : "left",
        };
      }
    }
  }

  // 6. Data: Standalone Production Items
  const standaloneItems = rabEstimate.items.filter(
    (it) => !it.bundleId && !it.isHidden && it.itemNature === "PRODUCTION",
  );
  if (standaloneItems.length > 0) {
    const bannerRow = ws.addRow(["", "PEKERJAAN FISIK & MATERIAL", "", "", "", "", ""]);
    bannerRow.height = 20;
    for (let c = 1; c <= 7; c++) {
      const cell = bannerRow.getCell(c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEEEF0" } };
      cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF444444" } };
      cell.border = neutralBorder;
      cell.alignment = { vertical: "middle" };
    }

    for (const item of standaloneItems) {
      const lineTotal = Number(item.lineTotal) || 0;
      totalGrand += lineTotal;
      const sRow = ws.addRow([
        itemCounter++,
        "Pekerjaan Produksi",
        `${item.clientLabel}${item.description ? ` - ${item.description}` : ""}`,
        Number(item.quantity) || 0,
        item.unit || "unit",
        Number(item.unitPrice) || 0,
        lineTotal,
      ]);
      sRow.height = 22;

      for (let c = 1; c <= 7; c++) {
        const cell = sRow.getCell(c);
        cell.border = neutralBorder;
        cell.font = { name: "Segoe UI", size: 9.5, bold: c === 7 };
        cell.alignment = {
          vertical: "middle",
          horizontal: c === 1 || c === 4 || c === 5 ? "center" : c >= 6 ? "right" : "left",
          wrapText: c === 3,
        };
        if (c === 6 || c === 7) {
          cell.numFmt =
            typeof cell.value === "number" && cell.value % 1 !== 0 ? '"Rp "#,##0.00' : '"Rp "#,##0';
        }
      }
    }
  }

  // 7. Data: Service Items
  const serviceItems = rabEstimate.items.filter(
    (it) => !it.bundleId && !it.isHidden && it.itemNature === "SERVICE_FEE",
  );
  if (serviceItems.length > 0) {
    const bannerRow = ws.addRow(["", "JASA DESAIN, PERENCANAAN & SUPERVISI", "", "", "", "", ""]);
    bannerRow.height = 20;
    for (let c = 1; c <= 7; c++) {
      const cell = bannerRow.getCell(c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEEEF0" } };
      cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF444444" } };
      cell.border = neutralBorder;
      cell.alignment = { vertical: "middle" };
    }

    for (const item of serviceItems) {
      const lineTotal = Number(item.lineTotal) || 0;
      totalGrand += lineTotal;
      const servRow = ws.addRow([
        itemCounter++,
        "Jasa Profesional",
        `${item.clientLabel}${item.description ? ` - ${item.description}` : ""}`,
        Number(item.quantity) || 0,
        item.unit || "ls",
        Number(item.unitPrice) || 0,
        lineTotal,
      ]);
      servRow.height = 22;

      for (let c = 1; c <= 7; c++) {
        const cell = servRow.getCell(c);
        cell.border = neutralBorder;
        cell.font = { name: "Segoe UI", size: 9.5, bold: c === 7 };
        cell.alignment = {
          vertical: "middle",
          horizontal: c === 1 || c === 4 || c === 5 ? "center" : c >= 6 ? "right" : "left",
          wrapText: c === 3,
        };
        if (c === 6 || c === 7) {
          cell.numFmt =
            typeof cell.value === "number" && cell.value % 1 !== 0 ? '"Rp "#,##0.00' : '"Rp "#,##0';
        }
      }
    }
  }

  // 8. Total Grand
  const totalRow = ws.addRow(["", "", "", "", "", "TOTAL NILAI RAB", totalGrand]);
  totalRow.height = 28;
  for (let c = 1; c <= 7; c++) {
    const cell = totalRow.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: themeArgb } };
    cell.font = {
      name: "Segoe UI",
      size: c === 7 ? 12 : 10,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFFFFFFF" } },
      bottom: { style: "double", color: { argb: "FFFFFFFF" } },
      left: { style: "thin", color: { argb: themeArgb } },
      right: { style: "thin", color: { argb: themeArgb } },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "right",
    };
    if (c === 7) {
      cell.numFmt =
        typeof cell.value === "number" && cell.value % 1 !== 0 ? '"Rp "#,##0.00' : '"Rp "#,##0';
    }
  }

  ws.addRow([]); // Blank row

  // 9. Ketentuan Pembayaran
  const termsTitleRow = ws.addRow(["KETENTUAN PEMBAYARAN & CATATAN TEKNIS:"]);
  termsTitleRow.getCell(1).font = {
    name: "Segoe UI",
    size: 10,
    bold: true,
    color: { argb: themeArgb },
  };

  if (rabEstimate.clientNotes) {
    const noteRow = ws.addRow([`• ${rabEstimate.clientNotes}`]);
    noteRow.getCell(1).font = {
      name: "Segoe UI",
      size: 9,
      italic: true,
      color: { argb: "FF333333" },
    };
  }

  const termsLines = cfg.paymentTermsNotes
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of termsLines) {
    const tRow = ws.addRow([line]);
    tRow.getCell(1).font = { name: "Segoe UI", size: 9, color: { argb: "FF444444" } };
  }

  ws.addRow([]); // Blank row

  // 10. Tanda Tangan
  const sigHeadingRow = ws.addRow(["", "Disiapkan Oleh:", "", "", "", "Disetujui Oleh:"]);
  sigHeadingRow.getCell(2).font = { name: "Segoe UI", size: 9, color: { argb: "FF666666" } };
  sigHeadingRow.getCell(2).alignment = { horizontal: "center" };
  sigHeadingRow.getCell(6).font = { name: "Segoe UI", size: 9, color: { argb: "FF666666" } };
  sigHeadingRow.getCell(6).alignment = { horizontal: "center" };

  const emptySig1 = ws.addRow([]);
  emptySig1.height = 18;
  const emptySig2 = ws.addRow([]);
  emptySig2.height = 18;

  const sigNameRow = ws.addRow([
    "",
    cfg.signeePreparedByTitle,
    "",
    "",
    "",
    "KLIEN / PEMBERI TUGAS",
  ]);
  sigNameRow.getCell(2).font = {
    name: "Segoe UI",
    size: 10,
    bold: true,
    color: { argb: themeArgb },
  };
  sigNameRow.getCell(2).alignment = { horizontal: "center" };
  sigNameRow.getCell(6).font = {
    name: "Segoe UI",
    size: 10,
    bold: true,
    color: { argb: "FF181817" },
  };
  sigNameRow.getCell(6).alignment = { horizontal: "center" };

  const sigPicRow = ws.addRow([
    "",
    `( ${cfg.signeePreparedByName} )`,
    "",
    "",
    "",
    `( ${cfg.signeeApprovedByName || meta.clientName || ".................................................."} )`,
  ]);
  sigPicRow.getCell(2).font = { name: "Segoe UI", size: 9, underline: true };
  sigPicRow.getCell(2).alignment = { horizontal: "center" };
  sigPicRow.getCell(6).font = { name: "Segoe UI", size: 9, underline: true };
  sigPicRow.getCell(6).alignment = { horizontal: "center" };

  return workbook;
}

export async function exportRabToStyledExcel(
  rabEstimate: RabPrintableEstimate,
  meta: RabExportMetadata,
  config?: RabDocumentConfig,
): Promise<void> {
  const workbook = await buildRabStyledWorkbook(rabEstimate, meta, config);
  const buffer = await workbook.xlsx.writeBuffer();

  if (typeof window === "undefined") return;

  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const URL = window.URL || window.webkitURL || window;
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const cleanProjectName = meta.projectName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `RAB_${cleanProjectName}_R${rabEstimate.revision}.xlsx`;

  link.download = filename;
  link.href = downloadUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

export interface ExportImageResult {
  readonly success: boolean;
  readonly blob?: Blob;
  readonly error?: string;
}

export async function exportElementToPng(
  element: HTMLElement,
  filename: string,
  autoDownload: boolean = true,
): Promise<ExportImageResult> {
  if (typeof window === "undefined") {
    return { success: false, error: "Ekspor gambar hanya dapat dilakukan di peramban (browser)." };
  }

  try {
    if (element.scrollHeight > 14000)
      return {
        success: false,
        error: "Dokumen terlalu panjang untuk satu gambar. Gunakan PDF atau Excel.",
      };
    const canvas = await captureRabCanvas(element);
    return new Promise((resolve) => {
      canvas.toBlob((blob: Blob | null) => {
        if (!blob) {
          resolve({ success: false, error: "Gagal membuat berkas gambar dari canvas." });
          return;
        }

        if (autoDownload) {
          const URL = window.URL || window.webkitURL || window;
          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
          link.href = downloadUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
        }

        resolve({ success: true, blob });
      }, "image/png");
    });
  } catch (err: unknown) {
    console.error("Gagal mengexport gambar RAB:", err);
    const message =
      err instanceof Error ? err.message : "Terjadi kesalahan saat memproses gambar RAB.";
    return { success: false, error: message };
  }
}

export interface ShareImageResult {
  readonly shared: boolean;
  readonly aborted?: boolean;
}

export async function shareImageViaWhatsAppOrDevice(
  blob: Blob,
  filename: string,
  title: string,
): Promise<ShareImageResult> {
  if (
    typeof navigator !== "undefined" &&
    "share" in navigator &&
    typeof navigator.canShare === "function"
  ) {
    const file = new File([blob], filename.endsWith(".png") ? filename : `${filename}.png`, {
      type: "image/png",
    });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title,
          text: `Berikut dokumen ${title}`,
          files: [file],
        });
        return { shared: true };
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError") {
          return { shared: false, aborted: true };
        }
        console.warn("Share failed:", err);
      }
    }
  }
  return { shared: false, aborted: false };
}

export async function captureRabCanvas(
  element: HTMLElement,
  crop?: { y: number; height: number },
): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  await Promise.all(Array.from(element.querySelectorAll("img")).map((img) => img.decode()));
  const html2canvasModule = await import("html2canvas-pro");
  const html2canvas = html2canvasModule.default || html2canvasModule;

  return html2canvas(element, {
    ...crop,
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: 0,
    windowWidth: Math.max(element.scrollWidth, 800),
    ignoreElements: (el: Element) => el.tagName === "STYLE",
    onclone: (_clonedDoc: Document, clonedElement: HTMLElement) => {
      clonedElement.style.width = "794px";
      clonedElement.style.maxWidth = "794px";
      clonedElement.style.margin = "0 auto";
      clonedElement.style.boxSizing = "border-box";
      clonedElement.style.transform = "none";

      // Reset any transforms or scroll/height constraints on ancestors in the cloned tree
      let p = clonedElement.parentElement;
      while (p && p !== _clonedDoc.body) {
        p.style.transform = "none";
        p.style.overflow = "visible";
        p.style.height = "auto";
        p.style.maxHeight = "none";
        p = p.parentElement;
      }
    },
  });
}

export function downloadRabBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function buildRabPdfBlob(element: HTMLElement): Promise<Blob> {
  await document.fonts.ready;
  await Promise.all(Array.from(element.querySelectorAll("img")).map((img) => img.decode()));
  const { PDFDocument, PageSizes, StandardFonts } = await import("pdf-lib");
  const pdf = await PDFDocument.create(),
    [width, height] = PageSizes.A4,
    margin = 24;
  const documentWidth = element.scrollWidth,
    ratio = documentWidth / element.getBoundingClientRect().width,
    origin = element.getBoundingClientRect().top;
  const bounds = (node: Element): { top: number; bottom: number } => {
    const r = node.getBoundingClientRect();
    return {
      top: Math.floor((r.top - origin) * ratio),
      bottom: Math.ceil((r.bottom - origin) * ratio),
    };
  };
  const header = element.querySelector("[data-rab-export-identity]"),
    thead = element.querySelector("thead"),
    total = element.querySelector("tfoot"),
    closing = element.querySelector("[data-rab-export-closing]");
  const blocks = Array.from(element.querySelectorAll("tr,header,p,footer,h2,h3")).map(bounds);
  if (total && closing) blocks.push({ top: bounds(total).top, bottom: bounds(closing).bottom });
  const pdfScale = (width - margin * 2) / documentWidth;
  const continuationHeight =
    (header ? bounds(header).bottom - bounds(header).top : 0) +
    (thead ? bounds(thead).bottom - bounds(thead).top : 0) +
    20;
  const pageHeight = Math.floor((height - margin * 2 - 14) / pdfScale - continuationHeight);
  const first = rabPageSlices(
    element.scrollHeight,
    Math.floor((height - margin * 2 - 14) / pdfScale),
    blocks,
  )[0];
  const rest =
    element.scrollHeight > first.height
      ? rabPageSlices(
          element.scrollHeight - first.height,
          pageHeight,
          blocks.map((b) => ({ top: b.top - first.height, bottom: b.bottom - first.height })),
        ).map((p) => ({ top: p.top + first.height, height: p.height }))
      : [];
  const slices = [first, ...rest];
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const capture = async (top: number, h: number): Promise<import("pdf-lib").PDFImage> => {
    const canvas = await captureRabCanvas(element, { y: top, height: h });
    const png = await pdf.embedPng(canvas.toDataURL("image/png"));
    canvas.width = 0;
    canvas.height = 0;
    return png;
  };
  const headerImage = header
    ? await capture(bounds(header).top, bounds(header).bottom - bounds(header).top)
    : null;
  const headingImage = thead
    ? await capture(bounds(thead).top, bounds(thead).bottom - bounds(thead).top)
    : null;
  for (const [index, slice] of slices.entries()) {
    const page = pdf.addPage(PageSizes.A4);
    let y = height - margin;
    if (index) {
      for (const image of [headerImage, headingImage])
        if (image) {
          const h = (image.height * (width - margin * 2)) / image.width;
          page.drawImage(image, { x: margin, y: y - h, width: width - margin * 2, height: h });
          y -= h + 6;
        }
    }
    const image = await capture(slice.top, slice.height),
      h = (image.height * (width - margin * 2)) / image.width;
    page.drawImage(image, { x: margin, y: y - h, width: width - margin * 2, height: h });
    page.drawText(`${index + 1} / ${slices.length}`, { x: width - 60, y: 12, size: 8, font });
  }
  pdf.setTitle("RAB untuk klien");
  return new Blob([new Uint8Array(await pdf.save()).buffer], { type: "application/pdf" });
}
