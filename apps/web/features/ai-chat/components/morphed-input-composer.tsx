"use client";

import {
  AppIcon,
  DialogOptionList,
  type DialogOptionListHandle,
  SearchDialog,
} from "@/components/ui";
import { transitionSpringSnappy, transitionSpringSmooth } from "@/lib/utils/motion";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import * as React from "react";
import type { InputField, RequestUserInputPayload } from "@/lib/ai/tools/input-request-tools";

import { COMPOSER_MORPH_LAYOUT_ID } from "./chat-composer";

/**
 * Panel input bertahap yang menggantikan komposer chat saat AI meminta data.
 *
 * Bentuknya panel, bukan bilah tipis: satu bilah 48px tidak muat menampung
 * label, nilai yang sudah diisi, kolom aktif, dan dua tombol navigasi tanpa
 * terasa sesak. Panel memakai `layoutId` yang sama dengan komposer sehingga
 * pertukaran keduanya terbaca sebagai satu benda yang berubah bentuk.
 */

/** Di atas ambang ini, pilihan pindah ke SearchDialog yang punya pencarian. */
const INLINE_SELECT_MAX_OPTIONS = 5;

/**
 * Label dari model sering sudah diawali kata kerja ("Pilih Proyek"), sehingga
 * menempelkan "Pilih " lagi menghasilkan "Pilih pilih proyek…". Ini membuang
 * awalan itu supaya kalimat yang dirakit tetap wajar.
 */
export function fieldNoun(label: string): string {
  return label.replace(/^(pilih|masukkan|isi|ketik)\s+/i, "").toLowerCase();
}

/** Nilai siap-tampil: rupiah diformat, pilihan memakai label bukan kodenya. */
export function formatFieldValue(field: InputField, raw: string): string {
  if (!raw) return "";
  if (field.type === "currency") {
    return `Rp ${Number(raw.replace(/\D/g, "")).toLocaleString("id-ID")}`;
  }
  if (field.type === "select") {
    return field.options?.find((option) => option.value === raw)?.label ?? raw;
  }
  return raw;
}

export function isFieldValid(field: InputField, raw: string): boolean {
  if (field.required === false) return true;
  if (field.type === "currency") return Number(raw.replace(/\D/g, "")) > 0;
  if (field.type === "number") {
    const parsed = Number(raw);
    return !Number.isNaN(parsed) && parsed > 0;
  }
  return raw.trim().length > 0;
}

/**
 * Pesan ditulis sebagai perintah ("Masukkan nominal…"), bukan vonis ("Nominal
 * tidak valid"), supaya pengguna langsung tahu tindakan berikutnya.
 */
export function validationMessageFor(field: InputField): string {
  if (field.type === "currency") return "Masukkan nominal lebih dari Rp 0.";
  if (field.type === "number") return "Masukkan angka lebih dari 0.";
  if (field.type === "select") return `Pilih ${fieldNoun(field.label)} terlebih dahulu.`;
  if (field.type === "date") return "Pilih tanggal terlebih dahulu.";
  return `Isi ${fieldNoun(field.label)} terlebih dahulu.`;
}

/**
 * Ke mana tombol lanjut membawa pengguna.
 *
 * Aturannya kontekstual dan disengaja: kalau pengguna melompat mundur lewat
 * chip untuk membetulkan satu isian, lanjut mengembalikannya ke langkah
 * terjauh yang sudah dicapai — bukan menyeretnya mengulang sisa formulir.
 */
export function nextStepAfter(
  currentStep: number,
  furthestStep: number,
  totalSteps: number,
): number | "submit" {
  if (currentStep < furthestStep) return furthestStep;
  if (currentStep < totalSteps - 1) return currentStep + 1;
  return "submit";
}

/** Pesan terformat yang dikirim ke AI setelah seluruh langkah terisi. */
export function buildSubmissionMessage(
  payload: RequestUserInputPayload,
  values: Record<string, string>,
): string {
  const lines = [`Berikut data untuk ${payload.actionTitle}:`];
  for (const field of payload.fields) {
    lines.push(`- ${field.label}: ${formatFieldValue(field, values[field.key] ?? "")}`);
  }
  return lines.join("\n");
}

/**
 * Tinggi alami isi panel, dipantau terus-menerus.
 *
 * Dipakai untuk menganimasikan tinggi kotak sebagai properti `height` yang
 * sesungguhnya. Itu memicu reflow biasa — bukan transform — sehingga tidak ada
 * skala yang diwariskan dan tidak ada isi yang teregang. Nilai `null` di render
 * pertama membiarkan tinggi tetap `auto`, jadi keluaran server dan cat pertama
 * tidak bergantung pada hasil pengukuran.
 */
function useMeasuredHeight(): {
  readonly contentRef: React.RefObject<HTMLDivElement | null>;
  readonly measuredHeight: number | null;
} {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = React.useState<number | null>(null);

  React.useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const sync = (): void => setMeasuredHeight(element.getBoundingClientRect().height);
    sync();

    const observer = new ResizeObserver(sync);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { contentRef, measuredHeight };
}

type MorphedInputComposerProps = {
  readonly payload: RequestUserInputPayload;
  readonly onSubmit: (formattedResponse: string) => void;
  readonly onCancel: () => void;
};

export function MorphedInputComposer({
  payload,
  onSubmit,
  onCancel,
}: MorphedInputComposerProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const { contentRef, measuredHeight } = useMeasuredHeight();
  const [currentStep, setCurrentStep] = React.useState(0);
  const [furthestStep, setFurthestStep] = React.useState(0);
  const [validationMessage, setValidationMessage] = React.useState<string | null>(null);
  const [isSelectDialogOpen, setIsSelectDialogOpen] = React.useState(false);
  const [selectSearchQuery, setSelectSearchQuery] = React.useState("");
  const selectOptionListRef = React.useRef<DialogOptionListHandle>(null);

  const [values, setValues] = React.useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of payload.fields) {
      if (field.defaultValue) initial[field.key] = field.defaultValue;
      else if (field.type === "date") initial[field.key] = new Date().toISOString().slice(0, 10);
      else initial[field.key] = "";
    }
    return initial;
  });

  const totalSteps = payload.fields.length;
  const currentField = payload.fields[currentStep];
  const currentValue = currentField ? (values[currentField.key] ?? "") : "";
  const isLastStep = currentStep === totalSteps - 1;

  function updateFieldValue(next: string): void {
    if (!currentField) return;
    setValidationMessage(null);
    setValues((prev) => ({ ...prev, [currentField.key]: next }));
  }

  function advance(nextValues: Record<string, string>): void {
    const destination = nextStepAfter(currentStep, furthestStep, totalSteps);
    if (destination === "submit") {
      onSubmit(buildSubmissionMessage(payload, nextValues));
      return;
    }
    setValidationMessage(null);
    setCurrentStep(destination);
    setFurthestStep((furthest) => Math.max(furthest, destination));
  }

  function handleNext(): void {
    if (!currentField) return;
    // Tombol sengaja tidak pernah disabled: yang tidak valid harus mengatakan
    // alasannya, bukan diam-diam mati. Pola yang sama dipakai SheetFooterActions.
    if (!isFieldValid(currentField, currentValue)) {
      setValidationMessage(validationMessageFor(currentField));
      return;
    }
    advance(values);
  }

  function handlePrev(): void {
    if (currentStep === 0) return;
    setValidationMessage(null);
    setCurrentStep((step) => step - 1);
  }

  function jumpToStep(step: number): void {
    setValidationMessage(null);
    setCurrentStep(step);
  }

  function selectOption(optionValue: string): void {
    if (!currentField) return;
    const nextValues = { ...values, [currentField.key]: optionValue };
    setValues(nextValues);
    setIsSelectDialogOpen(false);
    setSelectSearchQuery("");
    // Pilihan tidak punya keadaan "masih mengetik", jadi memilih sudah cukup
    // menyatakan selesai — tidak perlu menekan lanjut lagi.
    advance(nextValues);
  }

  function handleKeyDown(event: React.KeyboardEvent): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleNext();
    }
  }

  if (!currentField) return <React.Fragment />;

  const isSelectType = currentField.type === "select";
  const options = currentField.options ?? [];
  const usesInlineSelect = isSelectType && options.length <= INLINE_SELECT_MAX_OPTIONS;
  const selectedOption = options.find((option) => option.value === currentValue);
  const filteredOptions = options.filter((option) =>
    selectSearchQuery.trim()
      ? option.label.toLowerCase().includes(selectSearchQuery.toLowerCase())
      : true,
  );

  // Yang sudah dilewati dan yang sedang dikerjakan. Langkah di depan sengaja
  // tidak dijadikan chip: chip yang tidak bisa ditekan hanyalah kontrol mati
  // yang menyamar sebagai kontrol.
  //
  // Chip yang belum berisi apa pun juga dibuang. Di langkah pertama, chip
  // "current" adalah satu-satunya chip dan hanya mengulang label yang tepat
  // berada di bawahnya — nilainya nol, deraunya nyata.
  const visibleChips = payload.fields
    .slice(0, Math.max(currentStep, furthestStep) + 1)
    .map((field, index) => ({
      field,
      index,
      display: formatFieldValue(field, values[field.key] ?? ""),
    }))
    .filter(({ display }) => display.length > 0);

  const inputClassName =
    "w-full border-none bg-transparent p-0 text-section leading-6 font-bold text-on-surface placeholder:font-semibold placeholder:text-on-surface-variant/45 focus:ring-0 focus:outline-none";

  return (
    <>
      <motion.div
        layoutId={reduceMotion ? undefined : COMPOSER_MORPH_LAYOUT_ID}
        // `layout="position"` melarang Framer memakai transform `scale` untuk
        // memuluskan perubahan ukuran. Skala itulah biang peregangan: ia
        // diwariskan ke SELURUH keturunan, jadi memperbaikinya satu tingkat
        // hanya memindahkan cacatnya ke tingkat berikutnya. Di sini tinggi
        // dianimasikan sebagai tinggi sungguhan (lihat `measuredHeight`),
        // bukan sebagai transform, sehingga tidak ada yang teregang sama
        // sekali pada kedalaman mana pun.
        layout="position"
        animate={measuredHeight === null ? undefined : { height: measuredHeight }}
        transition={reduceMotion ? { duration: 0 } : transitionSpringSmooth}
        className="relative w-full overflow-hidden rounded-owner bg-white shadow-control ring-1 ring-ring-control focus-within:ring-2 focus-within:ring-focus-ring"
        role="group"
        aria-label={payload.actionTitle}
      >
        {/* Diukur, bukan dianimasikan: isi selalu berada pada tinggi alaminya
            sehingga tidak pernah bergeser, dan kotak di atasnya yang bergerak. */}
        <div ref={contentRef} className="flex min-h-40 flex-col gap-2.5 px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-eyebrow font-bold tracking-widest text-on-surface-variant uppercase">
                Melengkapi data
              </p>
              <h3 className="mt-0.5 truncate text-row font-bold tracking-[-0.01em] text-on-surface">
                {payload.actionTitle}
              </h3>
            </div>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Batalkan pengisian dan kembali ke chat"
              className="-mt-0.5 -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors duration-200 hover:bg-surface-container-low hover:text-on-surface focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
            >
              <AppIcon name="close" className="icon-sm" aria-hidden="true" />
            </button>
          </div>

          {/* Menggulir mendatar supaya baris ini tetap satu baris berapa pun
          isinya. Tingginya sengaja TIDAK dipesan saat kosong: pita kosong di
          bawah judul terbaca sebagai cacat tata letak sepanjang langkah
          pertama, sementara tumbuhnya panel saat chip pertama muncul hanya
          terjadi sekali dan sudah dimuluskan animasi tinggi di atas. */}
          <div hidden={visibleChips.length === 0} className="-mx-4 overflow-x-auto px-4">
            <ul className="flex w-max items-center gap-1.5" aria-label="Isian yang sudah diisi">
              {visibleChips.map(({ field, index, display }) => {
                const isCurrent = index === currentStep;
                return (
                  <li key={field.key}>
                    <button
                      type="button"
                      onClick={() => jumpToStep(index)}
                      aria-current={isCurrent ? "step" : undefined}
                      className={`flex min-h-7 max-w-52 items-center gap-1 rounded-full px-2.5 text-meta font-semibold whitespace-nowrap transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none ${
                        isCurrent
                          ? "bg-primary text-on-primary"
                          : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                      }`}
                    >
                      <span className="shrink-0 opacity-70">{field.label}:</span>
                      <span className="truncate">{display}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="min-w-0 flex-1">
            {/* `popLayout` mengeluarkan kolom yang pergi dari aliran tata letak
            seketika. Dengan `wait`, kolom lama harus selesai memudar dulu
            sebelum yang baru dipasang, sehingga sesaat tidak ada isi sama
            sekali dan tinggi panel sempat mengempis lalu tumbuh lagi. */}
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={currentField.key}
                initial={reduceMotion ? undefined : { opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, x: -6 }}
                transition={transitionSpringSmooth}
              >
                <label
                  htmlFor={`ai-field-${currentField.key}`}
                  className="block text-meta font-semibold text-on-surface-variant"
                >
                  {currentField.label}
                </label>

                <div className="mt-1">
                  {currentField.type === "currency" ? (
                    <input
                      id={`ai-field-${currentField.key}`}
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      value={currentValue ? formatFieldValue(currentField, currentValue) : ""}
                      onChange={(event) => updateFieldValue(event.target.value.replace(/\D/g, ""))}
                      onKeyDown={handleKeyDown}
                      placeholder={currentField.placeholder ?? "Rp 0"}
                      aria-describedby={`ai-field-status-${currentField.key}`}
                      className={inputClassName}
                    />
                  ) : currentField.type === "number" ? (
                    <input
                      id={`ai-field-${currentField.key}`}
                      type="number"
                      autoFocus
                      value={currentValue}
                      onChange={(event) => updateFieldValue(event.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={currentField.placeholder ?? "0"}
                      aria-describedby={`ai-field-status-${currentField.key}`}
                      className={inputClassName}
                    />
                  ) : currentField.type === "date" ? (
                    // Tetap input tanggal bawaan supaya ponsel memunculkan pemilih
                    // sistem; hanya penampilannya yang diselaraskan.
                    <input
                      id={`ai-field-${currentField.key}`}
                      type="date"
                      value={currentValue}
                      onChange={(event) => updateFieldValue(event.target.value)}
                      onKeyDown={handleKeyDown}
                      aria-describedby={`ai-field-status-${currentField.key}`}
                      className={`${inputClassName} [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-55 [&::-webkit-calendar-picker-indicator]:hover:opacity-100`}
                    />
                  ) : usesInlineSelect ? (
                    <ul className="flex flex-col gap-1.5" aria-label={currentField.label}>
                      {options.map((option) => {
                        const isSelected = currentValue === option.value;
                        return (
                          <li key={option.value}>
                            <button
                              type="button"
                              onClick={() => selectOption(option.value)}
                              aria-pressed={isSelected}
                              className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-inset px-3 text-left text-row font-semibold transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none ${
                                isSelected
                                  ? "bg-primary/6 text-primary ring-1 ring-primary/15"
                                  : "bg-surface-container-low text-on-surface hover:bg-surface-container"
                              }`}
                            >
                              <span className="truncate">{option.label}</span>
                              {isSelected && (
                                <AppIcon
                                  name="check"
                                  aria-hidden="true"
                                  className="icon-sm shrink-0 text-primary"
                                />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : isSelectType ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectSearchQuery("");
                        setIsSelectDialogOpen(true);
                      }}
                      aria-describedby={`ai-field-status-${currentField.key}`}
                      className="group flex min-h-11 w-full items-center justify-between gap-2 rounded-inset bg-surface-container-low px-3 text-left transition-colors duration-200 hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
                    >
                      <span
                        className={`truncate text-row font-semibold ${
                          selectedOption ? "text-on-surface" : "text-on-surface-variant/60"
                        }`}
                      >
                        {selectedOption?.label ??
                          currentField.placeholder ??
                          `Pilih ${fieldNoun(currentField.label)}…`}
                      </span>
                      <AppIcon
                        name="expand_more"
                        aria-hidden="true"
                        className="icon-sm shrink-0 text-on-surface-variant"
                      />
                    </button>
                  ) : (
                    <input
                      id={`ai-field-${currentField.key}`}
                      type="text"
                      autoFocus
                      value={currentValue}
                      onChange={(event) => updateFieldValue(event.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        currentField.placeholder ?? `Ketik ${fieldNoun(currentField.label)}…`
                      }
                      aria-describedby={`ai-field-status-${currentField.key}`}
                      className={inputClassName}
                    />
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Slot pesan selalu ada meski kosong, supaya panel tidak melonjak
            setinggi satu baris begitu pesan muncul. */}
            <p
              id={`ai-field-status-${currentField.key}`}
              role="status"
              aria-live="polite"
              className="mt-1.5 min-h-4 text-meta font-semibold text-error"
            >
              {validationMessage}
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-black/5.5 pt-2.5">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentStep === 0}
              aria-label="Kembali ke langkah sebelumnya"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors duration-200 hover:bg-surface-container-low hover:text-on-surface focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30"
            >
              <AppIcon name="arrow_back" className="icon-sm" aria-hidden="true" />
            </button>

            <span className="financial-amount text-meta font-bold text-on-surface-variant tabular-nums">
              {currentStep + 1}/{totalSteps}
            </span>

            <motion.button
              type="button"
              onClick={handleNext}
              whileTap={reduceMotion ? undefined : { scale: 0.94 }}
              transition={transitionSpringSnappy}
              aria-label={isLastStep ? "Kirim ke asisten AI" : "Lanjut ke langkah berikutnya"}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary shadow-control transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
            >
              <AppIcon name={isLastStep ? "send" : "arrow_forward"} className="icon-sm" />
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Dialog berada di luar kotak yang dipotong `overflow-hidden`. */}
      {isSelectType && !usesInlineSelect && (
        <SearchDialog
          open={isSelectDialogOpen}
          title={`Pilih ${fieldNoun(currentField.label)}`}
          query={selectSearchQuery}
          onQueryChange={setSelectSearchQuery}
          searchPlaceholder={`Cari ${fieldNoun(currentField.label)}…`}
          onSearchKeyDown={(event) => {
            if (event.key !== "ArrowDown") return;
            event.preventDefault();
            selectOptionListRef.current?.focusFirst();
          }}
          onClose={() => {
            setIsSelectDialogOpen(false);
            setSelectSearchQuery("");
          }}
        >
          <DialogOptionList
            key={selectSearchQuery}
            ref={selectOptionListRef}
            label={`Pilih ${fieldNoun(currentField.label)}`}
            value={currentValue}
            options={filteredOptions}
            emptyText="Tidak ada opsi yang sesuai pencarian."
            onSelect={(option) => selectOption(option.value)}
          />
        </SearchDialog>
      )}
    </>
  );
}
