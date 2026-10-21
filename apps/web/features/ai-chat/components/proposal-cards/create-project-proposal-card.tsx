"use client";

import { confirmAiCreateProjectProposal } from "@/app/actions/ai/confirm-project-proposal";
import { MoneyValue, FormDisclosure } from "@/components/ui";
import { calculateTargetGross } from "@atria/core/budget/excel-budget";
import type { ProjectBudgetDefaults } from "@atria/core/ai/project-budget-defaults";
import { useRouter } from "@/lib/navigation/workspace-navigation";

import * as React from "react";
import { ProposalCardShell, ProposalItemRow } from "./proposal-card-shell";

export type CreateProjectProposalData = {
  readonly kind: "CREATE_PROJECT";
  readonly name: string;
  readonly clientId: string;
  readonly clientName: string;
  readonly newClientName?: string;
  readonly newClientPhone?: string;
  readonly projectManagerId: string;
  readonly projectManagerName: string;
  readonly totalContractValue: { readonly amount: number; readonly formatted: string };
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly location: string;
  readonly notes: string;
  readonly budgetDefaults?: ProjectBudgetDefaults;
};

type CreateProjectProposalCardProps = {
  readonly proposal: CreateProjectProposalData;
  readonly toolCallId: string;
  readonly conversationId: string | null;
  readonly alreadyConfirmed: boolean;
  readonly onNavigate?: () => void;
};

export function CreateProjectProposalCard({
  proposal,
  toolCallId,
  conversationId,
  alreadyConfirmed,
  onNavigate,
}: CreateProjectProposalCardProps): React.JSX.Element {
  const router = useRouter();
  const [status, setStatus] = React.useState<"idle" | "submitting" | "submitted" | "failed">(
    alreadyConfirmed ? "submitted" : "idle",
  );
  const [createdProjectId, setCreatedProjectId] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string>("");
  const [showBudgetCategories, setShowBudgetCategories] = React.useState(false);
  const budgetDefaults = proposal.budgetDefaults;
  const internalBudget = budgetDefaults
    ? proposal.totalContractValue.amount * budgetDefaults.budgetCapRatio
    : 0;
  const gross = calculateTargetGross(proposal.totalContractValue.amount, internalBudget);

  async function handleConfirm(): Promise<void> {
    if (!conversationId) {
      setStatus("failed");
      setErrorMessage("Sesi percakapan belum siap. Silakan coba lagi.");
      return;
    }

    setStatus("submitting");
    const result = await confirmAiCreateProjectProposal({
      toolCallId,
      conversationId,
      name: proposal.name,
      clientId: proposal.clientId || undefined,
      newClientName: proposal.newClientName || undefined,
      newClientPhone: proposal.newClientPhone || undefined,
      projectManagerId: proposal.projectManagerId,
      totalContractValue: proposal.totalContractValue.amount,
      startDate: proposal.startDate || undefined,
      endDate: proposal.endDate || undefined,
      location: proposal.location || undefined,
      notes: proposal.notes || undefined,
      budgetDefaults,
    });

    if (result.success) {
      setStatus("submitted");
      setCreatedProjectId(result.data.projectId);
      return;
    }

    setStatus("failed");
    setErrorMessage(result.error.message);
  }

  return (
    <ProposalCardShell
      eyebrow="Usulan Proyek Baru"
      title={proposal.name}
      status={status}
      errorMessage={errorMessage}
      isAlreadyConfirmed={alreadyConfirmed}
      confirmLabel="Buat Proyek Ini"
      submittedMessage="Proyek dan budget awal berhasil dibuat."
      onConfirm={handleConfirm}
      viewActionLabel="Buka Halaman Proyek"
      onViewAction={
        createdProjectId
          ? () => {
              onNavigate?.();
              router.push(`/projects/${createdProjectId}`);
            }
          : undefined
      }
    >
      <dl className="divide-y divide-outline-variant/20">
        <ProposalItemRow label="Klien" value={proposal.clientName} />
        <ProposalItemRow label="Project Manager" value={proposal.projectManagerName} />
        <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
          <dt className="text-support font-semibold text-on-surface-variant">Nilai Kontrak</dt>
          <dd className="min-w-0">
            <MoneyValue
              amount={proposal.totalContractValue.amount}
              variant="compact"
              size="lg"
              align="right"
            />
          </dd>
        </div>
        {proposal.startDate && proposal.endDate && (
          <ProposalItemRow
            label="Target Waktu"
            value={`${proposal.startDate} s/d ${proposal.endDate}`}
          />
        )}
        {proposal.location && proposal.location !== "-" && (
          <ProposalItemRow label="Lokasi" value={proposal.location} />
        )}
      </dl>
      {budgetDefaults ? (
        <div className="border-t border-outline-variant/20 px-4 pb-2">
          <p className="pt-3 text-support font-semibold text-on-surface">
            Budget awal · Pengaturan ERP
          </p>
          <dl className="divide-y divide-outline-variant/20">
            <ProposalItemRow
              label="Plafon budget"
              value={
                <MoneyValue amount={internalBudget} variant="compact" size="md" align="right" />
              }
              subvalue={`${(budgetDefaults.budgetCapRatio * 100).toLocaleString("id-ID", { maximumFractionDigits: 2 })}% nilai kontrak`}
            />
            <ProposalItemRow
              label="Target margin"
              value={`${gross.percentage.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`}
              subvalue={
                <MoneyValue amount={gross.amount} variant="fullDynamic" size="sm" align="right" />
              }
            />
          </dl>
          <FormDisclosure
            title="Alokasi per kategori"
            description={budgetDefaults.settingName}
            variant="plain"
            expanded={showBudgetCategories}
            onToggle={() => setShowBudgetCategories((current) => !current)}
          >
            <dl className="divide-y divide-outline-variant/20">
              {budgetDefaults.categories.map((category) => (
                <ProposalItemRow
                  key={category.expenseCategoryId}
                  label={category.name}
                  wrapLabel
                  value={
                    <MoneyValue
                      amount={internalBudget * category.ratioPercentage}
                      variant="compact"
                      size="sm"
                      align="right"
                    />
                  }
                  subvalue={`${(category.ratioPercentage * 100).toLocaleString("id-ID", { maximumFractionDigits: 2 })}% plafon budget`}
                />
              ))}
            </dl>
          </FormDisclosure>
        </div>
      ) : (
        <p className="border-t border-outline-variant/20 px-4 py-3 text-support text-on-surface-variant">
          Budget awal mengikuti Pengaturan ERP aktif.
        </p>
      )}
    </ProposalCardShell>
  );
}
