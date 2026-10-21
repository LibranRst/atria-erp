"use client";
import * as React from "react";
import {
  Button,
  ButtonLink,
  FormSheet,
  GroupedSurface,
  FactRow,
  ReviewCollection,
  ReviewItem,
  ConfirmationDialog,
  FormDisclosure,
  AppIcon,
  SheetFooterActions,
} from "@/components/ui";
import { useCan } from "@/components/auth/permissions-provider";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import {
  getAiExpenseBatchAction,
  confirmAiExpenseBatchAction,
} from "@/app/actions/ai/expense-batch-action";
import {
  expenseBatchActionPermissions,
  type ExpenseBatchActionProposal,
} from "@atria/core/ai/expense-batch";
import { ProposalCardShell } from "./proposal-card-shell";
import {
  ProposalInlineReview,
  inlineProposalValue,
  type InlineProposalComparison,
} from "./proposal-inline-review";
import { ProposalReviewFeedback } from "./proposal-review-feedback";
/** Inherited Operate: reviewed immutable batch, separate decisions and protected cash recording. */
export function ExpenseBatchActionCard({
  proposal: initial,
  conversationId,
  toolCallId,
  isStreaming,
  isBusy,
  alreadyConfirmed,
  onFollowUp,
}: {
  readonly proposal: ExpenseBatchActionProposal;
  readonly conversationId: string | null;
  readonly toolCallId: string;
  readonly isStreaming: boolean;
  readonly isBusy: boolean;
  readonly alreadyConfirmed: boolean;
  readonly onFollowUp: (text: string) => void;
}): React.JSX.Element {
  const can = useCan(),
    desktop = useWorkspacePresentation() === "desktop";
  const [view, setView] = React.useState<{
      proposal: ExpenseBatchActionProposal;
      status: "READY" | "STALE" | "EXPIRED" | "CONFIRMED";
    } | null>(null),
    [open, setOpen] = React.useState(false),
    [decision, setDecision] = React.useState(false),
    [page, setPage] = React.useState(0),
    [expanded, setExpanded] = React.useState<string | null>(null),
    [budgetExpanded, setBudgetExpanded] = React.useState(false),
    [status, setStatus] = React.useState<"idle" | "submitting" | "submitted" | "failed">("idle"),
    [error, setError] = React.useState("");
  const epoch = React.useRef(0),
    inFlight = React.useRef(false);
  const proposal = view?.proposal ?? initial,
    input = proposal.input;
  const confirmed = alreadyConfirmed || status === "submitted" || view?.status === "CONFIRMED",
    pending = isBusy || status === "submitting",
    stale = view?.status === "STALE" || view?.status === "EXPIRED",
    inline = proposal.rows.length === 1;
  const ready =
    view?.status === "READY" &&
    !confirmed &&
    !isStreaming &&
    !error &&
    can("use:ai_chat") &&
    can("view:project") &&
    can("view:cost") &&
    expenseBatchActionPermissions(input.action).every((p) => can(p));
  const labels = {
    VERIFY: "Verifikasi pengeluaran",
    APPROVE: "Setujui pengeluaran",
    REJECT: "Tolak pengeluaran",
    PAY: "Catat pembayaran pengeluaran",
  };
  const reviewTitles = {
    VERIFY: "Verifikasi",
    APPROVE: "Persetujuan",
    REJECT: "Penolakan",
    PAY: "Pembayaran",
  };
  const single = proposal.rows[0];
  const beforeStatus = single.facts.find((f) => f.label === "Status saat ini");
  const afterStatus = single.facts.find((f) => f.label === "Setelah tindakan");
  const beforeBalance = proposal.summary.find((f) => f.label === "Saldo sebelum");
  const afterBalance = proposal.summary.find((f) => f.label === "Saldo setelah");
  const balanceLayout: InlineProposalComparison["layout"] = desktop ? "inline" : "stacked";
  const refresh = React.useCallback((): Promise<void> => {
    if (!conversationId || isStreaming || inFlight.current) return Promise.resolve();
    const n = ++epoch.current;
    return getAiExpenseBatchAction({ conversationId, toolCallId })
      .then((result) => {
        if (n !== epoch.current) return;
        if (result.success) {
          setView(result.data);
          setError("");
        } else setError(result.error.message);
      })
      .catch(() => {
        if (n === epoch.current) setError("Usulan belum dapat diperiksa. Coba lagi.");
      });
  }, [conversationId, toolCallId, isStreaming]);
  React.useEffect(() => {
    void refresh();
    const e = epoch;
    return () => {
      e.current++;
    };
  }, [refresh]);
  async function save(): Promise<void> {
    if (!conversationId || !ready || pending || inFlight.current) return;
    inFlight.current = true;
    epoch.current++;
    setStatus("submitting");
    setError("");
    try {
      const result = await confirmAiExpenseBatchAction({ conversationId, toolCallId });
      if (result.success) {
        setStatus("submitted");
        setOpen(false);
      } else {
        setStatus("failed");
        setError(result.error.message);
      }
    } catch {
      setStatus("failed");
      setError("Hasil tindakan belum diketahui. Periksa lagi sebelum mengulang.");
    } finally {
      inFlight.current = false;
      setDecision(false);
    }
  }
  const feedback = (embedded = false): React.JSX.Element | null =>
    error || stale ? (
      <ProposalReviewFeedback
        embedded={embedded}
        message={error || "Data/kelayakan berubah. Minta preview terbaru sebelum melanjutkan."}
        recovery={
          error
            ? { label: "Periksa lagi", disabled: pending, onClick: () => void refresh() }
            : undefined
        }
      />
    ) : null;
  const facts = (items: ExpenseBatchActionProposal["summary"]): React.JSX.Element => (
    <div className="divide-y divide-outline-variant/20">
      {items.map((f, i) => (
        <FactRow
          key={`${f.label}-${i}`}
          label={f.label}
          wrapLabel={f.label !== "Rekening"}
          value={<span className="wrap-anywhere">{inlineProposalValue(f.value, f.money)}</span>}
        />
      ))}
    </div>
  );
  const summary = <GroupedSurface>{facts(proposal.summary)}</GroupedSurface>;
  const footer = (
    <div className="space-y-3">
      {confirmed ? (
        <ButtonLink fullWidth variant="secondary" href={`/projects/${input.projectId}?tab=budget`}>
          Lihat pengeluaran proyek
        </ButtonLink>
      ) : (
        <SheetFooterActions
          layout="adaptive"
          desktopStacked={!inline}
          primaryFirst={!inline}
          primary={{
            label: labels[input.action],
            variant: input.action === "REJECT" ? "critical" : "primary",
            pending: status === "submitting",
            disabled: !ready || pending,
            onClick: () => setDecision(true),
          }}
          secondary={{
            label: stale ? "Minta preview terbaru" : "Koreksi lewat chat",
            variant: "quiet",
            disabled: pending,
            onClick: () => {
              setOpen(false);
              onFollowUp(
                `Baca sumber terbaru lalu koreksi preview ${proposal.title} untuk proyek ${proposal.projectName}. Pertahankan tahap terpisah dan minta data/referensi bank dari saya jika belum lengkap. Jangan jalankan otomatis.`,
              );
            },
          }}
        />
      )}
      <p role="status" className="text-meta text-on-surface-variant">
        {confirmed
          ? `${proposal.rows.length} pengeluaran ${input.action === "VERIFY" ? "diverifikasi" : input.action === "APPROVE" ? "disetujui" : input.action === "REJECT" ? "ditolak" : "dibayar"}.`
          : proposal.effect}
      </p>
      {confirmed && input.action === "VERIFY" && (
        <Button
          fullWidth
          variant="quiet"
          onClick={() =>
            onFollowUp(
              `Periksa hasil verifikasi ${proposal.rows.length} pengeluaran untuk ${proposal.projectName}: ${proposal.rows.map((r) => r.title).join(", ")}. Jelaskan mana membutuhkan persetujuan dan mana siap dibayar, tanpa menjalankan tindakan berikutnya otomatis.`,
            )
          }
        >
          Periksa hasil verifikasi
        </Button>
      )}
    </div>
  );
  const start = Math.min(page * 5, Math.max(0, Math.floor((proposal.rows.length - 1) / 5) * 5));
  return (
    <>
      <ProposalCardShell
        title={proposal.title}
        status={error && !confirmed ? "failed" : status}
        statusLabel={
          confirmed ? "Tercatat" : stale ? "Data berubah" : ready ? "Usulan" : "Memeriksa"
        }
        isAlreadyConfirmed={confirmed}
        showConfirmAction={false}
        onConfirm={save}
        footer={
          inline ? (
            footer
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-meta text-on-surface-variant">
                {proposal.rows.length} pengeluaran
              </span>
              <Button
                size="compact"
                variant="secondary"
                disabled={pending}
                onClick={() => setOpen(true)}
              >
                {confirmed ? "Lihat hasil" : `Tinjau ${proposal.rows.length} pengeluaran`}
                <AppIcon name="arrow_forward" className="icon-sm" />
              </Button>
            </div>
          )
        }
      >
        <div className="px-4 py-3">
          <p className="text-support text-on-surface-variant">{proposal.projectName}</p>
          {inline && <p className="mt-1 text-row font-semibold wrap-anywhere">{single.title}</p>}
          {inline && (
            <p className="mt-1 text-support text-on-surface-variant">
              {single.facts.find((f) => f.label === "Kategori")?.value}
            </p>
          )}
          {feedback(true)}
          {!inline &&
            facts(
              proposal.summary.filter((f) => ["Total nominal", "Saldo setelah"].includes(f.label)),
            )}
        </div>
        {inline ? (
          <ProposalInlineReview
            comparisons={[
              ...(beforeStatus && afterStatus
                ? [
                    {
                      label: "Status pengeluaran",
                      before: beforeStatus.value,
                      after: afterStatus.value,
                    },
                  ]
                : []),
              ...(beforeBalance && afterBalance
                ? [
                    {
                      label: "Saldo rekening",
                      before: beforeBalance.value,
                      after: afterBalance.value,
                      money: true,
                      layout: balanceLayout,
                    },
                  ]
                : []),
            ]}
            details={
              <div className="divide-y divide-outline-variant/20">
                {facts(
                  proposal.rows[0].facts.filter((f) =>
                    ["Pengaju", "Jumlah", "Harga satuan"].includes(f.label),
                  ),
                )}
                {proposal.budget.map((b) => (
                  <div key={b.name}>
                    <p className="px-4 py-3 text-row font-semibold">{b.name}</p>
                    <FactRow label="Alokasi" value={inlineProposalValue(b.allocated, true)} />
                    <FactRow label="Realisasi" value={inlineProposalValue(b.actual, true)} />
                    <FactRow
                      label="Pengajuan tertunda"
                      value={inlineProposalValue(b.pending, true)}
                    />
                  </div>
                ))}
              </div>
            }
            facts={[
              ...proposal.rows[0].facts.filter(
                (f) =>
                  ![
                    "Pengaju",
                    "Jumlah",
                    "Harga satuan",
                    "Kategori",
                    "Status saat ini",
                    "Setelah tindakan",
                  ].includes(f.label),
              ),
              ...proposal.summary.filter(
                (f) =>
                  !["Baris diproses", "Total nominal", "Saldo sebelum", "Saldo setelah"].includes(
                    f.label,
                  ),
              ),
            ]}
          >
            {initial.rows[0]?.receipt && (
              <ButtonLink href={initial.rows[0].receipt.url} variant="quiet" size="compact">
                Lihat bukti · {initial.rows[0].receipt.fileName}
              </ButtonLink>
            )}
          </ProposalInlineReview>
        ) : null}
      </ProposalCardShell>
      <FormSheet
        open={open}
        title={reviewTitles[input.action]}
        desktopSize="wide"
        desktopFooterPlacement="aside"
        desktopAsideSummary={summary}
        footer={footer}
        sizing="content"
        pending={pending}
        dismissal={{ mode: "preserve" }}
        onClose={() => {
          if (!inFlight.current) setOpen(false);
        }}
      >
        <div className="space-y-5">
          <div>
            <p className="text-section-title font-semibold">{proposal.projectName}</p>
            <p className="text-support text-on-surface-variant">{proposal.effect}</p>
          </div>
          {feedback()}
          {!desktop && summary}
          <ReviewCollection
            ariaLabel="Pengeluaran yang diproses"
            footer={
              proposal.rows.length > 5 ? (
                <nav
                  aria-label="Halaman review pengeluaran"
                  className="flex items-center justify-between gap-3 px-4 py-2"
                >
                  <Button
                    variant="quiet"
                    size="compact"
                    disabled={start === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Sebelumnya
                  </Button>
                  <span className="text-support tabular-nums">
                    {start + 1}–{Math.min(start + 5, proposal.rows.length)} / {proposal.rows.length}
                  </span>
                  <Button
                    variant="quiet"
                    size="compact"
                    disabled={start + 5 >= proposal.rows.length}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Berikutnya
                  </Button>
                </nav>
              ) : undefined
            }
          >
            {proposal.rows.slice(start, start + 5).map((r) => (
              <ReviewItem
                key={r.id}
                title={r.title}
                meta={r.facts.find((f) => f.label === "Kategori")?.value}
                primaryValue={inlineProposalValue(
                  r.facts.find((f) => f.label === "Nominal")?.value ?? 0,
                  true,
                )}
                summary={
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {r.facts.find((f) => f.label === "Status saat ini")?.value}
                    <AppIcon name="arrow_forward" className="icon-xs" />
                    {r.facts.find((f) => f.label === "Setelah tindakan")?.value}
                  </span>
                }
                expanded={expanded === r.id}
                onToggle={() => setExpanded((current) => (current === r.id ? null : r.id))}
                editor={facts(
                  r.facts.filter(
                    (f) =>
                      !["Kategori", "Nominal", "Status saat ini", "Setelah tindakan"].includes(
                        f.label,
                      ),
                  ),
                )}
              >
                {input.action === "PAY" && (
                  <p className="text-support wrap-anywhere">
                    Referensi bank: {r.facts.find((f) => f.label === "Referensi bank")?.value}
                  </p>
                )}
                {r.receipt && (
                  <ButtonLink href={r.receipt.url} variant="quiet" size="compact">
                    Lihat bukti · {r.receipt.fileName}
                  </ButtonLink>
                )}
              </ReviewItem>
            ))}
          </ReviewCollection>
          {proposal.budget.length > 0 && (
            <GroupedSurface>
              <div className="px-4">
                <FormDisclosure
                  title="Rincian budget"
                  variant="plain"
                  expanded={budgetExpanded}
                  onToggle={() => setBudgetExpanded((v) => !v)}
                >
                  {proposal.budget.map((b) => (
                    <div key={b.name} className="divide-y divide-outline-variant/20">
                      <p className="py-3 text-row font-semibold">{b.name}</p>
                      <FactRow
                        inset={false}
                        label="Alokasi"
                        value={inlineProposalValue(b.allocated, true)}
                      />
                      <FactRow
                        inset={false}
                        label="Realisasi"
                        value={inlineProposalValue(b.actual, true)}
                      />
                      <FactRow
                        inset={false}
                        label="Pengajuan tertunda"
                        value={inlineProposalValue(b.pending, true)}
                      />
                    </div>
                  ))}
                </FormDisclosure>
              </div>
            </GroupedSurface>
          )}
        </div>
      </FormSheet>
      <ConfirmationDialog
        actionLayout="adaptive"
        open={decision}
        title={labels[input.action]}
        description={proposal.effect}
        confirmLabel={labels[input.action]}
        tone={input.action === "REJECT" ? "danger" : "default"}
        pending={pending}
        disabled={!ready || pending}
        onClose={() => setDecision(false)}
        onConfirm={() => void save()}
      >
        <p className="mb-3 text-row font-semibold">{proposal.projectName}</p>
        {facts(proposal.summary)}
      </ConfirmationDialog>
    </>
  );
}
