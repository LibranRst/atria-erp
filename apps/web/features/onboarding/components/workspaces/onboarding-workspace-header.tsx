"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { AppIcon } from "@/components/ui";
import {
  getOwnerOnboardingProgress,
  ONBOARDING_STEP_IDS,
  type OnboardingStepId,
} from "@atria/core/onboarding/owner-onboarding";
import { transitionSpringSnappy, buttonTapActiveScale } from "@/lib/utils/motion";
import { ONBOARDING_STEP_COPY } from "./onboarding-workspace-presentation";

export function OnboardingWorkspaceHeader({
  step,
  busy,
  refreshing,
  onNavigate,
  onExit,
}: {
  readonly step: OnboardingStepId;
  readonly busy: boolean;
  readonly refreshing: boolean;
  readonly onNavigate: (step: OnboardingStepId) => void;
  readonly onExit: () => void;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const stepIndex = ONBOARDING_STEP_IDS.indexOf(step);
  const progress = getOwnerOnboardingProgress(step);
  const copy = ONBOARDING_STEP_COPY[step];

  return (
    <header className="space-y-4">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex justify-start">
          {stepIndex > 0 ? (
            <motion.button
              whileTap={reduceMotion ? undefined : { scale: buttonTapActiveScale }}
              transition={transitionSpringSnappy}
              type="button"
              onClick={() => onNavigate(ONBOARDING_STEP_IDS[stepIndex - 1])}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-on-surface shadow-control ring-1 ring-ring-subtle outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              aria-label="Kembali ke langkah sebelumnya"
            >
              <AppIcon name="arrow_back" className="icon-xl" />
            </motion.button>
          ) : (
            <div className="h-10 w-10 shrink-0" />
          )}
        </div>
        <div className="min-w-0 text-center">
          <p className="text-[9px] leading-5 font-bold tracking-[0.14em] text-on-surface-variant uppercase">
            Setup Paduna Build
          </p>
          <p className="truncate text-support font-semibold text-on-surface">{progress.label}</p>
        </div>
        <div className="flex justify-end">
          <motion.button
            whileTap={reduceMotion ? undefined : { scale: buttonTapActiveScale }}
            transition={transitionSpringSnappy}
            type="button"
            disabled={busy}
            onClick={onExit}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-on-surface shadow-control ring-1 ring-ring-subtle outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-45"
            aria-label="Jeda dan keluar onboarding"
            title="Jeda dan keluar"
          >
            <AppIcon name="close" className="icon-xl" />
          </motion.button>
        </div>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-surface-container-high"
        aria-label={`Progress setup ${Math.round(progress.percentage)} persen`}
      >
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={false}
          animate={{ width: `${progress.percentage}%` }}
          transition={reduceMotion ? { duration: 0 } : transitionSpringSnappy}
        />
      </div>
      <div className="px-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-eyebrow font-bold tracking-[0.14em] text-on-surface-variant uppercase">
            {copy.eyebrow}
          </p>
          {refreshing ? (
            <span className="text-eyebrow font-semibold text-on-surface-variant">Memperbarui…</span>
          ) : null}
        </div>
        <h1 className="mt-1.5 text-[26px] leading-8 font-bold tracking-[-0.035em] text-on-surface">
          {copy.title}
        </h1>
        <p className="mt-2 text-[13px] leading-5 text-on-surface-variant">{copy.description}</p>
      </div>
    </header>
  );
}
