"use client";

import React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  updateBudgetAllocationDefaults,
  type BudgetAllocationSettingRow,
} from "@/app/actions/settings/system";
import { SettingsHeader } from "../shared/settings-ui";
import {
  AppIcon,
  ConfirmationModal,
  FormField,
  FormRiskNotice,
  FormSection,
  GroupedSurface,
  MoneyInput,
  MoneyValue,
  NumericInput,
  Textarea,
  TextInput,
  WorkspaceModuleHeader,
  WorkspaceStatusLabel,
} from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";
const fullMoney = (value: number): string => `Rp ${Math.round(value).toLocaleString("id-ID")}`;
const percent = (value: number): string =>
  new Intl.NumberFormat("id-ID", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);

type BudgetSettingsManagerProps = {
  readonly initialSetting: BudgetAllocationSettingRow;
  readonly roleName: string;
  readonly canManage: boolean;
  readonly hideHeader?: boolean;
  readonly presentation?: "settings" | "onboarding";
  readonly onMutationComplete?: () => void;
  readonly onDirtyChange?: (dirty: boolean) => void;
};

export function BudgetSettingsManager({
  hideHeader = false,
  initialSetting,
  roleName,
  canManage,
  presentation = "settings",
  onMutationComplete,
  onDirtyChange,
}: BudgetSettingsManagerProps): React.JSX.Element {
  const [setting, setSetting] = React.useState(initialSetting);
  const [baseline, setBaseline] = React.useState(initialSetting);
  const [confirmSave, setConfirmSave] = React.useState(false);
  const [sampleValue, setSampleValue] = React.useState(100_000_000);
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const allocation = setting.categories.reduce(
    (sum, category) => sum + (category.isEnabled ? category.ratioPercentage : 0),
    0,
  );
  const internalBudget = sampleValue * setting.budgetCapRatio;
  const allocated = internalBudget * allocation;
  const buffer = Math.max(0, internalBudget - allocated);
  const overLimit = allocation > 1.000001;
  const dirty = JSON.stringify(setting) !== JSON.stringify(baseline);
  React.useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  function save(): void {
    setMessage(null);
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
        setMessage("Default budget berhasil disimpan.");
        toast.success("Default budget berhasil disimpan.");
        onMutationComplete?.();
      } else {
        setMessage(result.error.message);
        toast.error(result.error.message);
      }
    });
  }

  return (
    <section className="min-w-0 space-y-sm">
      {presentation === "onboarding" ? null : hideHeader ? (
        <WorkspaceModuleHeader
          eyebrow="Default finansial"
          title="Alokasi Budget"
          description="Atur hubungan Budget Internal, margin target, pembagian kategori, dan buffer."
        />
      ) : (
        <SettingsHeader
          eyebrow="Default finansial"
          title="Alokasi Budget"
          description="Rasio kategori memakai Budget Internal. Buffer dan margin kotor dihitung terpisah."
          role={roleName}
          canManage={canManage}
        />
      )}

      {presentation === "settings" ? (
        <FormSection
          presentation="plain"
          title="Simulasi nilai proyek"
          helper="Nilai contoh membantu membaca dampak formula dan tidak ikut disimpan."
        >
          <FormField
            label="Nilai proyek contoh"
            helper="Hanya untuk simulasi; tidak ikut disimpan."
          >
            <MoneyInput
              value={sampleValue}
              onChange={(value) => setSampleValue(Number(value || 0))}
            />
          </FormField>
          <GroupedSurface>
            <dl className="divide-y divide-black/5.5 px-4">
              {[
                {
                  label: "Budget Internal",
                  value: internalBudget,
                  tone: "primary" as const,
                },
                {
                  label: "Margin kotor",
                  value: sampleValue - internalBudget,
                  tone: "default" as const,
                },
                {
                  label: "Teralokasi",
                  value: allocated,
                  tone: "default" as const,
                },
                { label: "Buffer", value: buffer, tone: "warning" as const },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex min-h-12 items-center justify-between gap-3 py-2.5"
                >
                  <dt className="text-[11px] text-on-surface-variant">{item.label}</dt>
                  <dd className="min-w-0">
                    <MoneyValue
                      amount={item.value}
                      variant="compactWithFull"
                      size="xs"
                      align="right"
                      tone={item.tone}
                    />
                  </dd>
                </div>
              ))}
            </dl>
          </GroupedSurface>
        </FormSection>
      ) : null}

      <FormSection
        title="Formula proyek baru"
        helper="Perubahan menjadi default berikutnya; proyek aktif tidak berubah otomatis."
      >
        <FormField label="Nama default" htmlFor="budget-default-name">
          <TextInput
            id="budget-default-name"
            disabled={!canManage}
            value={setting.name}
            onChange={(value) => setSetting({ ...setting, name: value })}
          />
        </FormField>
        <FormField
          label="Batas Budget Internal (%)"
          helper={`Target margin kotor saat ini ${percent(1 - setting.budgetCapRatio)}.`}
        >
          <NumericInput
            min={0}
            max={100}
            disabled={!canManage}
            value={setting.budgetCapRatio * 100}
            onChange={(value) =>
              setSetting({
                ...setting,
                budgetCapRatio: Number(value || 0) / 100,
              })
            }
            suffix="%"
          />
        </FormField>
        <FormField label="Catatan" htmlFor="budget-default-notes">
          <Textarea
            id="budget-default-notes"
            disabled={!canManage}
            value={setting.notes ?? ""}
            onChange={(value) => setSetting({ ...setting, notes: value })}
          />
        </FormField>
      </FormSection>

      <FormSection
        presentation="plain"
        title={presentation === "onboarding" ? "Pembagian budget" : "Pembagian kategori"}
        helper="Bagikan Budget Internal ke kategori aktif. Total tidak boleh lebih dari 100%."
      >
        <div className="flex min-w-0 items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-title font-semibold text-on-surface">Pembagian Budget Internal</h2>
          </div>
          <p
            className={`financial-amount shrink-0 font-mono text-lg font-bold tabular-nums ${overLimit ? "text-error" : "text-on-surface"}`}
          >
            {percent(allocation)}
          </p>
        </div>
        <div
          className="mt-sm flex h-2 overflow-hidden rounded-full bg-surface-container"
          aria-label={`Teralokasi ${percent(allocation)}, buffer ${percent(Math.max(0, 1 - allocation))}`}
        >
          <span
            className={overLimit ? "bg-error" : "bg-primary"}
            style={{ width: `${Math.min(100, allocation * 100)}%` }}
          />
          {!overLimit ? (
            <span
              className="bg-primary/18"
              style={{ width: `${Math.max(0, 100 - allocation * 100)}%` }}
            />
          ) : null}
        </div>
        <div className="mt-2 flex min-w-0 justify-between gap-3 text-[10px] text-on-surface-variant">
          <span className="min-w-0">Teralokasi {fullMoney(allocated)}</span>
          <span className="shrink-0">Buffer {percent(Math.max(0, 1 - allocation))}</span>
        </div>
        <GroupedSurface className="mt-md">
          <div className="divide-y divide-black/5.5">
            {setting.categories.map((category, index) => {
              const categoryAmount =
                internalBudget * (category.isEnabled ? category.ratioPercentage : 0);
              return (
                <div
                  key={category.id}
                  className={`min-w-0 px-3.5 py-3 ${category.isEnabled ? "bg-white" : "bg-surface-container-low/35"}`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <motion.button
                      type="button"
                      role="switch"
                      aria-checked={category.isEnabled}
                      aria-label={`${category.isEnabled ? "Nonaktifkan" : "Aktifkan"} ${category.name}`}
                      whileTap={{ scale: 0.96 }}
                      transition={transitionSpringSnappy}
                      className={`relative h-7 w-12 shrink-0 rounded-full p-1 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${category.isEnabled ? "bg-primary" : "bg-outline-variant/35"}`}
                      disabled={!canManage}
                      onClick={() =>
                        setSetting({
                          ...setting,
                          categories: setting.categories.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, isEnabled: !row.isEnabled } : row,
                          ),
                        })
                      }
                    >
                      <motion.span
                        layout
                        transition={transitionSpringSnappy}
                        className={`block h-5 w-5 rounded-full bg-white shadow-control ${category.isEnabled ? "ml-5" : "ml-0"}`}
                      />
                    </motion.button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-on-surface">{category.name}</p>
                      <p className="truncate text-[9px] tracking-wide text-on-surface-variant uppercase">
                        {category.code}
                      </p>
                    </div>
                    <div className="max-w-[42%] shrink-0 text-right">
                      <MoneyValue
                        amount={categoryAmount}
                        variant="compactWithFull"
                        size="xs"
                        align="right"
                      />
                      <div className="mt-1 flex justify-end">
                        <WorkspaceStatusLabel
                          label={
                            category.isEnabled ? percent(category.ratioPercentage) : "Nonaktif"
                          }
                          tone={category.isEnabled ? "neutral" : "inactive"}
                        />
                      </div>
                    </div>
                  </div>
                  {category.isEnabled ? (
                    <div className="relative mt-2">
                      <NumericInput
                        min={0}
                        max={100}
                        disabled={!canManage || !category.isEnabled}
                        value={category.ratioPercentage * 100}
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
                  ) : null}
                </div>
              );
            })}
          </div>
        </GroupedSurface>
        {overLimit ? (
          <FormRiskNotice title="Alokasi melebihi 100%" tone="danger">
            Kurangi rasio kategori sebelum menyimpan default.
          </FormRiskNotice>
        ) : (
          <FormRiskNotice title="Buffer tetap terlihat" tone="success">
            Sisa {percent(Math.max(0, 1 - allocation))} tidak dialokasikan dan tetap menjadi buffer
            Budget Internal.
          </FormRiskNotice>
        )}
      </FormSection>

      {message ? (
        <p
          className={`rounded-2xl px-3 py-2.5 text-[11px] leading-[1.35] ${overLimit ? "bg-error/[0.07] text-error" : "bg-success/[0.07] text-success"}`}
        >
          {message}
        </p>
      ) : null}
      {canManage && dirty ? (
        <div className="sticky bottom-[calc(1rem+env(safe-area-inset-bottom))] z-10 min-w-0 space-y-1 rounded-[22px] bg-white/96 p-2 shadow-surface ring-1 ring-ring-subtle backdrop-blur-xl">
          <p
            className={`px-1 text-support ${overLimit ? "font-bold text-error" : "text-on-surface-variant"}`}
          >
            {overLimit
              ? "Total kategori melebihi 100%. Kurangi rasio sebelum menyimpan."
              : `Teralokasi ${percent(allocation)} · Buffer ${percent(Math.max(0, 1 - allocation))}`}
          </p>
          <motion.button
            type="button"
            disabled={pending || overLimit}
            onClick={() => setConfirmSave(true)}
            whileTap={{ scale: 0.97 }}
            transition={transitionSpringSnappy}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-bold text-on-primary disabled:opacity-40"
          >
            <AppIcon name="save" className="icon-sm" />
            {pending ? "Menyimpan…" : "Tinjau perubahan"}
          </motion.button>
        </div>
      ) : null}
      <ConfirmationModal
        open={confirmSave}
        title="Terapkan default budget baru?"
        description="Perubahan berlaku untuk project baru dan proses setup berikutnya. Project Budget yang sudah aktif tidak diubah diam-diam."
        tone="warning"
        onClose={() => setConfirmSave(false)}
        actions={
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-container-low p-3 text-center">
              <div>
                <p className="text-[9px] font-bold text-on-surface-variant uppercase">
                  Internal budget
                </p>
                <p className="mt-1 text-sm font-bold">{percent(setting.budgetCapRatio)}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-on-surface-variant uppercase">
                  Buffer kategori
                </p>
                <p className="mt-1 text-sm font-bold">{percent(Math.max(0, 1 - allocation))}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={transitionSpringSnappy}
                onClick={() => setConfirmSave(false)}
                className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold"
              >
                Kembali
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={transitionSpringSnappy}
                disabled={pending || overLimit}
                onClick={save}
                className="min-h-12 rounded-full bg-primary px-4 text-xs font-bold text-white disabled:opacity-40"
              >
                Simpan Default
              </motion.button>
            </div>
          </div>
        }
      />
    </section>
  );
}
