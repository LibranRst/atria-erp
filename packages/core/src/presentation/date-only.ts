/** Interpret calendar dates locally, without a UTC offset shifting the chosen day. */
export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

export function formatDateOnly(value: Date): string {
  return `${String(value.getFullYear()).padStart(4, "0")}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function clampDateOnly(value: string, minimum?: string, maximum?: string): string {
  const valid = parseDateOnly(value);
  if (!valid) return "";
  const min = minimum && parseDateOnly(minimum) ? minimum : undefined;
  const max = maximum && parseDateOnly(maximum) ? maximum : undefined;
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
}
