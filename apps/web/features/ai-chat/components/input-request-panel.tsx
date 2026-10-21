"use client";
import * as React from "react";
import {
  Button,
  FormSection,
  FormField,
  TextInput,
  MoneyInput,
  NumericInput,
  DatePickerField,
  AdaptiveSelect,
  WorkflowFormSheet,
  ChoiceRow,
} from "@/components/ui";
import type { InputField, RequestUserInputPayload } from "@atria/core/ai/input-request";
import {
  buildSubmissionMessage,
  isFieldValid,
  validationMessageFor,
} from "./morphed-input-composer";

function RequestField({
  field,
  value,
  onChange,
}: {
  readonly field: InputField;
  readonly value: string;
  readonly onChange: (value: string) => void;
}): React.JSX.Element {
  if (field.type === "select")
    return (
      <AdaptiveSelect
        label={field.label}
        value={value}
        onChange={onChange}
        options={(field.options ?? []).map((option) => ({
          value: option.value,
          label: option.label,
        }))}
        placeholder={field.placeholder ?? "Pilih nilai"}
      />
    );
  if (field.type === "date")
    return (
      <DatePickerField
        label={field.label}
        value={value}
        onChange={onChange}
        required={field.required}
      />
    );
  return (
    <FormField label={field.label} required={field.required}>
      {field.type === "currency" ? (
        <MoneyInput value={value} onChange={onChange} />
      ) : field.type === "number" ? (
        <NumericInput value={value} onChange={onChange} placeholder={field.placeholder} />
      ) : (
        <TextInput value={value} onChange={onChange} placeholder={field.placeholder} />
      )}
    </FormField>
  );
}
export function InputRequestPanel({
  payload,
  onSubmit,
  onCancel,
}: {
  readonly payload: RequestUserInputPayload;
  readonly onSubmit: (text: string) => void;
  readonly onCancel: () => void;
}): React.JSX.Element {
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(payload.fields.map((field) => [field.key, field.defaultValue ?? ""])),
  );
  const [open, setOpen] = React.useState(false);
  const queued = React.useRef<string | null>(null);
  const [error, setError] = React.useState("");
  const field = payload.fields[0];
  const short =
    payload.fields.length === 1 && (field.type !== "select" || (field.options?.length ?? 0) <= 5);
  function patch(key: string, value: string): void {
    setValues((current) => ({ ...current, [key]: value }));
    setError("");
  }
  function send(next: Record<string, string>, defer = false): void {
    const invalid = payload.fields.find((field) => !isFieldValid(field, next[field.key] ?? ""));
    if (invalid) {
      setError(validationMessageFor(invalid));
      return;
    }
    const text = buildSubmissionMessage(payload, next);
    if (defer) {
      queued.current = text;
      setOpen(false);
    } else onSubmit(text);
  }
  return (
    <div className="space-y-2" aria-label="Isian yang diminta asisten">
      <FormSection title={payload.actionTitle} helper={payload.description}>
        {short ? (
          field.type === "select" ? (
            <div role="radiogroup" aria-label={field.label}>
              {field.options?.map((option) => (
                <ChoiceRow
                  key={option.value}
                  checked={values[field.key] === option.value}
                  title={option.label}
                  selectionMode="radio"
                  onChange={() => {
                    const next = { ...values, [field.key]: option.value };
                    setValues(next);
                    send(next);
                  }}
                />
              ))}
            </div>
          ) : (
            <RequestField
              field={field}
              value={values[field.key] ?? ""}
              onChange={(value) => patch(field.key, value)}
            />
          )
        ) : (
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="text-support text-on-surface-variant">
              {payload.fields.length} isian diperlukan untuk melanjutkan.
            </p>
            <Button variant="secondary" size="compact" onClick={() => setOpen(true)}>
              Isi data
            </Button>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2 px-3 py-2">
          <Button variant="tertiary" size="compact" onClick={onCancel}>
            Batalkan permintaan
          </Button>
          {short && field.type !== "select" && (
            <Button variant="primary" size="compact" onClick={() => send(values)}>
              Kirim isian
            </Button>
          )}
        </div>
        {error && !open && (
          <p role="alert" className="px-4 pb-3 text-support text-critical">
            {error}
          </p>
        )}
      </FormSection>
      <WorkflowFormSheet
        open={open}
        title={payload.actionTitle}
        dismissal={{ mode: "preserve" }}
        onClose={() => setOpen(false)}
        primaryLabel="Kirim isian"
        secondaryLabel="Kembali"
        onSecondary={() => setOpen(false)}
        onPrimary={() => send(values, true)}
        onExitComplete={() => {
          const text = queued.current;
          queued.current = null;
          if (text) onSubmit(text);
        }}
      >
        <FormSection helper={payload.description}>
          {payload.fields.map((field) => (
            <RequestField
              key={field.key}
              field={field}
              value={values[field.key] ?? ""}
              onChange={(value) => patch(field.key, value)}
            />
          ))}
        </FormSection>
        {error && (
          <p role="alert" className="mt-3 text-support text-critical">
            {error}
          </p>
        )}
      </WorkflowFormSheet>
    </div>
  );
}
