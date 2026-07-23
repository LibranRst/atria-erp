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
import { FinancialDefaultsPanel } from "@/features/onboarding/components/panels/financial-defaults-panel";
import { InitialStockSetupPanel } from "@/features/onboarding/components/panels/initial-stock-setup-panel";
import { LibraryPanel } from "@/features/onboarding/components/panels/library-panel";
import { MaterialFoundationPanel } from "@/features/onboarding/components/panels/material-foundation-panel";
import { SetupBankAccountsPanel } from "@/features/onboarding/components/panels/setup-bank-accounts-panel";
import { TeamVendorsPanel } from "@/features/onboarding/components/panels/team-vendors-panel";
import { OnboardingVerificationPanel } from "@/features/onboarding/components/panels/onboarding-verification-panel";
import type {
  OwnerOnboardingWorkspaceData,
  WorkspaceSource,
} from "@/features/onboarding/actions/get-owner-onboarding-workspace-data";
import {
  getOwnerOnboardingProgress,
  ONBOARDING_STEP_IDS,
  type OnboardingStepId,
  type OnboardingStepStatus,
} from "@/lib/onboarding/owner-onboarding";
import { ConfirmationModal, StatusBadge, type StatusBadgeTone } from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { AppIcon } from "@/components/ui/icon/app-icon";

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
    description: "Tinjau formula budget dan lima kategori biaya utama langsung dari halaman ini.",
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
    description: "Buka kembali langkah yang belum lengkap sebelum mulai menjalankan proyek.",
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

const statusBadgeTone: Record<OnboardingStepStatus, StatusBadgeTone> = {
  READY: "healthy",
  INCOMPLETE: "warning",
  PENDING_APPROVAL: "pending",
  NOT_APPLICABLE: "inactive",
  SKIPPED: "inactive",
  REVIEWED: "completed",
};

function statusClass(status: OnboardingStepStatus): string {
  if (status === "READY" || status === "NOT_APPLICABLE") return "bg-success-container text-success";
  if (status === "PENDING_APPROVAL") return "bg-accent-container text-accent";
  if (status === "SKIPPED" || status === "INCOMPLETE") return "bg-warning-container text-warning";
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
    <div className="flex min-h-17.5 items-center gap-3 px-4 py-3">
      <AppIcon
        name={icon}
        className="flex! h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-surface-container-low text-[20px] text-primary"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold text-on-surface">{title}</span>
        <span className="mt-0.5 block text-[10px] leading-4 text-on-surface-variant">{detail}</span>
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
    <div className="rounded-3xl bg-white px-5 py-6 text-center ring-1 ring-black/4">
      <AppIcon name="sync_problem" className="text-[28px] text-warning" />
      <p className="mt-2 text-[13px] font-bold text-on-surface">Data step belum dapat dimuat</p>
      <p className="mt-1 text-[10px] leading-4 text-on-surface-variant">{source.message}</p>
      <button
        type="button"
        onClick={retry}
        className="mt-4 min-h-12 rounded-full bg-surface-container-low px-5 text-xs font-bold text-on-surface"
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
                transition={transitionSpringSnappy}
                type="button"
                onClick={() => navigate(ONBOARDING_STEP_IDS[stepIndex - 1])}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-on-surface shadow-[0_5px_16px_rgba(17,17,17,0.08)] ring-1 ring-outline-variant/15 outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                aria-label="Kembali ke langkah sebelumnya"
              >
                <AppIcon name="arrow_back" className="text-[24px]" />
              </motion.button>
            ) : (
              <div className="h-10 w-10 shrink-0" />
            )}
          </div>
          <div className="min-w-0 text-center">
            <p className="text-[9px] leading-5 font-bold tracking-[0.14em] text-on-surface-variant uppercase">
              Setup Atria
            </p>
            <p className="truncate text-[11px] leading-4 font-semibold text-on-surface">
              {progress.label}
            </p>
          </div>
          <div className="flex justify-end">
            <motion.button
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              transition={transitionSpringSnappy}
              type="button"
              disabled={busy}
              onClick={() => setShowExitConfirm(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-on-surface shadow-[0_5px_16px_rgba(17,17,17,0.08)] ring-1 ring-outline-variant/15 outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-45"
              aria-label="Jeda dan keluar onboarding"
              title="Jeda dan keluar"
            >
              <AppIcon name="close" className="text-[24px]" />
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
            <p className="text-[9px] font-bold tracking-[0.14em] text-on-surface-variant uppercase">
              {copy.eyebrow}
            </p>
            {refreshing ? (
              <span className="text-[9px] font-semibold text-on-surface-variant">Memperbarui…</span>
            ) : null}
          </div>
          <h1 className="mt-1.5 text-[26px] leading-8 font-bold tracking-[-0.035em] text-on-surface">
            {copy.title}
          </h1>
          {copy.description ? (
            <p className="mt-2 text-[13px] leading-5 text-on-surface-variant">{copy.description}</p>
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
              <h2 className="mb-2 px-1 text-[12px] font-bold text-on-surface">
                Wajib diselesaikan
              </h2>
              <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/[0.035]">
                <div className="divide-y divide-outline-variant/20">
                  {overview.blockers.map((issue) => (
                    <button
                      key={`${issue.stepId}-${issue.label}`}
                      type="button"
                      onClick={() => navigate(issue.stepId)}
                      className="flex min-h-17 w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      <AppIcon name="priority_high" className="text-[20px] text-warning" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-bold text-on-surface">
                          {issue.label}
                        </span>
                        <span className="mt-0.5 block text-[9px] leading-4 text-on-surface-variant">
                          {issue.detail}
                        </span>
                      </span>
                      <AppIcon
                        name="chevron_right"
                        className="text-[18px] text-on-surface-variant"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
          {overview.warnings.length > 0 ? (
            <section>
              <h2 className="mb-2 px-1 text-[12px] font-bold text-on-surface">
                Boleh dilengkapi nanti
              </h2>
              <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/[0.035]">
                <div className="divide-y divide-outline-variant/20">
                  {overview.warnings.map((issue) => (
                    <button
                      key={`${issue.stepId}-${issue.label}`}
                      type="button"
                      onClick={() => navigate(issue.stepId)}
                      className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      <AppIcon name="info" className="text-[19px] text-on-surface-variant" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-bold text-on-surface">
                          {issue.label}
                        </span>
                        <span className="mt-0.5 block text-[9px] leading-4 text-on-surface-variant">
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
                    className="flex min-h-17 w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low"
                  >
                    <AppIcon
                      className={`h-9 w-9 shrink-0 rounded-full p-2 text-[18px] ${statusClass(item.status)}`}
                      name={
                        item.ready
                          ? "check"
                          : item.status === "PENDING_APPROVAL"
                            ? "hourglass_top"
                            : "priority_high"
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-on-surface">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-4 text-on-surface-variant">
                        {item.detail}
                      </span>
                    </span>
                    <StatusBadge
                      tone={statusBadgeTone[item.status]}
                      label={STATUS_LABEL[item.status]}
                    />
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
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={() => markAndContinue("REVIEWED")}
              className="min-h-12 w-full rounded-full bg-primary px-5 text-xs font-bold text-on-primary disabled:opacity-45"
            >
              {step === "welcome" ? "Mulai setup" : "Lanjut"}
            </motion.button>
            {step !== "welcome" && !readiness?.ready ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => markAndContinue("SKIPPED")}
                className="min-h-12 w-full rounded-full px-5 text-xs font-bold text-on-surface-variant disabled:opacity-45"
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
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
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
              onClick={() => finish("project")}
              className="min-h-12 w-full rounded-full bg-primary px-5 text-xs font-bold text-on-primary disabled:opacity-40"
            >
              Buat proyek pertama
            </motion.button>
            <button
              type="button"
              disabled={busy || !overview.canComplete}
              onClick={() => finish("dashboard")}
              className="min-h-12 w-full rounded-full bg-white px-5 text-xs font-bold text-on-surface ring-1 ring-black/5.5 disabled:opacity-40"
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
              transition={transitionSpringSnappy}
              type="button"
              onClick={() => setShowExitConfirm(false)}
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
                setShowExitConfirm(false);
                pause();
              }}
              className="min-h-12 rounded-full bg-primary px-4 text-xs font-bold text-on-primary disabled:opacity-45"
            >
              Jeda & Keluar
            </motion.button>
          </div>
        }
      />
    </section>
  );
}
