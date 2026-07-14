import type { SelectOption } from "./form-control-types";

export const fieldShell = "min-w-0 space-y-1.5";
export const labelClass =
  "ml-1 block text-[9px] font-bold uppercase tracking-[0.12em] text-on-surface-variant";
export const helperClass = "ml-1 text-[10px] leading-4 text-on-surface-variant";
export const errorClass = "ml-1 text-[10px] font-semibold leading-4 text-error";
export const controlClass =
  "min-h-12 w-full min-w-0 rounded-2xl border border-outline-variant/35 bg-surface-container-low px-3 text-sm font-semibold text-on-surface outline-none transition focus:border-outline focus:ring-0 disabled:cursor-not-allowed disabled:opacity-55";

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function fieldAdornment(required?: boolean, optional?: boolean): string {
  if (required) return "Wajib";
  if (optional) return "Opsional";
  return "";
}

export function toNumberString(value: string | number): string {
  return typeof value === "number" ? String(value) : value;
}

export function decimalValue(value: string): string {
  return value.replace(/[^\d.,]/g, "").replace(",", ".");
}

export function formatDateLabel(value: string): string {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function selectedOptionLabel(
  options: readonly SelectOption[],
  value: string,
): string {
  return options.find((option) => option.value === value)?.label ?? "";
}
