"use client";

import React from "react";

import {
  ChoiceRow,
  COMMON_UNIT_OPTIONS,
  ComboboxField,
  FieldContextLine,
  FormField,
  FormSection,
  MoneyInput,
  NumericInput,
  OperationalFormSheet,
  Textarea,
  TextInput,
  useSheetPresenceValue,
  ValuePreviewStrip,
} from "@/components/ui";
import { rabSourceLabel } from "../shared/rap-rab-primitives";
import type { RabEstimateView, RabItemView } from "../shared/rap-rab-manager";

export function RabItemEditDrawer({
  rabItemEditorId,
  closeRabItemEditor,
  sortedRabItems,
  rabDraftEdits,
  handleRabEditChange,
  handleSaveRabItem,
  isPending,
  rabEstimate,
  canManageRab,
}: {
  readonly rabItemEditorId: string | null;
  readonly closeRabItemEditor: () => void;
  readonly sortedRabItems: readonly RabItemView[];
  readonly rabDraftEdits: Record<string, RabItemView>;
  readonly handleRabEditChange: (
    item: RabItemView,
    updates: Partial<RabItemView>,
  ) => void;
  readonly handleSaveRabItem: (item: RabItemView) => void;
  readonly isPending: boolean;
  readonly rabEstimate: RabEstimateView | null;
  readonly canManageRab: boolean;
}): React.JSX.Element | null {
  const selectedItem = sortedRabItems.find((row) => row.id === rabItemEditorId);
  const { presentedValue: item, open, handleExitComplete } =
    useSheetPresenceValue(selectedItem, rabItemEditorId);
  if (!item) return null;

  const draft = rabDraftEdits[item.id] ?? item;
  const editable = rabEstimate?.status === "DRAFT" && canManageRab;
  const changed = Boolean(rabDraftEdits[item.id]);
  const total = Number(draft.quantity) * Number(draft.unitPrice);

  return (
    <OperationalFormSheet
      open={open}
      onExitComplete={handleExitComplete}
      title={editable ? "Edit Item RAB" : "Detail Item RAB"}
      onClose={closeRabItemEditor}
      pending={isPending}
      disabled={!editable || !changed}
      disabledReason={editable && !changed ? "Belum ada perubahan untuk disimpan." : undefined}
      submitLabel="Simpan Perubahan"
      hideSubmit={!editable}
      onSubmit={() => handleSaveRabItem(item)}
      statusText={`${rabSourceLabel(item.sourceType)} · ${draft.quantity} ${draft.unit} · Rp ${total.toLocaleString("id-ID")}`}
      statusTone={total > 0 ? "success" : "warning"}
    >
      <div className="space-y-md">
        <FieldContextLine>{rabSourceLabel(item.sourceType)} · aman untuk klien</FieldContextLine>
        <FormSection title="1 · Tampilan untuk klien" helper="Hanya nama, deskripsi, jumlah, satuan, dan harga di bagian ini yang masuk ke RAB klien.">
        <FormField label="Nama item" required>
          <TextInput
            disabled={!editable}
            value={draft.clientLabel}
            onChange={(value) => handleRabEditChange(item, { clientLabel: value })}
          />
        </FormField>
        <FormField label="Deskripsi untuk klien" optional>
          <Textarea
            disabled={!editable}
            rows={3}
            value={draft.description ?? ""}
            onChange={(value) => handleRabEditChange(item, { description: value })}
          />
        </FormField>
        </FormSection>
        <FormSection title="2 · Jumlah & harga" helper="Subtotal diperbarui langsung sebelum perubahan disimpan.">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <FormField label="Jumlah">
            <NumericInput
              value={draft.quantity}
              onChange={(value) => handleRabEditChange(item, { quantity: value })}
              disabled={!editable}
            />
          </FormField>
          <ComboboxField
            label="Satuan"
            value={draft.unit}
            onChange={(value) => handleRabEditChange(item, { unit: value })}
            options={COMMON_UNIT_OPTIONS}
            disabled={!editable}
          />
        </div>
        <FormField label="Harga satuan klien">
          <MoneyInput
            value={draft.unitPrice}
            onChange={(value) => handleRabEditChange(item, { unitPrice: value })}
            showPreview={false}
            disabled={!editable}
          />
        </FormField>
        <ValuePreviewStrip items={[{ label: "Subtotal item", amount: total, tone: total > 0 ? "success" : "warning" }]} />
        </FormSection>
        {editable && (
          <FormSection title="3 · Visibilitas" helper="Sembunyikan item tanpa menghapus sumber atau nilai internalnya.">
            <ChoiceRow
              checked={draft.isHidden}
              onChange={(checked) => handleRabEditChange(item, { isHidden: checked })}
              title="Sembunyikan dari RAB klien"
            />
          </FormSection>
        )}
      </div>
    </OperationalFormSheet>
  );
}
