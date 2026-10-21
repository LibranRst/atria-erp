"use client";

import React from "react";

import type { InitialStockImportPreview } from "@/app/actions/material/opening-inventory";
import { AppIcon, Button } from "@/components/ui";
import { OPENING_INVENTORY_CSV_TEMPLATE } from "@atria/core/import/material-csv";
import { OpeningInventoryCsvPreview } from "./opening-inventory-csv-preview";
interface OpeningInventoryCsvEntryProps {
  readonly preview: InitialStockImportPreview | null;
  readonly fileName: string;
  readonly pending: boolean;
  readonly onFileSelected: (file: File) => Promise<void>;
  readonly inputRef?: React.RefObject<HTMLInputElement | null>;
}

function downloadTemplate(): void {
  const url = URL.createObjectURL(
    new Blob([OPENING_INVENTORY_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "template-saldo-awal-stok.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function OpeningInventoryCsvEntry({
  preview,
  fileName,
  pending,
  onFileSelected,
  inputRef,
}: OpeningInventoryCsvEntryProps): React.JSX.Element {
  const internalInputRef = React.useRef<HTMLInputElement | null>(null);
  const fileInputRef = inputRef ?? internalInputRef;
  return (
    <section className="space-y-3">
      <div className="rounded-3xl bg-surface-container-lowest p-4 shadow-surface ring-1 ring-ring-subtle">
        <p className="text-row font-bold text-on-surface">Upload CSV saldo stok</p>
        <p className="mt-1 text-meta text-on-surface-variant">
          Header: material_name atau material_code, location_name, quantity, unit_cost.
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
        <Button
          type="button"
          variant="secondary"
          fullWidth
          disabled={pending}
          onClick={() => fileInputRef.current?.click()}
          aria-label={fileName ? `Ganti file CSV: ${fileName}` : "Pilih file CSV"}
          className="mt-3 min-w-0"
        >
          <AppIcon name="upload_file" className="icon-md shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate" title={fileName || undefined}>
            {fileName || "Pilih file CSV"}
          </span>
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          disabled={pending}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void onFileSelected(file);
          }}
        />
      </div>

      {preview ? <OpeningInventoryCsvPreview preview={preview} /> : null}
    </section>
  );
}
