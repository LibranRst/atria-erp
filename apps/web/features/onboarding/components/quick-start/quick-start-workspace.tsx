"use client";

import { useWorkspaceHref } from "@/lib/navigation/workspace-presentation";
import { useRouter } from "@/lib/navigation/workspace-navigation";

import React from "react";
import { toast } from "sonner";

import {
  advanceQuickStart,
  pauseQuickStart,
  recordQuickStartRetry,
} from "@/app/actions/quick-start";
import {
  AppIcon,
  Button,
  ButtonLink,
  ConfirmationDialog,
  GroupedSurface,
  InlineStateRow,
  MoneyValue,
} from "@/components/ui";
import { FinancialDefaultsPanel } from "@/features/onboarding/components/panels/financial-defaults-panel";
import type { QuickStartWorkspaceData } from "@/features/onboarding/server/get-quick-start-workspace-data";
import type { QuickStartStepId } from "@atria/core/onboarding/organization-setup";
import { FirstProjectPanel, type CreatedFirstProjectSummary } from "./first-project-panel";
import { QuickStartHeader } from "./quick-start-header";

export function QuickStartWorkspace({
  initialData,
}: {
  readonly initialData: QuickStartWorkspaceData;
}): React.JSX.Element {
  const router = useRouter();
  const workspaceHref = useWorkspaceHref();
  const [exitOpen, setExitOpen] = React.useState(false);
  const [created, setCreated] = React.useState<CreatedFirstProjectSummary | null>(null);
  const [pending, startTransition] = React.useTransition();
  const step: QuickStartStepId = created ? "success" : initialData.activeStep;

  function advance(): void {
    if (step !== "welcome" && step !== "financial_defaults") return;
    startTransition(async () => {
      const result = await advanceQuickStart({ stepId: step });
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      router.replace(`/onboarding?step=${result.data.currentStep}`, { scroll: false });
    });
  }

  function pause(): void {
    if (step === "success") return;
    startTransition(async () => {
      const result = await pauseQuickStart({ currentStep: step });
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Quick start dijeda. Data yang sudah disimpan tetap aman.");
      window.location.replace(workspaceHref("/ledger"));
    });
  }

  function retry(): void {
    startTransition(async () => {
      await recordQuickStartRetry({ event: "RETRY", stepId: step });
      router.refresh();
    });
  }

  return (
    <section className="w-full space-y-4 px-1 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <QuickStartHeader step={step} busy={pending} onExit={() => setExitOpen(true)} />

      {step === "welcome" ? (
        <div className="space-y-4">
          <GroupedSurface>
            <div className="divide-y divide-outline-variant/20">
              <InlineStateRow
                icon="trending_up"
                title="Lihat budget dan margin pertama"
                description="Project Draft langsung memakai default kategori yang Anda review."
              />
              <InlineStateRow
                icon="schedule"
                title="Sekitar 10–15 menit"
                description="Tim, rekening, material, dan stok dapat dilengkapi setelah project terbentuk."
              />
              <InlineStateRow
                icon="verified_user"
                title="Belum ada kas atau stok bergerak"
                description="Quick start hanya membuat project Draft dan baseline budget yang dapat ditinjau."
              />
            </div>
          </GroupedSurface>
          <Button type="button" fullWidth pending={pending} onClick={advance}>
            Mulai quick start
          </Button>
        </div>
      ) : null}

      {step === "financial_defaults" ? (
        initialData.financial?.status === "ready" ? (
          <div className="space-y-4">
            <FinancialDefaultsPanel
              budgetSetting={initialData.financial.budget.budgetAllocationSetting}
              categories={initialData.financial.categories.expenseCategories}
              canManageBudget={initialData.financial.budget.permissions.canManageBudgetSettings}
              canManageCategories={
                initialData.financial.categories.permissions.canManageExpenseCategories
              }
              onMutationComplete={() => router.refresh()}
            />
            <Button type="button" fullWidth pending={pending} onClick={advance}>
              Gunakan default ini
            </Button>
          </div>
        ) : (
          <GroupedSurface className="p-5 text-center">
            <AppIcon name="sync_problem" className="icon-2xl text-warning" />
            <p className="mt-2 text-row font-bold text-on-surface">
              Default finansial belum dapat dimuat
            </p>
            <p className="mt-1 text-meta text-on-surface-variant">
              {initialData.financial?.message ?? "Coba muat ulang halaman."}
            </p>
            <Button
              type="button"
              variant="secondary"
              className="mt-4"
              pending={pending}
              onClick={retry}
            >
              Coba lagi
            </Button>
          </GroupedSurface>
        )
      ) : null}

      {step === "first_project" ? (
        initialData.project?.status === "ready" ? (
          <FirstProjectPanel
            data={initialData.project}
            onCreated={(summary) => {
              setCreated(summary);
              toast.success("Project Draft dan budget awal berhasil dibuat.");
            }}
          />
        ) : (
          <GroupedSurface className="p-5 text-center">
            <AppIcon name="sync_problem" className="icon-2xl text-warning" />
            <p className="mt-2 text-row font-bold text-on-surface">
              Data project belum dapat dimuat
            </p>
            <p className="mt-1 text-meta text-on-surface-variant">
              {initialData.project?.message ?? "Coba muat ulang halaman."}
            </p>
            <Button
              type="button"
              variant="secondary"
              className="mt-4"
              pending={pending}
              onClick={retry}
            >
              Coba lagi
            </Button>
          </GroupedSurface>
        )
      ) : null}

      {step === "success" && created ? (
        <div className="space-y-4">
          <GroupedSurface>
            <div className="p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-icon bg-surface-container-low text-on-surface">
                  <AppIcon name="task_alt" className="icon-lg" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-row font-bold text-on-surface">{created.name}</span>
                  <span className="block text-meta text-on-surface-variant">
                    Draft aman untuk dilengkapi sebelum aktivasi.
                  </span>
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-inset bg-surface-container-low p-3">
                  <p className="text-meta text-on-surface-variant">Nilai project</p>
                  <MoneyValue amount={created.contractValue} variant="compact" size="sm" />
                </div>
                <div className="rounded-inset bg-surface-container-low p-3">
                  <p className="text-meta text-on-surface-variant">Budget internal</p>
                  <MoneyValue amount={created.internalBudget} variant="compact" size="sm" />
                </div>
              </div>
            </div>
          </GroupedSurface>
          <ButtonLink href={`/projects/${created.id}?tab=overview`} variant="primary" fullWidth>
            Lihat project
          </ButtonLink>
          <ButtonLink href="/settings?tab=readiness" variant="secondary" fullWidth>
            Lihat kesiapan operasional
          </ButtonLink>
        </div>
      ) : null}

      <ConfirmationDialog
        open={exitOpen}
        title="Jeda quick start sekarang?"
        description="Progress yang sudah disimpan tetap aman. Anda dapat melanjutkan dari Dashboard."
        tone="default"
        onClose={() => setExitOpen(false)}
        actions={
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="secondary" fullWidth onClick={() => setExitOpen(false)}>
              Kembali
            </Button>
            <Button
              type="button"
              pending={pending}
              fullWidth
              onClick={() => {
                setExitOpen(false);
                pause();
              }}
            >
              Jeda & keluar
            </Button>
          </div>
        }
      />
    </section>
  );
}
