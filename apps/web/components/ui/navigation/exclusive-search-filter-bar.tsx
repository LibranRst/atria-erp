"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AppIcon } from "@/components/ui/icon/app-icon";
import React from "react";

import { SegmentedTabs, type SegmentedTabOption } from "@/components/ui/navigation/segmented-tabs";
import {
  transitionEaseSmooth,
  transitionSpringSmooth,
  transitionSpringSnappy,
} from "@/lib/utils/motion";

export type SearchFilterMode = "filter" | "search";

type SearchSurfaceGeometry = {
  readonly railWidth: number;
  readonly triggerWidth: number;
  readonly triggerX: number;
};

function useSearchSurfaceGeometry(
  railRef: React.RefObject<HTMLDivElement | null>,
  triggerAnchorRef: React.RefObject<HTMLSpanElement | null>,
): SearchSurfaceGeometry | null {
  const [geometry, setGeometry] = React.useState<SearchSurfaceGeometry | null>(null);

  React.useLayoutEffect(() => {
    function measure(): void {
      const railElement = railRef.current;
      const triggerElement = triggerAnchorRef.current;
      if (!railElement || !triggerElement) return;
      const railRect = railElement.getBoundingClientRect();
      const triggerRect = triggerElement.getBoundingClientRect();
      const next = {
        railWidth: railRect.width,
        triggerWidth: triggerRect.width,
        triggerX: triggerRect.left - railRect.left,
      };
      setGeometry((current) =>
        current &&
        Math.abs(current.railWidth - next.railWidth) < 0.25 &&
        Math.abs(current.triggerWidth - next.triggerWidth) < 0.25 &&
        Math.abs(current.triggerX - next.triggerX) < 0.25
          ? current
          : next,
      );
    }

    measure();
    const railElement = railRef.current;
    const triggerElement = triggerAnchorRef.current;
    if (!railElement || !triggerElement) return undefined;
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(railElement);
    observer.observe(triggerElement);
    return () => observer.disconnect();
  }, [railRef, triggerAnchorRef]);

  return geometry;
}

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
  endControl,
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
  readonly endControl?: React.ReactNode;
  readonly fillAvailableSpace?: boolean;
  readonly className?: string;
}): React.JSX.Element {
  const railRef = React.useRef<HTMLDivElement | null>(null);
  const triggerAnchorRef = React.useRef<HTMLSpanElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const previousModeRef = React.useRef<SearchFilterMode>(mode);
  const geometry = useSearchSurfaceGeometry(railRef, triggerAnchorRef);
  const reduceMotion = useReducedMotion();

  /*
   * Penempatan pertama tidak boleh dianimasikan.
   *
   * Geometri baru diketahui setelah pengukuran, jadi render pertama memakai
   * nilai cadangan `calc(100% - 48px)`. Ketika hasil ukur masuk, Framer melihat
   * `x` berpindah dari string `calc(...)` ke angka — dua satuan yang tidak bisa
   * diinterpolasi, sehingga ia memulai dari 0 dan tombol pencarian terlihat
   * melayang dari tepi kiri ke tempatnya setiap kali panel ini muncul.
   *
   * Commit pertama setelah pengukuran karena itu dibuat seketika; perpindahan
   * mode sesudahnya tetap beranimasi seperti biasa.
   */
  const layoutTransition = reduceMotion ? { duration: 0 } : transitionSpringSmooth;
  const contentTransition = reduceMotion ? { duration: 0 } : transitionEaseSmooth;

  React.useEffect(() => {
    const previousMode = previousModeRef.current;
    previousModeRef.current = mode;
    const animationFrame = window.requestAnimationFrame(() => {
      if (mode === "search") inputRef.current?.focus({ preventScroll: true });
      else if (previousMode === "search") triggerRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [mode]);

  function closeSearch(): void {
    onSearchChange("");
    onModeChange("filter");
  }

  return (
    <div ref={railRef} className={`relative min-h-12 w-full ${className}`} data-control-mode={mode}>
      <motion.div
        initial={false}
        animate={{ opacity: mode === "filter" ? 1 : 0 }}
        transition={contentTransition}
        aria-hidden={mode === "search"}
        inert={mode === "search"}
        className={`absolute inset-0 flex min-w-0 items-center gap-2 ${mode === "search" ? "pointer-events-none" : ""}`}
      >
        <div className="min-w-0 flex-1">
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
        </div>
        <span ref={triggerAnchorRef} className="block h-12 w-12 shrink-0" aria-hidden="true" />
        {endControl ? <div className="shrink-0">{endControl}</div> : null}
      </motion.div>

      {/*
       * `key` berpindah sekali ketika hasil ukur pertama masuk, sehingga
       * elemennya dipasang ulang langsung pada posisi akhirnya.
       *
       * Gerbang berbasis state tidak bisa dipakai di sini: `setState` yang
       * dipanggil saat render di-flush SEBELUM commit, jadi render yang
       * benar-benar tergambar sudah membawa nilai barunya — gerbangnya selalu
       * terlambat satu langkah. Pemasangan ulang plus `initial={false}` tidak
       * bergantung pada urutan itu sama sekali.
       */}
      <motion.div
        key={geometry === null ? "unmeasured" : "measured"}
        data-search-surface="true"
        data-search-layout-id={searchLayoutId}
        initial={false}
        /*
         * Tanpa hasil ukur, posisinya TIDAK ditebak.
         *
         * Nilai cadangan sebelumnya `calc(100% - 104px)` terlihat masuk akal
         * tetapi salah: di dalam `x`, `100%` dihitung terhadap lebar elemen itu
         * sendiri (48 px), bukan lebar rel — sehingga hasilnya −56 px, jauh di
         * kiri. Dari sanalah tombol pencarian terlihat melayang ke tempatnya.
         *
         * Pengukuran terjadi di `useLayoutEffect`, jadi keadaan tak-terukur ini
         * tidak pernah sempat tergambar.
         */
        animate={{
          x: geometry === null ? 0 : mode === "search" ? 0 : geometry.triggerX,
          width:
            geometry === null ? 48 : mode === "search" ? geometry.railWidth : geometry.triggerWidth,
          opacity: geometry === null ? 0 : 1,
        }}
        transition={layoutTransition}
        className="absolute inset-y-0 left-0 z-10 overflow-hidden rounded-full bg-white/96 shadow-surface ring-1 ring-ring-subtle focus-within:ring-2 focus-within:ring-focus-ring"
      >
        <motion.button
          ref={triggerRef}
          type="button"
          initial={false}
          animate={{ opacity: mode === "filter" ? 1 : 0 }}
          onClick={() => onModeChange("search")}
          whileTap={reduceMotion ? undefined : { scale: 0.96 }}
          transition={transitionSpringSnappy}
          tabIndex={mode === "filter" ? 0 : -1}
          aria-hidden={mode === "search"}
          className={`absolute inset-y-0 left-0 flex w-12 items-center justify-center rounded-full text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${mode === "search" ? "pointer-events-none" : ""}`}
          aria-label={`Buka ${searchAriaLabel.toLowerCase()}`}
        >
          <AppIcon name="search" className="icon-md" aria-hidden="true" />
        </motion.button>

        <motion.div
          initial={false}
          animate={{ opacity: mode === "search" ? 1 : 0 }}
          transition={contentTransition}
          aria-hidden={mode === "filter"}
          inert={mode === "filter"}
          style={{ width: geometry?.railWidth ?? "100%" }}
          className={`absolute inset-y-0 left-0 flex h-12 items-center gap-2 pr-1 pl-4 ${mode === "filter" ? "pointer-events-none" : ""}`}
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
            tabIndex={mode === "search" ? 0 : -1}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-on-surface-variant/55 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
          />
          <motion.button
            type="button"
            onClick={closeSearch}
            whileTap={reduceMotion ? undefined : { scale: 0.94 }}
            transition={transitionSpringSnappy}
            tabIndex={mode === "search" ? 0 : -1}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant outline-none focus-visible:bg-surface-container focus-visible:ring-2 focus-visible:ring-focus-ring"
            aria-label="Tutup pencarian"
          >
            <AppIcon name="close" className="icon-sm" aria-hidden="true" />
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}
