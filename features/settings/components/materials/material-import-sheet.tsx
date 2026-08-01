"use client";

import React from "react";
import { toast } from "sonner";

import {
  commitMaterialImport,
  previewMaterialImport,
  type MaterialImportInput,
  type MaterialImportPreview,
} from "@/app/actions/settings/material-import";
import { Button, FormRiskNotice, WorkflowFormSheet } from "@/components/ui";
import { GroupedSurface } from "@/components/ui/feedback/main-surface";
import { parseCsvTable } from "@/lib/import/csv";
import { AppIcon } from "@/components/ui/icon/app-icon";

function parseMaterialRows(source: string): MaterialImportInput {
  const table = parseCsvTable(source);
  const index = (name: string): number => table.headers.indexOf(name);
  const required = ["name", "category", "unit", "location"];
  const missing = required.filter((header) => index(header) < 0);
  if (missing.length > 0) throw new Error(`Header wajib belum ada: ${missing.join(", ")}.`);
  const value = (row: readonly string[], name: string): string =>
    index(name) >= 0 ? (row[index(name)] ?? "") : "";
  const numberValue = (row: readonly string[], name: string): number => {
    const parsed = Number(value(row, name) || 0);
    return Number.isFinite(parsed) ? parsed : -1;
  };
  return {
    rows: table.rows.map((row, rowIndex) => ({
      rowNumber: rowIndex + 2,
      name: value(row, "name"),
      categoryName: value(row, "category"),
      unit: value(row, "unit"),
      locationName: value(row, "location"),
      minimumStock: numberValue(row, "minimum_stock"),
      lastPurchasePrice: numberValue(row, "last_purchase_price"),
      vendorName: value(row, "vendor"),
      specification: value(row, "specification"),
      brand: value(row, "brand"),
      code: value(row, "code"),
      color: value(row, "color"),
    })),
  };
}

export function MaterialImportSheet({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}): React.JSX.Element {
  const [input, setInput] = React.useState<MaterialImportInput | null>(null);
  const [preview, setPreview] = React.useState<MaterialImportPreview | null>(null);
  const [fileName, setFileName] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const canCommit = Boolean(
    input && preview && preview.items.length > 0 && preview.errors.length === 0,
  );

  function downloadTemplate(): void {
    const content =
      "name,category,unit,location,minimum_stock,last_purchase_price,vendor,specification,brand,code,color\nMultipleks 18mm,Panel,lembar,Gudang Utama,2,250000,Vendor Utama,18mm,Brand,PLY-18,Natural\n";
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "template-material-master.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function reset(): void {
    setInput(null);
    setPreview(null);
    setFileName("");
  }

  async function readFile(file: File): Promise<void> {
    setFileName(file.name);
    setPreview(null);
    try {
      const parsed = parseMaterialRows(await file.text());
      setInput(parsed);
      setPending(true);
      const result = await previewMaterialImport(parsed);
      setPending(false);
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      setPreview(result.data);
      if (result.data.errors.length > 0)
        toast.warning(`${result.data.errors.length} baris perlu diperbaiki.`);
      else
        toast.success(
          `${result.data.items.length} material siap diimport. Belum ada data yang berubah.`,
        );
    } catch (error) {
      setPending(false);
      toast.error(error instanceof Error ? error.message : "CSV material tidak dapat dibaca.");
    }
  }

  async function commit(): Promise<void> {
    if (!input || !canCommit) return;
    setPending(true);
    const result = await commitMaterialImport(input);
    setPending(false);
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    toast.success(
      `${result.data.created} Material Master berhasil dibuat dengan inventory bersaldo nol.`,
    );
    onClose();
    window.location.reload();
  }

  return (
    <WorkflowFormSheet
      open={open}
      title="Import Material Master"
      primaryLabel="Import"
      pendingLabel="Mengimport…"
      pending={pending}
      disabled={!canCommit}
      disabledReason={
        preview?.errors.length
          ? "Perbaiki seluruh error CSV sebelum import."
          : "Upload dan validasi CSV terlebih dahulu."
      }
      actionLayout="stacked"
      onClose={onClose}
      onExitComplete={reset}
      onPrimary={() => void commit()}
    >
      <div className="space-y-4">
        <section className="rounded-[26px] bg-white p-4 shadow-control ring-1 ring-ring-subtle">
          <p className="text-[13px] font-bold text-on-surface">Template CSV</p>
          <p className="mt-1 text-meta text-on-surface-variant">
            Wajib: name, category, unit, location. Opsional: minimum_stock, last_purchase_price,
            vendor, specification, brand, code, color.
          </p>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={downloadTemplate}
            className="mt-3"
          >
            Unduh template CSV
          </Button>
          <label className="mt-4 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-surface-container-low px-5 text-xs font-bold text-on-surface ring-1 ring-ring-subtle">
            <AppIcon name="upload_file" className="text-[18px]" />
            {fileName || "Pilih file CSV"}
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={pending}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readFile(file);
              }}
            />
          </label>
        </section>
        {preview ? (
          <GroupedSurface>
            <div className="divide-y divide-black/5.5">
              {preview.items.map((item) => (
                <div key={item.rowNumber} className="flex min-h-15.5 items-center gap-3 px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-container text-[10px] font-bold text-success">
                    {item.rowNumber}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-bold text-on-surface">
                      {item.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-on-surface-variant">
                      {item.categoryName} · {item.locationName} · {item.unit}
                    </span>
                  </span>
                </div>
              ))}
              {preview.errors.map((error) => (
                <div
                  key={`${error.rowNumber}-${error.message}`}
                  className="flex min-h-14.5 items-center gap-3 bg-error/[0.035] px-4 py-3"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-error/10 text-[10px] font-bold text-error">
                    {error.rowNumber}
                  </span>
                  <p className="text-meta text-error">{error.message}</p>
                </div>
              ))}
            </div>
          </GroupedSurface>
        ) : null}
        <FormRiskNotice title="Preview tidak mengubah data">
          Saat import dikonfirmasi, seluruh baris ditulis dalam satu transaksi. Satu kegagalan
          membatalkan seluruh batch.
        </FormRiskNotice>
      </div>
    </WorkflowFormSheet>
  );
}
