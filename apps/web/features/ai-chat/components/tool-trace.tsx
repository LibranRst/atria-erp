"use client";

import { AppIcon } from "@/components/ui";
import {
  collapseVariants,
  pulseAnimation,
  spinAnimation,
  transitionPulseSmooth,
  transitionSpinLinear,
} from "@/lib/utils/motion";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import * as React from "react";

import type { ToolTraceState } from "../utils/tool-labels";

/**
 * Jejak pemanggilan tool, diringkas menjadi satu baris.
 *
 * Pengguna perlu bisa memastikan angka berasal dari data nyata, tetapi daftar
 * centang sepanjang enam baris mendorong jawaban keluar layar di perangkat kecil.
 * Ringkasan tetap terlihat; rinciannya tinggal dibuka.
 *
 * Saat masih berjalan, rincian dibiarkan terbuka karena di situlah nilainya:
 * pengguna melihat apa yang sedang diambil, bukan sekadar bahwa ada sesuatu.
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

const TRACE_ICON: Record<ToolTraceState, string> = {
  running: "database",
  done: "check",
  failed: "warning",
};

function summarize(traces: readonly ToolTrace[]): string {
  const sources = traces.reduce((total, trace) => total + trace.count, 0);
  const failed = traces.filter((trace) => trace.state === "failed").length;
  const running = traces.some((trace) => trace.state === "running");

  if (running) return "Mengambil data…";
  if (failed > 0) return `${sources} sumber data dibaca, ${failed} gagal`;
  return `${sources} sumber data dibaca`;
}

export function ToolTraceList({ traces }: ToolTraceListProps): React.JSX.Element | null {
  const reduceMotion = useReducedMotion();
  const isRunning = traces.some((trace) => trace.state === "running");
  const hasFailure = traces.some((trace) => trace.state === "failed");
  const [open, setOpen] = React.useState(false);

  if (traces.length === 0) return null;

  // Selama berjalan atau ketika ada yang gagal, rincian selalu ditampilkan:
  // keduanya adalah saat pengguna paling butuh tahu apa yang terjadi.
  const expanded = open || isRunning || hasFailure;

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={expanded}
        disabled={isRunning || hasFailure}
        className="group flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full px-2 py-1 text-on-surface-variant transition-colors duration-200 hover:bg-surface-container-low hover:text-on-surface focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none disabled:cursor-default disabled:hover:bg-transparent"
      >
        <motion.span
          className={`flex shrink-0 ${
            isRunning ? "text-on-surface" : hasFailure ? "text-critical" : "text-on-surface-variant"
          }`}
          animate={isRunning && !reduceMotion ? pulseAnimation : undefined}
          transition={transitionPulseSmooth}
          aria-hidden="true"
        >
          <AppIcon
            name={isRunning ? "database" : hasFailure ? "warning" : "check"}
            className="icon-xs"
          />
        </motion.span>
        <span className="text-meta font-semibold">{summarize(traces)}</span>
        {!isRunning && !hasFailure && (
          <span
            aria-hidden="true"
            className={`inline-flex shrink-0 transition-transform duration-200 ${
              expanded ? "rotate-90" : "rotate-0"
            }`}
          >
            <AppIcon name="chevron_right" className="icon-xs" />
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.ul
            variants={collapseVariants}
            initial={reduceMotion ? false : "hidden"}
            animate="visible"
            exit={reduceMotion ? undefined : "exit"}
            className="space-y-1.5 overflow-hidden pl-2"
          >
            {traces.map((trace) => (
              <li
                key={trace.key}
                className={`flex items-center gap-1.5 ${
                  trace.state === "failed"
                    ? "text-critical"
                    : trace.state === "running"
                      ? "text-on-surface"
                      : "text-on-surface-variant"
                }`}
              >
                <motion.span
                  className="flex shrink-0"
                  animate={trace.state === "running" && !reduceMotion ? spinAnimation : undefined}
                  transition={transitionSpinLinear}
                  aria-hidden="true"
                >
                  <AppIcon name={TRACE_ICON[trace.state]} className="icon-xs" />
                </motion.span>
                <span className="text-meta font-semibold">
                  {trace.label}
                  {trace.count > 1 ? ` (${trace.count}×)` : ""}
                </span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
