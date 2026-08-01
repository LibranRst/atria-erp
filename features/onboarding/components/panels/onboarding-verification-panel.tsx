"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import React from "react";

import type {
  OnboardingStepStatus,
  OnboardingVerificationSnapshot,
} from "@/lib/onboarding/owner-onboarding";
import { transitionEaseSmooth, transitionSpringSnappy } from "@/lib/utils/motion";
import { AppIcon } from "@/components/ui";
type VerificationPresentation = {
  readonly icon: string;
  readonly label: string;
  readonly className: string;
};

const READY_SUMMARY: Readonly<Record<OnboardingVerificationSnapshot["kind"], string>> = {
  welcome: "Setup siap dimulai.",
  financial_defaults: "Pengaturan budget siap digunakan.",
  team_vendors: "Tim dan vendor sudah tercatat.",
  bank_accounts: "Rekening perusahaan sudah tercatat.",
  material_foundation: "Lokasi dan Material Master sudah siap.",
  item_library: "Library item dan harga sudah siap.",
  initial_stock: "Keputusan saldo awal stok sudah selesai.",
};

function verificationSummary(snapshot: OnboardingVerificationSnapshot): string {
  if (snapshot.status === "PENDING_APPROVAL") return "Saldo awal menunggu keputusan Finance.";
  if (snapshot.status === "NOT_APPLICABLE") return "Tidak ada stok lama yang perlu dicatat.";
  if (snapshot.status === "SKIPPED") return "Langkah ini perlu dilengkapi sebelum setup selesai.";
  if (snapshot.status === "INCOMPLETE") return "Lengkapi data agar langkah ini siap digunakan.";
  if (snapshot.status === "REVIEWED") return "Langkah ini sudah ditinjau.";
  return READY_SUMMARY[snapshot.kind];
}

function verificationPresentation(status: OnboardingStepStatus): VerificationPresentation {
  if (status === "READY" || status === "NOT_APPLICABLE") {
    return {
      icon: "verified",
      label: "Siap digunakan",
      className: "text-success",
    };
  }
  if (status === "PENDING_APPROVAL") {
    return {
      icon: "schedule",
      label: "Menunggu keputusan",
      className: "text-accent",
    };
  }
  if (status === "SKIPPED" || status === "INCOMPLETE") {
    return {
      icon: "error",
      label: "Perlu dilengkapi",
      className: "text-warning",
    };
  }
  return {
    icon: "fact_check",
    label: "Sudah ditinjau",
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
      aria-label="Status langkah onboarding"
      className="overflow-hidden rounded-3xl bg-white shadow-surface ring-1 ring-ring-subtle"
    >
      <motion.button
        type="button"
        onClick={toggleExpanded}
        whileTap={reduceMotion ? undefined : { scale: 0.985 }}
        transition={transitionSpringSnappy}
        aria-expanded={expanded}
        aria-controls={contentId}
        className="flex min-h-17 w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-surface-container-low text-on-surface-variant"
          aria-hidden="true"
        >
          <AppIcon name="fact_check" className="icon-md" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] leading-5 font-bold text-on-surface">
            Status langkah
          </span>
          <span className="block text-[9px] leading-4 text-on-surface-variant">
            {verificationSummary(snapshot)}
          </span>
          <span className="sr-only">{presentation.label}.</span>
        </span>
        <span
          aria-hidden="true"
          className={`hidden shrink-0 items-center gap-1 text-[9px] font-bold min-[350px]:flex ${presentation.className}`}
        >
          <AppIcon name={presentation.icon} className="icon-xs" />
          {presentation.label}
        </span>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={reduceMotion ? { duration: 0 } : transitionSpringSnappy}
          className="shrink-0 text-on-surface-variant"
          aria-hidden="true"
        >
          <AppIcon name="expand_more" className="h-4.75 w-4.75" />
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
                    className="flex min-h-14.5 items-center justify-between gap-3 px-4 py-3"
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
                    <span className="max-w-[48%] text-right text-[11px] font-bold wrap-break-word text-on-surface tabular-nums">
                      {fact.value}
                    </span>
                  </div>
                ))
              ) : (
                <div className="px-4 py-4 text-[10px] leading-5 text-on-surface-variant">
                  Belum ada rincian tambahan untuk langkah ini.
                </div>
              )}
            </div>

            {snapshot.technical?.length ? (
              <div className="border-t border-outline-variant/20 bg-white px-4 py-2">
                <>
                  <button
                    type="button"
                    onClick={() => setTechnicalOpen((current) => !current)}
                    aria-expanded={technicalOpen}
                    aria-controls={technicalId}
                    className="flex min-h-12 w-full items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <AppIcon name="code" className="icon-sm text-on-surface-variant" />
                    <span className="min-w-0 flex-1 text-[10px] font-bold text-on-surface-variant">
                      Info teknis developer
                    </span>
                    <motion.span
                      animate={{ rotate: technicalOpen ? 180 : 0 }}
                      transition={reduceMotion ? { duration: 0 } : transitionSpringSnappy}
                      className="text-on-surface-variant"
                      aria-hidden="true"
                    >
                      <AppIcon name="expand_more" className="h-4.25 w-4.25" />
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
                        <div className="mb-1 overflow-hidden rounded-[18px] bg-white ring-1 ring-ring-subtle">
                          <div className="divide-y divide-outline-variant/20">
                            {snapshot.technical.map((fact, index) => (
                              <div
                                key={`${fact.label}-${fact.value}-${index}`}
                                className="px-3.5 py-3"
                              >
                                <p className="text-[9px] font-semibold text-on-surface-variant">
                                  {fact.label}
                                </p>
                                <p className="mt-1 font-mono text-[9px] break-all text-on-surface">
                                  {fact.value}
                                </p>
                                {fact.detail ? (
                                  <p className="mt-1 font-mono text-[8px] break-all text-on-surface-variant">
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
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
