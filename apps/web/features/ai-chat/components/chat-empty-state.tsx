"use client";

import { AppIcon } from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";

const QUICK_ACTIONS: readonly {
  readonly icon: string;
  readonly title: string;
  readonly prompt: string;
}[] = [
  {
    icon: "add_circle",
    title: "Buat Proyek Baru",
    prompt: "Bantu saya buat proyek baru dari awal beserta alokasi budgetnya",
  },
  {
    icon: "receipt_long",
    title: "Catat Pengeluaran",
    prompt: "Saya mau catat pengeluaran lapangan baru",
  },
  {
    icon: "account_balance_wallet",
    title: "Bayar Tagihan Vendor",
    prompt: "Tampilkan tagihan vendor yang perlu dibayar dan siapkan usulan pembayarannya",
  },
  {
    icon: "inventory_2",
    title: "Terima Barang / Stok",
    prompt: "Bantu saya mencatat penerimaan barang (Goods Receipt) ke gudang",
  },
];

const ANALYSIS_QUESTIONS: readonly string[] = [
  "Proyek mana yang budgetnya paling kritis atau over-budget?",
  "Berapa total saldo kas di semua rekening bank saat ini?",
  "Berapa sisa budget material proyek yang sedang berjalan?",
];

type ChatEmptyStateProps = {
  readonly onSelect: (question: string) => void;
  readonly disabled: boolean;
};

export function ChatEmptyState({ onSelect, disabled }: ChatEmptyStateProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();

  return (
    <div className="space-y-lg py-2">
      {/* Header Info */}
      <div className="flex items-start gap-3.5">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-control"
          aria-hidden="true"
        >
          <AppIcon name="sparkle" weight="fill" className="icon-lg" />
        </div>
        <div className="space-y-1">
          <h3 className="text-section font-bold tracking-[-0.015em] text-on-surface">
            Asisten Cerdas Atria
          </h3>
          <p className="text-support leading-relaxed font-semibold text-on-surface-variant">
            Asisten siap memandu pembuatan proyek, alokasi budget, pengeluaran, pembayaran vendor,
            hingga penerimaan stok barang.
          </p>
        </div>
      </div>

      {/* Quick Action Guides */}
      <div className="space-y-2.5">
        <p className="text-eyebrow font-bold tracking-widest text-on-surface-variant uppercase">
          Panduan Aksi Cepat
        </p>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_ACTIONS.map((action) => (
            <motion.button
              key={action.title}
              type="button"
              onClick={() => onSelect(action.prompt)}
              disabled={disabled}
              whileTap={reduceMotion || disabled ? undefined : { scale: 0.97 }}
              transition={transitionSpringSnappy}
              className="group flex flex-col items-start gap-2 rounded-2xl bg-white p-3 text-left shadow-surface ring-1 ring-ring-subtle transition-all duration-200 hover:bg-surface-container-low hover:ring-ring-control focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none disabled:opacity-45"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container text-primary">
                <AppIcon name={action.icon} className="icon-xs" />
              </span>
              <span className="text-support font-bold tracking-tight text-on-surface">
                {action.title}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Analysis Questions */}
      <div className="space-y-2.5">
        <p className="text-eyebrow font-bold tracking-widest text-on-surface-variant uppercase">
          Pertanyaan Analisis
        </p>
        <div className="space-y-1.5">
          {ANALYSIS_QUESTIONS.map((question) => (
            <motion.button
              key={question}
              type="button"
              onClick={() => onSelect(question)}
              disabled={disabled}
              whileTap={reduceMotion || disabled ? undefined : { scale: 0.98 }}
              transition={transitionSpringSnappy}
              className="flex w-full items-center justify-between gap-3 rounded-full bg-white px-4 py-3 text-left text-support font-semibold text-on-surface shadow-control ring-1 ring-ring-subtle transition-all duration-200 hover:bg-surface-container-low hover:ring-ring-control focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none disabled:opacity-45"
            >
              <span className="truncate">{question}</span>
              <AppIcon name="arrow_forward" className="icon-xs shrink-0 text-on-surface-variant" />
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
