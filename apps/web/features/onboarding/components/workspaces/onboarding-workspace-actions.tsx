"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { ConfirmationDialog } from "@/components/ui";
import type {
  OnboardingStepId,
  OwnerOnboardingOverview,
} from "@atria/core/onboarding/owner-onboarding";
import { transitionSpringSnappy } from "@/lib/utils/motion";

type InitialStockDecision = "NO_LEGACY_STOCK" | "HAS_LEGACY_STOCK" | "SKIPPED";

export function OnboardingWorkspaceActions({
  step,
  overview,
  busy,
  exitConfirmOpen,
  onExitConfirmChange,
  onMark,
  onFinish,
  onPause,
}: {
  readonly step: OnboardingStepId;
  readonly overview: OwnerOnboardingOverview;
  readonly busy: boolean;
  readonly exitConfirmOpen: boolean;
  readonly onExitConfirmChange: (open: boolean) => void;
  readonly onMark: (
    disposition: "REVIEWED" | "SKIPPED",
    initialStockDecision?: InitialStockDecision,
  ) => void;
  readonly onFinish: (target: "dashboard" | "project") => void;
  readonly onPause: () => void;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const readiness = overview.readiness.find((item) => item.id === step);

  return (
    <>
      <footer className="space-y-2 pt-1">
        {step !== "initial_stock" && step !== "summary" ? (
          <>
            <motion.button
              type="button"
              disabled={busy}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={() => onMark("REVIEWED")}
              className="min-h-12 w-full rounded-full bg-primary px-5 text-xs font-bold text-on-primary disabled:opacity-45"
            >
              {step === "welcome" ? "Mulai setup" : "Lanjut"}
            </motion.button>
            {step !== "welcome" && !readiness?.ready ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onMark("SKIPPED")}
                className="min-h-12 w-full rounded-full px-5 text-xs font-bold text-on-surface-variant disabled:opacity-45"
              >
                Lewati step ini
              </button>
            ) : null}
          </>
        ) : null}
        {step === "initial_stock" &&
        overview.state.initialStockDecision !== "UNDECIDED" &&
        overview.state.initialStockDecision !== "SKIPPED" ? (
          <motion.button
            type="button"
            disabled={busy}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            transition={transitionSpringSnappy}
            onClick={() =>
              onMark(
                "REVIEWED",
                overview.counts.pendingInitialStockBatches > 0 ||
                  overview.counts.postedInitialStockBatches > 0
                  ? "HAS_LEGACY_STOCK"
                  : undefined,
              )
            }
            className="min-h-12 w-full rounded-full bg-primary px-5 text-xs font-bold text-on-primary disabled:opacity-45"
          >
            Lanjut ke Ringkasan
          </motion.button>
        ) : null}
        {step === "summary" ? (
          <>
            <motion.button
              type="button"
              disabled={busy || !overview.canComplete}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={() => onFinish("project")}
              className="min-h-12 w-full rounded-full bg-primary px-5 text-xs font-bold text-on-primary disabled:opacity-40"
            >
              Buat proyek pertama
            </motion.button>
            <button
              type="button"
              disabled={busy || !overview.canComplete}
              onClick={() => onFinish("dashboard")}
              className="min-h-12 w-full rounded-full bg-white px-5 text-xs font-bold text-on-surface ring-1 ring-ring-subtle disabled:opacity-40"
            >
              Masuk Dashboard
            </button>
          </>
        ) : null}
      </footer>

      <ConfirmationDialog
        open={exitConfirmOpen}
        title="Jeda setup sekarang?"
        description="Semua progres dan data yang telah Anda isi tersimpan dengan aman. Anda dapat melanjutkan setup ini kapan saja melalui Dashboard atau menu Pengaturan."
        tone="default"
        onClose={() => onExitConfirmChange(false)}
        actions={
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              transition={transitionSpringSnappy}
              type="button"
              onClick={() => onExitConfirmChange(false)}
              className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold text-on-surface"
            >
              Kembali
            </motion.button>
            <motion.button
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              transition={transitionSpringSnappy}
              type="button"
              disabled={busy}
              onClick={() => {
                onExitConfirmChange(false);
                onPause();
              }}
              className="min-h-12 rounded-full bg-primary px-4 text-xs font-bold text-on-primary disabled:opacity-45"
            >
              Jeda & Keluar
            </motion.button>
          </div>
        }
      />
    </>
  );
}
