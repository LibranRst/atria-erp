import type { SelectOption } from "./form-control-types";

export const fieldShell = "min-w-0 space-y-1.5";
export const labelClass =
  "block text-[9px] font-bold uppercase tracking-[0.12em] text-on-surface-variant";
export const helperClass = "text-[10px] leading-4 text-on-surface-variant";
export const errorClass = "text-[10px] font-semibold leading-4 text-error";
export const controlClass =
  "min-h-12 w-full min-w-0 rounded-2xl border border-outline-variant/35 bg-surface-container-low px-3 text-sm font-semibold text-on-surface outline-none transition focus:border-outline focus:ring-0 disabled:cursor-not-allowed disabled:opacity-55";

/**
 * Gabung kelas apa adanya, tanpa menyelesaikan konflik Tailwind — kelas terakhir
 * TIDAK otomatis menang. Pakai ini saat kelasnya sudah dipastikan tidak
 * bertabrakan.
 *
 * Untuk menimpa kelas yang mungkin bentrok (misalnya `className` dari pemanggil
 * yang harus mengalahkan default komponen), pakai `cn` di `lib/utils/cn.ts`
 * yang menjalankan `twMerge`. Keduanya sengaja dibiarkan terpisah: menukar yang
 * satu dengan yang lain mengubah hasil render pada kelas yang bertabrakan.
 */
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
  let cleaned = value.replace(/[^\d.,]/g, "").replace(",", ".");

  // Discard extra decimal points, keeping only the first one
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    cleaned = parts[0] + "." + parts.slice(1).join("");
  }

  // Prepend "0" if user types a decimal point first (e.g. ".5" -> "0.5")
  if (cleaned.startsWith(".")) {
    cleaned = "0" + cleaned;
  }

  // Strip unwanted leading zeros (e.g. "01" -> "1", "00" -> "0", "00.5" -> "0.5")
  // Keep single "0" or decimal fractions starting with "0."
  if (cleaned.length > 1 && cleaned.startsWith("0") && !cleaned.startsWith("0.")) {
    cleaned = cleaned.replace(/^0+/, "");
    if (cleaned === "" || cleaned.startsWith(".")) {
      cleaned = "0" + cleaned;
    }
  }

  return cleaned;
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

export function parseIsoDate(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function selectedOptionLabel(options: readonly SelectOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? "";
}
