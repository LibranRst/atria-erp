"use client";

import { confirmAiSetupBudgetProposal } from "@/app/actions/ai/confirm-project-proposal";
import { MoneyValue } from "@/components/ui";
import { useRouter } from "@/lib/navigation/workspace-navigation";

import * as React from "react";
import { ProposalCardShell } from "./proposal-card-shell";

export type SetupBudgetProposalData = {
  readonly kind: "SETUP_BUDGET";
  readonly projectId: string;
  readonly projectName: string;
  readonly alreadyHasBudget: boolean;
  readonly contractValue: { readonly amount: number; readonly formatted: string };
  readonly budgetCapRatio: number;
  readonly budgetCapPercentageLabel: string;
  readonly internalBudget: { readonly amount: number; readonly formatted: string };
  readonly targetGrossAmount: { readonly amount: number; readonly formatted: string };
  readonly targetGrossPercentage: number;
  readonly categories: readonly {
    readonly expenseCategoryId: string;
    readonly categoryCode: string;
    readonly categoryName: string;
    readonly ratioPercentage: number;
    readonly ratioPercentageLabel: string;
    readonly allocated: { readonly amount: number; readonly formatted: string };
    readonly sortOrder: number;
  }[];
};

type SetupBudgetProposalCardProps = {
  readonly proposal: SetupBudgetProposalData;
  readonly toolCallId: string;
  readonly conversationId: string | null;
  readonly alreadyConfirmed: boolean;
  readonly onNavigate?: () => void;
};

export function SetupBudgetProposalCard({
  proposal,
  toolCallId,
  conversationId,
  alreadyConfirmed,
  onNavigate,
}: SetupBudgetProposalCardProps): React.JSX.Element {
  const router = useRouter();
  const [status, setStatus] = React.useState<"idle" | "submitting" | "submitted" | "failed">(
    alreadyConfirmed ? "submitted" : "idle",
  );
  const [errorMessage, setErrorMessage] = React.useState<string>("");

  async function handleConfirm(): Promise<void> {
    if (!conversationId) {
      setStatus("failed");
      setErrorMessage("Sesi percakapan belum siap. Silakan coba lagi.");
      return;
    }

    setStatus("submitting");
    const result = await confirmAiSetupBudgetProposal({
      toolCallId,
      conversationId,
      projectId: proposal.projectId,
      contractValue: proposal.contractValue.amount,
      budgetCapRatio: proposal.budgetCapRatio,
      categories: proposal.categories.map((c) => ({
        expenseCategoryId: c.expenseCategoryId,
        ratioPercentage: c.ratioPercentage,
        sortOrder: c.sortOrder,
      })),
      notes: "Alokasi budget awal disetujui via Asisten AI",
    });

    if (result.success) {
      setStatus("submitted");
      return;
    }

    setStatus("failed");
    setErrorMessage(result.error.message);
  }

  return (
    <ProposalCardShell
      eyebrow="Usulan Alokasi Budget"
      title={proposal.projectName}
      status={status}
      errorMessage={errorMessage}
      isAlreadyConfirmed={alreadyConfirmed}
      confirmLabel="Terapkan Alokasi Budget"
      submittedMessage="Budget internal proyek berhasil dialokasikan per kategori."
      onConfirm={handleConfirm}
      viewActionLabel="Lihat Budget Proyek"
      onViewAction={() => {
        onNavigate?.();
        router.push(`/projects/${proposal.projectId}`);
      }}
    >
      <div className="bg-surface-container-low/50 p-3">
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-ring-subtle">
            <p className="text-meta font-semibold text-on-surface-variant">
              Cap Budget Internal ({proposal.budgetCapPercentageLabel})
            </p>
            <div className="mt-1">
              <MoneyValue
                amount={proposal.internalBudget.amount}
                variant="compact"
                size="md"
                align="center"
              />
            </div>
          </div>
          <div className="rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-ring-subtle">
            <p className="text-meta font-semibold text-on-surface-variant">
              Target Margin ({proposal.targetGrossPercentage}%)
            </p>
            <div className="mt-1">
              <MoneyValue
                amount={proposal.targetGrossAmount.amount}
                variant="compact"
                size="md"
                align="center"
              />
            </div>
          </div>
        </div>
      </div>

      <dl className="divide-y divide-black/5.5">
        {proposal.categories.map((cat) => (
          <div
            key={cat.expenseCategoryId}
            className="flex items-baseline justify-between gap-3 px-4 py-2.5"
          >
            <dt className="flex items-center gap-1.5 text-support font-semibold text-on-surface">
              <span>{cat.categoryName}</span>
              <span className="text-meta font-normal text-on-surface-variant">
                ({cat.ratioPercentageLabel})
              </span>
            </dt>
            <dd className="min-w-0">
              <MoneyValue amount={cat.allocated.amount} variant="compact" size="sm" align="right" />
            </dd>
          </div>
        ))}
      </dl>
    </ProposalCardShell>
  );
}
