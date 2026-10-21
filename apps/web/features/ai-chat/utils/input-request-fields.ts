import type { InputField, RequestUserInputPayload } from "@atria/core/ai/input-request";
import { inputFieldVisible } from "@atria/core/ai/input-request-flow";

export type WizardProgress = {
  readonly values: Readonly<Record<string, string>>;
  readonly currentStep: number;
  readonly furthestStep: number;
};
export function initialWizardProgress(payload: RequestUserInputPayload): WizardProgress {
  return {
    values: Object.fromEntries(
      payload.fields.map((field) => [field.key, field.defaultValue ?? ""]),
    ),
    currentStep: 0,
    furthestStep: 0,
  };
}
export function fieldNoun(label: string): string {
  return label.replace(/^(pilih|masukkan|isi|ketik)\s+/i, "").toLowerCase();
}
export function formatFieldValue(field: InputField, raw: string): string {
  if (!raw) return "";
  if (field.type === "currency") return "Rp " + Number(raw).toLocaleString("id-ID");
  if (field.type === "select")
    return field.options?.find((option) => option.value === raw)?.label ?? raw;
  return raw;
}
export function isFieldValid(field: InputField, raw: string): boolean {
  if (!raw.trim()) return field.required === false;
  if (field.type === "currency" || field.type === "number") {
    const number = Number(raw);
    return Number.isFinite(number) && (field.required === false ? number >= 0 : number > 0);
  }
  if (field.type === "select")
    return Boolean(field.options?.some((option) => option.value === raw));
  if (field.type === "date")
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(raw) &&
      !Number.isNaN(Date.parse(raw)) &&
      new Date(raw).toISOString().slice(0, 10) === raw
    );
  return true;
}
export function validationMessageFor(field: InputField): string {
  if (field.type === "currency") return "Masukkan nominal lebih dari Rp 0.";
  if (field.type === "number") return "Masukkan angka lebih dari 0.";
  if (field.type === "select") return "Pilih " + fieldNoun(field.label) + " terlebih dahulu.";
  if (field.type === "date") return "Pilih tanggal terlebih dahulu.";
  return "Isi " + fieldNoun(field.label) + " terlebih dahulu.";
}
export function nextStepAfter(
  currentStep: number,
  _furthestStep: number,
  totalSteps: number,
): number | "submit" {
  if (currentStep < totalSteps - 1) return currentStep + 1;
  return "submit";
}
export function buildSubmissionMessage(
  payload: RequestUserInputPayload,
  values: Readonly<Record<string, string>>,
): string {
  return [
    "Berikut data untuk " + payload.actionTitle + ":",
    ...payload.fields
      .filter((field) => inputFieldVisible(field, values))
      .map((field) => "- " + field.label + ": " + formatFieldValue(field, values[field.key] ?? "")),
  ].join("\n");
}
