"use client";

import React from "react";
import { toast } from "sonner";

import {
  updateBudgetAllocationDefaults,
  updateExpenseCategoryDetails,
  type BudgetAllocationCategoryRow,
  type BudgetAllocationSettingRow,
  type ExpenseCategorySettingRow,
} from "@/app/actions/settings/system";
import {
  AppIcon,
  Button,
  ConfirmationDialog,
  FormDisclosure,
  FormField,
  FormSection,
  GroupedSurface,
  InlineStateRow,
  MainSection,
  MoneyInput,
  MoneyValue,
  NumericInput,
  OperationalFormSheet,
  RowGroup,
  SectionAction,
  SwitchRow,
  Textarea,
  TextInput,
  ValuePreviewStrip,
  WorkspaceRowChevron,
  WorkspaceStatusLabel,
} from "@/components/ui";
import { SettingsInverseSurface } from "../shared/settings-inverse-surface";

const percent = (value: number): string =>
  new Intl.NumberFormat("id-ID", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);

const ratioToPercentInput = (ratio: number): number => Math.round(ratio * 1_000_000) / 10_000;

type FormulaDraft = {
  readonly name: string;
  readonly budgetCapRatio: number;
  readonly notes: string | null;
};

type SettingsBudgetSettingsManagerProps = {
  readonly initialSetting: BudgetAllocationSettingRow;
  readonly initialCategories: readonly ExpenseCategorySettingRow[];
  readonly canManageBudget: boolean;
  readonly canManageCategories: boolean;
  readonly onMutationComplete?: () => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
};

function formulaFrom(setting: BudgetAllocationSettingRow): FormulaDraft {
  return {
    name: setting.name,
    budgetCapRatio: setting.budgetCapRatio,
    notes: setting.notes,
  };
}

function formulaMatches(setting: BudgetAllocationSettingRow, draft: FormulaDraft): boolean {
  return (
    setting.name === draft.name &&
    setting.budgetCapRatio === draft.budgetCapRatio &&
    setting.notes === draft.notes
  );
}

function allocationsMatch(
  current: readonly BudgetAllocationCategoryRow[],
  draft: readonly BudgetAllocationCategoryRow[],
): boolean {
  return (
    current.length === draft.length &&
    current.every((category, index) => {
      const next = draft[index];
      return (
        next?.id === category.id &&
        next.ratioPercentage === category.ratioPercentage &&
        next.isEnabled === category.isEnabled
      );
    })
  );
}

function allocationTotal(categories: readonly BudgetAllocationCategoryRow[]): number {
  return categories.reduce(
    (sum, category) => sum + (category.isEnabled ? category.ratioPercentage : 0),
    0,
  );
}

export function SettingsBudgetSettingsManager({
  initialSetting,
  initialCategories,
  canManageBudget,
  canManageCategories,
  onMutationComplete,
  onDirtyChange,
}: SettingsBudgetSettingsManagerProps): React.JSX.Element {
  const [setting, setSetting] = React.useState(initialSetting);
  const [categories, setCategories] = React.useState(initialCategories);
  const [formulaDraft, setFormulaDraft] = React.useState<FormulaDraft>(() =>
    formulaFrom(initialSetting),
  );
  const [allocationDraft, setAllocationDraft] = React.useState<
    readonly BudgetAllocationCategoryRow[]
  >(initialSetting.categories);
  const [sampleValue, setSampleValue] = React.useState(100_000_000);
  const [simulationOpen, setSimulationOpen] = React.useState(false);
  const [formulaOpen, setFormulaOpen] = React.useState(false);
  const [allocationEditing, setAllocationEditing] = React.useState(false);
  const [confirmFormulaSave, setConfirmFormulaSave] = React.useState(false);
  const [confirmFormulaDiscard, setConfirmFormulaDiscard] = React.useState(false);
  const [confirmAllocationSave, setConfirmAllocationSave] = React.useState(false);
  const [confirmAllocationDiscard, setConfirmAllocationDiscard] = React.useState(false);
  const [formulaError, setFormulaError] = React.useState<string | null>(null);
  const [allocationError, setAllocationError] = React.useState<string | null>(null);
  const [editingCategory, setEditingCategory] = React.useState<ExpenseCategorySettingRow | null>(
    null,
  );
  const [editingCategoryBaseline, setEditingCategoryBaseline] =
    React.useState<ExpenseCategorySettingRow | null>(null);
  const [confirmCategoryClose, setConfirmCategoryClose] = React.useState(false);
  const [formulaPending, startFormulaTransition] = React.useTransition();
  const [allocationPending, startAllocationTransition] = React.useTransition();
  const [categoryPending, startCategoryTransition] = React.useTransition();

  const formulaDirty = !formulaMatches(setting, formulaDraft);
  const allocationDirty = !allocationsMatch(setting.categories, allocationDraft);
  const visibleCategories = allocationEditing ? allocationDraft : setting.categories;
  const allocation = allocationTotal(visibleCategories);
  const overLimit = allocation > 1.000001;
  const internalBudget = sampleValue * setting.budgetCapRatio;
  const targetMarginAmount = sampleValue - internalBudget;
  const bufferAmount = internalBudget * Math.max(0, 1 - allocation);
  const allocationWidth = Math.min(100, Math.max(0, allocation * 100));
  const bufferWidth = Math.min(100, Math.max(0, (1 - allocation) * 100));

  React.useEffect(() => {
    onDirtyChange?.(formulaDirty || allocationDirty);
  }, [allocationDirty, formulaDirty, onDirtyChange]);

  function resetFormulaDraft(): void {
    setFormulaDraft(formulaFrom(setting));
    setFormulaError(null);
  }

  function closeFormula(): void {
    if (formulaDirty) {
      setConfirmFormulaDiscard(true);
      return;
    }
    resetFormulaDraft();
    setFormulaOpen(false);
  }

  function saveFormula(): void {
    setFormulaError(null);
    startFormulaTransition(async () => {
      const result = await updateBudgetAllocationDefaults({
        budgetAllocationSettingId: setting.id,
        name: formulaDraft.name,
        budgetCapRatio: formulaDraft.budgetCapRatio,
        notes: formulaDraft.notes,
        categories: setting.categories.map((category) => ({
          budgetAllocationSettingCategoryId: category.id,
          ratioPercentage: category.ratioPercentage,
          isEnabled: category.isEnabled,
        })),
      });

      if (!result.success) {
        setFormulaError(result.error.message);
        setConfirmFormulaSave(false);
        toast.error(result.error.message);
        return;
      }

      setSetting(result.data);
      setFormulaDraft(formulaFrom(result.data));
      setAllocationDraft(result.data.categories);
      setFormulaOpen(false);
      setConfirmFormulaSave(false);
      toast.success("Formula default berhasil diperbarui.");
      onMutationComplete?.();
    });
  }

  function cancelAllocationEdit(): void {
    if (allocationDirty) {
      setConfirmAllocationDiscard(true);
      return;
    }
    setAllocationDraft(setting.categories);
    setAllocationError(null);
    setAllocationEditing(false);
  }

  function saveAllocation(): void {
    setAllocationError(null);
    startAllocationTransition(async () => {
      const result = await updateBudgetAllocationDefaults({
        budgetAllocationSettingId: setting.id,
        name: setting.name,
        budgetCapRatio: setting.budgetCapRatio,
        notes: setting.notes,
        categories: allocationDraft.map((category) => ({
          budgetAllocationSettingCategoryId: category.id,
          ratioPercentage: category.ratioPercentage,
          isEnabled: category.isEnabled,
        })),
      });

      if (!result.success) {
        setAllocationError(result.error.message);
        setConfirmAllocationSave(false);
        toast.error(result.error.message);
        return;
      }

      setSetting(result.data);
      setFormulaDraft(formulaFrom(result.data));
      setAllocationDraft(result.data.categories);
      setAllocationEditing(false);
      setConfirmAllocationSave(false);
      toast.success("Alokasi kategori berhasil diperbarui.");
      onMutationComplete?.();
    });
  }

  function openCategoryEditor(category: BudgetAllocationCategoryRow): void {
    const existing = categories.find(
      (row) => row.id === category.expenseCategoryId || row.code === category.code,
    );
    const categoryToEdit: ExpenseCategorySettingRow = existing ?? {
      id: category.expenseCategoryId,
      code: category.code,
      name: category.name,
      description: "",
      defaultRatio: category.ratioPercentage,
      sortOrder: category.sortOrder,
      isActive: category.isEnabled,
      isCore: true,
    };
    setEditingCategory(categoryToEdit);
    setEditingCategoryBaseline(categoryToEdit);
  }

  function saveCategory(): void {
    if (!editingCategory) return;

    startCategoryTransition(async () => {
      const result = await updateExpenseCategoryDetails({
        expenseCategoryId: editingCategory.id,
        name: editingCategory.name,
        description: editingCategory.description,
      });

      if (!result.success) {
        toast.error(result.error.message);
        return;
      }

      setCategories((current) =>
        current.map((row) => (row.id === result.data.id ? result.data : row)),
      );
      setSetting((current) => ({
        ...current,
        categories: current.categories.map((category) =>
          category.expenseCategoryId === result.data.id
            ? { ...category, name: result.data.name }
            : category,
        ),
      }));
      setAllocationDraft((current) =>
        current.map((category) =>
          category.expenseCategoryId === result.data.id
            ? { ...category, name: result.data.name }
            : category,
        ),
      );
      setEditingCategory(null);
      setEditingCategoryBaseline(null);
      toast.success("Informasi kategori diperbarui.");
      onMutationComplete?.();
    });
  }

  const formulaValid =
    Boolean(formulaDraft.name.trim()) &&
    formulaDraft.budgetCapRatio >= 0 &&
    formulaDraft.budgetCapRatio <= 1;
  const editingNameValid = Boolean(editingCategory?.name.trim());
  const editingCategoryDirty = Boolean(
    editingCategory &&
    editingCategoryBaseline &&
    (editingCategory.name !== editingCategoryBaseline.name ||
      editingCategory.description !== editingCategoryBaseline.description),
  );

  return (
    <section className="min-w-0 space-y-sm">
      <SettingsInverseSurface label="Ringkasan formula budget">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-eyebrow font-bold tracking-[0.16em] text-white/58 uppercase">
              Batas budget internal
            </p>
            <p className="financial-amount mt-1 text-[34px] leading-none font-extrabold tracking-[-0.04em] text-white tabular-nums max-[430px]:text-[30px]">
              {percent(setting.budgetCapRatio)}
            </p>
          </div>
          <WorkspaceStatusLabel
            label={canManageBudget ? "Proyek baru" : "Hanya baca"}
            tone="inverse"
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="min-w-0 rounded-inset bg-white/8 p-3">
            <p className="text-eyebrow font-bold tracking-[0.12em] text-white/55 uppercase">
              Target margin
            </p>
            <p className="financial-amount mt-1 text-base font-extrabold text-white tabular-nums">
              {percent(1 - setting.budgetCapRatio)}
            </p>
          </div>
          <div className="min-w-0 rounded-inset bg-white/8 p-3">
            <p className="text-eyebrow font-bold tracking-[0.12em] text-white/55 uppercase">
              Buffer kategori
            </p>
            <p
              className={`financial-amount mt-1 text-base font-extrabold tabular-nums ${overLimit ? "text-error" : "text-white"}`}
            >
              {overLimit ? "Melebihi batas" : percent(Math.max(0, 1 - allocation))}
            </p>
          </div>
        </div>

        <div className="mt-3.5 rounded-inset bg-white/8 p-3 ring-1 ring-white/6">
          <div className="flex items-center justify-between gap-3 text-meta font-medium text-white/72">
            <span>Teralokasi {percent(allocation)}</span>
            <span>Sisa {percent(Math.max(0, 1 - allocation))}</span>
          </div>
          <div
            className="mt-2 flex h-2 overflow-hidden rounded-full bg-white/10"
            role="img"
            aria-label={`Alokasi kategori ${percent(allocation)}. Buffer ${percent(Math.max(0, 1 - allocation))}.`}
          >
            <span
              className={overLimit ? "bg-error" : "bg-white"}
              style={{ width: `${allocationWidth}%` }}
            />
            {!overLimit && bufferWidth > 0 ? (
              <span className="bg-white/25" style={{ width: `${bufferWidth}%` }} />
            ) : null}
          </div>
          {overLimit ? (
            <p className="mt-2 flex items-center gap-1.5 text-meta font-bold text-error">
              <AppIcon name="warning" className="icon-xs" aria-hidden="true" />
              Total alokasi harus kembali ke 100% atau kurang.
            </p>
          ) : null}
        </div>
        <p className="mt-3 px-1 text-meta leading-[1.35] text-white/55">
          Perubahan default hanya berlaku saat proyek baru dibuat.
        </p>
      </SettingsInverseSurface>

      <FormDisclosure
        title="Uji nominal proyek"
        description="Nilai lokal, tidak disimpan."
        icon={<AppIcon name="tune" className="icon-sm" />}
        variant="compact"
        expanded={simulationOpen}
        onToggle={() => setSimulationOpen((current) => !current)}
      >
        <div className="pt-1">
          <FormSection presentation="grouped">
            <FormField
              label="Nilai proyek simulasi"
              htmlFor="settings-budget-simulation"
              helper="Nilai ini hanya membantu membaca hasil rasio dalam rupiah."
            >
              <MoneyInput
                id="settings-budget-simulation"
                value={sampleValue}
                onChange={(value) => setSampleValue(Number(value || 0))}
              />
            </FormField>
            <div className="p-3">
              <ValuePreviewStrip
                items={[
                  { label: "Budget internal simulasi", amount: internalBudget },
                  { label: "Target margin simulasi", amount: targetMarginAmount },
                  {
                    label: "Buffer belum dialokasikan",
                    amount: bufferAmount,
                    tone: overLimit ? "danger" : undefined,
                  },
                ]}
                lastItemFullWidth
              />
            </div>
          </FormSection>
        </div>
      </FormDisclosure>

      <MainSection
        title="Formula"
        titleAction={
          canManageBudget ? undefined : <WorkspaceStatusLabel label="Hanya baca" tone="inactive" />
        }
        action={
          canManageBudget && !allocationEditing ? (
            <SectionAction
              label="Ubah formula"
              onClick={() => {
                resetFormulaDraft();
                setFormulaOpen(true);
              }}
            />
          ) : undefined
        }
      >
        <GroupedSurface>
          <RowGroup>
            <FormulaRow label="Nama preset" value={setting.name} />
            <FormulaRow label="Batas budget internal" value={percent(setting.budgetCapRatio)} />
            <FormulaRow label="Target margin kotor" value={percent(1 - setting.budgetCapRatio)} />
            <FormulaRow label="Catatan" value={setting.notes?.trim() || "Tidak ada catatan"} />
          </RowGroup>
        </GroupedSurface>
      </MainSection>

      <MainSection
        title="Alokasi"
        action={
          canManageBudget ? (
            <SectionAction
              label={allocationEditing ? "Batal" : "Ubah alokasi"}
              onClick={() => {
                if (allocationEditing) cancelAllocationEdit();
                else {
                  setAllocationDraft(setting.categories);
                  setAllocationError(null);
                  setAllocationEditing(true);
                }
              }}
            />
          ) : undefined
        }
      >
        <GroupedSurface>
          <RowGroup>
            {visibleCategories.map((category, index) => {
              const enabled = category.isEnabled;
              const categoryAmount = internalBudget * (enabled ? category.ratioPercentage : 0);

              if (allocationEditing) {
                return (
                  <div key={category.id} className="min-w-0">
                    <SwitchRow
                      className="px-3.5 py-3"
                      checked={enabled}
                      onChange={() =>
                        setAllocationDraft((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, isEnabled: !row.isEnabled } : row,
                          ),
                        )
                      }
                      title={category.name}
                      description={
                        enabled
                          ? `Dialokasikan ${percent(category.ratioPercentage)}`
                          : "Tidak ikut dalam pembagian default"
                      }
                      trailing={
                        <SectionAction
                          label="Detail"
                          mode="text-only"
                          onClick={() => openCategoryEditor(category)}
                        />
                      }
                      switchLabel={`${enabled ? "Nonaktifkan" : "Aktifkan"} ${category.name}`}
                    />
                    {enabled ? (
                      <div className="flex min-w-0 items-center gap-3 px-3.5 pb-3">
                        <div className="min-w-0 flex-1">
                          <NumericInput
                            min={0}
                            max={100}
                            value={ratioToPercentInput(category.ratioPercentage)}
                            onChange={(value) =>
                              setAllocationDraft((current) =>
                                current.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? {
                                        ...row,
                                        ratioPercentage: Number(value || 0) / 100,
                                      }
                                    : row,
                                ),
                              )
                            }
                            suffix="%"
                          />
                        </div>
                        <span className="max-w-[42%] text-right text-meta leading-tight text-on-surface-variant">
                          dari budget internal
                        </span>
                      </div>
                    ) : null}
                  </div>
                );
              }

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => openCategoryEditor(category)}
                  className="flex min-h-19 w-full min-w-0 items-center gap-3 px-3.5 py-3 text-left outline-none focus-visible:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset active:bg-surface-container-low/75"
                  aria-label={`Buka detail kategori ${category.name}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-row font-bold text-on-surface">
                      {category.name}
                    </span>
                    <span className="mt-1 block text-meta text-on-surface-variant">
                      {enabled
                        ? `Aktif · ${percent(category.ratioPercentage)} dari budget internal`
                        : "Nonaktif · Tidak ikut pembagian default"}
                    </span>
                  </span>
                  <span className="max-w-[38%] shrink-0 text-right">
                    <span className="block text-eyebrow font-bold tracking-wide text-on-surface-variant/65 uppercase">
                      Simulasi
                    </span>
                    <MoneyValue
                      amount={categoryAmount}
                      variant="compact"
                      size="xs"
                      align="right"
                      className={enabled ? "text-on-surface" : "text-on-surface-variant/55"}
                    />
                  </span>
                  <WorkspaceRowChevron />
                </button>
              );
            })}
          </RowGroup>
        </GroupedSurface>
      </MainSection>

      {allocationEditing ? (
        <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 min-w-0 space-y-2 rounded-owner bg-white p-3 shadow-raised ring-1 ring-ring-subtle">
          {allocationError ? (
            <p
              className="flex items-start gap-1.5 px-1 text-meta font-bold text-error"
              role="alert"
            >
              <AppIcon name="warning" className="mt-0.5 icon-xs shrink-0" aria-hidden="true" />
              {allocationError}
            </p>
          ) : (
            <p
              className={`flex items-center gap-1.5 px-1 text-meta ${overLimit ? "font-bold text-error" : "font-medium text-on-surface-variant"}`}
              role={overLimit ? "alert" : "status"}
            >
              <AppIcon
                name={overLimit ? "warning" : "info"}
                className="icon-xs"
                aria-hidden="true"
              />
              {overLimit
                ? `Total ${percent(allocation)} melebihi batas 100%.`
                : `Teralokasi ${percent(allocation)} · Buffer ${percent(Math.max(0, 1 - allocation))}`}
            </p>
          )}
          <Button
            type="button"
            fullWidth
            pending={allocationPending}
            pendingLabel="Menyimpan alokasi…"
            disabled={!allocationDirty || overLimit}
            onClick={() => setConfirmAllocationSave(true)}
            leadingIcon={<AppIcon name="save" className="icon-sm" />}
          >
            Simpan alokasi
          </Button>
        </div>
      ) : null}

      <OperationalFormSheet
        dismissal={{ mode: "managed" }}
        open={formulaOpen}
        title="Ubah formula default"
        pending={formulaPending}
        disabled={!formulaDirty || !formulaValid}
        disabledReason={
          !formulaValid
            ? "Nama preset wajib diisi dan batas budget harus 0–100%."
            : !formulaDirty
              ? "Belum ada perubahan."
              : undefined
        }
        submitLabel="Tinjau perubahan"
        submittingLabel="Menyimpan…"
        statusText="Formula ini hanya menjadi titik awal untuk proyek baru."
        onClose={closeFormula}
        onSubmit={() => setConfirmFormulaSave(true)}
        error={
          formulaError ? (
            <GroupedSurface>
              <InlineStateRow
                icon="warning"
                title="Formula belum tersimpan"
                description={formulaError}
                tone="critical"
              />
            </GroupedSurface>
          ) : undefined
        }
      >
        <FormSection
          title="Formula proyek baru"
          helper="Target margin dihitung otomatis dari batas budget internal."
        >
          <FormField label="Nama preset formula" htmlFor="budget-default-name" required>
            <TextInput
              id="budget-default-name"
              value={formulaDraft.name}
              onChange={(name) => setFormulaDraft((current) => ({ ...current, name }))}
              placeholder="Contoh: Standar Residential"
            />
          </FormField>
          <FormField
            label="Batas budget internal"
            helper={`Target margin kotor: ${percent(1 - formulaDraft.budgetCapRatio)}`}
          >
            <NumericInput
              min={0}
              max={100}
              value={ratioToPercentInput(formulaDraft.budgetCapRatio)}
              onChange={(value) =>
                setFormulaDraft((current) => ({
                  ...current,
                  budgetCapRatio: Number(value || 0) / 100,
                }))
              }
              suffix="%"
            />
          </FormField>
          <FormField label="Catatan formula" htmlFor="budget-default-notes" optional>
            <Textarea
              id="budget-default-notes"
              value={formulaDraft.notes ?? ""}
              onChange={(notes) => setFormulaDraft((current) => ({ ...current, notes }))}
              placeholder="Catatan panduan alokasi proyek..."
              rows={3}
            />
          </FormField>
        </FormSection>
      </OperationalFormSheet>

      <OperationalFormSheet
        dismissal={{ mode: "managed" }}
        open={Boolean(editingCategory)}
        title={canManageCategories ? "Edit kategori pengeluaran" : "Detail kategori pengeluaran"}
        onClose={() => {
          if (editingCategoryDirty) setConfirmCategoryClose(true);
          else {
            setEditingCategory(null);
            setEditingCategoryBaseline(null);
          }
        }}
        pending={categoryPending}
        hideSubmit={!canManageCategories}
        disabled={!editingNameValid || !editingCategoryDirty}
        disabledReason={
          canManageCategories
            ? !editingNameValid
              ? "Nama kategori wajib diisi."
              : !editingCategoryDirty
                ? "Belum ada perubahan."
                : undefined
            : "Akses hanya baca."
        }
        submitLabel="Simpan kategori"
        submittingLabel="Menyimpan…"
        onSubmit={saveCategory}
        statusText={editingCategory?.name.trim() || "Kategori pengeluaran"}
        statusTone={!editingNameValid ? "warning" : editingCategoryDirty ? "success" : "default"}
      >
        {editingCategory ? (
          <FormSection
            title="Informasi kategori"
            helper="Nama dan deskripsi tampil pada budget, pengeluaran, dan laporan."
          >
            <FormField label="Nama kategori" htmlFor="edit-category-name" required>
              <TextInput
                id="edit-category-name"
                disabled={!canManageCategories}
                value={editingCategory.name}
                onChange={(name) => setEditingCategory({ ...editingCategory, name })}
              />
            </FormField>
            <FormField
              label="Deskripsi kategori"
              htmlFor="edit-category-description"
              helper="Jelaskan jenis pengeluaran yang termasuk dalam kategori ini."
              optional
            >
              <Textarea
                id="edit-category-description"
                disabled={!canManageCategories}
                value={editingCategory.description ?? ""}
                onChange={(description) => setEditingCategory({ ...editingCategory, description })}
                rows={3}
              />
            </FormField>
          </FormSection>
        ) : null}
      </OperationalFormSheet>

      <ConfirmationDialog
        open={confirmFormulaSave}
        title="Terapkan formula default baru?"
        description="Perubahan berlaku untuk proyek baru berikutnya. Budget proyek aktif tidak berubah."
        tone="warning"
        pending={formulaPending}
        confirmLabel="Terapkan formula"
        onConfirm={saveFormula}
        onClose={() => setConfirmFormulaSave(false)}
      >
        <ValuePreviewStrip
          items={[
            { label: "Batas budget", value: percent(formulaDraft.budgetCapRatio) },
            { label: "Target margin", value: percent(1 - formulaDraft.budgetCapRatio) },
          ]}
        />
      </ConfirmationDialog>

      <ConfirmationDialog
        open={confirmFormulaDiscard}
        title="Buang perubahan formula?"
        description="Formula akan kembali ke nilai yang terakhir disimpan."
        tone="warning"
        confirmLabel="Buang perubahan"
        onConfirm={() => {
          resetFormulaDraft();
          setFormulaOpen(false);
          setConfirmFormulaDiscard(false);
        }}
        onClose={() => setConfirmFormulaDiscard(false)}
      />

      <ConfirmationDialog
        open={confirmAllocationSave}
        title="Terapkan alokasi kategori baru?"
        description="Pembagian ini menjadi default untuk proyek baru. Proyek aktif tidak berubah."
        tone="warning"
        pending={allocationPending}
        disabled={overLimit}
        confirmLabel="Terapkan alokasi"
        onConfirm={saveAllocation}
        onClose={() => setConfirmAllocationSave(false)}
      />

      <ConfirmationDialog
        open={confirmAllocationDiscard}
        title="Buang perubahan alokasi?"
        description="Seluruh persentase dan status kategori akan kembali ke nilai tersimpan."
        tone="warning"
        confirmLabel="Buang perubahan"
        onConfirm={() => {
          setAllocationDraft(setting.categories);
          setAllocationError(null);
          setAllocationEditing(false);
          setConfirmAllocationDiscard(false);
        }}
        onClose={() => setConfirmAllocationDiscard(false)}
      />

      <ConfirmationDialog
        open={confirmCategoryClose}
        title="Buang perubahan kategori?"
        description="Nama dan deskripsi kategori akan kembali ke versi sebelumnya."
        danger
        confirmLabel="Buang"
        onConfirm={() => {
          setEditingCategory(null);
          setEditingCategoryBaseline(null);
          setConfirmCategoryClose(false);
        }}
        onClose={() => setConfirmCategoryClose(false)}
      />
    </section>
  );
}

function FormulaRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.JSX.Element {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 px-3.5 py-3">
      <span className="shrink-0 text-support text-on-surface-variant">{label}</span>
      <span className="min-w-0 text-right text-support font-bold wrap-break-word text-on-surface">
        {value}
      </span>
    </div>
  );
}
