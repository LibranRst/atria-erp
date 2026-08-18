"use client";

import { confirmAiExpenseProposal } from "@/app/actions/ai/confirm-expense-proposal";
import { AppIcon, Button, MoneyValue, StatusBadge } from "@/components/ui";
import { transitionSpringSmooth } from "@/lib/utils/motion";
import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";

import type { ExpenseProposal } from "../utils/expense-proposal";

/**
 * Kartu usulan pengeluaran.
 *
 * Asisten hanya boleh mengusulkan. Kartu ini menampilkan seluruh rincian yang
 * akan tercatat, lalu penulisan dilakukan oleh Server Action ber-RBAC yang sama
 * dengan form manual — dipicu tombol konfirmasi, tidak pernah otomatis.
 *
 * Status "sudah dikonfirmasi" datang dari database (`alreadyConfirmed`), bukan
 * hanya dari state komponen. Tanpa itu, kartu lama akan tampil seolah belum
 * dikirim setiap kali riwayat dimuat ulang, dan pengguna bisa membuat dokumen
 * kedua untuk usulan yang sama.
 */

type ExpenseProposalCardProps = {
  readonly proposal: ExpenseProposal;
  readonly toolCallId: string;
  readonly conversationId: string | null;
  /** Terisi bila usulan ini sudah pernah dieksekusi menjadi dokumen. */
  readonly alreadyConfirmed: boolean;
};

type SubmitState =
  | { readonly kind: "idle" }
  | { readonly kind: "submitting" }
  | { readonly kind: "submitted" }
  | { readonly kind: "failed"; readonly message: string };

export function ExpenseProposalCard({
  proposal,
  toolCallId,
  conversationId,
  alreadyConfirmed,
}: ExpenseProposalCardProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const [state, setState] = React.useState<SubmitState>(
    alreadyConfirmed ? { kind: "submitted" } : { kind: "idle" },
  );

  const isSubmitted = state.kind === "submitted";

  async function confirm(): Promise<void> {
    if (!conversationId) {
      setState({
        kind: "failed",
        message: "Percakapan belum siap. Tutup dan buka kembali asisten, lalu coba lagi.",
      });
      return;
    }

    setState({ kind: "submitting" });
    const response = await confirmAiExpenseProposal({
      toolCallId,
      conversationId,
      projectId: proposal.projectId,
      projectBudgetCategoryId: proposal.projectBudgetCategoryId,
      description: proposal.description,
      quantity: proposal.quantity,
      unitPrice: proposal.unitPrice.amount,
      amount: proposal.amount.amount,
    });

    if (response.success) {
      setState({ kind: "submitted" });
      return;
    }
    setState({ kind: "failed", message: response.error.message });
  }

  return (
    <motion.section
      initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitionSpringSmooth}
      className="overflow-hidden rounded-owner bg-white shadow-surface ring-1 ring-ring-subtle"
      aria-label="Usulan pengajuan biaya"
    >
      <header className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-3">
        <div className="min-w-0">
          <p className="text-eyebrow font-bold tracking-widest text-on-surface-variant uppercase">
            Usulan pengajuan biaya
          </p>
          <h4 className="mt-1 truncate text-section font-bold tracking-[-0.015em] text-on-surface">
            {proposal.projectName}
          </h4>
        </div>
        <StatusBadge
          tone={isSubmitted ? "completed" : "pending"}
          label={isSubmitted ? "Terkirim" : "Belum dikirim"}
        />
      </header>

      <dl className="divide-y divide-black/5.5 border-t border-black/5.5">
        <ProposalRow label="Kategori" value={proposal.categoryName} />
        <ProposalRow label="Keperluan" value={proposal.description} />
        <ProposalRow
          label="Rincian"
          value={`${proposal.quantity} × ${proposal.unitPrice.formatted}`}
        />
        <div className="flex items-baseline justify-between gap-3 px-4 py-3">
          <dt className="text-support font-semibold text-on-surface-variant">Total</dt>
          <dd className="min-w-0">
            <MoneyValue amount={proposal.amount.amount} variant="compact" size="lg" align="right" />
          </dd>
        </div>
      </dl>

      {proposal.exceedsRemaining && !isSubmitted && (
        <p className="flex items-start gap-2 border-t border-black/5.5 bg-critical-container px-4 py-3 text-support font-semibold text-critical">
          <AppIcon name="warning" aria-hidden="true" className="mt-px icon-sm shrink-0" />
          <span>
            Nominal ini melewati sisa budget kategori ({proposal.remainingBeforeSubmit.formatted}).
            Pengajuan tetap bisa dikirim, tetapi akan butuh persetujuan Owner.
          </span>
        </p>
      )}

      <div className="border-t border-black/5.5 px-4 py-3.5">
        {isSubmitted ? (
          <p className="flex items-start gap-2 text-support font-semibold text-on-surface-variant">
            <AppIcon name="check_circle" aria-hidden="true" className="mt-px icon-sm shrink-0" />
            <span>
              Pengajuan tercatat dan menunggu verifikasi. Lanjutkan di menu Pengeluaran untuk
              melampirkan nota.
            </span>
          </p>
        ) : (
          <div className="space-y-2.5">
            {state.kind === "failed" && (
              <p
                className="flex items-start gap-2 text-support font-semibold text-critical"
                role="alert"
              >
                <AppIcon name="warning" aria-hidden="true" className="mt-px icon-sm shrink-0" />
                <span>{state.message}</span>
              </p>
            )}
            <Button
              variant="primary"
              className="w-full"
              disabled={state.kind === "submitting"}
              onClick={() => void confirm()}
            >
              {state.kind === "submitting" ? "Mengirim…" : "Konfirmasi dan ajukan"}
            </Button>
            <p className="text-meta font-semibold text-on-surface-variant">
              Asisten tidak mengirim apa pun sampai Anda menekan tombol ini.
            </p>
          </div>
        )}
      </div>
    </motion.section>
  );
}

function ProposalRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-3">
      <dt className="shrink-0 text-support font-semibold text-on-surface-variant">{label}</dt>
      <dd className="min-w-0 text-right text-row font-semibold text-on-surface">{value}</dd>
    </div>
  );
}
