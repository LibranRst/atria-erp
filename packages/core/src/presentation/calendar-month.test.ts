import { describe, expect, test } from "bun:test";
import { buildCalendarMonth, calendarMonthOf, shiftCalendarMonth } from "./calendar-month";

describe("local calendar month", () => {
  test("normalizes a valid day and crosses year boundaries without date rollover", () => {
    expect(calendarMonthOf("2026-12-31")).toBe("2026-12-01");
    expect(shiftCalendarMonth("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftCalendarMonth("2027-01-01", -1)).toBe("2026-12-01");
    expect(shiftCalendarMonth("2026-01-31", 1)).toBe("2026-02-01");
  });

  test("rejects malformed dates, impossible dates and fractional navigation", () => {
    for (const invalid of ["", "2026-02-29", "2026-13-01", "2026-10", "2026-10-03T00:00:00Z"])
      expect(() => calendarMonthOf(invalid)).toThrow(RangeError);
    for (const invalid of [0.5, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => shiftCalendarMonth("2026-10-01", invalid)).toThrow(RangeError);
  });

  test("pads Sunday-first leap-year rows while preserving selected and today independently", () => {
    const calendar = buildCalendarMonth({
      month: "2028-02-29",
      selected: "2028-02-29",
      today: "2028-02-01",
    });
    expect(calendar.label).toBe("Februari 2028");
    expect(calendar.leadingEmpty).toBe(2);
    expect(calendar.rows).toHaveLength(5);
    for (const row of calendar.rows) expect(row).toHaveLength(7);
    expect(calendar.rows[0].slice(0, 2)).toEqual([null, null]);
    const days = calendar.rows.flat().filter((day) => day !== null);
    expect(days).toHaveLength(29);
    expect(days[0]).toMatchObject({ value: "2028-02-01", today: true, selected: false });
    expect(days[28]).toMatchObject({ value: "2028-02-29", selected: true, today: false });
    expect(days[28].label).toBe("Selasa, 29 Februari 2028");
    expect(calendar.rows[4].slice(3)).toEqual([null, null, null, null]);
  });

  test("uses only required rows, including a complete four-week month", () => {
    const calendar = buildCalendarMonth({
      month: "2026-02-01",
      selected: "",
      today: "2026-10-03",
    });
    expect(calendar.leadingEmpty).toBe(0);
    expect(calendar.rows).toHaveLength(4);
    expect(calendar.rows.flat().every((day) => day && !day.selected && !day.today)).toBe(true);
  });

  test("restricts days inclusively and permits navigation only into months intersecting bounds", () => {
    const calendar = buildCalendarMonth({
      month: "2026-10-01",
      selected: "2026-10-10",
      today: "2026-10-03",
      minimumDate: "2026-10-03",
      maximumDate: "2026-11-04",
    });
    const days = calendar.rows.flat().filter((day) => day !== null);
    expect(days[1].disabled).toBe(true);
    expect(days[2].disabled).toBe(false);
    expect(days[30].disabled).toBe(false);
    expect(calendar.previousMonth).toBe("2026-09-01");
    expect(calendar.canPrevious).toBe(false);
    expect(calendar.nextMonth).toBe("2026-11-01");
    expect(calendar.canNext).toBe(true);
    const lastMonth = buildCalendarMonth({
      month: calendar.nextMonth,
      selected: "2026-10-10",
      today: "2026-10-03",
      minimumDate: "2026-10-03",
      maximumDate: "2026-11-04",
    });
    expect(lastMonth.canPrevious).toBe(true);
    expect(lastMonth.canNext).toBe(false);
    expect(lastMonth.rows.flat().filter((day) => day !== null)[4].disabled).toBe(true);
  });

  test("validates bounds and does not silently treat invalid dates as unrestricted", () => {
    const input = { month: "2026-10-01", selected: "", today: "2026-10-03" };
    expect(() => buildCalendarMonth({ ...input, minimumDate: "invalid" })).toThrow(RangeError);
    expect(() => buildCalendarMonth({ ...input, maximumDate: "2026-02-29" })).toThrow(RangeError);
    expect(() =>
      buildCalendarMonth({ ...input, minimumDate: "2026-10-05", maximumDate: "2026-10-04" }),
    ).toThrow(RangeError);
    expect(() => buildCalendarMonth({ ...input, selected: "invalid" })).toThrow(RangeError);
    expect(() => buildCalendarMonth({ ...input, today: "invalid" })).toThrow(RangeError);
  });

  test("keeps chosen dates and month geometry stable across timezone and DST boundaries", () => {
    const script = `
      import { buildCalendarMonth, shiftCalendarMonth } from ${JSON.stringify(`${import.meta.dir}/calendar-month.ts`)};
      import { parseDateOnly } from ${JSON.stringify(`${import.meta.dir}/date-only.ts`)};
      const calendar = buildCalendarMonth({ month: "2026-03-01", selected: "2026-03-08", today: "2026-03-08" });
      const chosen = calendar.rows.flat().find(day => day?.selected);
      process.stdout.write(JSON.stringify({ leading: calendar.leadingEmpty, value: chosen?.value, today: chosen?.today, hour: parseDateOnly(chosen?.value)?.getHours(), shifted: shiftCalendarMonth("2026-03-31", -1) }));
    `;
    for (const timezone of ["UTC", "Asia/Jakarta", "America/Los_Angeles", "Pacific/Kiritimati"]) {
      const result = Bun.spawnSync([process.execPath, "--eval", script], {
        env: { ...process.env, TZ: timezone },
      });
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout.toString())).toEqual({
        leading: 0,
        value: "2026-03-08",
        today: true,
        hour: 12,
        shifted: "2026-02-01",
      });
    }
  });
});
