"use client";

import { useWorkspaceHref } from "@/lib/navigation/workspace-presentation";
import { useRouter } from "@/lib/navigation/workspace-navigation";

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
  const workspaceHref = useWorkspaceHref();
  const [step, setStep] = React.useState<OnboardingStepId>(initialStep);
  const [serverStep, setServerStep] = React.useState<OnboardingStepId>(initialStep);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);

  // Menyesuaikan langkah ketika server mengirim jawaban yang berbeda dari yang
  // sudah dipilih di klien — misalnya karena langkah tujuan ternyata datanya
  // sudah lengkap dan dilewati.
  //
  // Dulu penyelarasan ini dilakukan dengan `key` di halaman: setiap ganti
  // langkah, seluruh workspace dibongkar dan dibangun ulang. Padahal `navigate`
  // sudah menyetel langkahnya di klien lebih dulu, jadi yang dibongkar itu
  // pohon yang isinya sudah benar — dan itulah kedipannya. Pola ini menyetel
  // ulang state saat render, sebelum React sempat menampilkan apa pun.
  if (initialStep !== serverStep) {
    setServerStep(initialStep);
    setStep(initialStep);
  }
  const [refreshing, startRefresh] = React.useTransition();
  const [pending, startTransition] = React.useTransition();

  function navigate(next: OnboardingStepId): void {
    setStep(next);
    // Di dalam transisi, supaya React menahan layar yang sekarang sampai data
    // langkah berikutnya siap. Tanpa itu, navigasi yang dipanggil langsung —
    // tombol kembali di header — menjatuhkan halaman ke `loading.tsx` dulu:
    // isi, lalu kerangka, lalu isi lagi. Sekaligus menyalakan `refreshing`,
    // jadi tombolnya terkunci selama perpindahan.
    startRefresh(() => {
      router.replace(`/onboarding?step=${next}`, { scroll: false });
    });
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
      window.location.replace(workspaceHref("/ledger"));
    });
  }

  function finish(target: "dashboard" | "project"): void {
    startTransition(async () => {
      const result = await completeOwnerOnboarding();
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Fondasi Paduna Build siap digunakan.");
      window.location.replace(
        workspaceHref(target === "project" ? "/projects?new-project=true" : "/ledger"),
      );
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
