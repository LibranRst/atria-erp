"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AppIcon } from "@/components/ui/icon/app-icon";
import React from "react";

import { SegmentedTabs, type SegmentedTabOption } from "@/components/ui/navigation/segmented-tabs";
import {
  transitionEaseSmooth,
  transitionSpringSmooth,
  transitionSpringSnappy,
} from "@/lib/utils/motion";

export type SearchFilterMode = "filter" | "search";

export function ExclusiveSearchFilterBar<TValue extends string>({
  mode,
  filterValue,
  filterOptions,
  searchValue,
  onFilterChange,
  onSearchChange,
  onModeChange,
  filterAriaLabel,
  searchAriaLabel,
  searchPlaceholder,
  filterLayoutId,
  searchLayoutId,
  fillAvailableSpace = false,
  className = "",
}: {
  readonly mode: SearchFilterMode;
  readonly filterValue: TValue;
  readonly filterOptions: readonly SegmentedTabOption<TValue>[];
  readonly searchValue: string;
  readonly onFilterChange: (value: TValue) => void;
  readonly onSearchChange: (value: string) => void;
  readonly onModeChange: (mode: SearchFilterMode) => void;
  readonly filterAriaLabel: string;
  readonly searchAriaLabel: string;
  readonly searchPlaceholder: string;
  readonly filterLayoutId: string;
  readonly searchLayoutId: string;
  readonly fillAvailableSpace?: boolean;
  readonly className?: string;
}): React.JSX.Element {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const reduceMotion = useReducedMotion();
  const layoutTransition = reduceMotion ? { duration: 0 } : transitionSpringSmooth;
  const contentTransition = reduceMotion ? { duration: 0 } : transitionEaseSmooth;

  React.useEffect(() => {
    if (mode !== "search") return;
    inputRef.current?.focus({ preventScroll: true });
  }, [mode]);

  function closeSearch(): void {
    onSearchChange("");
    onModeChange("filter");
  }

  return (
    <div className={`relative min-h-12 w-full ${className}`} data-control-mode={mode}>
      <AnimatePresence initial={false}>
        {mode === "filter" ? (
          <motion.div
            key="filter-tabs"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={contentTransition}
            className="absolute inset-y-0 right-14 left-0 min-w-0"
          >
            <SegmentedTabs
              value={filterValue}
              options={filterOptions}
              onChange={onFilterChange}
              ariaLabel={filterAriaLabel}
              layoutId={filterLayoutId}
              scrollable
              fillAvailableSpace={fillAvailableSpace}
              density="compact"
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div
        data-search-surface="true"
        layoutId={searchLayoutId}
        initial={false}
        animate={{ width: mode === "search" ? "100%" : 48 }}
        transition={layoutTransition}
        className="absolute inset-y-0 right-0 z-10 overflow-hidden rounded-full bg-white/96 shadow-surface ring-1 ring-ring-subtle focus-within:ring-2 focus-within:ring-focus-ring"
      >
        <AnimatePresence initial={false} mode="sync">
          {mode === "filter" ? (
            <motion.button
              key="search-trigger"
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => onModeChange("search")}
              whileTap={reduceMotion ? undefined : { scale: 0.96 }}
              transition={transitionSpringSnappy}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-full text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              aria-label={`Buka ${searchAriaLabel.toLowerCase()}`}
            >
              <AppIcon name="search" className="icon-md" aria-hidden="true" />
            </motion.button>
          ) : (
            <motion.div
              key="search-field"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={contentTransition}
              className="flex h-12 w-full items-center gap-2 pr-1 pl-4"
            >
              <AppIcon
                name="search"
                className="icon-md shrink-0 text-on-surface-variant"
                aria-hidden="true"
              />
              <input
                ref={inputRef}
                type="search"
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") closeSearch();
                }}
                placeholder={searchPlaceholder}
                aria-label={searchAriaLabel}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-on-surface-variant/55"
              />
              <motion.button
                type="button"
                onClick={closeSearch}
                whileTap={reduceMotion ? undefined : { scale: 0.94 }}
                transition={transitionSpringSnappy}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant outline-none focus-visible:bg-surface-container focus-visible:ring-2 focus-visible:ring-focus-ring"
                aria-label="Tutup pencarian"
              >
                <AppIcon name="close" className="icon-sm" aria-hidden="true" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
