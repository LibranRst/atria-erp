"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import React from "react";

import type {
  OnboardingStepStatus,
  OnboardingVerificationSnapshot,
} from "@/lib/onboarding/owner-onboarding";
import { transitionEaseSmooth, transitionSpringSnappy } from "@/lib/utils/motion";

type VerificationPresentation = {
  readonly icon: string;
  readonly label: string;
  readonly className: string;
};

function verificationPresentation(status: OnboardingStepStatus): VerificationPresentation {
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
  const disclosureTransition = reduceMotion ? { duration: 0 } : transitionEaseSmooth;

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
        className="focus-visible:ring-primary/30 flex min-h-[68px] w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset"
      >
        <span
          className="bg-surface-container-low text-on-surface-variant flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px]"
          aria-hidden="true"
        >
          <span className="material-symbols-outlined text-[18px]">fact_check</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-on-surface block text-[12px] leading-5 font-bold">
            Verifikasi data
          </span>
          <span className="text-on-surface-variant block truncate text-[9px] leading-4">
            {snapshot.title} · {snapshot.facts.length} fakta
          </span>
          <span className="sr-only">{presentation.label}.</span>
        </span>
        <span
          aria-hidden="true"
          className={`hidden shrink-0 items-center gap-1 text-[9px] font-bold min-[350px]:flex ${presentation.className}`}
        >
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
            {presentation.icon}
          </span>
          {presentation.label}
        </span>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={reduceMotion ? { duration: 0 } : transitionSpringSnappy}
          className="material-symbols-outlined text-on-surface-variant shrink-0 text-[19px]"
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
            className="border-outline-variant/20 overflow-hidden border-t"
          >
            <div className="divide-outline-variant/20 divide-y">
              {snapshot.facts.length > 0 ? (
                snapshot.facts.map((fact, index) => (
                  <div
                    key={`${fact.label}-${fact.value}-${index}`}
                    className="flex min-h-[58px] items-center justify-between gap-3 px-4 py-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="text-on-surface-variant block text-[10px] font-semibold">
                        {fact.label}
                      </span>
                      {fact.detail ? (
                        <span className="text-on-surface-variant/75 mt-0.5 block text-[9px] leading-4">
                          {fact.detail}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-on-surface max-w-[48%] text-right text-[11px] font-bold wrap-break-word tabular-nums">
                      {fact.value}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-on-surface-variant px-4 py-4 text-[10px] leading-5">
                  Belum ada record aktual pada step ini.
                </div>
              )}
            </div>

            <div className="border-outline-variant/20 border-t bg-white px-4 py-2">
              {snapshot.technical?.length ? (
                <>
                  <button
                    type="button"
                    onClick={() => setTechnicalOpen((current) => !current)}
                    aria-expanded={technicalOpen}
                    aria-controls={technicalId}
                    className="focus-visible:ring-primary/30 flex min-h-12 w-full items-center gap-2 text-left outline-none focus-visible:ring-2"
                  >
                    <span
                      className="material-symbols-outlined text-on-surface-variant text-[16px]"
                      aria-hidden="true"
                    >
                      code
                    </span>
                    <span className="text-on-surface-variant min-w-0 flex-1 text-[10px] font-bold">
                      Detail teknis developer
                    </span>
                    <motion.span
                      animate={{ rotate: technicalOpen ? 180 : 0 }}
                      transition={reduceMotion ? { duration: 0 } : transitionSpringSnappy}
                      className="material-symbols-outlined text-on-surface-variant text-[17px]"
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
                          <div className="divide-outline-variant/20 divide-y">
                            {snapshot.technical.map((fact, index) => (
                              <div
                                key={`${fact.label}-${fact.value}-${index}`}
                                className="px-3.5 py-3"
                              >
                                <p className="text-on-surface-variant text-[9px] font-semibold">
                                  {fact.label}
                                </p>
                                <p className="text-on-surface mt-1 font-mono text-[9px] break-all">
                                  {fact.value}
                                </p>
                                {fact.detail ? (
                                  <p className="text-on-surface-variant mt-1 font-mono text-[8px] break-all">
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
                <div className="text-on-surface-variant flex min-h-10 items-center gap-2 text-[9px] font-semibold">
                  <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
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
