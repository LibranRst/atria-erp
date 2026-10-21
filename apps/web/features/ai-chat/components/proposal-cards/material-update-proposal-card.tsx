"use client";

import {
  confirmAiMaterialUpdateProposal,
  getAiMaterialUpdateProposal,
} from "@/app/actions/ai/material-update";
import { ActionMenu, AppIcon, Button, IconButton } from "@/components/ui";
import {
  materialUpdateDiff,
  type MaterialUpdateProposal,
  type MaterialUpdateView,
} from "@atria/core/ai/material-update";
import * as React from "react";
import { ProposalCardShell, ProposalDiffRow } from "./proposal-card-shell";

const STATUS_LABELS: Record<MaterialUpdateView["status"], string> = {
  READY: "Usulan",
  STALE: "Data berubah",
  EXPIRED: "Kedaluwarsa",
  CONFIRMED: "Tersimpan",
};
export function MaterialUpdateProposalCard({
  proposal: initialProposal,
  conversationId,
  toolCallId,
  isStreaming,
  isBusy,
  alreadyConfirmed,
  onFollowUp,
}: {
  readonly proposal: MaterialUpdateProposal;
  readonly conversationId: string | null;
  readonly toolCallId: string;
  readonly isStreaming: boolean;
  readonly isBusy: boolean;
  readonly alreadyConfirmed: boolean;
  readonly onFollowUp: (text: string) => void;
}): React.JSX.Element {
  const [view, setView] = React.useState<MaterialUpdateView | null>(null);
  const [status, setStatus] = React.useState<"idle" | "submitting" | "submitted" | "failed">(
    "idle",
  );
  const [error, setError] = React.useState("");
  const epoch = React.useRef(0);
  const saving = React.useRef(false);
  const proposal = view?.proposal ?? initialProposal;
  const changes = materialUpdateDiff(proposal.before, proposal.after);
  const confirmed = alreadyConfirmed || view?.status === "CONFIRMED" || status === "submitted";
  const needsRefresh = view?.status === "STALE" || view?.status === "EXPIRED";
  const refresh = React.useCallback(
    (clearError = true): Promise<void> => {
      if (!conversationId || isStreaming) return Promise.resolve();
      const request = ++epoch.current;
      return getAiMaterialUpdateProposal({ conversationId, toolCallId })
        .then((result): void => {
          if (request !== epoch.current) return;
          if (result.success) {
            setView(result.data);
            if (clearError) {
              setError("");
              setStatus("idle");
            }
          } else {
            setView(null);
            setStatus("failed");
            setError(result.error.message);
          }
        })
        .catch((): void => {
          if (request === epoch.current) {
            setStatus("failed");
            setError("Status usulan belum dapat diperiksa. Coba lagi.");
          }
        });
    },
    [conversationId, toolCallId, isStreaming],
  );
  React.useEffect(() => {
    void refresh();
    return () => {
      epoch.current += 1;
    };
  }, [refresh]);
  async function confirm(): Promise<void> {
    if (!conversationId || isStreaming || saving.current || view?.status !== "READY" || confirmed)
      return;
    saving.current = true;
    epoch.current += 1;
    setStatus("submitting");
    setError("");
    try {
      const result = await confirmAiMaterialUpdateProposal({ conversationId, toolCallId });
      if (result.success) setStatus("submitted");
      else {
        setStatus("failed");
        setError(result.error.message);
        await refresh(false);
      }
    } catch {
      setStatus("failed");
      setError("Perubahan belum tersimpan. Coba lagi; konfirmasi yang sama aman diulang.");
    } finally {
      saving.current = false;
    }
  }
  const warning = needsRefresh
    ? view.status === "STALE"
      ? "Data material sudah berubah. Minta usulan terbaru agar perubahan lain tetap terjaga."
      : "Usulan sudah melewati masa review 30 hari. Minta usulan terbaru."
    : proposal.before.isActive && !proposal.after.isActive
      ? "Material akan menjadi nonaktif. Stok dan dokumen lama tetap tersimpan."
      : null;
  return (
    <ProposalCardShell
      title="Ubah material"
      status={status}
      statusLabel={
        confirmed
          ? "Tersimpan"
          : status === "submitting"
            ? "Menyimpan"
            : view
              ? STATUS_LABELS[view.status]
              : "Memeriksa"
      }
      isAlreadyConfirmed={confirmed}
      disabled={isStreaming || view?.status !== "READY"}
      disabledReason={
        isStreaming
          ? "Tunggu jawaban selesai sebelum menyimpan."
          : !view
            ? "Periksa status usulan sebelum menyimpan."
            : needsRefresh
              ? "Usulan lama tidak menimpa data terbaru."
              : "Hanya data master yang berubah; stok dan transaksi tetap."
      }
      showConfirmAction={!needsRefresh}
      confirmLabel="Simpan perubahan"
      submittedMessage="Perubahan Material Master tersimpan dan tercatat di audit. Stok dan transaksi tetap."
      errorMessage={error}
      warningMessage={warning}
      onConfirm={confirm}
      headerAction={
        <ActionMenu
          label="Opsi usulan material"
          trigger={
            <IconButton
              label="Opsi usulan material"
              icon={<AppIcon name="more_horiz" className="icon-md" />}
              size="compact"
              variant="tertiary"
            />
          }
          items={[
            {
              id: "refresh",
              label: "Periksa status usulan",
              icon: "refresh",
              onSelect: () => void refresh(),
              disabledReason:
                isStreaming || status === "submitting" ? "Tunggu proses selesai." : undefined,
            },
          ]}
        />
      }
    >
      <div className="space-y-1 px-4 py-3">
        <p className="text-row font-semibold wrap-anywhere text-on-surface">
          {proposal.before.name}
        </p>
        <p className="text-meta wrap-anywhere text-on-surface-variant">
          {proposal.before.code ? `Kode ${proposal.before.code} · ` : ""}
          {proposal.before.categoryName} · {proposal.before.unit} · {changes.length} perubahan
        </p>
      </div>
      <div className="divide-y divide-outline-variant/20 border-t border-outline-variant/20">
        {changes.map((change) => (
          <ProposalDiffRow
            key={change.key}
            label={change.label}
            before={change.before}
            after={change.after}
            layout="stacked"
            tone={change.key === "isActive" && !proposal.after.isActive ? "negative" : "neutral"}
          />
        ))}
      </div>
      {!confirmed && (
        <div className="border-t border-outline-variant/20 px-4 py-3">
          <Button
            variant="tertiary"
            size="compact"
            disabled={isBusy || isStreaming || status === "submitting"}
            onClick={() =>
              onFollowUp(
                needsRefresh
                  ? "Siapkan ulang usulan edit Material Master terakhir berdasarkan data terbaru. Pertahankan perubahan yang terakhir saya minta."
                  : "Saya ingin mengoreksi usulan edit Material Master terakhir. Tanyakan field yang ingin saya ubah.",
              )
            }
          >
            <AppIcon name={needsRefresh ? "refresh" : "edit"} className="icon-sm" />
            {needsRefresh ? "Minta usulan terbaru" : "Koreksi melalui chat"}
          </Button>
        </div>
      )}
    </ProposalCardShell>
  );
}
