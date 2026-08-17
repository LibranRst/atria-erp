"use client";

import { AppIcon } from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";

/**
 * Keadaan awal percakapan.
 *
 * Alih-alih kartu sambutan, layar kosong ini langsung menawarkan pertanyaan yang
 * memang bisa dijawab oleh tool yang tersedia. Saran ditulis sebagai pertanyaan
 * utuh supaya pengguna tahu tingkat kedalaman yang wajar untuk ditanyakan.
 */

const SUGGESTIONS: readonly string[] = [
  "Proyek mana yang budgetnya paling mengkhawatirkan?",
  "Berapa sisa budget material proyek yang sedang berjalan?",
  "Kategori biaya mana yang sudah lewat dari rencana?",
];

type ChatEmptyStateProps = {
  readonly onSelect: (question: string) => void;
  readonly disabled: boolean;
};

export function ChatEmptyState({ onSelect, disabled }: ChatEmptyStateProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();

  return (
    <div className="space-y-lg py-2">
      <div className="flex items-start gap-3.5">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-container text-on-surface shadow-control ring-1 ring-ring-subtle"
          aria-hidden="true"
        >
          <AppIcon name="chat" className="icon-lg" />
        </div>
        <div className="space-y-1">
          <h3 className="text-section font-bold tracking-[-0.015em] text-on-surface">
            Asisten Keuangan & Proyek
          </h3>
          <p className="text-support leading-relaxed font-semibold text-on-surface-variant">
            Jawaban selalu dibaca langsung dari data Atria. Asisten ini tidak bisa mengubah,
            menyetujui, atau membayar apa pun.
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        <p className="text-eyebrow font-bold tracking-widest text-on-surface-variant uppercase">
          Rekomendasi pertanyaan
        </p>
        <ul className="space-y-2">
          {SUGGESTIONS.map((question, index) => (
            <motion.li
              key={question}
              initial={reduceMotion ? undefined : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transitionSpringSnappy, delay: index * 0.05 }}
            >
              <motion.button
                type="button"
                onClick={() => onSelect(question)}
                disabled={disabled}
                whileTap={reduceMotion || disabled ? undefined : { scale: 0.98 }}
                transition={transitionSpringSnappy}
                className="group flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-full bg-white px-5 py-2.5 text-left shadow-control ring-1 ring-ring-subtle transition-all duration-200 hover:bg-surface-container-low hover:ring-ring-control focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
              >
                <span className="text-support font-semibold text-on-surface">{question}</span>
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-container-low transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:bg-surface-container"
                >
                  <AppIcon name="arrow_upward" className="icon-xs text-on-surface-variant" />
                </span>
              </motion.button>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}
