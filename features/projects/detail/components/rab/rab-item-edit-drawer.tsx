"use client";

import React from "react";

import {
  BottomSheet,
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
import { Badge } from "@/components/ui/badge";
import { MoneyValue } from "@/components/ui/page-primitives";
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
  readonly handleRabEditChange: (item: RabItemView, updates: Partial<RabItemView>) => void;
  readonly handleSaveRabItem: (item: RabItemView) => void;
  readonly isPending: boolean;
  readonly rabEstimate: RabEstimateView | null;
  readonly canManageRab: boolean;
}): React.JSX.Element | null {
  const selectedItem = sortedRabItems.find((row) => row.id === rabItemEditorId);
  const {
    presentedValue: item,
    open,
    handleExitComplete,
  } = useSheetPresenceValue(selectedItem, rabItemEditorId);
  if (!item) return null;

  const draft = rabDraftEdits[item.id] ?? item;
  const editable = rabEstimate?.status === "DRAFT" && canManageRab;
  const changed = Boolean(rabDraftEdits[item.id]);
  const total = Number(draft.quantity) * Number(draft.unitPrice);

  if (!editable) {
    return (
      <BottomSheet
        open={open}
        title="Detail Item RAB"
        onClose={closeRabItemEditor}
        onExitComplete={handleExitComplete}
      >
        <div className="space-y-md">
          <div className="flex items-start justify-between gap-3 px-1">
            <div className="min-w-0">
              <p className="text-base font-bold text-on-surface">{item.clientLabel}</p>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                Sumber: {rabSourceLabel(item.sourceType)} · aman untuk klien
              </p>
            </div>
            {item.isHidden && <Badge status="WARNING">Tersembunyi</Badge>}
          </div>

          <div className="divide-y divide-outline-variant/15 overflow-hidden rounded-[22px] bg-surface-container-lowest shadow-[0_8px_24px_rgba(17,17,17,0.035)] ring-1 ring-outline-variant/15">
            {item.description && (
              <div className="bg-surface-container-low/20 px-4 py-3.5">
                <p className="text-[10px] font-bold tracking-wide text-on-surface-variant uppercase">
                  Deskripsi Pekerjaan
                </p>
                <p className="mt-1 text-xs leading-relaxed text-on-surface">{item.description}</p>
              </div>
            )}

            <DetailRow label="Jumlah" value={`${item.quantity} ${item.unit}`} />
            <DetailRow
              label="Harga Satuan Klien"
              value={
                <MoneyValue
                  amount={Number(item.unitPrice)}
                  variant="compactWithFull"
                  size="sm"
                  align="right"
                />
              }
            />
            <DetailRow
              label="Subtotal Klien"
              value={
                <MoneyValue
                  amount={Number(item.quantity) * Number(item.unitPrice)}
                  variant="compactWithFull"
                  size="sm"
                  align="right"
                  tone="default"
                />
              }
            />
            <DetailRow
              label="Tampil ke Klien"
              value={item.isHidden ? "Tidak (Tersembunyi)" : "Ya"}
            />
          </div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <OperationalFormSheet
      open={open}
      onExitComplete={handleExitComplete}
      title="Edit Item RAB"
      onClose={closeRabItemEditor}
      pending={isPending}
      disabled={!changed}
      disabledReason={!changed ? "Belum ada perubahan untuk disimpan." : undefined}
      submitLabel="Simpan"
      onSubmit={() => handleSaveRabItem(item)}
      statusText={`${rabSourceLabel(item.sourceType)} · ${draft.quantity} ${draft.unit} · Rp ${total.toLocaleString("id-ID")}`}
      statusTone={total > 0 ? "success" : "warning"}
    >
      <div className="space-y-md">
        <FieldContextLine>{rabSourceLabel(item.sourceType)} · aman untuk klien</FieldContextLine>
        <FormSection
          title="Tampilan untuk klien"
          helper="Hanya nama, deskripsi, jumlah, satuan, dan harga di bagian ini yang masuk ke RAB klien."
        >
          <div className="grid grid-cols-1 divide-y divide-outline-variant/20">
            <FormField label="Nama item" required>
              <TextInput
                disabled={!editable}
                value={draft.clientLabel}
                onChange={(value) => handleRabEditChange(item, { clientLabel: value })}
                placeholder="Nama item untuk klien"
              />
            </FormField>
            <FormField label="Deskripsi untuk klien" optional>
              <Textarea
                disabled={!editable}
                rows={3}
                value={draft.description ?? ""}
                onChange={(value) => handleRabEditChange(item, { description: value })}
                placeholder="Deskripsi pekerjaan"
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection
          title="Jumlah & harga"
          helper="Subtotal diperbarui langsung sebelum perubahan disimpan."
        >
          <div className="grid grid-cols-1 divide-y divide-outline-variant/20">
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
              placeholder="Pilih satuan"
            />
            <FormField label="Harga satuan klien">
              <MoneyInput
                value={draft.unitPrice}
                onChange={(value) => handleRabEditChange(item, { unitPrice: value })}
                showPreview={false}
                disabled={!editable}
              />
            </FormField>
          </div>
          <div className="p-3">
            <ValuePreviewStrip
              items={[
                { label: "Subtotal item", amount: total, tone: total > 0 ? "success" : "warning" },
              ]}
            />
          </div>
        </FormSection>

        <FormSection
          title="Visibilitas"
          helper="Sembunyikan item tanpa menghapus sumber atau nilai internalnya."
        >
          <ChoiceRow
            checked={draft.isHidden}
            onChange={(checked) => handleRabEditChange(item, { isHidden: checked })}
            title="Sembunyikan dari RAB klien"
          />
        </FormSection>
      </div>
    </OperationalFormSheet>
  );
}

function DetailRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3.5 text-xs">
      <span className="shrink-0 text-on-surface-variant">{label}</span>
      <span className="text-right font-bold text-on-surface">{value}</span>
    </div>
  );
}
