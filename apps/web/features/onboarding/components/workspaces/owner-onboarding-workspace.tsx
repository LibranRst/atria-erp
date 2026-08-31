"use client";

import { useRouter } from "next/navigation";
import React from "react";
import { toast } from "sonner";

import {
  advanceOwnerOnboardingStep,
  completeOwnerOnboarding,
  pauseOwnerOnboarding,
} from "@/app/actions/onboarding";
import type { OwnerOnboardingWorkspaceData } from "@/features/onboarding/server/get-owner-onboarding-workspace-data";
import type { OnboardingStepId } from "@atria/core/onboarding/owner-onboarding";
import { OnboardingStepContent } from "./onboarding-step-content";
import { OnboardingWorkspaceActions } from "./onboarding-workspace-actions";
import { OnboardingWorkspaceHeader } from "./onboarding-workspace-header";

type InitialStockDecision = "NO_LEGACY_STOCK" | "HAS_LEGACY_STOCK" | "SKIPPED";

export function OwnerOnboardingWorkspace({
  initialData,
  initialStep,
}: {
  readonly initialData: OwnerOnboardingWorkspaceData;
  readonly initialStep: OnboardingStepId;
}): React.JSX.Element {
  const router = useRouter();
  const [step, setStep] = React.useState<OnboardingStepId>(initialStep);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);
  const [refreshing, startRefresh] = React.useTransition();
  const [pending, startTransition] = React.useTransition();

  function navigate(next: OnboardingStepId): void {
    setStep(next);
    router.replace(`/onboarding?step=${next}`, { scroll: false });
  }

  function refreshWorkspace(): void {
    startRefresh(() => router.refresh());
  }

  function markAndContinue(
    disposition: "REVIEWED" | "SKIPPED" = "REVIEWED",
    initialStockDecision?: InitialStockDecision,
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
      // Tanpa router.refresh() di sini. `advanceOwnerOnboardingStep` sudah
      // memanggil revalidatePath("/onboarding"), jadi navigasi di bawah ini
      // sendiri yang mengambil data baru. Menambahkan refresh membuat satu klik
      // "Lanjut" memicu dua render server berturut-turut atas data yang sama —
      // dan karena halaman ini force-dynamic, dua-duanya benar-benar menembak
      // ketujuh sumber datanya. Itu yang terasa seperti halaman ke-refresh dua
      // kali.
      navigate(result.data.nextStep);
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
    <section className="w-full space-y-sm px-1 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <OnboardingWorkspaceHeader
        step={step}
        busy={busy}
        refreshing={refreshing}
        onNavigate={navigate}
        onExit={() => setShowExitConfirm(true)}
      />
      <OnboardingStepContent
        step={step}
        data={initialData}
        onNavigate={navigate}
        onRefresh={refreshWorkspace}
        onMark={markAndContinue}
      />
      <OnboardingWorkspaceActions
        step={step}
        overview={initialData.overview}
        busy={busy}
        exitConfirmOpen={showExitConfirm}
        onExitConfirmChange={setShowExitConfirm}
        onMark={markAndContinue}
        onFinish={finish}
        onPause={pause}
      />
    </section>
  );
}
