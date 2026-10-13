"use client";
import * as React from "react";
import { getAiRabExportPreview } from "@/app/actions/ai/rab-export";
import { useCan } from "@/components/auth/permissions-provider";
import { ButtonLink, FactRow, MoneyValue, SheetFooterActions } from "@/components/ui";
import { RabExportDrawer } from "@/features/projects/detail/components/rab/rab-export-drawer";
import type { RabExportFormat, RabExportProposal, RabExportView } from "@atria/core/ai/rab-export";
import { ProposalCardShell } from "./proposal-card-shell";
import { ProposalReviewFeedback } from "./proposal-review-feedback";

export function RabExportCard({
  proposal,
  conversationId,
  toolCallId,
  isStreaming,
  isBusy,
  onFollowUp,
}: {
  readonly proposal: RabExportProposal;
  readonly conversationId: string | null;
  readonly toolCallId: string;
  readonly isStreaming: boolean;
  readonly isBusy: boolean;
  readonly onFollowUp: (text: string) => void;
}): React.JSX.Element {
  const can = useCan();
  const allowed = can("use:ai_chat") && can("view:project") && can("view:rab");
  const [view, setView] = React.useState<RabExportView | null>(null),
    [error, setError] = React.useState(""),
    [open, setOpen] = React.useState(false),
    [downloaded, setDownloaded] = React.useState<RabExportFormat | null>(null);
  const [started, setStarted] = React.useState(false);
  const epoch = React.useRef(0);
  const refresh = React.useCallback((): Promise<void> => {
    if (!conversationId || isStreaming)
      return Promise.reject(new Error("Tunggu jawaban selesai sebelum membuka dokumen."));
    const n = ++epoch.current;
    return getAiRabExportPreview({ conversationId, toolCallId })
      .then((r) => {
        if (n !== epoch.current) throw new Error("Pemeriksaan dokumen berubah.");
        if (!r.success) {
          setView(null);
          setError(r.error.message);
          throw new Error(r.error.message);
        }
        setView(r.data);
        const message =
          r.data.status === "READY"
            ? ""
            : r.data.status === "EXPIRED"
              ? "Dokumen kedaluwarsa. Minta preview ekspor terbaru."
              : "RAB atau data dokumen berubah. Minta preview ekspor terbaru.";
        setError(message);
        if (message) throw new Error(message);
      })
      .catch((e: unknown) => {
        if (n === epoch.current) {
          setView(null);
          setError(e instanceof Error ? e.message : "Dokumen belum dapat dibaca. Periksa lagi.");
        }
        throw e;
      });
  }, [conversationId, toolCallId, isStreaming]);
  React.useEffect(() => {
    void refresh().catch(() => {});
    const ref = epoch;
    return () => {
      ref.current++;
    };
  }, [refresh]);
  const ready = allowed && view?.status === "READY" && Boolean(view.document) && !error;
  const feedback = error ? (
    <ProposalReviewFeedback
      embedded
      message={error}
      recovery={{ label: "Periksa lagi", onClick: () => void refresh().catch(() => {}) }}
    />
  ) : null;
  const correction = (): void =>
    onFollowUp(
      "Periksa revisi RAB terbaru dan siapkan ulang ekspor untuk proyek yang saya pilih. Jika proyek/revisi belum jelas, minta pilihan; jangan unduh atau kirim otomatis.",
    );
  return (
    <>
      <ProposalCardShell
        title="Ekspor RAB"
        status={error ? "failed" : "idle"}
        statusLabel={
          downloaded ? "Terunduh" : ready ? "Dokumen siap" : error ? "Perlu diperiksa" : "Memeriksa"
        }
        isAlreadyConfirmed={false}
        showConfirmAction={false}
        onConfirm={async () => {}}
        footer={
          <div className="space-y-2">
            <SheetFooterActions
              layout="adaptive"
              primary={{
                label: "Preview & unduh",
                disabled: !ready || isStreaming || isBusy,
                onClick: () => {
                  setStarted(true);
                  setOpen(true);
                  void refresh().catch(() => {});
                },
              }}
              secondary={{
                label: error ? "Minta preview terbaru" : "Koreksi lewat chat",
                variant: "quiet",
                disabled: isBusy || isStreaming,
                onClick: correction,
              }}
            />
            {downloaded && (
              <p role="status" className="text-support text-on-surface-variant">
                {downloaded === "PNG" ? "Gambar" : downloaded === "EXCEL" ? "Excel" : "PDF"} telah
                disiapkan. RAB tersimpan tetap.
              </p>
            )}
            {ready && (
              <ButtonLink
                href={`/projects/${proposal.input.projectId}?tab=rab`}
                variant="quiet"
                size="compact"
              >
                Buka RAB proyek
              </ButtonLink>
            )}
          </div>
        }
      >
        {ready ? (
          <>
            <div className="space-y-1 px-4 py-3">
              <p className="text-row font-semibold">{proposal.projectName}</p>
              <p className="text-support text-on-surface-variant">
                {proposal.title} · {proposal.clientName}
              </p>
            </div>
            <FactRow
              label="Revisi"
              value={`R${proposal.revision} · ${proposal.status === "APPROVED" ? "Disetujui" : "Draft"}`}
            />
            <FactRow label="Baris penawaran" value={proposal.rowCount} />
            <FactRow
              label="Total RAB"
              value={
                <MoneyValue
                  amount={Number(proposal.total)}
                  variant="fullDynamic"
                  fractionDigits={Number(proposal.total) % 1 === 0 ? 0 : 2}
                  size="sm"
                  align="right"
                />
              }
            />
          </>
        ) : (
          <div className="px-4 py-3">
            {feedback || (
              <p role="status" className="text-support text-on-surface-variant">
                Memeriksa dokumen dan akses proyek…
              </p>
            )}
          </div>
        )}
      </ProposalCardShell>
      {started && (
        <RabExportDrawer
          open={open}
          onClose={() => setOpen(false)}
          rabEstimate={ready ? (view?.document?.estimate ?? null) : null}
          meta={ready ? (view?.document?.meta ?? null) : null}
          sourceError={error || (!allowed ? "Akses dokumen tidak tersedia." : undefined)}
          initialFormat={proposal.input.format}
          verifySource={refresh}
          onRetry={() => void refresh().catch(() => {})}
          onDownloaded={setDownloaded}
        />
      )}
    </>
  );
}
