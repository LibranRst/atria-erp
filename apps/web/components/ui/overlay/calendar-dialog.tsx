"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AppIcon } from "@/components/ui/icon/app-icon";
import { formatIsoDate } from "@atria/core/utils/date";
import { cx, parseIsoDate } from "../form/form-control-utils";
import { transitionEaseSmooth } from "@/lib/utils/motion";
import { DialogFrame } from "./dialog-frame";
import { Button, IconButton } from "../button/button";
import { useWorkspaceControlPresentation } from "@/lib/navigation/workspace-presentation";

const DAYS_HEADER = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"] as const;

export type CalendarDialogProps = {
  readonly open: boolean;
  readonly title?: string;
  readonly value?: string;
  readonly onChange?: (isoDate: string) => void;
  readonly onClose: () => void;
  readonly minDate?: string;
  readonly maxDate?: string;
  readonly children?: React.ReactNode;
  readonly returnFocusRef?: React.RefObject<HTMLElement | null>;
};

export function CalendarDialog({
  open,
  title = "Pilih Tanggal",
  value,
  onChange,
  onClose,
  minDate,
  maxDate,
  children,
  returnFocusRef,
}: CalendarDialogProps): React.JSX.Element | null {
  const todayIso = formatIsoDate(new Date());
  const todayDisabled = Boolean((minDate && todayIso < minDate) || (maxDate && todayIso > maxDate));

  function selectIsoDate(isoDate: string): void {
    onChange?.(isoDate);
    onClose();
  }

  return (
    <DialogFrame
      open={open}
      title={title}
      returnFocusRef={returnFocusRef}
      presentation="calendar"
      onClose={onClose}
    >
      <CalendarContent
        title={title}
        value={value}
        todayDisabled={todayDisabled}
        onSelectToday={() => selectIsoDate(todayIso)}
        onChange={selectIsoDate}
        onClose={onClose}
        minDate={minDate}
        maxDate={maxDate}
      >
        {children}
      </CalendarContent>
    </DialogFrame>
  );
}

function CalendarContent({
  title,
  value,
  todayDisabled,
  onSelectToday,
  onChange,
  onClose,
  minDate,
  maxDate,
  children,
}: {
  readonly title: string;
  readonly value?: string;
  readonly todayDisabled: boolean;
  readonly onSelectToday: () => void;
  readonly onChange: (isoDate: string) => void;
  readonly onClose: () => void;
  readonly minDate?: string;
  readonly maxDate?: string;
  readonly children?: React.ReactNode;
}): React.JSX.Element {
  const desktop = useWorkspaceControlPresentation() === "desktop";
  const gridContentRef = React.useRef<HTMLDivElement>(null);
  const dayButtonRefs = React.useRef(new Map<string, HTMLButtonElement>());
  const [measuredGridHeight, setMeasuredGridHeight] = React.useState<number | null>(null);
  const reduceMotion = useReducedMotion();

  const parsed = parseIsoDate(value ?? "");
  const initialFocusDate = parsed ?? new Date();
  const [viewDate, setViewDate] = React.useState<Date>(() => initialFocusDate);
  const [focusedIso, setFocusedIso] = React.useState(() => formatIsoDate(initialFocusDate));

  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const blanks = monthStart.getDay();
  const monthLabel = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(viewDate);

  const selectedIso = parsed ? formatIsoDate(parsed) : (value ?? "");
  const todayIso = formatIsoDate(new Date());

  React.useLayoutEffect(() => {
    const grid = gridContentRef.current;
    if (!grid) return undefined;

    function measure(): void {
      const el = gridContentRef.current;
      if (!el) return;
      const nextHeight = el.scrollHeight;
      if (!nextHeight) return;
      setMeasuredGridHeight((current) =>
        current !== null && Math.abs(current - nextHeight) < 1 ? current : nextHeight,
      );
    }

    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [viewDate]);

  function handlePrevMonth(): void {
    moveFocusedDateByMonth(-1);
  }

  function handleNextMonth(): void {
    moveFocusedDateByMonth(1);
  }

  function handleSelectDate(day: number): void {
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const iso = formatIsoDate(date);
    onChange(iso);
  }

  function clampToBounds(date: Date): Date {
    const iso = formatIsoDate(date);
    if (minDate && iso < minDate) return parseIsoDate(minDate) ?? date;
    if (maxDate && iso > maxDate) return parseIsoDate(maxDate) ?? date;
    return date;
  }

  function focusDate(date: Date): void {
    const next = clampToBounds(date);
    const iso = formatIsoDate(next);
    setFocusedIso(iso);
    if (next.getFullYear() !== viewDate.getFullYear() || next.getMonth() !== viewDate.getMonth()) {
      setViewDate(new Date(next.getFullYear(), next.getMonth(), 1));
    }
  }

  function moveFocusedDateByMonth(offset: number): void {
    const current = parseIsoDate(focusedIso) ?? viewDate;
    const targetMonthStart = new Date(current.getFullYear(), current.getMonth() + offset, 1);
    const targetMonthDays = new Date(
      targetMonthStart.getFullYear(),
      targetMonthStart.getMonth() + 1,
      0,
    ).getDate();
    focusDate(
      new Date(
        targetMonthStart.getFullYear(),
        targetMonthStart.getMonth(),
        Math.min(current.getDate(), targetMonthDays),
      ),
    );
  }

  function handleDateKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, date: Date): void {
    let nextDate: Date | null = null;
    if (event.key === "ArrowLeft")
      nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
    else if (event.key === "ArrowRight")
      nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    else if (event.key === "ArrowUp")
      nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 7);
    else if (event.key === "ArrowDown")
      nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7);
    else if (event.key === "Home")
      nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
    else if (event.key === "End")
      nextDate = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() + (6 - date.getDay()),
      );
    else if (event.key === "PageUp") {
      event.preventDefault();
      moveFocusedDateByMonth(-1);
      return;
    } else if (event.key === "PageDown") {
      event.preventDefault();
      moveFocusedDateByMonth(1);
      return;
    }

    if (!nextDate) return;
    event.preventDefault();
    focusDate(nextDate);
  }

  React.useEffect(() => {
    dayButtonRefs.current.get(focusedIso)?.focus({ preventScroll: true });
  }, [focusedIso, viewDate]);

  return (
    <>
      <div className="flex items-center justify-between px-2 pt-2 pb-3">
        <span className="text-sm font-bold text-on-surface">{title}</span>
        {desktop ? (
          <Button
            type="button"
            size="compact"
            variant="secondary"
            disabled={todayDisabled}
            onClick={onSelectToday}
          >
            Hari Ini
          </Button>
        ) : (
          <button
            type="button"
            disabled={todayDisabled}
            onClick={onSelectToday}
            className="rounded-full bg-surface-container-lowest px-3 py-1 text-xs font-semibold text-accent transition-all hover:bg-surface-container active:z-10 active:scale-[1.05] active:shadow-raised disabled:opacity-45"
          >
            Hari Ini
          </button>
        )}
      </div>

      <div className="rounded-3xl bg-surface-container-lowest shadow-surface">
        {/* Month Navigation */}
        <div className="flex items-center justify-between px-2 py-2">
          {desktop ? (
            <IconButton
              size="compact"
              label="Bulan sebelumnya"
              icon={<AppIcon name="chevron_left" className="icon-sm" />}
              onClick={handlePrevMonth}
            />
          ) : (
            <button
              type="button"
              onClick={handlePrevMonth}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-low text-on-surface transition-all outline-none hover:bg-surface-container-low/50 focus-visible:ring-2 focus-visible:ring-focus-ring active:z-10 active:scale-[1.05] active:shadow-raised"
              aria-label="Bulan sebelumnya"
            >
              <AppIcon name="chevron_left" className="icon-sm" />
            </button>
          )}
          <span className="text-row font-bold text-on-surface capitalize">{monthLabel}</span>
          {desktop ? (
            <IconButton
              size="compact"
              label="Bulan berikutnya"
              icon={<AppIcon name="chevron_right" className="icon-sm" />}
              onClick={handleNextMonth}
            />
          ) : (
            <button
              type="button"
              onClick={handleNextMonth}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-low text-on-surface transition-all outline-none hover:bg-surface-container-low/50 focus-visible:ring-2 focus-visible:ring-focus-ring active:z-10 active:scale-[1.05] active:shadow-raised"
              aria-label="Bulan berikutnya"
            >
              <AppIcon name="chevron_right" className="icon-sm" />
            </button>
          )}
        </div>

        {/* Custom Children (if provided) or Default Grid */}
        {children ? (
          <div className="px-2 py-2">{children}</div>
        ) : (
          <div className="px-2 py-2">
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 text-center text-eyebrow font-bold tracking-wider text-on-surface-variant/75 uppercase">
              {DAYS_HEADER.map((day) => (
                <span key={day} className="py-1">
                  {day}
                </span>
              ))}
            </div>

            {/* Smoothly Animated Grid Area */}
            <motion.div
              animate={{ height: measuredGridHeight ?? "auto" }}
              transition={reduceMotion ? { duration: 0 } : transitionEaseSmooth}
              className="overflow-hidden"
            >
              <div
                ref={gridContentRef}
                role="grid"
                aria-label={monthLabel}
                className="grid grid-cols-7 gap-1 pt-1"
              >
                {Array.from({ length: blanks }).map((_, index) => (
                  <span key={`blank-${index}`} className="aspect-square" aria-hidden="true" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, index) => {
                  const day = index + 1;
                  const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
                  const iso = formatIsoDate(date);
                  const active = iso === selectedIso;
                  const isToday = iso === todayIso;

                  const isBeforeMin = minDate ? iso < minDate : false;
                  const isAfterMax = maxDate ? iso > maxDate : false;
                  const isDisabled = isBeforeMin || isAfterMax;

                  return (
                    <button
                      key={iso}
                      ref={(node) => {
                        if (node) dayButtonRefs.current.set(iso, node);
                        else dayButtonRefs.current.delete(iso);
                      }}
                      type="button"
                      role="gridcell"
                      disabled={isDisabled}
                      onClick={() => handleSelectDate(day)}
                      onFocus={() => setFocusedIso(iso)}
                      onKeyDown={(event) => handleDateKeyDown(event, date)}
                      tabIndex={iso === focusedIso ? 0 : -1}
                      data-dialog-autofocus={iso === focusedIso ? "true" : undefined}
                      aria-selected={active}
                      aria-label={new Intl.DateTimeFormat("id-ID", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }).format(date)}
                      className={cx(
                        "flex aspect-square items-center justify-center rounded-full text-sm font-bold transition-all outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:z-10 active:scale-[1.05]",
                        isDisabled && "cursor-not-allowed opacity-30",
                        active
                          ? "bg-primary text-on-primary shadow-xs"
                          : isToday
                            ? "bg-surface-container-low font-extrabold text-accent ring-1 ring-accent/40"
                            : "text-on-surface hover:bg-surface-container-low",
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}

        <div className="px-2 pt-3 pb-2">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-10 w-full items-center justify-center rounded-full bg-surface-container-low text-xs font-semibold text-on-surface transition-all hover:bg-surface-container active:z-10 active:scale-[1.05] active:shadow-raised"
          >
            Batal
          </button>
        </div>
      </div>
    </>
  );
}
