import React from "react";

import { AppIcon, DuotoneIconTile, StatusBadge, Button } from "@/components/ui";
import { FinancialDefaultsPanel } from "@/features/onboarding/components/panels/financial-defaults-panel";
import { InitialStockSetupPanel } from "@/features/onboarding/components/panels/initial-stock-setup-panel";
import { LibraryPanel } from "@/features/onboarding/components/panels/library-panel";
import { MaterialFoundationPanel } from "@/features/onboarding/components/panels/material-foundation-panel";
import { OnboardingVerificationPanel } from "@/features/onboarding/components/panels/onboarding-verification-panel";
import { SetupBankAccountsPanel } from "@/features/onboarding/components/panels/setup-bank-accounts-panel";
import { TeamVendorsPanel } from "@/features/onboarding/components/panels/team-vendors-panel";
import type {
  OwnerOnboardingWorkspaceData,
  WorkspaceSource,
} from "@/features/onboarding/server/get-owner-onboarding-workspace-data";
import type { OnboardingStepId } from "@atria/core/onboarding/owner-onboarding";
import {
  ONBOARDING_STATUS_LABEL,
  onboardingStatusBadgeTone,
  onboardingStatusClass,
} from "./onboarding-workspace-presentation";

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
      <DuotoneIconTile name={icon} />
      <span className="min-w-0 flex-1">
        <span className="block text-row font-bold text-on-surface">{title}</span>
        <span className="mt-0.5 block text-meta text-on-surface-variant">{detail}</span>
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
    <div className="rounded-3xl bg-white px-5 py-6 text-center ring-1 ring-ring-subtle">
      <AppIcon name="sync_problem" className="icon-2xl text-warning" />
      <p className="mt-2 text-row font-bold text-on-surface">Data step belum dapat dimuat</p>
      <p className="mt-1 text-meta text-on-surface-variant">{source.message}</p>
      <Button
        type="button"
        onClick={retry}
        className="mt-4 min-h-12 rounded-full bg-surface-container-low px-5 text-xs font-bold text-on-surface"
        variant="secondary"
      >
        Coba lagi
      </Button>
    </div>
  );
}

function OnboardingSummary({
  overview,
  onNavigate,
}: {
  readonly overview: OwnerOnboardingWorkspaceData["overview"];
  readonly onNavigate: (step: OnboardingStepId) => void;
}): React.JSX.Element {
  return (
    <div className="space-y-4">
      {overview.blockers.length > 0 ? (
        <section>
          <h2 className="mb-2 px-1 text-[12px] font-bold text-on-surface">Wajib diselesaikan</h2>
          <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-ring-subtle">
            <div className="divide-y divide-outline-variant/20">
              {overview.blockers.map((issue) => (
                <button
                  key={`${issue.stepId}-${issue.label}`}
                  type="button"
                  onClick={() => onNavigate(issue.stepId)}
                  className="flex min-h-17 w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <AppIcon name="priority_high" className="icon-lg text-warning" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-bold text-on-surface">
                      {issue.label}
                    </span>
                    <span className="mt-0.5 block text-[9px] leading-4 text-on-surface-variant">
                      {issue.detail}
                    </span>
                  </span>
                  <AppIcon name="chevron_right" className="icon-md text-on-surface-variant" />
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
          <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-ring-subtle">
            <div className="divide-y divide-outline-variant/20">
              {overview.warnings.map((issue) => (
                <button
                  key={`${issue.stepId}-${issue.label}`}
                  type="button"
                  onClick={() => onNavigate(issue.stepId)}
                  className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <AppIcon name="info" className="text-[19px] text-on-surface-variant" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-support font-bold text-on-surface">
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
      <div className="overflow-hidden rounded-owner bg-white ring-1 ring-ring-subtle">
        <div className="divide-y divide-black/5.5">
          {overview.readiness
            .filter((item) => item.id !== "summary")
            .map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className="flex min-h-17 w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low"
              >
                <AppIcon
                  className={`icon-md h-9 w-9 shrink-0 rounded-full p-2 ${onboardingStatusClass(item.status)}`}
                  name={
                    item.ready
                      ? "check"
                      : item.status === "PENDING_APPROVAL"
                        ? "hourglass_top"
                        : "priority_high"
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-row font-bold text-on-surface">{item.label}</span>
                  <span className="mt-0.5 block text-meta text-on-surface-variant">
                    {item.detail}
                  </span>
                </span>
                <StatusBadge
                  tone={onboardingStatusBadgeTone[item.status]}
                  label={ONBOARDING_STATUS_LABEL[item.status]}
                />
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

export function OnboardingStepContent({
  step,
  data,
  onNavigate,
  onRefresh,
  onMark,
}: {
  readonly step: OnboardingStepId;
  readonly data: OwnerOnboardingWorkspaceData;
  readonly onNavigate: (step: OnboardingStepId) => void;
  readonly onRefresh: () => void;
  readonly onMark: (
    disposition: "REVIEWED" | "SKIPPED",
    initialStockDecision?: "NO_LEGACY_STOCK" | "HAS_LEGACY_STOCK" | "SKIPPED",
  ) => void;
}): React.JSX.Element {
  const snapshot = data.verificationSnapshots.find((item) => item.kind === step);

  return (
    <>
      {step === "welcome" ? (
        <div className="overflow-hidden rounded-owner bg-white shadow-surface ring-1 ring-ring-subtle">
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
        data.settings.status === "ready" ? (
          <FinancialDefaultsPanel
            budgetSetting={data.settings.data.budgetAllocationSetting}
            categories={data.settings.data.expenseCategories}
            canManageBudget={data.settings.data.permissions.canManageBudgetSettings}
            canManageCategories={data.settings.data.permissions.canManageExpenseCategories}
            onMutationComplete={onRefresh}
          />
        ) : (
          <SourceError source={data.settings} retry={onRefresh} />
        )
      ) : null}
      {step === "team_vendors" ? (
        data.administration.status === "ready" ? (
          <TeamVendorsPanel data={data.administration.data} onMutationComplete={onRefresh} />
        ) : (
          <SourceError source={data.administration} retry={onRefresh} />
        )
      ) : null}
      {step === "bank_accounts" ? (
        data.bankAccounts.status === "ready" ? (
          <SetupBankAccountsPanel
            initialAccounts={data.bankAccounts.data}
            onMutationComplete={onRefresh}
          />
        ) : (
          <SourceError source={data.bankAccounts} retry={onRefresh} />
        )
      ) : null}
      {step === "material_foundation" ? (
        data.settings.status === "ready" ? (
          <MaterialFoundationPanel
            key={`${data.settings.data.inventoryLocations.map((row) => row.id).join(":")}-${data.settings.data.materials.map((row) => row.id).join(":")}`}
            settings={data.settings.data}
            onMutationComplete={onRefresh}
          />
        ) : (
          <SourceError source={data.settings} retry={onRefresh} />
        )
      ) : null}
      {step === "item_library" ? (
        data.settings.status === "ready" && data.library.status === "ready" ? (
          <LibraryPanel
            settings={data.settings.data}
            items={data.library.data}
            onMutationComplete={onRefresh}
          />
        ) : (
          <SourceError
            source={data.settings.status === "error" ? data.settings : data.library}
            retry={onRefresh}
          />
        )
      ) : null}
      {step === "initial_stock" ? (
        data.initialStock.status === "ready" ? (
          <InitialStockSetupPanel
            candidates={data.initialStock.data.candidates}
            batches={data.initialStock.data.batches}
            simulation={
              data.developerSimulation.status === "ready" ? data.developerSimulation.data : null
            }
            onMutationComplete={onRefresh}
            onNoLegacyStock={() => onMark("REVIEWED", "NO_LEGACY_STOCK")}
            onSkip={() => onMark("SKIPPED", "SKIPPED")}
          />
        ) : (
          <SourceError source={data.initialStock} retry={onRefresh} />
        )
      ) : null}
      {step === "summary" ? (
        <OnboardingSummary overview={data.overview} onNavigate={onNavigate} />
      ) : null}
      {/*
        Tidak di welcome: panel ini melaporkan kesiapan data satu langkah, dan di
        layar sambutan belum ada satu pun data yang bisa dilaporkan. Yang muncul
        cuma "Setup siap dimulai." — sebuah pengungkap yang dibuka untuk tidak
        memberitahu apa-apa, tepat di layar yang tugasnya menjelaskan alurnya.
      */}
      {step !== "summary" && step !== "welcome" ? (
        <OnboardingVerificationPanel snapshot={snapshot} />
      ) : null}
    </>
  );
}
