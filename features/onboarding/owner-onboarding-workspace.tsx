"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import React from "react";
import { toast } from "sonner";

import {
  completeOwnerOnboarding,
  pauseOwnerOnboarding,
  advanceOwnerOnboardingStep,
} from "@/app/actions/onboarding";
import { FinancialDefaultsPanel } from "@/features/onboarding/components/financial-defaults-panel";
import { InitialStockSetupPanel } from "@/features/onboarding/components/initial-stock-setup-panel";
import { LibraryPanel } from "@/features/onboarding/components/library-panel";
import { MaterialFoundationPanel } from "@/features/onboarding/components/material-foundation-panel";
import { SetupBankAccountsPanel } from "@/features/onboarding/components/setup-bank-accounts-panel";
import { TeamVendorsPanel } from "@/features/onboarding/components/team-vendors-panel";
import { OnboardingVerificationPanel } from "@/features/onboarding/components/onboarding-verification-panel";
import type {
  OwnerOnboardingWorkspaceData,
  WorkspaceSource,
} from "@/features/onboarding/server/get-owner-onboarding-workspace-data";
import {
  getOwnerOnboardingProgress,
  ONBOARDING_STEP_IDS,
  type OnboardingStepId,
  type OnboardingStepStatus,
} from "@/lib/onboarding/owner-onboarding";
import { ConfirmationModal } from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";

type StepCopy = {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
};

const STEP_COPY: Record<OnboardingStepId, StepCopy> = {
  welcome: {
    eyebrow: "Setup organisasi",
    title: "Mulai dari fondasi yang jelas",
    description: "Siapkan default, orang, kas, dan master data tanpa membuat transaksi proyek.",
  },
  financial_defaults: {
    eyebrow: "Langkah 1",
    title: "Review default finansial",
    description:
      "Tinjau formula budget dan lima kategori biaya canonical langsung dari workspace ini.",
  },
  team_vendors: {
    eyebrow: "Langkah 2",
    title: "Siapkan tim dan vendor",
    description:
      "Tambahkan Finance, Project Manager, Purchasing, dan vendor tanpa meninggalkan onboarding.",
  },
  bank_accounts: {
    eyebrow: "Langkah 3",
    title: "Tambahkan rekening perusahaan",
    description:
      "Hanya identitas rekening dan saldo awal tersedia di setup. Operasi kas tetap berada di Ledger.",
  },
  material_foundation: {
    eyebrow: "Langkah 4",
    title: "Siapkan lokasi dan Material Master",
    description: "Lokasi dibuat lebih dahulu. Material baru mendapat inventory bersaldo nol.",
  },
  item_library: {
    eyebrow: "Langkah 5 · Opsional",
    title: "Siapkan Library Item & Harga",
    description: "Buat template berulang untuk RAP dan RAB, atau lewati untuk dilengkapi nanti.",
  },
  initial_stock: {
    eyebrow: "Langkah 6",
    title: "Tentukan saldo awal stok",
    description: "Pilih keputusan yang sesuai dan catat stok fisik lama bila memang ada.",
  },
  summary: {
    eyebrow: "Ringkasan",
    title: "Periksa kesiapan operasional",
    description:
      "Setiap gap dapat dibuka kembali sebagai step internal. Readiness selalu berasal dari data aktual.",
  },
};

const STATUS_LABEL: Record<OnboardingStepStatus, string> = {
  READY: "Siap",
  INCOMPLETE: "Belum lengkap",
  SKIPPED: "Dilanjutkan nanti",
  REVIEWED: "Sudah ditinjau",
  PENDING_APPROVAL: "Menunggu approval",
  NOT_APPLICABLE: "Tidak ada stok lama",
};

function statusClass(status: OnboardingStepStatus): string {
  if (status === "READY" || status === "NOT_APPLICABLE") return "bg-emerald-50 text-emerald-700";
  if (status === "PENDING_APPROVAL") return "bg-blue-50 text-blue-700";
  if (status === "SKIPPED" || status === "INCOMPLETE") return "bg-amber-50 text-amber-700";
  return "bg-surface-container-low text-on-surface-variant";
}

function FactRow({
  icon,
  title,
  detail,
}: {
  readonly icon: string;
  readonly title: string;
  readonly detail: string;
}): React.JSX.Element {
  return (
    <div className="flex min-h-[70px] items-center gap-3 px-4 py-3">
      <span
        className="material-symbols-outlined bg-surface-container-low text-primary flex! h-10 w-10 shrink-0 items-center justify-center rounded-[14px] text-[20px]"
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-on-surface block text-[13px] font-bold">{title}</span>
        <span className="text-on-surface-variant mt-0.5 block text-[10px] leading-4">{detail}</span>
      </span>
    </div>
  );
}

function SourceError({
  source,
  retry,
}: {
  readonly source: WorkspaceSource<unknown>;
  readonly retry: () => void;
}): React.JSX.Element | null {
  if (source.status !== "error") return null;
  return (
    <div className="rounded-[24px] bg-white px-5 py-6 text-center ring-1 ring-black/4">
      <span className="material-symbols-outlined text-warning text-[28px]" aria-hidden="true">
        sync_problem
      </span>
      <p className="text-on-surface mt-2 text-[13px] font-bold">Data step belum dapat dimuat</p>
      <p className="text-on-surface-variant mt-1 text-[10px] leading-4">{source.message}</p>
      <button
        type="button"
        onClick={retry}
        className="bg-surface-container-low text-on-surface mt-4 min-h-12 rounded-full px-5 text-xs font-bold"
      >
        Coba lagi
      </button>
    </div>
  );
}

export function OwnerOnboardingWorkspace({
  initialData,
  initialStep,
}: {
  readonly initialData: OwnerOnboardingWorkspaceData;
  readonly initialStep: OnboardingStepId;
}): React.JSX.Element {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = React.useState<OnboardingStepId>(initialStep);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);
  const [refreshing, startRefresh] = React.useTransition();
  const [pending, startTransition] = React.useTransition();
  const overview = initialData.overview;
  const copy = STEP_COPY[step];
  const stepIndex = ONBOARDING_STEP_IDS.indexOf(step);
  const progress = getOwnerOnboardingProgress(step);
  const readiness = overview.readiness.find((item) => item.id === step);
  const snapshot = initialData.verificationSnapshots.find((item) => item.kind === step);

  function navigate(next: OnboardingStepId): void {
    setStep(next);
    router.replace(`/onboarding?step=${next}`, { scroll: false });
  }

  function refreshWorkspace(): void {
    startRefresh(() => router.refresh());
  }

  function markAndContinue(
    disposition: "REVIEWED" | "SKIPPED" = "REVIEWED",
    initialStockDecision?: "NO_LEGACY_STOCK" | "HAS_LEGACY_STOCK" | "SKIPPED",
  ): void {
    startTransition(async () => {
      const result = await advanceOwnerOnboardingStep({
        stepId: step,
        disposition,
        initialStockDecision,
      });
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      navigate(result.data.nextStep);
      router.refresh();
    });
  }

  function pause(): void {
    startTransition(async () => {
      const result = await pauseOwnerOnboarding({ currentStep: step });
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Setup dijeda. Data yang sudah disimpan tetap aman.");
      router.push("/ledger");
      router.refresh();
    });
  }

  function finish(target: "dashboard" | "project"): void {
    startTransition(async () => {
      const result = await completeOwnerOnboarding();
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Fondasi Atria siap digunakan.");
      router.push(target === "project" ? "/projects?new-project=true" : "/ledger");
      router.refresh();
    });
  }

  const busy = pending || refreshing;

  return (
    <section className="w-full space-y-5 px-1 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <header className="space-y-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex justify-start">
            {stepIndex > 0 ? (
              <motion.button
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                type="button"
                onClick={() => navigate(ONBOARDING_STEP_IDS[stepIndex - 1])}
                className="text-on-surface ring-outline-variant/15 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_5px_16px_rgba(17,17,17,0.08)] ring-1 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                aria-label="Kembali ke langkah sebelumnya"
              >
                <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
                  arrow_back
                </span>
              </motion.button>
            ) : (
              <div className="h-10 w-10 shrink-0" />
            )}
          </div>
          <div className="min-w-0 text-center">
            <p className="text-on-surface-variant text-[9px] leading-5 font-bold tracking-[0.14em] uppercase">
              Setup Atria
            </p>
            <p className="text-on-surface truncate text-[11px] leading-4 font-semibold">
              {progress.label}
            </p>
          </div>
          <div className="flex justify-end">
            <motion.button
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              type="button"
              disabled={busy}
              onClick={() => setShowExitConfirm(true)}
              className="text-on-surface ring-outline-variant/15 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_5px_16px_rgba(17,17,17,0.08)] ring-1 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:opacity-45"
              aria-label="Jeda dan keluar onboarding"
              title="Jeda dan keluar"
            >
              <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
                close
              </span>
            </motion.button>
          </div>
        </div>
        <div
          className="bg-surface-container-high h-1.5 overflow-hidden rounded-full"
          aria-label={`Progress setup ${Math.round(progress.percentage)} persen`}
        >
          <motion.div
            className="bg-primary h-full rounded-full"
            initial={false}
            animate={{ width: `${progress.percentage}%` }}
            transition={reduceMotion ? { duration: 0 } : transitionSpringSnappy}
          />
        </div>
        <div className="px-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-on-surface-variant text-[9px] font-bold tracking-[0.14em] uppercase">
              {copy.eyebrow}
            </p>
            {refreshing ? (
              <span className="text-on-surface-variant text-[9px] font-semibold">Memperbarui…</span>
            ) : null}
          </div>
          <h1 className="text-on-surface mt-1.5 text-[26px] leading-8 font-bold tracking-[-0.035em]">
            {copy.title}
          </h1>
          {copy.description ? (
            <p className="text-on-surface-variant mt-2 text-[13px] leading-5">{copy.description}</p>
          ) : null}
        </div>
      </header>

      {step === "welcome" ? (
        <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_14px_34px_rgba(17,17,17,0.045)] ring-1 ring-black/[0.035]">
          <div className="divide-y divide-black/5.5">
            <FactRow
              icon="tune"
              title="Semua setup dilakukan di sini"
              detail="Form dibuka sebagai drawer dan kembali ke step yang sama setelah disimpan."
            />
            <FactRow
              icon="verified_user"
              title="Aksi penting tetap eksplisit"
              detail="Tidak ada uang atau stok yang bergerak hanya karena onboarding dibuka."
            />
            <FactRow
              icon="resume"
              title="Bisa dijeda kapan saja"
              detail="Data tersimpan tetap aman dan posisi step dapat dilanjutkan."
            />
          </div>
        </div>
      ) : null}

      {step === "financial_defaults" ? (
        initialData.settings.status === "ready" ? (
          <FinancialDefaultsPanel
            settings={initialData.settings.data}
            onMutationComplete={refreshWorkspace}
          />
        ) : (
          <SourceError source={initialData.settings} retry={refreshWorkspace} />
        )
      ) : null}
      {step === "team_vendors" ? (
        initialData.administration.status === "ready" ? (
          <TeamVendorsPanel
            data={initialData.administration.data}
            onMutationComplete={refreshWorkspace}
          />
        ) : (
          <SourceError source={initialData.administration} retry={refreshWorkspace} />
        )
      ) : null}
      {step === "bank_accounts" ? (
        initialData.bankAccounts.status === "ready" ? (
          <SetupBankAccountsPanel
            initialAccounts={initialData.bankAccounts.data}
            onMutationComplete={refreshWorkspace}
          />
        ) : (
          <SourceError source={initialData.bankAccounts} retry={refreshWorkspace} />
        )
      ) : null}
      {step === "material_foundation" ? (
        initialData.settings.status === "ready" ? (
          <MaterialFoundationPanel
            key={`${initialData.settings.data.inventoryLocations.map((row) => row.id).join(":")}-${initialData.settings.data.materials.map((row) => row.id).join(":")}`}
            settings={initialData.settings.data}
            onMutationComplete={refreshWorkspace}
          />
        ) : (
          <SourceError source={initialData.settings} retry={refreshWorkspace} />
        )
      ) : null}
      {step === "item_library" ? (
        initialData.settings.status === "ready" && initialData.library.status === "ready" ? (
          <LibraryPanel
            settings={initialData.settings.data}
            items={initialData.library.data}
            onMutationComplete={refreshWorkspace}
          />
        ) : (
          <SourceError
            source={
              initialData.settings.status === "error" ? initialData.settings : initialData.library
            }
            retry={refreshWorkspace}
          />
        )
      ) : null}
      {step === "initial_stock" ? (
        initialData.initialStock.status === "ready" ? (
          <InitialStockSetupPanel
            candidates={initialData.initialStock.data.candidates}
            batches={initialData.initialStock.data.batches}
            simulation={
              initialData.developerSimulation.status === "ready"
                ? initialData.developerSimulation.data
                : null
            }
            onMutationComplete={refreshWorkspace}
            onNoLegacyStock={() => markAndContinue("REVIEWED", "NO_LEGACY_STOCK")}
            onSkip={() => markAndContinue("SKIPPED", "SKIPPED")}
          />
        ) : (
          <SourceError source={initialData.initialStock} retry={refreshWorkspace} />
        )
      ) : null}

      {step === "summary" ? (
        <div className="space-y-4">
          {overview.blockers.length > 0 ? (
            <section>
              <h2 className="text-on-surface mb-2 px-1 text-[12px] font-bold">
                Wajib diselesaikan
              </h2>
              <div className="overflow-hidden rounded-[24px] bg-white ring-1 ring-black/[0.035]">
                <div className="divide-outline-variant/20 divide-y">
                  {overview.blockers.map((issue) => (
                    <button
                      key={`${issue.stepId}-${issue.label}`}
                      type="button"
                      onClick={() => navigate(issue.stepId)}
                      className="flex min-h-[68px] w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      <span
                        className="material-symbols-outlined text-warning text-[20px]"
                        aria-hidden="true"
                      >
                        priority_high
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-on-surface block text-[12px] font-bold">
                          {issue.label}
                        </span>
                        <span className="text-on-surface-variant mt-0.5 block text-[9px] leading-4">
                          {issue.detail}
                        </span>
                      </span>
                      <span
                        className="material-symbols-outlined text-on-surface-variant text-[18px]"
                        aria-hidden="true"
                      >
                        chevron_right
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
          {overview.warnings.length > 0 ? (
            <section>
              <h2 className="text-on-surface mb-2 px-1 text-[12px] font-bold">
                Boleh dilengkapi nanti
              </h2>
              <div className="overflow-hidden rounded-[24px] bg-white ring-1 ring-black/[0.035]">
                <div className="divide-outline-variant/20 divide-y">
                  {overview.warnings.map((issue) => (
                    <button
                      key={`${issue.stepId}-${issue.label}`}
                      type="button"
                      onClick={() => navigate(issue.stepId)}
                      className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      <span
                        className="material-symbols-outlined text-on-surface-variant text-[19px]"
                        aria-hidden="true"
                      >
                        info
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-on-surface block text-[11px] font-bold">
                          {issue.label}
                        </span>
                        <span className="text-on-surface-variant mt-0.5 block text-[9px] leading-4">
                          {issue.detail}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
          <div className="overflow-hidden rounded-[28px] bg-white ring-1 ring-black/[0.035]">
            <div className="divide-y divide-black/5.5">
              {overview.readiness
                .filter((item) => item.id !== "summary")
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.id)}
                    className="active:bg-surface-container-low focus-visible:bg-surface-container-low flex min-h-[68px] w-full items-center gap-3 px-4 py-3 text-left outline-none"
                  >
                    <span
                      className={`material-symbols-outlined flex! h-9 w-9 shrink-0 items-center justify-center rounded-full text-[18px] ${statusClass(item.status)}`}
                      aria-hidden="true"
                    >
                      {item.ready
                        ? "check"
                        : item.status === "PENDING_APPROVAL"
                          ? "hourglass_top"
                          : "priority_high"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-on-surface block text-[13px] font-bold">
                        {item.label}
                      </span>
                      <span className="text-on-surface-variant mt-0.5 block text-[10px] leading-4">
                        {item.detail}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold ${statusClass(item.status)}`}
                    >
                      {STATUS_LABEL[item.status]}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      ) : null}

      {step !== "summary" ? <OnboardingVerificationPanel snapshot={snapshot} /> : null}

      <footer className="space-y-2 pt-1">
        {step !== "initial_stock" && step !== "summary" ? (
          <>
            <motion.button
              type="button"
              disabled={busy}
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={() => markAndContinue("REVIEWED")}
              className="bg-primary text-on-primary min-h-12 w-full rounded-full px-5 text-xs font-bold disabled:opacity-45"
            >
              {step === "welcome" ? "Mulai setup" : "Lanjut"}
            </motion.button>
            {step !== "welcome" && !readiness?.ready ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => markAndContinue("SKIPPED")}
                className="text-on-surface-variant min-h-12 w-full rounded-full px-5 text-xs font-bold disabled:opacity-45"
              >
                Lewati step ini
              </button>
            ) : null}
          </>
        ) : null}
        {step === "initial_stock" ? (
          <motion.button
            type="button"
            disabled={busy}
            whileTap={{ scale: 0.97 }}
            transition={transitionSpringSnappy}
            onClick={() =>
              markAndContinue(
                "REVIEWED",
                overview.counts.pendingInitialStockBatches > 0 ||
                  overview.counts.postedInitialStockBatches > 0
                  ? "HAS_LEGACY_STOCK"
                  : undefined,
              )
            }
            className="bg-primary text-on-primary min-h-12 w-full rounded-full px-5 text-xs font-bold disabled:opacity-45"
          >
            Lanjut ke Ringkasan
          </motion.button>
        ) : null}
        {step === "summary" ? (
          <>
            <motion.button
              type="button"
              disabled={busy || !overview.canComplete}
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={() => finish("project")}
              className="bg-primary text-on-primary min-h-12 w-full rounded-full px-5 text-xs font-bold disabled:opacity-40"
            >
              Buat proyek pertama
            </motion.button>
            <button
              type="button"
              disabled={busy || !overview.canComplete}
              onClick={() => finish("dashboard")}
              className="text-on-surface min-h-12 w-full rounded-full bg-white px-5 text-xs font-bold ring-1 ring-black/5.5 disabled:opacity-40"
            >
              Masuk Dashboard
            </button>
          </>
        ) : null}
      </footer>

      <ConfirmationModal
        open={showExitConfirm}
        title="Jeda setup sekarang?"
        description="Semua progres dan data yang telah Anda isi tersimpan dengan aman. Anda dapat melanjutkan setup ini kapan saja melalui Dashboard atau menu Pengaturan."
        tone="default"
        onClose={() => setShowExitConfirm(false)}
        actions={
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              type="button"
              onClick={() => setShowExitConfirm(false)}
              className="bg-surface-container text-on-surface min-h-12 rounded-full px-4 text-xs font-bold"
            >
              Kembali
            </motion.button>
            <motion.button
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              type="button"
              disabled={busy}
              onClick={() => {
                setShowExitConfirm(false);
                pause();
              }}
              className="bg-primary text-on-primary min-h-12 rounded-full px-4 text-xs font-bold disabled:opacity-45"
            >
              Jeda & Keluar
            </motion.button>
          </div>
        }
      />
    </section>
  );
}
