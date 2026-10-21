"use client";

import * as React from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "framer-motion";
import {
  AppIcon,
  ActionMenu,
  Button,
  IconButton,
  FormSection,
  FormField,
  TextInput,
  NumericInput,
  MoneyInput,
  AdaptiveSelect,
  DatePickerField,
  MoneyValue,
  type SelectOption,
} from "@/components/ui";
import { transitionSpringSmooth } from "@/lib/utils/motion";
import type { InputField, RequestUserInputPayload } from "@atria/core/ai/input-request";
import {
  inputFieldVisible,
  normalizeInputRequestPayload,
  wizardPrimarySteps,
  wizardStepFields,
} from "@atria/core/ai/input-request-flow";
import {
  initialWizardProgress,
  fieldNoun,
  formatFieldValue,
  isFieldValid,
  validationMessageFor,
  buildSubmissionMessage,
  type WizardProgress,
} from "../utils/input-request-fields";
export {
  fieldNoun,
  formatFieldValue,
  isFieldValid,
  validationMessageFor,
  nextStepAfter,
  buildSubmissionMessage,
} from "../utils/input-request-fields";

function WizardFieldContent({
  fieldKey,
  children,
}: {
  readonly fieldKey: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const present = useIsPresent();
  return (
    <div data-wizard-field-key={fieldKey} inert={!present} aria-hidden={!present || undefined}>
      {children}
    </div>
  );
}

export function MorphedInputComposer({
  payload: rawPayload,
  progress,
  onProgressChange,
  onPause,
  onSubmit,
  onCancel,
  disabled = false,
}: {
  readonly payload: RequestUserInputPayload;
  readonly progress?: WizardProgress;
  readonly onProgressChange?: React.Dispatch<React.SetStateAction<WizardProgress>>;
  readonly onPause?: () => void;
  readonly onSubmit: (text: string) => void;
  readonly onCancel: () => void;
  readonly disabled?: boolean;
}): React.JSX.Element {
  const payload = React.useMemo(() => normalizeInputRequestPayload(rawPayload), [rawPayload]);
  const [local, setLocal] = React.useState<WizardProgress>(() => initialWizardProgress(payload));
  const [error, setError] = React.useState("");
  const [errorKey, setErrorKey] = React.useState("");
  const state = progress ?? local;
  const reduced = useReducedMotion();
  const present = useIsPresent();
  const fieldHost = React.useRef<HTMLDivElement>(null);
  const steps = wizardPrimarySteps(payload, state.values);
  const requested = payload.fields[state.currentStep];
  const fieldIndex =
    steps.find((index) => payload.fields[index].key === (requested?.groupWith ?? requested?.key)) ??
    (state.currentStep >= payload.fields.length ? steps.at(-1) : steps[0]) ??
    0;
  const field = payload.fields[fieldIndex];
  const position = steps.indexOf(fieldIndex);
  const focusField = React.useCallback(
    (key: string): void => {
      const active = Array.from(
        fieldHost.current?.querySelectorAll<HTMLElement>("[data-wizard-field-key]") ?? [],
      ).find((node) => node.dataset.wizardFieldKey === field?.key);
      const control = Array.from(
        active?.querySelectorAll<HTMLElement>("[data-wizard-control-key]") ?? [],
      ).find((node) => node.dataset.wizardControlKey === key);
      (control ?? active)
        ?.querySelector<HTMLElement>(
          'input:not([type="hidden"]):not([disabled]),button:not([disabled])',
        )
        ?.focus({ preventScroll: true });
    },
    [field?.key],
  );
  React.useEffect(() => {
    if (present && field) focusField(requested?.groupWith ? requested.key : field.key);
  }, [focusField, present, requested?.key, requested?.groupWith, field]);
  if (!field) return <></>;
  const group = wizardStepFields(payload, field.key, state.values);
  const last = position === steps.length - 1;
  const chips = payload.fields
    .map((item, index) => ({ field: item, index, raw: state.values[item.key] ?? "" }))
    .filter(
      (item) =>
        inputFieldVisible(item.field, state.values) &&
        item.raw.length > 0 &&
        (item.field.groupWith
          ? payload.fields.findIndex((parent) => parent.key === item.field.groupWith)
          : item.index) <= Math.max(fieldIndex, state.furthestStep),
    );

  function update(next: React.SetStateAction<WizardProgress>): void {
    if (onProgressChange) onProgressChange(next);
    else setLocal(next);
    setError("");
    setErrorKey("");
  }
  function next(): void {
    if (disabled || !present) return;
    const invalidInGroup = group.find((item) => !isFieldValid(item, state.values[item.key] ?? ""));
    if (invalidInGroup) {
      setError(validationMessageFor(invalidInGroup));
      setErrorKey(invalidInGroup.key);
      focusField(invalidInGroup.key);
      return;
    }
    const destination = steps[position + 1];
    if (destination === undefined) {
      const invalid = payload.fields.findIndex(
        (item) =>
          inputFieldVisible(item, state.values) &&
          !isFieldValid(item, state.values[item.key] ?? ""),
      );
      if (invalid !== -1) {
        update((current) => ({ ...current, currentStep: invalid }));
        setError(validationMessageFor(payload.fields[invalid]));
        setErrorKey(payload.fields[invalid].key);
        return;
      }
      onSubmit(buildSubmissionMessage(payload, state.values));
    } else
      update((current) => ({
        ...current,
        currentStep: destination,
        furthestStep: Math.max(current.furthestStep, destination),
      }));
  }
  function enter(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (
      event.defaultPrevented ||
      event.nativeEvent.isComposing ||
      event.key !== "Enter" ||
      event.shiftKey
    )
      return;
    if (!(event.target instanceof HTMLInputElement) || !event.currentTarget.contains(event.target))
      return;
    event.preventDefault();
    next();
  }
  function patch(key: string, raw: string): void {
    update((current) => ({ ...current, values: { ...current.values, [key]: raw } }));
  }
  function renderField(item: InputField): React.JSX.Element {
    const value = state.values[item.key] ?? "";
    const onChange = (raw: string): void => patch(item.key, raw);
    const fieldError = errorKey === item.key ? error : undefined;
    const createValue =
      item.label === "Klien"
        ? payload.fields.find((child) => child.groupWith === item.key && child.required)
            ?.visibleWhen?.equals
        : undefined;
    const options =
      item.options?.map((option): SelectOption =>
        option.value === createValue
          ? {
              ...option,
              action: { kind: "create", label: "Tambah klien baru" },
              description: "Isi nama klien di langkah ini",
            }
          : option,
      ) ?? [];
    return (
      <motion.div
        key={item.key}
        data-wizard-control-key={item.key}
        initial={reduced || !item.groupWith ? false : { opacity: 0, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduced ? { duration: 0 } : transitionSpringSmooth}
      >
        {item.type === "select" ? (
          <AdaptiveSelect
            label={item.label}
            disabled={disabled}
            value={value}
            onChange={onChange}
            options={options}
            required={item.required}
            placeholder={item.placeholder ?? "Pilih " + fieldNoun(item.label) + "…"}
            error={fieldError}
          />
        ) : item.type === "date" ? (
          <DatePickerField
            disabled={disabled}
            label={item.label}
            value={value}
            onChange={onChange}
            required={item.required}
            error={fieldError}
          />
        ) : (
          <FormField label={item.label} required={item.required} error={fieldError}>
            {item.type === "currency" ? (
              <MoneyInput
                disabled={disabled}
                value={value}
                onChange={onChange}
                autoFocus={!item.groupWith}
                showPreview={false}
              />
            ) : item.type === "number" ? (
              <NumericInput
                disabled={disabled}
                value={value}
                onChange={onChange}
                autoFocus={!item.groupWith}
                placeholder={item.placeholder}
              />
            ) : (
              <TextInput
                disabled={disabled}
                value={value}
                onChange={onChange}
                autoFocus={!item.groupWith}
                placeholder={item.placeholder}
              />
            )}
          </FormField>
        )}
      </motion.div>
    );
  }

  return (
    <div
      className="min-w-0 p-2"
      role="group"
      aria-label={payload.actionTitle}
      data-composer-wizard=""
    >
      <div className="flex min-w-0 items-center gap-2 px-2 pb-1">
        <h3 className="min-w-0 flex-1 text-support font-semibold text-on-surface">
          {payload.actionTitle}
        </h3>
        {onPause && (
          <IconButton
            label="Tulis pesan tanpa membatalkan isian"
            size="compact"
            variant="tertiary"
            className="bg-surface-container-lowest! text-on-surface! shadow-none!"
            icon={<AppIcon name="chat" className="icon-md" />}
            onClick={onPause}
          />
        )}
        <ActionMenu
          label="Opsi pengisian"
          placement="top-end"
          trigger={
            <IconButton
              label="Opsi pengisian"
              size="compact"
              variant="tertiary"
              className="bg-surface-container-lowest! text-on-surface! shadow-none!"
              icon={<AppIcon name="more_horiz" className="icon-md" />}
            />
          }
          items={[{ id: "cancel", label: "Batalkan pengisian", icon: "close", onSelect: onCancel }]}
        />
      </div>
      <div hidden={chips.length === 0} className="overflow-x-auto px-1 py-1">
        <ul className="flex w-max gap-1.5" aria-label="Isian yang sudah diisi">
          {chips.map((item) => (
            <li key={item.field.key}>
              <Button
                type="button"
                variant="secondary"
                size="compact"
                className={
                  item.index === state.currentStep
                    ? "max-w-56 bg-surface-container-high! text-on-surface! shadow-none!"
                    : "max-w-56 bg-surface-container-low! text-on-surface! shadow-none!"
                }
                onClick={() => update((current) => ({ ...current, currentStep: item.index }))}
                aria-current={item.index === state.currentStep ? "step" : undefined}
              >
                <span className="min-w-0 truncate text-meta">{item.field.label}: </span>
                {item.field.type === "currency" && Number.isFinite(Number(item.raw)) ? (
                  <MoneyValue
                    amount={Number(item.raw)}
                    variant="compact"
                    size="sm"
                    showTooltip={false}
                  />
                ) : (
                  <span className="min-w-0 truncate text-meta">
                    {formatFieldValue(item.field, item.raw)}
                  </span>
                )}
              </Button>
            </li>
          ))}
        </ul>
      </div>
      <div ref={fieldHost} className="relative min-w-0" onKeyDown={enter}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={field.key}
            initial={reduced ? false : { opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: -6 }}
            transition={reduced ? { duration: 0 } : transitionSpringSmooth}
          >
            <WizardFieldContent fieldKey={field.key}>
              <FormSection presentation="embedded">{group.map(renderField)}</FormSection>
            </WizardFieldContent>
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        Langkah {position + 1} dari {steps.length}: {field.label}
      </p>
      <div className="flex items-center justify-between gap-3 border-t border-ring-subtle px-2 pt-2">
        <IconButton
          label="Kembali ke langkah sebelumnya"
          size="compact"
          variant="tertiary"
          className="bg-surface-container-lowest! text-on-surface! shadow-none!"
          disabled={position === 0}
          icon={<AppIcon name="arrow_back" className="icon-md" />}
          onClick={() =>
            update((current) => ({ ...current, currentStep: steps[Math.max(0, position - 1)] }))
          }
        />
        <span className="text-meta text-on-surface-variant tabular-nums">
          {position + 1}/{steps.length}
        </span>
        <IconButton
          label={last ? "Kirim ke asisten AI" : "Lanjut ke langkah berikutnya"}
          size="compact"
          variant="primary"
          className="bg-primary! text-on-primary! shadow-none!"
          disabled={disabled}
          icon={<AppIcon name={last ? "arrow_upward" : "arrow_forward"} className="icon-md" />}
          onClick={next}
        />
      </div>
      {payload.workflow === "CREATE_PROJECT" ? (
        <p className="px-2 pt-1 text-center text-meta text-on-surface-variant">
          Budget awal memakai Pengaturan ERP.
        </p>
      ) : null}
    </div>
  );
}
