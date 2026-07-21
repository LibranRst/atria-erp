"use client";

import type { JSX, ReactNode } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { transitionSpringBouncy } from "@/lib/utils/motion";

export type SegmentedTabOption<TValue extends string> = {
  readonly value: TValue;
  readonly label: string;
  readonly count?: number;
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
};

type SegmentedTabsProps<TValue extends string> = {
  readonly value: TValue;
  readonly options: readonly SegmentedTabOption<TValue>[];
  readonly onChange: (value: TValue) => void;
  readonly ariaLabel: string;
  readonly className?: string;
  readonly layoutId?: string;
  readonly scrollable?: boolean;
  readonly fillAvailableSpace?: boolean;
  readonly animated?: boolean;
  readonly density?: "default" | "compact";
};

export function calculateCenteredScrollLeft({
  itemLeft,
  itemWidth,
  viewportWidth,
  scrollWidth,
}: {
  readonly itemLeft: number;
  readonly itemWidth: number;
  readonly viewportWidth: number;
  readonly scrollWidth: number;
}): number {
  const centered = itemLeft - (viewportWidth - itemWidth) / 2;
  return Math.min(Math.max(centered, 0), Math.max(scrollWidth - viewportWidth, 0));
}

export function shouldContainSegmentedTabWheel(deltaY: number): boolean {
  return deltaY !== 0;
}

export function SegmentedTabs<TValue extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
  layoutId,
  scrollable = false,
  fillAvailableSpace = false,
  animated = true,
  density = "default",
}: SegmentedTabsProps<TValue>): JSX.Element {
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const tabListRef = useRef<HTMLDivElement | null>(null);
  const [indicatorMetrics, setIndicatorMetrics] = useState({
    left: 0,
    width: 0,
  });
  const reduceMotion = useReducedMotion();
  const activeLayoutId =
    layoutId ?? `segmented-tabs-active-${ariaLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const optionSignature = options
    .map((option) => `${option.value}:${option.label}:${option.count ?? ""}`)
    .join("|");

  const updateIndicatorMetrics = useCallback((): void => {
    const activeButton = activeButtonRef.current;
    if (!activeButton) return;
    const nextMetrics = {
      left: activeButton.offsetLeft,
      width: activeButton.offsetWidth,
    };
    setIndicatorMetrics((current) =>
      current.left === nextMetrics.left && current.width === nextMetrics.width
        ? current
        : nextMetrics,
    );
  }, []);

  useLayoutEffect(() => {
    updateIndicatorMetrics();
  }, [optionSignature, updateIndicatorMetrics, value]);

  useEffect(() => {
    const tabList = tabListRef.current;
    const activeButton = activeButtonRef.current;
    if (!tabList || !activeButton) return;

    const observer = new ResizeObserver(updateIndicatorMetrics);
    observer.observe(tabList);
    observer.observe(activeButton);
    window.addEventListener("resize", updateIndicatorMetrics);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateIndicatorMetrics);
    };
  }, [updateIndicatorMetrics, value]);

  useEffect(() => {
    if (!scrollable) return;
    const scroller = scrollRef.current;
    const activeButton = activeButtonRef.current;
    if (!scroller || !activeButton) return;

    scroller.scrollTo({
      left: calculateCenteredScrollLeft({
        itemLeft: activeButton.offsetLeft,
        itemWidth: activeButton.offsetWidth,
        viewportWidth: scroller.clientWidth,
        scrollWidth: scroller.scrollWidth,
      }),
      behavior: reduceMotion || !animated ? "auto" : "smooth",
    });
  }, [animated, reduceMotion, scrollable, value]);

  useEffect(() => {
    if (!scrollable) return;
    const scroller = scrollRef.current;
    if (!scroller) return;

    const containWheelGesture = (event: WheelEvent): void => {
      if (!shouldContainSegmentedTabWheel(event.deltaY)) return;
      event.preventDefault();
      if (event.deltaX !== 0) scroller.scrollLeft += event.deltaX;
    };

    scroller.addEventListener("wheel", containWheelGesture, { passive: false });
    return () => scroller.removeEventListener("wheel", containWheelGesture);
  }, [scrollable]);

  const tabButtons = options.map((option) => {
    const active = value === option.value;
    const compact = density === "compact";
    return (
      <button
        key={option.value}
        ref={active ? activeButtonRef : undefined}
        type="button"
        role="tab"
        aria-selected={active}
        disabled={option.disabled}
        onClick={() => onChange(option.value)}
        className={`focus-visible:ring-primary/30 relative flex items-center justify-center rounded-full font-bold outline-none focus-visible:ring-2 disabled:opacity-40 ${compact ? "h-10 min-h-10 gap-1 px-3 py-1.5 text-[11px] after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']" : "min-h-12 gap-1.5 py-2 text-xs"} ${animated ? "transition-colors active:scale-[0.98]" : ""} ${
          scrollable
            ? fillAvailableSpace
              ? compact
                ? "min-w-max flex-1 px-3 whitespace-nowrap"
                : "min-w-max flex-1 px-4 whitespace-nowrap"
              : compact
                ? "shrink-0 px-3 whitespace-nowrap"
                : "shrink-0 px-4 whitespace-nowrap"
            : compact
              ? "min-w-0 flex-1"
              : "min-w-0 flex-1 px-2"
        } ${active ? "text-on-primary" : "text-on-surface-variant hover:text-on-surface"}`}
      >
        <span className="relative z-10 inline-flex min-w-0 items-center justify-center gap-1.5">
          {option.icon}
          <span className="truncate">{option.label}</span>
          {typeof option.count === "number" ? (
            <span
              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full p-0 font-mono leading-none font-black ${option.count > 99 ? "text-[7px]" : "text-[8px]"} ${compact ? "max-[430px]:h-[18px] max-[430px]:w-[18px] max-[430px]:text-[7px]" : ""} ${active ? "bg-white/18 text-white" : "bg-error-container/55 text-error"}`}
            >
              {option.count > 99 ? "99+" : option.count}
            </span>
          ) : null}
        </span>
      </button>
    );
  });

  if (scrollable) {
    return (
      <div
        className={`border-outline-variant/10 bg-surface-container-low relative w-full overflow-hidden rounded-full border p-1 ${className}`}
      >
        <div
          ref={scrollRef}
          className="no-scrollbar touch-pan-x overflow-x-auto overscroll-x-contain rounded-full"
        >
          <div
            ref={tabListRef}
            className="relative flex w-max min-w-full overflow-hidden rounded-full select-none"
            role="tablist"
            aria-label={ariaLabel}
            data-indicator-id={activeLayoutId}
          >
            <motion.span
              initial={false}
              animate={indicatorMetrics}
              transition={reduceMotion || !animated ? { duration: 0 } : transitionSpringBouncy}
              className="bg-primary pointer-events-none absolute inset-y-0 rounded-full shadow-sm"
              aria-hidden="true"
            />
            {tabButtons}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        ref={tabListRef}
        className="border-outline-variant/10 bg-surface-container-low relative flex w-full overflow-hidden rounded-full border p-1 select-none"
        role="tablist"
        aria-label={ariaLabel}
        data-indicator-id={activeLayoutId}
      >
        <motion.span
          initial={false}
          animate={indicatorMetrics}
          transition={reduceMotion || !animated ? { duration: 0 } : transitionSpringBouncy}
          className="bg-primary pointer-events-none absolute inset-y-1 rounded-full shadow-sm"
          aria-hidden="true"
        />
        {tabButtons}
      </div>
    </div>
  );
}
