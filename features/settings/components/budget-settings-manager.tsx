"use client";

import React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Save } from "lucide-react";
import {
  updateBudgetAllocationDefaults,
  type BudgetAllocationSettingRow,
} from "@/app/actions/settings/system";
import { SettingsHeader } from "./settings-ui";
import { ConfirmationModal, FormField, FormRiskNotice, FormSection, MoneyInput, NumericInput, Textarea, TextInput } from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";

const fullMoney = (value: number): string =>
  `Rp ${Math.round(value).toLocaleString("id-ID")}`;
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
};

export function BudgetSettingsManager({
  hideHeader = false,
  initialSetting,
  roleName,
  canManage,
}: BudgetSettingsManagerProps): React.JSX.Element {
  const [setting, setSetting] = React.useState(initialSetting);
  const [baseline, setBaseline] = React.useState(initialSetting);
  const [confirmSave, setConfirmSave] = React.useState(false);
  const [sampleValue, setSampleValue] = React.useState(100_000_000);
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const allocation = setting.categories.reduce(
    (sum, category) =>
      sum + (category.isEnabled ? category.ratioPercentage : 0),
    0,
  );
  const internalBudget = sampleValue * setting.budgetCapRatio;
  const allocated = internalBudget * allocation;
  const buffer = Math.max(0, internalBudget - allocated);
  const overLimit = allocation > 1.000001;
  const dirty = JSON.stringify(setting) !== JSON.stringify(baseline);

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
      } else {
        setMessage(result.error.message);
        toast.error(result.error.message);
      }
    });
  }

  return (
    <section className="min-w-0 space-y-lg">
      {!hideHeader && (
        <SettingsHeader
          eyebrow="Default finansial"
          title="Alokasi Budget"
          description="Rasio kategori memakai Budget Internal. Buffer dan margin kotor dihitung terpisah."
          role={roleName}
          canManage={canManage}
        />
      )}

      <FormSection title="1 · Simulasi nilai proyek" helper="Ubah nilai contoh untuk melihat dampak formula. Nilai ini tidak ikut disimpan.">
        <FormField label="Nilai proyek contoh" helper="Hanya untuk simulasi; tidak ikut disimpan."><MoneyInput value={sampleValue} onChange={(value) => setSampleValue(Number(value || 0))} /></FormField>
        <dl className="divide-y divide-outline-variant/35 rounded-2xl bg-surface-container-low px-4">
          {[{ label: "Budget internal", value: internalBudget, tone: "text-primary" }, { label: "Margin kotor", value: sampleValue - internalBudget, tone: "text-on-surface" }, { label: "Teralokasi", value: allocated, tone: "text-on-surface" }, { label: "Buffer", value: buffer, tone: "text-warning" }].map((item) => <div key={item.label} className="flex min-h-11 items-center justify-between gap-3 py-2"><dt className="text-[11px] text-on-surface-variant">{item.label}</dt><dd className={`text-xs font-bold tabular-nums ${item.tone}`}>{fullMoney(item.value)}</dd></div>)}
        </dl>
      </FormSection>

      <FormSection title="2 · Formula proyek baru" helper="Perubahan hanya menjadi default untuk setup berikutnya; proyek aktif tidak berubah otomatis.">
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

      <FormSection title="3 · Alokasi kategori" helper="Bagikan Budget Internal ke kategori aktif. Total tidak boleh lebih dari 100%.">
        <div className="flex min-w-0 items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-on-surface">
              Pembagian Budget Internal
            </h2>
          </div>
          <p
            className={`financial-amount shrink-0 font-mono text-lg font-bold tabular-nums ${overLimit ? "text-error" : "text-on-surface"}`}
          >
            {percent(allocation)}
          </p>
        </div>
        <div className="mt-sm h-2 overflow-hidden rounded-full bg-surface-container">
          <div
            className={`h-full rounded-full ${overLimit ? "bg-error" : "bg-primary"}`}
            style={{ width: `${Math.min(100, allocation * 100)}%` }}
          />
        </div>
        <div className="mt-2 flex min-w-0 justify-between gap-3 text-[10px] text-on-surface-variant">
          <span className="min-w-0">Teralokasi {fullMoney(allocated)}</span>
          <span className="shrink-0">
            Buffer {percent(Math.max(0, 1 - allocation))}
          </span>
        </div>
        <div className="mt-md space-y-2">
          {setting.categories.map((category, index) => {
            const categoryAmount =
              internalBudget *
              (category.isEnabled ? category.ratioPercentage : 0);
            return (
              <div key={category.id} className={`min-w-0 rounded-[22px] p-3 ring-1 ${category.isEnabled ? "bg-surface-container-low ring-outline-variant/15" : "bg-surface-container-low/45 ring-outline-variant/10"}`}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <motion.button
                    type="button"
                    role="switch"
                    aria-checked={category.isEnabled}
                    aria-label={`${category.isEnabled ? "Nonaktifkan" : "Aktifkan"} ${category.name}`}
                    whileTap={{ scale: 0.96 }}
                    transition={transitionSpringSnappy}
                    className={`relative h-7 w-12 shrink-0 rounded-full p-1 outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${category.isEnabled ? "bg-primary" : "bg-outline-variant/35"}`}
                    disabled={!canManage}
                    onClick={() =>
                      setSetting({
                        ...setting,
                        categories: setting.categories.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, isEnabled: !row.isEnabled }
                            : row,
                        ),
                      })
                    }
                  >
                    <motion.span layout transition={transitionSpringSnappy} className={`block h-5 w-5 rounded-full bg-white shadow-sm ${category.isEnabled ? "ml-5" : "ml-0"}`} />
                  </motion.button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-on-surface">
                      {category.name}
                    </p>
                    <p className="truncate text-[9px] uppercase tracking-wide text-on-surface-variant">
                      {category.code}
                    </p>
                  </div>
                  <div className="max-w-[42%] shrink-0 text-right"><p className="text-xs font-bold tabular-nums text-on-surface">{fullMoney(categoryAmount)}</p><p className="mt-0.5 text-[9px] text-on-surface-variant">{category.isEnabled ? percent(category.ratioPercentage) : "Nonaktif"}</p></div>
                </div>
                {category.isEnabled ? <div className="relative mt-2">
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
                </div> : null}
              </div>
            );
          })}
        </div>
        {overLimit ? <FormRiskNotice title="Alokasi melebihi 100%" tone="danger">Kurangi rasio kategori sebelum menyimpan default.</FormRiskNotice> : <FormRiskNotice title="Buffer tetap terlihat" tone="success">Sisa {percent(Math.max(0, 1 - allocation))} tidak dialokasikan dan tetap menjadi buffer Budget Internal.</FormRiskNotice>}
      </FormSection>

      <div className="min-w-0 space-y-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <p
          className={`px-1 text-[11px] leading-4 ${overLimit ? "font-bold text-error" : "text-on-surface-variant"}`}
        >
          {message ??
            (overLimit
              ? "Total kategori melebihi 100%. Kurangi rasio sebelum menyimpan."
              : `Teralokasi ${percent(allocation)} · Buffer ${percent(Math.max(0, 1 - allocation))}`)}
        </p>
        <motion.button
          type="button"
          disabled={!canManage || pending || overLimit || !dirty}
          onClick={() => setConfirmSave(true)}
          whileTap={{ scale: 0.97 }}
          transition={transitionSpringSnappy}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-bold text-on-primary disabled:opacity-40"
        >
          <Save className="h-4 w-4" />
          {pending ? "Menyimpan…" : !dirty ? "Tidak ada perubahan" : canManage ? "Tinjau & Simpan" : "Hanya baca"}
        </motion.button>
      </div>
      <ConfirmationModal
        open={confirmSave}
        title="Terapkan default budget baru?"
        description="Perubahan berlaku untuk project baru dan proses setup berikutnya. Project Budget yang sudah aktif tidak diubah diam-diam."
        tone="warning"
        onClose={() => setConfirmSave(false)}
        actions={(
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-container-low p-3 text-center">
              <div><p className="text-[9px] font-bold uppercase text-on-surface-variant">Internal budget</p><p className="mt-1 text-sm font-bold">{percent(setting.budgetCapRatio)}</p></div>
              <div><p className="text-[9px] font-bold uppercase text-on-surface-variant">Buffer kategori</p><p className="mt-1 text-sm font-bold">{percent(Math.max(0, 1 - allocation))}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} onClick={() => setConfirmSave(false)} className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold">Kembali</motion.button>
              <motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} disabled={pending || overLimit} onClick={save} className="min-h-12 rounded-full bg-primary px-4 text-xs font-bold text-white disabled:opacity-40">Simpan Default</motion.button>
            </div>
          </div>
        )}
      />
    </section>
  );
}
