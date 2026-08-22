"use client";

import { AppIcon } from "@/components/ui";
import {
  collapseVariants,
  pulseAnimation,
  spinAnimation,
  transitionPulseSmooth,
  transitionSpinLinear,
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
  const detailsId = React.useId();

  if (traces.length === 0) return null;

  // Disclosure sepenuhnya milik pengguna. Perubahan running, selesai, atau gagal
  // hanya memperbarui summary; ia tidak lagi membuka lalu menutup layout sendiri.
  const expanded = open;

  return (
    <div className="space-y-2.5">
      {/* Kapsul Pemicu (Trigger Button) */}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={expanded}
        aria-controls={detailsId}
        className="group relative inline-flex min-h-8 cursor-pointer items-center gap-2 rounded-full border border-black/6 bg-surface-container-low/90 px-3 py-1 text-on-surface-variant shadow-control transition-all duration-200 after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] hover:bg-surface-container hover:text-on-surface focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
      >
        <motion.span
          className={`pointer-events-none flex shrink-0 ${
            isRunning
              ? "text-primary"
              : hasFailure
                ? "text-critical"
                : hasInterrupted
                  ? "text-on-surface-variant"
                  : "font-bold text-primary"
          }`}
          animate={isRunning && !reduceMotion ? pulseAnimation : undefined}
          transition={transitionPulseSmooth}
          aria-hidden="true"
        >
          <AppIcon
            name={
              isRunning ? "database" : hasFailure ? "warning" : hasInterrupted ? "close" : "check"
            }
            className="icon-xs"
          />
        </motion.span>

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
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                            isTraceRunning
                              ? "bg-primary/10 text-primary"
                              : isTraceFailed
                                ? "bg-critical-container text-critical"
                                : isTraceInterrupted
                                  ? "bg-surface-container text-on-surface-variant"
                                  : "bg-primary/8 text-primary"
                          }`}
                        >
                          <motion.span
                            className="flex shrink-0"
                            animate={isTraceRunning && !reduceMotion ? spinAnimation : undefined}
                            transition={transitionSpinLinear}
                            aria-hidden="true"
                          >
                            <AppIcon
                              name={
                                isTraceRunning
                                  ? "progress_activity"
                                  : isTraceFailed
                                    ? "warning"
                                    : isTraceInterrupted
                                      ? "close"
                                      : "check"
                              }
                              className="icon-xs"
                            />
                          </motion.span>
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
                          className={`rounded-full px-2 py-0.5 text-eyebrow font-bold tracking-wider uppercase ${
                            isTraceRunning
                              ? "bg-primary/10 text-primary"
                              : isTraceFailed
                                ? "bg-critical-container text-critical"
                                : "bg-surface-container-low text-on-surface-variant"
                          }`}
                        >
                          {isTraceRunning ? "Proses" : isTraceFailed ? "Gagal" : "Selesai"}
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
