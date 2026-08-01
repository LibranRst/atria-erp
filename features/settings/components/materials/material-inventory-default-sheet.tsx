import React from "react";
import {
  AppIcon,
  FormField,
  FormSection,
  MoneyInput,
  NumericInput,
  OperationalFormSheet,
} from "@/components/ui";
import type { InventoryDraft } from "../../types/material-types";

type MaterialInventoryDefaultSheetProps = {
  readonly draft: InventoryDraft | null;
  readonly original: InventoryDraft | null;
  readonly pending: boolean;
  readonly dirty: boolean;
  readonly onClose: () => void;
  readonly onDraftChange: (draft: InventoryDraft) => void;
  readonly onSubmit: () => void;
};

export function MaterialInventoryDefaultSheet({
  draft,
  original,
  pending,
  dirty,
  onClose,
  onDraftChange,
  onSubmit,
}: MaterialInventoryDefaultSheetProps): React.JSX.Element {
  return (
    <OperationalFormSheet
      open={Boolean(draft)}
      title="Default Inventori"
      onClose={onClose}
      pending={pending}
      disabled={!dirty}
      disabledReason={!dirty ? "Belum ada perubahan untuk disimpan." : undefined}
      submitLabel="Simpan"
      submittingLabel="Menyimpan…"
      onSubmit={onSubmit}
      statusText={dirty ? "Perubahan default siap disimpan." : undefined}
      statusTone={dirty ? "success" : "default"}
    >
      {draft ? (
        <div className="space-y-md">
          <FormSection
            title="Default lokasi"
            helper="Atur batas minimum dan harga referensi tanpa mengubah stok saat ini."
          >
            <FormField label="Lokasi inventori" readOnly>
              <div className="flex min-h-8 items-center gap-2.5">
                <AppIcon
                  name="warehouse"
                  className="icon-sm shrink-0 text-on-surface-variant"
                  aria-hidden="true"
                />
                <span className="truncate text-sm font-bold text-on-surface">
                  {draft.locationName}
                </span>
              </div>
            </FormField>
            <FormField label="Stok minimum">
              <NumericInput
                min={0}
                value={draft.minimumStock}
                onChange={(value) => onDraftChange({ ...draft, minimumStock: Number(value || 0) })}
              />
            </FormField>
            <FormField label="Harga pembelian acuan">
              <MoneyInput
                value={draft.lastPurchasePrice}
                onChange={(value) =>
                  onDraftChange({ ...draft, lastPurchasePrice: Number(value || 0) })
                }
              />
            </FormField>
          </FormSection>
          {original && dirty ? (
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-[20px] bg-surface-container-lowest px-3.5 py-3 ring-1 ring-ring-subtle">
              <div>
                <p className="text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
                  Sebelum
                </p>
                <p className="mt-1 text-[11px] font-bold tabular-nums">
                  Min. {original.minimumStock.toLocaleString("id-ID")}
                </p>
                <p className="mt-0.5 truncate text-[9px] text-on-surface-variant tabular-nums">
                  Rp {original.lastPurchasePrice.toLocaleString("id-ID")}
                </p>
              </div>
              <AppIcon
                name="arrow_forward"
                className="icon-md leading-none text-on-surface-variant"
              />
              <div className="text-right">
                <p className="text-[9px] font-bold tracking-wide text-primary uppercase">Sesudah</p>
                <p className="mt-1 text-[11px] font-bold text-primary tabular-nums">
                  Min. {draft.minimumStock.toLocaleString("id-ID")}
                </p>
                <p className="mt-0.5 truncate text-[9px] text-primary tabular-nums">
                  Rp {draft.lastPurchasePrice.toLocaleString("id-ID")}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </OperationalFormSheet>
  );
}
