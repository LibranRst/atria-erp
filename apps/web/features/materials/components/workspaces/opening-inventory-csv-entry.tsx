"use client";

import type { InitialStockImportPreview } from "@/app/actions/material/opening-inventory";
import { AppIcon, Button, GroupedSurface, MoneyValue } from "@/components/ui";
interface OpeningInventoryCsvEntryProps {
  readonly preview: InitialStockImportPreview | null;
  readonly fileName: string;
  readonly pending: boolean;
  readonly onFileSelected: (file: File) => Promise<void>;
}

function downloadTemplate(): void {
  const content =
    "material_name,material_code,location_name,quantity,unit_cost\nMultipleks 18mm,PLY-18,Gudang Utama,10,250000\n";
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
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
}: OpeningInventoryCsvEntryProps): React.JSX.Element {
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
        <label className="mt-3 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-surface-container px-5 text-row font-bold text-on-surface ring-1 ring-ring-subtle transition-transform active:z-10 active:scale-[1.05] active:shadow-raised">
          <AppIcon name="upload_file" className="icon-md" />
          {fileName || "Pilih file CSV"}
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            disabled={pending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFileSelected(file);
            }}
          />
        </label>
      </div>

      {preview ? (
        <GroupedSurface>
          <div className="divide-y divide-outline-variant/20">
            {preview.items.map((item) => (
              <div
                key={`${item.rowNumber}-${item.materialInventoryId}`}
                className="flex min-h-16 items-center gap-3 px-4 py-3"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-container text-meta font-bold text-success">
                  {item.rowNumber}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-bold text-on-surface">
                    {item.materialName}
                  </span>
                  <span className="mt-0.5 block text-meta text-on-surface-variant">
                    {item.locationName} · {item.quantity.toLocaleString("id-ID")}
                  </span>
                </span>
                <MoneyValue
                  amount={item.quantity * item.unitCost}
                  variant="compact"
                  size="sm"
                  align="right"
                />
              </div>
            ))}
            {preview.errors.map((error) => (
              <div
                key={`${error.rowNumber}-${error.message}`}
                className="flex min-h-14.5 items-center gap-3 bg-error/[0.035] px-4 py-3"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-error/10 text-meta font-bold text-error">
                  {error.rowNumber}
                </span>
                <p className="text-meta text-error">{error.message}</p>
              </div>
            ))}
          </div>
        </GroupedSurface>
      ) : null}
    </section>
  );
}
