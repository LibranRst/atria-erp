"use client";

import React from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";

import {
  GroupedSurface,
  Badge,
  DetailSheet,
  ChoiceRow,
  ComboboxField,
  COMMON_UNIT_OPTIONS,
  FactRow,
  FormField,
  FormRiskNotice,
  FormSection,
  MoneyInput,
  MoneyValue,
  NumericInput,
  OperationalFormSheet,
  Textarea,
  TextInput,
  useSheetPresenceValue,
  ValuePreviewStrip,
} from "@/components/ui";
import { rabSourceLabel } from "../shared/rap-rab-primitives";
import type { RabEstimateView, RabItemView } from "../shared/rap-rab-manager";
import { isRabManualSourceType } from "../../types/rap-rab-types";

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
  error,
  fallbackFocusRef,
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
  readonly error?: string | null;
  readonly fallbackFocusRef?: React.RefObject<HTMLElement | null>;
}): React.JSX.Element | null {
  const desktop = useWorkspacePresentation() === "desktop";
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
  const parentBundle = rabEstimate?.bundles.find((bundle) => bundle.id === item.bundleId);
  const parentHidden = Boolean(parentBundle?.isHidden);
  function updateDraft(updates: Partial<RabItemView>): void {
    if (!isPending && editable && item) handleRabEditChange(item, updates);
  }

  if (!editable) {
    return (
      <DetailSheet
        open={open}
        title="Detail Item RAB"
        onClose={closeRabItemEditor}
        onExitComplete={handleExitComplete}
        fallbackFocusRef={fallbackFocusRef}
      >
        <div className="space-y-md">
          <div className="flex items-start justify-between gap-3 px-1">
            <div className="min-w-0">
              <p className="text-base font-bold text-on-surface">{item.clientLabel}</p>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                Sumber: {rabSourceLabel(item.sourceType, item.itemNature)} · aman untuk klien
              </p>
            </div>
            {item.isHidden && <Badge status="WARNING">Tersembunyi</Badge>}
            {!item.isHidden && parentHidden && <Badge status="WARNING">Paket disembunyikan</Badge>}
          </div>

          <div className="divide-y divide-outline-variant/15 overflow-hidden rounded-[22px] bg-surface-container-lowest shadow-surface ring-1 ring-ring-subtle">
            {item.description && (
              <div className="bg-surface-container-low/20 px-4 py-3.5">
                <p className="text-meta font-bold tracking-wide text-on-surface-variant uppercase">
                  Deskripsi Pekerjaan
                </p>
                <p className="mt-1 text-xs leading-relaxed text-on-surface">{item.description}</p>
              </div>
            )}

            <FactRow
              label="Sifat Komponen"
              value={item.itemNature === "SERVICE_FEE" ? "Jasa Desain & Fee" : "Pekerjaan Fisik"}
            />
            <FactRow label="Jumlah" value={`${item.quantity} ${item.unit}`} />
            <FactRow
              label="Harga Satuan Klien"
              value={
                <MoneyValue
                  amount={Number(item.unitPrice)}
                  fractionDigits={Number.isInteger(Number(item.unitPrice)) ? 0 : 2}
                  variant="fullDynamic"
                  size="sm"
                  align="right"
                />
              }
            />
            <FactRow
              label="Subtotal Klien"
              value={
                <MoneyValue
                  amount={Number(item.lineTotal)}
                  fractionDigits={Number.isInteger(Number(item.lineTotal)) ? 0 : 2}
                  variant="fullDynamic"
                  size="sm"
                  align="right"
                  tone="default"
                />
              }
            />
            <FactRow
              label="Tampil ke Klien"
              value={
                item.isHidden
                  ? "Tidak (Tersembunyi)"
                  : parentHidden
                    ? "Tidak, paket disembunyikan"
                    : "Ya"
              }
            />
            {parentHidden && (
              <FactRow
                label="Visibilitas item"
                value={item.isHidden ? "Disembunyikan" : "Ditampilkan"}
              />
            )}
          </div>
        </div>
      </DetailSheet>
    );
  }

  return (
    <OperationalFormSheet
      desktopSize="wide"
      desktopFooterPlacement="aside"
      desktopAsideSummary={
        <div className="space-y-3">
          <div className="px-1">
            <h3 className="text-support font-semibold text-on-surface">Ringkasan item RAB</h3>
            <p className="mt-1 text-support wrap-anywhere text-on-surface-variant">
              {draft.clientLabel.trim() || "Nama item belum diisi"}
            </p>
          </div>
          <GroupedSurface variant="desktopPanel" className="wrap-anywhere">
            <div className="divide-y divide-outline-variant/20">
              <FactRow
                layout="stacked"
                wrapLabel
                label="Tampilan klien"
                value={
                  draft.isHidden
                    ? "Disembunyikan"
                    : parentHidden
                      ? "Tidak, paket disembunyikan"
                      : "Ditampilkan"
                }
              />
              {parentHidden && (
                <FactRow
                  layout="stacked"
                  wrapLabel
                  label="Visibilitas item"
                  value={draft.isHidden ? "Disembunyikan" : "Ditampilkan"}
                />
              )}
              <FactRow
                layout="stacked"
                wrapLabel
                label="Jumlah"
                value={`${draft.quantity || 0} ${draft.unit || "unit"}`}
              />
              <FactRow
                layout="stacked"
                wrapLabel
                label="Subtotal klien"
                value={
                  <MoneyValue
                    fractionDigits={Number.isInteger(total) ? 0 : 2}
                    amount={total}
                    variant="fullDynamic"
                    size="sm"
                    align="right"
                  />
                }
              />
            </div>
          </GroupedSurface>
          <p className="px-1 text-support text-on-surface-variant">
            Gunakan nama dan deskripsi yang aman untuk klien. Data biaya internal tetap terpisah.
          </p>
        </div>
      }
      dismissal={{
        mode: "confirm",
        dirty: changed,
        onDiscard: () => undefined,
        description: "Perubahan item RAB yang belum disimpan akan hilang.",
      }}
      open={open}
      onExitComplete={handleExitComplete}
      fallbackFocusRef={fallbackFocusRef}
      title="Edit Item RAB"
      onClose={closeRabItemEditor}
      pending={isPending}
      error={
        error ? (
          <div role="alert">
            <FormRiskNotice title="Item RAB belum tersimpan" tone="danger">
              {error}
            </FormRiskNotice>
          </div>
        ) : undefined
      }
      disabled={!changed}
      disabledReason={!changed ? "Belum ada perubahan untuk disimpan." : undefined}
      submitLabel="Simpan"
      onSubmit={() => handleSaveRabItem(item)}
      statusText={
        desktop
          ? undefined
          : `${rabSourceLabel(item.sourceType)} · ${draft.quantity} ${draft.unit} · Rp ${total.toLocaleString("id-ID")}`
      }
      statusTone={total > 0 ? "success" : "warning"}
    >
      <div className="space-y-md">
        {!desktop && (
          <div className="overflow-hidden rounded-owner bg-white p-4 shadow-surface ring-1 ring-ring-subtle">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-eyebrow font-bold tracking-[0.14em] text-on-surface-variant uppercase">
                  Rincian Item RAB
                </p>
                <h3 className="mt-0.5 truncate text-row font-bold tracking-[-0.01em] text-on-surface">
                  {draft.clientLabel || "Item RAB"}
                </h3>
                <p className="mt-0.5 truncate text-meta font-medium text-on-surface-variant/75">
                  Sumber {rabSourceLabel(item.sourceType)}
                  {draft.unit ? ` · ${draft.quantity} ${draft.unit}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-0.5 text-eyebrow font-bold text-success ring-1 ring-success/20">
                  Aman untuk klien
                </span>
                <div className="mt-1.5">
                  <MoneyValue
                    amount={total}
                    variant="fullDynamic"
                    size="sm"
                    align="right"
                    className="font-bold text-on-surface"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <FormSection
          title="Tampilan untuk klien"
          helper="Hanya nama, deskripsi, jumlah, satuan, dan harga di bagian ini yang masuk ke RAB klien."
        >
          <FormField label="Nama item" required>
            <TextInput
              disabled={!editable || isPending}
              value={draft.clientLabel}
              onChange={(value) => updateDraft({ clientLabel: value })}
              placeholder="Nama item untuk klien"
            />
          </FormField>
          <FormField label="Deskripsi untuk klien" optional>
            <Textarea
              disabled={!editable || isPending}
              rows={3}
              value={draft.description ?? ""}
              onChange={(value) => updateDraft({ description: value })}
              placeholder="Deskripsi pekerjaan"
            />
          </FormField>
        </FormSection>

        <FormSection
          title="Jumlah & harga"
          helper="Subtotal diperbarui langsung sebelum perubahan disimpan."
        >
          <FormField label="Jumlah">
            <NumericInput
              value={draft.quantity}
              onChange={(value) => updateDraft({ quantity: value })}
              disabled={!editable || isPending}
            />
          </FormField>
          <ComboboxField
            label="Satuan"
            value={draft.unit}
            onChange={(value) => updateDraft({ unit: value })}
            options={COMMON_UNIT_OPTIONS}
            disabled={!editable || isPending}
            placeholder="Pilih satuan"
          />
          <FormField label="Harga satuan klien">
            <MoneyInput
              value={draft.unitPrice}
              onChange={(value) => updateDraft({ unitPrice: value })}
              showPreview={false}
              disabled={!editable || isPending}
            />
          </FormField>
          <div className="p-3">
            <ValuePreviewStrip
              items={[
                {
                  label: "Subtotal item",
                  amount: total,
                  fractionDigits: Number.isInteger(total) ? 0 : 2,
                  tone: total > 0 ? "success" : "warning",
                },
              ]}
            />
          </div>
        </FormSection>

        {isRabManualSourceType(item.sourceType) && (
          <FormSection
            title="Sifat komponen biaya"
            helper="Tentukan apakah item ini memerlukan belanja fisik lapangan atau jasa keahlian studio."
          >
            <div className="space-y-1.5 p-3">
              <ChoiceRow
                disabled={isPending}
                checked={(draft.itemNature ?? "PRODUCTION") === "PRODUCTION"}
                onChange={() => updateDraft({ itemNature: "PRODUCTION" })}
                title="Pekerjaan Fisik Tambahan"
                description="Memerlukan belanja material/tukang. Masuk ke pagu belanja fisik lapangan."
              />
              <ChoiceRow
                disabled={isPending}
                checked={draft.itemNature === "SERVICE_FEE"}
                onChange={() => updateDraft({ itemNature: "SERVICE_FEE" })}
                title="Jasa Desain & Manajemen Fee"
                description="Jasa profesional studio. 100% margin kotor tanpa menambah pagu belanja lapangan."
              />
            </div>
          </FormSection>
        )}

        <FormSection
          title="Visibilitas"
          helper="Sembunyikan item tanpa menghapus sumber atau nilai internalnya."
        >
          <ChoiceRow
            disabled={isPending}
            checked={draft.isHidden}
            onChange={(checked) => updateDraft({ isHidden: checked })}
            title="Sembunyikan dari RAB klien"
          />
        </FormSection>
      </div>
    </OperationalFormSheet>
  );
}
