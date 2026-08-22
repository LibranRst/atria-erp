"use client";

import { confirmAiCreateProjectProposal } from "@/app/actions/ai/confirm-project-proposal";
import { MoneyValue } from "@/components/ui";
import { useRouter } from "next/navigation";
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
      submittedMessage="Proyek berhasil dibuat dalam status DRAFT."
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
      <dl className="divide-y divide-black/5.5">
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
    </ProposalCardShell>
  );
}
