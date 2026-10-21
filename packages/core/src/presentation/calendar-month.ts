import { formatDateOnly, parseDateOnly } from "./date-only";

export type CalendarDay = {
  readonly value: string;
  readonly day: number;
  readonly label: string;
  readonly selected: boolean;
  readonly today: boolean;
  readonly disabled: boolean;
};

export type CalendarMonthInput = {
  readonly month: string;
  readonly selected: string;
  readonly today: string;
  readonly minimumDate?: string;
  readonly maximumDate?: string;
};

export type CalendarMonth = {
  readonly label: string;
  readonly leadingEmpty: number;
  readonly rows: readonly (readonly (CalendarDay | null)[])[];
  readonly previousMonth: string;
  readonly nextMonth: string;
  readonly canPrevious: boolean;
  readonly canNext: boolean;
};

function requireDate(value: string): Date {
  const date = parseDateOnly(value);
  if (!date) throw new RangeError(`Invalid calendar date: ${value}`);
  return date;
}

function monthEnd(month: string): string {
  const date = requireDate(month);
  date.setMonth(date.getMonth() + 1, 0);
  return formatDateOnly(date);
}

/** A local calendar month is represented by its first day, never a UTC timestamp. */
export function calendarMonthOf(value: string): string {
  const date = requireDate(value);
  date.setDate(1);
  return formatDateOnly(date);
}

export function shiftCalendarMonth(month: string, offset: number): string {
  if (!Number.isSafeInteger(offset)) throw new RangeError("Month offset must be a safe integer.");
  const date = requireDate(calendarMonthOf(month));
  date.setMonth(date.getMonth() + offset);
  const shifted = formatDateOnly(date);
  requireDate(shifted);
  return shifted;
}

export function buildCalendarMonth({
  month,
  selected,
  today,
  minimumDate,
  maximumDate,
}: CalendarMonthInput): CalendarMonth {
  const firstDay = calendarMonthOf(month);
  const firstDate = requireDate(firstDay);
  if (selected) requireDate(selected);
  requireDate(today);
  if (minimumDate !== undefined) requireDate(minimumDate);
  if (maximumDate !== undefined) requireDate(maximumDate);
  if (minimumDate && maximumDate && minimumDate > maximumDate)
    throw new RangeError("Minimum calendar date must not follow maximum date.");

  const previousMonth = shiftCalendarMonth(firstDay, -1);
  const nextMonth = shiftCalendarMonth(firstDay, 1);
  const intersectsBounds = (candidate: string): boolean =>
    (!minimumDate || monthEnd(candidate) >= minimumDate) &&
    (!maximumDate || candidate <= maximumDate);
  const leadingEmpty = firstDate.getDay();
  const finalDate = requireDate(monthEnd(firstDay));
  const dayCount = finalDate.getDate();
  const cellCount = Math.ceil((leadingEmpty + dayCount) / 7) * 7;
  const rows: (CalendarDay | null)[][] = [];
  const labelFormatter = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  for (let cell = 0; cell < cellCount; cell += 1) {
    if (cell % 7 === 0) rows.push([]);
    const row = rows[rows.length - 1];
    const day = cell - leadingEmpty + 1;
    if (day < 1 || day > dayCount) {
      row.push(null);
      continue;
    }
    const date = requireDate(firstDay);
    date.setDate(day);
    const value = formatDateOnly(date);
    row.push({
      value,
      day,
      label: labelFormatter.format(date),
      selected: value === selected,
      today: value === today,
      disabled: Boolean(
        (minimumDate && value < minimumDate) || (maximumDate && value > maximumDate),
      ),
    });
  }

  return {
    label: new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(firstDate),
    leadingEmpty,
    rows,
    previousMonth,
    nextMonth,
    canPrevious: intersectsBounds(previousMonth),
    canNext: intersectsBounds(nextMonth),
  };
}
