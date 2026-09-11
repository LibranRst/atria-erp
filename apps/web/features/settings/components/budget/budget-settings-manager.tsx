"use client";

import React from "react";
import { toast } from "sonner";
import {
  updateBudgetAllocationDefaults,
  updateExpenseCategoryDetails,
  type BudgetAllocationSettingRow,
  type ExpenseCategorySettingRow,
} from "@/app/actions/settings/system";
import {
  AppIcon,
  Button,
  ConfirmationDialog,
  DuotoneIconTile,
  FormField,
  FormSection,
  GroupedSurface,
  MetadataChip,
  MoneyInput,
  MoneyValue,
  NumericInput,
  OperationalFormSheet,
  SwitchRow,
  Textarea,
  TextInput,
  WorkspaceStatusLabel,
} from "@/components/ui";
import { SettingsInverseSurface } from "../shared/settings-inverse-surface";
import { SettingsBudgetSettingsManager } from "./settings-budget-settings-manager";

const percent = (value: number): string =>
  new Intl.NumberFormat("id-ID", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);

const ratioToPercentInput = (ratio: number): number => Math.round(ratio * 1_000_000) / 10_000;

type BudgetSettingsManagerProps = {
  readonly initialSetting: BudgetAllocationSettingRow;
  readonly initialCategories?: readonly ExpenseCategorySettingRow[];
  readonly canManage: boolean;
  readonly canManageCategories: boolean;
  readonly presentation?: "settings" | "onboarding";
  readonly onMutationComplete?: () => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
};

/**
 * Jarak bilah simpan dari dasar layar, per konteks pemakaian.
 *
 * Di Settings ada bottom nav yang menempati dasar layar, jadi bilahnya harus
 * naik melewatinya. Di dalam sheet onboarding tidak ada apa-apa di sana —
 * memakai jarak yang sama menyisakan 80px ruang kosong di bawah tombol, dan
 * tombolnya terbaca menggantung terlalu tinggi.
 *
 * Sisa 0.75rem pada varian sheet disengaja: menempel rata di 0 membuat bilahnya
 * terlihat menyatu dengan tepi layar alih-alih mengambang di atas isinya.
 */
const STICKY_SAVE_BOTTOM: Record<"settings" | "onboarding", string> = {
  settings: "bottom-[calc(5rem+env(safe-area-inset-bottom))]",
  onboarding: "bottom-[calc(0.75rem+env(safe-area-inset-bottom))]",
};

export function BudgetSettingsManager(props: BudgetSettingsManagerProps): React.JSX.Element {
  if ((props.presentation ?? "settings") === "settings") {
    return (
      <SettingsBudgetSettingsManager
        initialSetting={props.initialSetting}
        initialCategories={props.initialCategories ?? []}
        canManageBudget={props.canManage}
        canManageCategories={props.canManageCategories}
        onMutationComplete={props.onMutationComplete}
        onDirtyChange={props.onDirtyChange}
      />
    );
  }

  return <OnboardingBudgetSettingsManager {...props} />;
}

function OnboardingBudgetSettingsManager({
  initialSetting,
  initialCategories = [],
  canManage,
  presentation = "settings",
  onMutationComplete,
  onDirtyChange,
}: BudgetSettingsManagerProps): React.JSX.Element {
  const [setting, setSetting] = React.useState(initialSetting);
  const [baseline, setBaseline] = React.useState(initialSetting);
  const [categories, setCategories] = React.useState(initialCategories);
  const [confirmSave, setConfirmSave] = React.useState(false);
  const [sampleValue, setSampleValue] = React.useState(100_000_000);
  const [editingCategory, setEditingCategory] = React.useState<ExpenseCategorySettingRow | null>(
    null,
  );
  const [editingCategoryBaseline, setEditingCategoryBaseline] =
    React.useState<ExpenseCategorySettingRow | null>(null);
  const [confirmCategoryClose, setConfirmCategoryClose] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [categoryPending, startCategoryTransition] = React.useTransition();

  const allocation = setting.categories.reduce(
    (sum, category) => sum + (category.isEnabled ? category.ratioPercentage : 0),
    0,
  );
  const internalBudget = sampleValue * setting.budgetCapRatio;
  const overLimit = allocation > 1.000001;
  const dirty = JSON.stringify(setting) !== JSON.stringify(baseline);

  React.useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const allocationWidth = Math.min(100, Math.max(0, allocation * 100));
  const bufferWidth = Math.min(100, Math.max(0, (1 - allocation) * 100));

  function saveBudget(): void {
    startTransition(async () => {
      const result = await updateBudgetAllocationDefaults({
        budgetAllocationSettingId: setting.id,
        name: setting.name,
        budgetCapRatio: setting.budgetCapRatio,
        notes: setting.notes,
        categories: setting.categories.map((category) => ({
          budgetAllocationSettingCategoryId: category.id,
          ratioPercentage: category.ratioPercentage,
          isEnabled: category.isEnabled,
        })),
      });
      if (result.success) {
        setSetting(result.data);
        setBaseline(result.data);
        setConfirmSave(false);
        toast.success("Default formula budget berhasil disimpan.");
        onMutationComplete?.();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  function openCategoryEditor(
    categoryId: string,
    categoryCode: string,
    categoryName: string,
  ): void {
    const existing = categories.find((c) => c.id === categoryId || c.code === categoryCode);
    const catToEdit: ExpenseCategorySettingRow = existing ?? {
      id: categoryId,
      code: categoryCode,
      name: categoryName,
      description: "",
      defaultRatio: 0,
      sortOrder: 0,
      isActive: true,
      isCore: true,
    };
    setEditingCategory(catToEdit);
    setEditingCategoryBaseline(catToEdit);
  }

  function saveCategory(): void {
    if (!editingCategory) return;
    startCategoryTransition(async () => {
      const result = await updateExpenseCategoryDetails({
        expenseCategoryId: editingCategory.id,
        name: editingCategory.name,
        description: editingCategory.description,
      });
      if (result.success) {
        setCategories((current) =>
          current.map((row) => (row.id === result.data.id ? result.data : row)),
        );
        // Also update name in current setting categories if matched
        setSetting((current) => ({
          ...current,
          categories: current.categories.map((cat) =>
            cat.id === editingCategory.id || cat.code === editingCategory.code
              ? { ...cat, name: result.data.name }
              : cat,
          ),
        }));
        setEditingCategory(null);
        setEditingCategoryBaseline(null);
        toast.success("Informasi kategori diperbarui.");
        onMutationComplete?.();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  const editingNameValid = Boolean(editingCategory?.name.trim());
  const editingCategoryDirty = Boolean(
    editingCategory &&
    editingCategoryBaseline &&
    (editingCategory.name !== editingCategoryBaseline.name ||
      editingCategory.description !== editingCategoryBaseline.description),
  );

  return (
    <section className="min-w-0 space-y-sm">
      {/* Hero Focal Summary Card */}
      <SettingsInverseSurface label="Ringkasan Formula Budget">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-eyebrow font-bold tracking-[0.18em] text-white/52 uppercase">
              Batas Budget Internal
            </p>
            <p className="financial-amount mt-1 text-[34px] leading-none font-extrabold tracking-[-0.045em] text-white tabular-nums max-[430px]:text-[30px]">
              {percent(setting.budgetCapRatio)}
            </p>
          </div>
          <WorkspaceStatusLabel label="Default Proyek Baru" tone="inverse" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="flex w-full min-w-0 flex-col gap-1 rounded-inset bg-white/8 p-3">
            <p className="text-[9px] leading-none font-bold tracking-[0.12em] text-white/52 uppercase">
              Target Margin
            </p>
            <p className="financial-amount mt-0.5 font-sans text-base font-extrabold tracking-tight text-white tabular-nums">
              {percent(1 - setting.budgetCapRatio)}
            </p>
          </div>
          <div className="flex w-full min-w-0 flex-col gap-1 rounded-inset bg-white/8 p-3">
            <p className="text-[9px] leading-none font-bold tracking-[0.12em] text-white/52 uppercase">
              Sisa Buffer
            </p>
            <p
              className={`financial-amount mt-0.5 font-sans text-base font-extrabold tracking-tight tabular-nums ${
                overLimit ? "text-error" : "text-white"
              }`}
            >
              {overLimit ? "Over 100%" : percent(Math.max(0, 1 - allocation))}
            </p>
          </div>
        </div>

        <div className="mt-3.5 rounded-inset bg-white/8 p-3 ring-1 ring-white/6">
          <div className="flex items-center justify-between text-meta font-medium text-white/70">
            <span>Teralokasi {percent(allocation)}</span>
            <span>Buffer {percent(Math.max(0, 1 - allocation))}</span>
          </div>
          <div
            className="mt-2 flex h-2 overflow-hidden rounded-full bg-white/10"
            aria-label={`Alokasi ${percent(allocation)}, buffer ${percent(Math.max(0, 1 - allocation))}`}
          >
            <span
              className={overLimit ? "bg-error" : "bg-white"}
              style={{ width: `${allocationWidth}%` }}
            />
            {!overLimit && bufferWidth > 0 ? (
              <span className="bg-white/25" style={{ width: `${bufferWidth}%` }} />
            ) : null}
          </div>
        </div>
      </SettingsInverseSurface>

      {/* Formula & Project Simulation */}
      <FormSection
        title="Formula & Parameter"
        helper="Nilai proyek simulasi hanya untuk memverifikasi rasio nominal dan tidak ikut tersimpan."
      >
        <FormField label="Nama Preset Formula" htmlFor="budget-default-name">
          <TextInput
            id="budget-default-name"
            disabled={!canManage}
            value={setting.name}
            onChange={(value) => setSetting({ ...setting, name: value })}
            placeholder="Contoh: Standar Residential"
          />
        </FormField>

        <FormField
          label="Batas Budget Internal (%)"
          helper={`Target margin kotor: ${percent(1 - setting.budgetCapRatio)}`}
        >
          <NumericInput
            min={0}
            max={100}
            disabled={!canManage}
            value={ratioToPercentInput(setting.budgetCapRatio)}
            onChange={(value) =>
              setSetting({
                ...setting,
                budgetCapRatio: Number(value || 0) / 100,
              })
            }
            suffix="%"
          />
        </FormField>

        {presentation === "settings" ? (
          <FormField label="Simulasi Nilai Proyek" helper="Uji coba nominal proyek">
            <MoneyInput
              value={sampleValue}
              onChange={(value) => setSampleValue(Number(value || 0))}
            />
          </FormField>
        ) : null}

        <FormField label="Catatan Formula" htmlFor="budget-default-notes" optional>
          <Textarea
            id="budget-default-notes"
            disabled={!canManage}
            value={setting.notes ?? ""}
            onChange={(value) => setSetting({ ...setting, notes: value })}
            placeholder="Catatan panduan alokasi proyek..."
            rows={2}
          />
        </FormField>
      </FormSection>

      {/* 5 Categories Allocation */}
      <section className="space-y-2">
        <div className="flex min-h-8 items-center justify-between px-1">
          <h2 className="text-section font-bold text-on-surface">Alokasi 5 Kategori Pengeluaran</h2>
          <WorkspaceStatusLabel
            label={`${percent(allocation)} Teralokasi`}
            tone={overLimit ? "critical" : "neutral"}
          />
        </div>

        <GroupedSurface>
          <div className="divide-y divide-black/5.5">
            {setting.categories.map((category, index) => {
              const categoryAmount =
                internalBudget * (category.isEnabled ? category.ratioPercentage : 0);
              const isEnabled = category.isEnabled;

              return (
                <div
                  key={category.id}
                  className={`min-w-0 p-3.5 transition-colors ${
                    isEnabled ? "bg-white" : "bg-surface-container-low/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          openCategoryEditor(category.id, category.code, category.name)
                        }
                        className="group flex min-w-0 items-center gap-1.5 text-left outline-none"
                        title="Klik untuk melihat / mengedit detail kategori"
                      >
                        <span className="truncate text-row font-bold text-on-surface group-hover:text-primary">
                          {category.name}
                        </span>
                        <AppIcon
                          name="edit"
                          className="icon-xs shrink-0 text-on-surface-variant/40 group-hover:text-primary"
                        />
                      </button>
                      <WorkspaceStatusLabel label={category.code} tone="neutral" />
                    </div>

                    <div className="flex items-center gap-3">
                      <MoneyValue
                        amount={categoryAmount}
                        variant="compact"
                        size="xs"
                        align="right"
                        className={
                          isEnabled ? "font-semibold text-on-surface" : "text-on-surface-variant/50"
                        }
                      />
                      <SwitchRow
                        checked={isEnabled}
                        disabled={!canManage}
                        onChange={() =>
                          setSetting({
                            ...setting,
                            categories: setting.categories.map((row, rowIndex) =>
                              rowIndex === index ? { ...row, isEnabled: !row.isEnabled } : row,
                            ),
                          })
                        }
                        title=""
                        switchLabel={`${isEnabled ? "Nonaktifkan" : "Aktifkan"} ${category.name}`}
                      />
                    </div>
                  </div>

                  {isEnabled ? (
                    <div className="mt-2.5 flex items-center gap-3">
                      <div className="flex-1">
                        <NumericInput
                          min={0}
                          max={100}
                          disabled={!canManage}
                          value={ratioToPercentInput(category.ratioPercentage)}
                          onChange={(value) =>
                            setSetting({
                              ...setting,
                              categories: setting.categories.map((row, rowIndex) =>
                                rowIndex === index
                                  ? {
                                      ...row,
                                      ratioPercentage: Number(value || 0) / 100,
                                    }
                                  : row,
                              ),
                            })
                          }
                          suffix="%"
                        />
                      </div>
                      <span className="shrink-0 text-meta font-medium text-on-surface-variant">
                        dari Budget Internal
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </GroupedSurface>
      </section>

      {/* Sticky Save Bar */}
      {canManage && dirty ? (
        <div
          className={`sticky ${STICKY_SAVE_BOTTOM[presentation]} z-10 min-w-0 space-y-1.5 rounded-owner bg-white p-3 shadow-raised ring-1 ring-ring-subtle`}
        >
          <div className="flex items-center justify-between px-1 text-meta">
            <span
              className={overLimit ? "font-bold text-error" : "font-medium text-on-surface-variant"}
            >
              {overLimit
                ? "Total alokasi melebihi 100%!"
                : `Teralokasi ${percent(allocation)} · Buffer ${percent(Math.max(0, 1 - allocation))}`}
            </span>
            <span className="font-mono font-bold text-on-surface">
              {percent(setting.budgetCapRatio)} Cap
            </span>
          </div>
          <Button
            type="button"
            fullWidth
            disabled={pending || overLimit}
            onClick={() => setConfirmSave(true)}
            leadingIcon={<AppIcon name="save" className="icon-sm" />}
          >
            {pending ? "Menyimpan…" : "Simpan Perubahan Budget"}
          </Button>
        </div>
      ) : null}

      {/* Category Editor Bottom Sheet */}
      <OperationalFormSheet
        dismissal={{ mode: "managed" }}
        open={Boolean(editingCategory)}
        title={canManage ? "Edit Kategori Pengeluaran" : "Detail Kategori Pengeluaran"}
        onClose={() => {
          if (editingCategoryDirty) setConfirmCategoryClose(true);
          else {
            setEditingCategory(null);
            setEditingCategoryBaseline(null);
          }
        }}
        pending={categoryPending}
        disabled={!canManage || !editingNameValid || !editingCategoryDirty}
        disabledReason={
          !canManage
            ? "Akses hanya baca."
            : !editingNameValid
              ? "Nama kategori wajib diisi."
              : !editingCategoryDirty
                ? "Belum ada perubahan."
                : undefined
        }
        submitLabel="Simpan Kategori"
        submittingLabel="Menyimpan…"
        onSubmit={saveCategory}
        statusText={
          editingCategory
            ? `${editingCategory.name.trim() || "Kategori"} · Kode ${editingCategory.code}`
            : undefined
        }
        statusTone={!editingNameValid ? "warning" : editingCategoryDirty ? "success" : "default"}
      >
        {editingCategory ? (
          <FormSection
            title="Identitas Kategori"
            helper="Nama dan deskripsi tampil pada seluruh budget proyek, pengeluaran, dan laporan."
          >
            <div className="flex min-h-12 items-center gap-3 px-4 py-2">
              <DuotoneIconTile name="lock" className="h-8 w-8" iconClassName="icon-xs" />
              <div className="min-w-0 flex-1">
                <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
                  Kode Kategori
                </p>
                <p className="mt-0.5 text-sm font-bold text-on-surface">{editingCategory.code}</p>
              </div>
              <MetadataChip>Baku</MetadataChip>
            </div>
            <FormField
              label="Nama Kategori"
              htmlFor="edit-category-name"
              required
              error={!editingNameValid ? "Nama kategori wajib diisi." : undefined}
            >
              <TextInput
                id="edit-category-name"
                disabled={!canManage}
                value={editingCategory.name}
                onChange={(value) => setEditingCategory({ ...editingCategory, name: value })}
              />
            </FormField>
            <FormField
              label="Deskripsi Kategori"
              htmlFor="edit-category-desc"
              optional
              helper="Penjelasan cakupan pengeluaran dalam kategori ini."
            >
              <Textarea
                id="edit-category-desc"
                disabled={!canManage}
                value={editingCategory.description ?? ""}
                onChange={(value) => setEditingCategory({ ...editingCategory, description: value })}
                rows={3}
              />
            </FormField>
          </FormSection>
        ) : null}
      </OperationalFormSheet>

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        open={confirmSave}
        title="Terapkan Default Budget Baru?"
        description="Perubahan akan menjadi formula default untuk seluruh proyek baru berikutnya. Proyek aktif tidak berubah."
        tone="warning"
        pending={pending}
        disabled={overLimit}
        onClose={() => setConfirmSave(false)}
        confirmLabel="Terapkan Formula"
        onConfirm={saveBudget}
      >
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-inset bg-surface-container-low p-2">
            <p className="text-eyebrow font-bold text-on-surface-variant uppercase">Batas Budget</p>
            <p className="mt-0.5 text-sm font-bold text-on-surface">
              {percent(setting.budgetCapRatio)}
            </p>
          </div>
          <div className="rounded-inset bg-surface-container-low p-2">
            <p className="text-eyebrow font-bold text-on-surface-variant uppercase">
              Buffer Kategori
            </p>
            <p className="mt-0.5 text-sm font-bold text-on-surface">
              {percent(Math.max(0, 1 - allocation))}
            </p>
          </div>
        </div>
      </ConfirmationDialog>

      <ConfirmationDialog
        open={confirmCategoryClose}
        title="Buang Perubahan Kategori?"
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
