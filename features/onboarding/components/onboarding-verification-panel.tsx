"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import React from "react";

import type {
  OnboardingStepStatus,
  OnboardingVerificationSnapshot,
} from "@/lib/onboarding/owner-onboarding";
import {
  transitionEaseSmooth,
  transitionSpringSnappy,
} from "@/lib/utils/motion";

type VerificationPresentation = {
  readonly icon: string;
  readonly label: string;
  readonly className: string;
};

function verificationPresentation(
  status: OnboardingStepStatus,
): VerificationPresentation {
  if (status === "READY" || status === "NOT_APPLICABLE") {
    return {
      icon: "verified",
      label: "Terverifikasi",
      className: "text-success",
    };
  }
  if (status === "PENDING_APPROVAL") {
    return {
      icon: "schedule",
      label: "Menunggu keputusan",
      className: "text-[#007AFF]",
    };
  }
  if (status === "SKIPPED") {
    return {
      icon: "error",
      label: "Masih ada gap",
      className: "text-warning",
    };
  }
  return {
    icon: "database",
    label: "Data aktual",
    className: "text-on-surface-variant",
  };
}

export function OnboardingVerificationPanel({
  snapshot,
}: {
  readonly snapshot: OnboardingVerificationSnapshot | undefined;
}): React.JSX.Element | null {
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = React.useState(false);
  const [technicalOpen, setTechnicalOpen] = React.useState(false);

  if (!snapshot) return null;

  const contentId = `verification-content-${snapshot.kind}`;
  const technicalId = `verification-technical-${snapshot.kind}`;
  const presentation = verificationPresentation(snapshot.status);
  const disclosureTransition = reduceMotion
    ? { duration: 0 }
    : transitionEaseSmooth;

  function toggleExpanded(): void {
    if (expanded) setTechnicalOpen(false);
    setExpanded(!expanded);
  }

  return (
    <section
      aria-label="Verifikasi data onboarding"
      className="overflow-hidden rounded-[24px] bg-white shadow-[0_10px_28px_rgba(17,17,17,0.035)] ring-1 ring-black/[0.035]"
    >
      <motion.button
        type="button"
        onClick={toggleExpanded}
        whileTap={reduceMotion ? undefined : { scale: 0.985 }}
        transition={transitionSpringSnappy}
        aria-expanded={expanded}
        aria-controls={contentId}
        className="flex min-h-[68px] w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-surface-container-low text-on-surface-variant"
          aria-hidden="true"
        >
          <span className="material-symbols-outlined text-[18px]">
            fact_check
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-bold leading-5 text-on-surface">
            Verifikasi data
          </span>
          <span className="block truncate text-[9px] leading-4 text-on-surface-variant">
            {snapshot.title} · {snapshot.facts.length} fakta
          </span>
          <span className="sr-only">{presentation.label}.</span>
        </span>
        <span
          aria-hidden="true"
          className={`hidden shrink-0 items-center gap-1 text-[9px] font-bold min-[350px]:flex ${presentation.className}`}
        >
          <span
            className="material-symbols-outlined text-[14px]"
            aria-hidden="true"
          >
            {presentation.icon}
          </span>
          {presentation.label}
        </span>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={reduceMotion ? { duration: 0 } : transitionSpringSnappy}
          className="material-symbols-outlined shrink-0 text-[19px] text-on-surface-variant"
          aria-hidden="true"
        >
          expand_more
        </motion.span>
      </motion.button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            id={contentId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={disclosureTransition}
            className="overflow-hidden border-t border-outline-variant/20"
          >
            <div className="divide-y divide-outline-variant/20">
              {snapshot.facts.length > 0 ? (
                snapshot.facts.map((fact, index) => (
                  <div
                    key={`${fact.label}-${fact.value}-${index}`}
                    className="flex min-h-[58px] items-center justify-between gap-3 px-4 py-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-semibold text-on-surface-variant">
                        {fact.label}
                      </span>
                      {fact.detail ? (
                        <span className="mt-0.5 block text-[9px] leading-4 text-on-surface-variant/75">
                          {fact.detail}
                        </span>
                      ) : null}
                    </span>
                    <span className="max-w-[48%] break-words text-right text-[11px] font-bold tabular-nums text-on-surface">
                      {fact.value}
                    </span>
                  </div>
                ))
              ) : (
                <div className="px-4 py-4 text-[10px] leading-5 text-on-surface-variant">
                  Belum ada record aktual pada step ini.
                </div>
              )}
            </div>

            <div className="border-t border-outline-variant/20 bg-white px-4 py-2">
              {snapshot.technical?.length ? (
                <>
                  <button
                    type="button"
                    onClick={() => setTechnicalOpen((current) => !current)}
                    aria-expanded={technicalOpen}
                    aria-controls={technicalId}
                    className="flex min-h-12 w-full items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    <span
                      className="material-symbols-outlined text-[16px] text-on-surface-variant"
                      aria-hidden="true"
                    >
                      code
                    </span>
                    <span className="min-w-0 flex-1 text-[10px] font-bold text-on-surface-variant">
                      Detail teknis developer
                    </span>
                    <motion.span
                      animate={{ rotate: technicalOpen ? 180 : 0 }}
                      transition={
                        reduceMotion ? { duration: 0 } : transitionSpringSnappy
                      }
                      className="material-symbols-outlined text-[17px] text-on-surface-variant"
                      aria-hidden="true"
                    >
                      expand_more
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {technicalOpen ? (
                      <motion.div
                        id={technicalId}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={disclosureTransition}
                        className="overflow-hidden"
                      >
                        <div className="mb-1 overflow-hidden rounded-[18px] bg-white ring-1 ring-black/[0.035]">
                          <div className="divide-y divide-outline-variant/20">
                            {snapshot.technical.map((fact, index) => (
                              <div
                                key={`${fact.label}-${fact.value}-${index}`}
                                className="px-3.5 py-3"
                              >
                                <p className="text-[9px] font-semibold text-on-surface-variant">
                                  {fact.label}
                                </p>
                                <p className="mt-1 break-all font-mono text-[9px] text-on-surface">
                                  {fact.value}
                                </p>
                                {fact.detail ? (
                                  <p className="mt-1 break-all font-mono text-[8px] text-on-surface-variant">
                                    {fact.detail}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </>
              ) : (
                <div className="flex min-h-10 items-center gap-2 text-[9px] font-semibold text-on-surface-variant">
                  <span
                    className="material-symbols-outlined text-[15px]"
                    aria-hidden="true"
                  >
                    database
                  </span>
                  Dibaca langsung dari database
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
