"use client";

import type { JSX, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";

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
};

export function SegmentedTabs<TValue extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
  layoutId,
  scrollable = false,
}: SegmentedTabsProps<TValue>): JSX.Element {
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();
  const [overflow, setOverflow] = useState({ left: false, right: false });
  const activeLayoutId =
    layoutId ??
    `segmented-tabs-active-${ariaLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  useEffect(() => {
    if (!scrollable) return;
    activeButtonRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [reduceMotion, scrollable, value]);

  const updateOverflow = useCallback((): void => {
    const node = scrollRef.current;
    if (!node) return;
    setOverflow({
      left: node.scrollLeft > 4,
      right: node.scrollLeft + node.clientWidth < node.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    if (!scrollable) return undefined;
    const node = scrollRef.current;
    updateOverflow();
    node?.addEventListener("scroll", updateOverflow, { passive: true });
    window.addEventListener("resize", updateOverflow);
    return () => {
      node?.removeEventListener("scroll", updateOverflow);
      window.removeEventListener("resize", updateOverflow);
    };
  }, [options.length, scrollable, updateOverflow]);

  const tabButtons = options.map((option) => {
    const active = value === option.value;
    return (
      <button
        key={option.value}
        ref={active ? activeButtonRef : undefined}
        type="button"
        role="tab"
        aria-selected={active}
        disabled={option.disabled}
        onClick={() => onChange(option.value)}
        className={`relative flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-bold outline-none transition-colors active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40 ${
          scrollable
            ? "h-10 shrink-0 whitespace-nowrap px-4"
            : "min-w-0 flex-1 px-2"
        } ${
          active
            ? "text-on-primary"
            : "text-on-surface-variant hover:text-on-surface"
        }`}
      >
        {active && (
          <motion.span
            layoutId={activeLayoutId}
            className="absolute inset-0 rounded-full bg-primary shadow-sm"
            transition={transitionSpringBouncy}
          />
        )}
        <span className="relative z-10 inline-flex min-w-0 items-center justify-center gap-1.5">
          {option.icon}
          <span className="truncate">
            {option.label}
            {typeof option.count === "number" ? ` (${option.count})` : ""}
          </span>
        </span>
      </button>
    );
  });

  if (scrollable) {
    return (
      <div className={`relative w-full overflow-hidden rounded-full border border-outline-variant/10 bg-surface-container-low p-1 ${className}`}>
        <div ref={scrollRef} className="overflow-x-auto rounded-full no-scrollbar">
          <LayoutGroup id={activeLayoutId}>
            <div
              className="flex w-max min-w-full select-none rounded-full"
              role="tablist"
              aria-label={ariaLabel}
            >
              {tabButtons}
            </div>
          </LayoutGroup>
        </div>
        {overflow.left ? (
          <span className="pointer-events-none absolute inset-y-1 left-1 w-7 rounded-l-full bg-gradient-to-r from-surface-container-low via-surface-container-low/90 to-transparent" />
        ) : null}
        {overflow.right ? (
          <span className="pointer-events-none absolute inset-y-1 right-1 w-7 rounded-r-full bg-gradient-to-l from-surface-container-low via-surface-container-low/90 to-transparent" />
        ) : null}
      </div>
    );
  }

  return (
    <div className={className}>
      <LayoutGroup id={activeLayoutId}>
        <div
          className="flex w-full select-none rounded-full border border-outline-variant/10 bg-surface-container-low p-1"
          role="tablist"
          aria-label={ariaLabel}
        >
          {tabButtons}
        </div>
      </LayoutGroup>
    </div>
  );
}
