"use client";

import { AppIcon } from "@/components/ui";
import {
  collapseVariants,
  spinAnimation,
  transitionSpinLinear,
  transitionSpringSnappy,
  transitionSpringSmooth,
} from "@/lib/utils/motion";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import * as React from "react";

import type { ToolTraceState } from "../utils/tool-labels";

/**
 * Jejak pemanggilan tool AI yang transparan, terstruktur, dan elegan.
 *
 * Menerapkan estetika Calm Modern Luxury:
 * 1. Mode Terlipat (Collapsed): Kapsul kompak dengan indikator status ramah visual.
 * 2. Mode Terbuka (Expanded): Kartu bertingkat dengan baris proses terperinci,
 *    ikon status semantik, dan tag kepastian data.
 */

export type ToolTrace = {
  readonly key: string;
  readonly label: string;
  readonly state: ToolTraceState;
  readonly count: number;
};

type ToolTraceListProps = {
  readonly traces: readonly ToolTrace[];
};

function summarize(traces: readonly ToolTrace[]): string {
  const failed = traces.filter((trace) => trace.state === "failed").length;
  const interrupted = traces.filter((trace) => trace.state === "interrupted").length;
  const running = traces.some((trace) => trace.state === "running");
  // Hanya yang benar-benar mengembalikan hasil yang boleh disebut terbaca; yang
  // terhenti tidak pernah sampai ke sana.
  const sources = traces
    .filter((trace) => trace.state === "done")
    .reduce((total, trace) => total + trace.count, 0);

  // Bukan "Mengambil data…": kalimat itu sudah diperkenalkan oleh indicator
  // sebelum kapsul ini mengambil alih slot. Mengulangnya pada tool trace hanya
  // memakan ruang; yang berguna setelah handoff adalah kemajuannya — berapa
  // yang sudah kembali dari berapa yang diminta.
  if (running) {
    const total = traces.reduce((count, trace) => count + trace.count, 0);
    return `${sources} dari ${total} sumber dibaca`;
  }
  if (interrupted > 0) return `${sources} sumber data dibaca, ${interrupted} dihentikan`;
  if (failed > 0) return `${sources} sumber data dibaca, ${failed} gagal`;
  return `${sources} sumber data dibaca`;
}

export function ToolTraceList({ traces }: ToolTraceListProps): React.JSX.Element | null {
  const reduceMotion = useReducedMotion();
  const isRunning = traces.some((trace) => trace.state === "running");
  const hasFailure = traces.some((trace) => trace.state === "failed");
  // Centang di sebelah "1 dihentikan" membacanya sebagai keberhasilan.
  const hasInterrupted = traces.some((trace) => trace.state === "interrupted");
  const [open, setOpen] = React.useState(false);
  const userInteractedRef = React.useRef(false);
  const collapseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRunningRef = React.useRef(isRunning);
  const detailsId = React.useId();

  // Bersihkan timer pending saat komponen dilepas
  React.useEffect(() => {
    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = null;
      }
    };
  }, []);

  // Kelola siklus auto-expand saat running dan auto-collapse halus saat selesai
  React.useEffect(() => {
    const wasRunning = prevRunningRef.current;
    prevRunningRef.current = isRunning;

    if (isRunning) {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = null;
      }
      if (!wasRunning) {
        // Siklus baru dimulai
        userInteractedRef.current = false;
      }
      if (!userInteractedRef.current) {
        setOpen(true);
      }
    } else if (wasRunning && !isRunning) {
      // Seluruh tool baru saja selesai
      if (hasFailure) {
        // Biarkan terbuka bila terjadi kegagalan agar pengguna tahu alasannya
        return;
      }
      if (!userInteractedRef.current) {
        // Beri jeda ~600ms agar centang terlihat sebelum menciut otomatis
        collapseTimerRef.current = setTimeout(() => {
          setOpen(false);
          collapseTimerRef.current = null;
        }, 600);
      }
    }
  }, [hasFailure, isRunning]);

  const handleToggle = React.useCallback(() => {
    // Pengguna berinteraksi manual; jangan timpa keputusannya
    userInteractedRef.current = true;
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    setOpen((current) => !current);
  }, []);

  if (traces.length === 0) return null;

  const expanded = open;

  return (
    <div className="space-y-2.5">
      {/* Kapsul Pemicu (Trigger Button) */}
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-controls={detailsId}
        className="group relative inline-flex min-h-8 cursor-pointer items-center gap-2 rounded-full border border-black/6 bg-surface-container-low/90 px-3 py-1 text-on-surface-variant shadow-control transition-all duration-200 after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] hover:bg-surface-container hover:text-on-surface focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
      >
        <span
          className={`pointer-events-none flex shrink-0 ${
            isRunning
              ? "text-primary"
              : hasFailure
                ? "text-critical"
                : hasInterrupted
                  ? "text-on-surface-variant"
                  : "font-bold text-primary"
          }`}
          aria-hidden="true"
        >
          {isRunning ? (
            <motion.span
              key="capsule-running"
              className="flex shrink-0"
              animate={reduceMotion ? undefined : spinAnimation}
              transition={transitionSpinLinear}
            >
              <AppIcon name="progress_activity" className="icon-xs" />
            </motion.span>
          ) : (
            <motion.span
              key="capsule-static"
              className="flex shrink-0"
              initial={reduceMotion ? false : { scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={transitionSpringSnappy}
            >
              <AppIcon
                name={hasFailure ? "warning" : hasInterrupted ? "close" : "check"}
                className="icon-xs"
              />
            </motion.span>
          )}
        </span>

        <span className="pointer-events-none text-meta font-bold tracking-tight text-on-surface">
          {summarize(traces)}
        </span>

        <span
          aria-hidden="true"
          className={`pointer-events-none inline-flex shrink-0 text-on-surface-variant/70 transition-transform duration-200 ${
            expanded ? "rotate-90" : "rotate-0"
          }`}
        >
          <AppIcon name="chevron_right" className="icon-xs" />
        </span>
      </button>

      {/* Rincian Sumber Data (Expanded Card) */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={detailsId}
            variants={collapseVariants}
            initial={reduceMotion ? false : "hidden"}
            animate="visible"
            exit={reduceMotion ? undefined : "exit"}
            transition={transitionSpringSmooth}
            className="overflow-hidden pb-1"
          >
            <div className="rounded-2xl bg-white p-3 shadow-surface ring-1 ring-ring-subtle">
              <div className="mb-2 flex items-center justify-between border-b border-black/5 pb-2">
                <span className="text-eyebrow font-bold tracking-wider text-on-surface-variant uppercase">
                  Verifikasi Sumber Data
                </span>
                <span className="rounded-full bg-surface-container px-2 py-0.5 text-eyebrow font-bold text-on-surface-variant tabular-nums">
                  {traces.length} {traces.length === 1 ? "tindakan" : "tindakan"}
                </span>
              </div>

              <ul className="divide-y divide-black/4">
                {traces.map((trace) => {
                  const isTraceRunning = trace.state === "running";
                  const isTraceFailed = trace.state === "failed";
                  // Terhenti di tengah: bukan berhasil, bukan gagal. Membiarkan
                  // barisnya tetap berputar setelah pengguna menekan berhenti
                  // membuat antarmuka menyatakan sesuatu yang tidak benar.
                  const isTraceInterrupted = trace.state === "interrupted";

                  return (
                    <li
                      key={trace.key}
                      className="flex items-center justify-between gap-3 py-2 text-support"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        {/* Ikon Status Bulat */}
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
                            isTraceRunning
                              ? "bg-primary/10 text-primary"
                              : isTraceFailed
                                ? "bg-critical-container text-critical"
                                : isTraceInterrupted
                                  ? "bg-surface-container text-on-surface-variant"
                                  : "bg-primary/8 text-primary"
                          }`}
                        >
                          {isTraceRunning ? (
                            <motion.span
                              key="row-running"
                              className="flex shrink-0"
                              animate={reduceMotion ? undefined : spinAnimation}
                              transition={transitionSpinLinear}
                              aria-hidden="true"
                            >
                              <AppIcon name="progress_activity" className="icon-xs" />
                            </motion.span>
                          ) : (
                            <motion.span
                              key={`row-${trace.state}`}
                              className="flex shrink-0"
                              initial={reduceMotion ? false : { scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1, rotate: 0 }}
                              transition={transitionSpringSnappy}
                              aria-hidden="true"
                            >
                              <AppIcon
                                name={
                                  isTraceFailed
                                    ? "warning"
                                    : isTraceInterrupted
                                      ? "close"
                                      : "check"
                                }
                                className="icon-xs"
                              />
                            </motion.span>
                          )}
                        </div>

                        {/* Label Tindakan */}
                        <span
                          className={`truncate font-semibold ${
                            isTraceFailed
                              ? "text-critical"
                              : isTraceRunning
                                ? "font-bold text-on-surface"
                                : "text-on-surface"
                          }`}
                        >
                          {trace.label}
                        </span>
                      </div>

                      {/* Tag Kanan / Pengganda */}
                      <div className="flex shrink-0 items-center gap-1.5">
                        {trace.count > 1 && (
                          <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-eyebrow font-bold text-on-surface-variant tabular-nums">
                            {trace.count}×
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-eyebrow font-bold tracking-wider uppercase transition-colors duration-200 ${
                            isTraceRunning
                              ? "bg-primary/10 text-primary"
                              : isTraceFailed
                                ? "bg-critical-container text-critical"
                                : isTraceInterrupted
                                  ? "bg-surface-container text-on-surface-variant"
                                  : "bg-surface-container-low text-primary"
                          }`}
                        >
                          {isTraceRunning
                            ? "Proses"
                            : isTraceFailed
                              ? "Gagal"
                              : isTraceInterrupted
                                ? "Dihentikan"
                                : "Selesai"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
