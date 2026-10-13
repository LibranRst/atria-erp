"use client";

import React from "react";
import { toast } from "sonner";

import {
  updateBudgetAllocationDefaults,
  type BudgetAllocationSettingRow,
} from "@/app/actions/settings/system";
import {
  ConfirmationDialog,
  FactRow,
  FormField,
  FormSection,
  GroupedSurface,
  NumericInput,
  SheetFooterActions,
  SwitchRow,
  Textarea,
  TextInput,
  WorkflowFormSheet,
} from "@/components/ui";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";

const ratioToPercent = (ratio: number): number => Math.round(ratio * 10_000) / 100;

const percent = (ratio: number): string =>
  new Intl.NumberFormat("id-ID", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(ratio);

export function OnboardingBudgetDefaultsSheet({
  open,
  initialSetting,
  canManage,
  onClose,
  onMutationComplete,
}: {
  readonly open: boolean;
  readonly initialSetting: BudgetAllocationSettingRow;
  readonly canManage: boolean;
  readonly onClose: () => void;
  readonly onMutationComplete: () => void;
}): React.JSX.Element {
  const [draft, setDraft] = React.useState(initialSetting);
  const [baseline, setBaseline] = React.useState(initialSetting);
  const [reviewing, setReviewing] = React.useState(false);
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const desktop = useWorkspacePresentation() === "desktop";

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const allocation = draft.categories.reduce(
    (sum, category) => sum + (category.isEnabled ? category.ratioPercentage : 0),
    0,
  );
  const overLimit = allocation > 1.000001;
  const disabledReason = !canManage
    ? "Akses hanya baca."
    : !dirty
      ? "Belum ada perubahan."
      : overLimit
        ? "Total alokasi kategori tidak boleh melebihi 100%."
        : undefined;

  function requestClose(): void {
    if (pending) return;
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }

  function save(): void {
    if (!canManage || !dirty || overLimit || pending) return;
    startTransition(async () => {
      const result = await updateBudgetAllocationDefaults({
        budgetAllocationSettingId: draft.id,
        name: draft.name,
        budgetCapRatio: draft.budgetCapRatio,
        notes: draft.notes,
        categories: draft.categories.map((category) => ({
          budgetAllocationSettingCategoryId: category.id,
          ratioPercentage: category.ratioPercentage,
          isEnabled: category.isEnabled,
        })),
      });
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      setDraft(result.data);
      setBaseline(result.data);
      setReviewing(false);
      toast.success("Default budget diperbarui untuk proyek baru.");
      onClose();
      onMutationComplete();
    });
  }

  return (
    <>
      <WorkflowFormSheet
        dismissal={{ mode: "managed" }}
        open={open}
        title="Sesuaikan default budget"
        desktopSize="wide"
        desktopFooterPlacement="aside"
        contentKey={reviewing ? "review" : "edit"}
        desktopAsideSummary={
          <GroupedSurface>
            <div className="divide-y divide-outline-variant/20">
              <FactRow
                layout="stacked"
                label="Preset"
                wrapLabel
                value={draft.name || "Belum diisi"}
              />
              <FactRow
                layout="stacked"
                label="Batas budget"
                wrapLabel
                value={percent(draft.budgetCapRatio)}
              />
              <FactRow
                layout="stacked"
                label="Target margin"
                wrapLabel
                value={percent(1 - draft.budgetCapRatio)}
              />
              <FactRow layout="stacked" label="Teralokasi" value={percent(allocation)} />
              <FactRow
                layout="stacked"
                label="Buffer"
                value={percent(Math.max(0, 1 - allocation))}
              />
              <p className="px-4 py-3 text-support text-on-surface-variant">
                Default ini hanya berlaku untuk proyek baru. Budget proyek aktif tetap sama.
              </p>
            </div>
          </GroupedSurface>
        }
        primaryLabel={reviewing ? "Simpan" : "Tinjau"}
        secondaryLabel={reviewing ? "Ubah" : undefined}
        pendingLabel="Menyimpan…"
        pending={pending}
        disabled={Boolean(disabledReason)}
        disabledReason={disabledReason}
        statusText={
          desktop
            ? reviewing
              ? "Periksa alokasi sebelum menyimpan."
              : undefined
            : `Teralokasi ${percent(allocation)} · Buffer ${percent(Math.max(0, 1 - allocation))}`
        }
        statusTone={overLimit ? "danger" : dirty ? "success" : "default"}
        onClose={requestClose}
        onPrimary={() => {
          if (reviewing) save();
          else setReviewing(true);
        }}
        onSecondary={() => setReviewing(false)}
      >
        {reviewing ? (
          <div className="space-y-4">
            {!desktop ? (
              <FormSection
                title="Dampak perubahan"
                helper="Default ini hanya dipakai saat proyek baru dibuat. Proyek aktif tidak berubah."
              >
                <FactRow label="Nama preset" value={draft.name} />
                <FactRow label="Batas budget internal" value={percent(draft.budgetCapRatio)} />
                <FactRow label="Target margin kotor" value={percent(1 - draft.budgetCapRatio)} />
                <FactRow label="Total alokasi kategori" value={percent(allocation)} />
                <FactRow label="Buffer" value={percent(Math.max(0, 1 - allocation))} />
              </FormSection>
            ) : null}
            <FormSection title="Alokasi kategori">
              {draft.categories.map((category) => (
                <FactRow
                  key={category.id}
                  label={category.name}
                  value={category.isEnabled ? percent(category.ratioPercentage) : "Nonaktif"}
                />
              ))}
            </FormSection>
          </div>
        ) : (
          <div className="space-y-4">
            <FormSection
              title="Formula proyek baru"
              helper="Target margin dihitung otomatis dari batas budget internal."
            >
              <FormField label="Nama preset formula" required>
                <TextInput
                  value={draft.name}
                  onChange={(name) => setDraft((current) => ({ ...current, name }))}
                  disabled={!canManage || pending}
                />
              </FormField>
              <FormField
                label="Batas budget internal"
                helper={`Target margin kotor: ${percent(1 - draft.budgetCapRatio)}`}
                required
              >
                <NumericInput
                  min={0}
                  max={100}
                  value={ratioToPercent(draft.budgetCapRatio)}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      budgetCapRatio: Number(value || 0) / 100,
                    }))
                  }
                  suffix="%"
                  disabled={!canManage || pending}
                />
              </FormField>
              <FormField label="Catatan formula" optional>
                <Textarea
                  value={draft.notes ?? ""}
                  onChange={(notes) => setDraft((current) => ({ ...current, notes }))}
                  rows={2}
                  disabled={!canManage || pending}
                />
              </FormField>
            </FormSection>

            <FormSection
              title="Alokasi kategori"
              helper="Material tetap menjadi satu kategori budget bersama Tukang, Operasional, Lain-lain, dan Subcon."
            >
              {draft.categories.map((category, index) => (
                <div key={category.id} className="space-y-2 bg-surface-container-lowest px-4 py-3">
                  <SwitchRow
                    className="min-h-0 bg-transparent p-0"
                    title={category.name}
                    description={
                      category.isEnabled ? "Dipakai pada proyek baru." : "Tidak dialokasikan."
                    }
                    checked={category.isEnabled}
                    disabled={!canManage || pending}
                    onChange={(isEnabled) =>
                      setDraft((current) => ({
                        ...current,
                        categories: current.categories.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, isEnabled } : row,
                        ),
                      }))
                    }
                  />
                  {category.isEnabled ? (
                    <NumericInput
                      min={0}
                      max={100}
                      value={ratioToPercent(category.ratioPercentage)}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          categories: current.categories.map((row, rowIndex) =>
                            rowIndex === index
                              ? { ...row, ratioPercentage: Number(value || 0) / 100 }
                              : row,
                          ),
                        }))
                      }
                      suffix="%"
                      disabled={!canManage || pending}
                      aria-label={`Alokasi ${category.name}`}
                    />
                  ) : null}
                </div>
              ))}
            </FormSection>
          </div>
        )}
      </WorkflowFormSheet>

      <ConfirmationDialog
        open={confirmDiscard}
        title="Buang perubahan?"
        description="Perubahan default budget yang belum disimpan akan hilang."
        tone="warning"
        pending={pending}
        onClose={() => setConfirmDiscard(false)}
        actions={
          <SheetFooterActions
            secondary={{ label: "Lanjut edit", onClick: () => setConfirmDiscard(false) }}
            primary={{
              label: "Buang perubahan",
              variant: "critical",
              onClick: () => {
                setConfirmDiscard(false);
                setDraft(baseline);
                setReviewing(false);
                onClose();
              },
            }}
          />
        }
      />
    </>
  );
}
