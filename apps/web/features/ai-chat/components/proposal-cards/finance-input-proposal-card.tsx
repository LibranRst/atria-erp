"use client";
import * as React from "react";
import {
  getAiFinanceInputProposal,
  confirmAiFinanceInputProposal,
} from "@/app/actions/ai/finance-input";
import { useCan } from "@/components/auth/permissions-provider";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import {
  AppIcon,
  Button,
  ButtonLink,
  SheetFooterActions,
  FormSheet,
  ConfirmationDialog,
  GroupedSurface,
  FactRow,
  ReviewCollection,
  ReviewItem,
} from "@/components/ui";
import { ProposalCardShell } from "./proposal-card-shell";
import {
  ProposalInlineReview,
  inlineProposalValue,
  type InlineProposalComparison,
} from "./proposal-inline-review";
import { ProposalReviewFeedback } from "./proposal-review-feedback";
import {
  financeInputPermission,
  isFinanceSettingsInput,
  type FinanceInputProposal,
  type FinanceInputView,
} from "@atria/core/ai/finance-input";
import { proposalReviewFlow } from "../../utils/proposal-review-flow";

/** Inherited Atria Operate: complete invoice/default decision, shared grouped review and protected save. */
export function FinanceInputProposalCard({
  proposal: initial,
  conversationId,
  toolCallId,
  isStreaming,
  isBusy,
  alreadyConfirmed,
  onFollowUp,
}: {
  readonly proposal: FinanceInputProposal;
  readonly conversationId: string | null;
  readonly toolCallId: string;
  readonly isStreaming: boolean;
  readonly isBusy: boolean;
  readonly alreadyConfirmed: boolean;
  readonly onFollowUp: (text: string) => void;
}): React.JSX.Element {
  const can = useCan(),
    desktop = useWorkspacePresentation() === "desktop";
  const [view, setView] = React.useState<FinanceInputView | null>(null),
    [open, setOpen] = React.useState(false),
    [decision, setDecision] = React.useState(false),
    [page, setPage] = React.useState(0),
    [error, setError] = React.useState(""),
    [denied, setDenied] = React.useState(false),
    [status, setStatus] = React.useState<"idle" | "submitting" | "submitted" | "failed">("idle");
  const epoch = React.useRef(0),
    inFlight = React.useRef(false);
  const proposal = view?.proposal ?? initial,
    input = proposal.input;
  const settings = isFinanceSettingsInput(input),
    operational =
      input.action === "APPROVAL_THRESHOLDS" || input.action === "EXPENSE_CATEGORY_SETTINGS";
  const displayChanges = proposal.changes.map((change): InlineProposalComparison => ({
    ...change,
    ...(operational &&
    !change.money &&
    (String(change.before).length > 40 || String(change.after).length > 40)
      ? { layout: desktop ? "stacked" : "vertical" }
      : {}),
  }));
  const flow = proposalReviewFlow(proposal),
    inline = flow.review === "inline";
  const confirmed = alreadyConfirmed || status === "submitted" || view?.status === "CONFIRMED",
    pending = isBusy || status === "submitting",
    stale = view?.status === "STALE" || view?.status === "EXPIRED";
  const permitted =
    can("use:ai_chat") &&
    can(financeInputPermission(input)) &&
    (settings
      ? can("view:settings") &&
        (input.action !== "EXPENSE_CATEGORY_SETTINGS" ||
          input.patch.defaultRatio === undefined ||
          can("manage:budget_settings"))
      : can("view:project") && can("view:client_invoice"));
  const readable =
    !denied &&
    (settings ? can("view:settings") : can("view:project") && can("view:client_invoice"));
  const ready =
    view?.status === "READY" && permitted && readable && !confirmed && !isStreaming && !error;
  const action =
    input.action === "APPROVAL_THRESHOLDS"
      ? "Simpan ambang persetujuan"
      : input.action === "EXPENSE_CATEGORY_SETTINGS"
        ? "Simpan pengaturan kategori"
        : input.action === "BUDGET_DEFAULTS"
          ? "Simpan default budget"
          : input.action === "CREATE_INVOICE"
            ? "Buat invoice"
            : "Buat jadwal termin";
  const saved =
    input.action === "APPROVAL_THRESHOLDS"
      ? "Ambang diperbarui untuk pengajuan berikutnya; pengajuan berjalan tetap."
      : input.action === "EXPENSE_CATEGORY_SETTINGS"
        ? "Pengaturan kategori diperbarui; budget dan nominal transaksi tersimpan tetap."
        : input.action === "BUDGET_DEFAULTS"
          ? "Default budget diperbarui untuk setup berikutnya."
          : "Tagihan klien tercatat sebagai belum dibayar.";
  const href = proposal.projectId ? `/projects/${proposal.projectId}?tab=payments` : "/settings";
  const refresh = React.useCallback((): Promise<void> => {
    if (!conversationId || isStreaming || inFlight.current) return Promise.resolve();
    const request = ++epoch.current;
    return getAiFinanceInputProposal({ conversationId, toolCallId })
      .then((result) => {
        if (request !== epoch.current) return;
        if (result.success) {
          setView(result.data);
          setError("");
          setDenied(false);
        } else {
          setError(result.error.message);
          setDenied(["FORBIDDEN", "UNAUTHORIZED", "NOT_FOUND"].includes(result.error.code));
        }
      })
      .catch(() => {
        if (request === epoch.current) setError("Usulan belum dapat diperiksa. Coba periksa lagi.");
      });
  }, [conversationId, toolCallId, isStreaming]);
  React.useEffect(() => {
    void refresh();
    const request = epoch;
    return () => {
      request.current++;
    };
  }, [refresh]);
  async function save(): Promise<void> {
    if (!conversationId || !ready || pending || inFlight.current) return;
    inFlight.current = true;
    epoch.current++;
    setStatus("submitting");
    setError("");
    try {
      const result = await confirmAiFinanceInputProposal({ conversationId, toolCallId });
      if (result.success) {
        setStatus("submitted");
        setOpen(false);
        setDecision(false);
      } else {
        setError(result.error.message);
        setStatus("failed");
        setDecision(false);
      }
    } catch {
      setError("Hasil penyimpanan belum diketahui. Periksa lagi sebelum mengulang.");
      setStatus("failed");
      setDecision(false);
    } finally {
      inFlight.current = false;
    }
  }
  const feedback = error ? (
    <ProposalReviewFeedback
      embedded
      message={error}
      recovery={
        !confirmed
          ? { label: "Periksa lagi", disabled: pending, onClick: () => void refresh() }
          : undefined
      }
    />
  ) : stale ? (
    <ProposalReviewFeedback
      embedded
      message="Data berubah atau usulan kedaluwarsa. Minta preview terbaru sebelum menyimpan."
    />
  ) : null;
  const facts = (rows: FinanceInputProposal["summary"]): React.JSX.Element => (
    <div className="divide-y divide-outline-variant/20">
      {rows.map((fact, index) => (
        <FactRow
          key={`${fact.label}-${index}`}
          label={
            operational && fact.label === "Status pilihan setelah perubahan"
              ? "Status pilihan"
              : fact.label
          }
          wrapLabel={!operational}
          value={
            typeof fact.value === "string" && operational ? (
              <span className="wrap-anywhere">{fact.value}</span>
            ) : (
              inlineProposalValue(fact.value, fact.money, operational)
            )
          }
        />
      ))}
    </div>
  );
  const summary = readable ? <GroupedSurface>{facts(proposal.summary)}</GroupedSurface> : null;
  const footer = (
    <div className="space-y-3">
      {confirmed ? (
        <ButtonLink fullWidth href={href}>
          {proposal.projectId ? "Buka tagihan proyek" : "Buka pengaturan"}
        </ButtonLink>
      ) : (
        <SheetFooterActions
          layout="adaptive"
          desktopStacked={!inline}
          primaryFirst={!inline}
          primary={{
            label: action,
            pending: status === "submitting",
            pendingLabel: "Menyimpan…",
            disabled: !ready || pending,
            onClick: () => (flow.confirmation === "dialog" ? setDecision(true) : void save()),
          }}
          secondary={{
            label: stale ? "Minta preview terbaru" : "Koreksi lewat chat",
            variant: "quiet",
            disabled: pending,
            onClick: () => {
              setOpen(false);
              onFollowUp(
                `Periksa sumber terbaru lalu bantu ${stale ? "buat ulang preview" : "koreksi"} ${proposal.title} untuk ${proposal.entityName}. Tanyakan bagian yang ingin diubah sebelum menyiapkan usulan baru.`,
              );
            },
          }}
        />
      )}
      <p role="status" className="text-meta text-on-surface-variant">
        {confirmed ? saved : proposal.effect}
      </p>
    </div>
  );
  const start = Math.min(page * 5, Math.max(0, Math.floor((proposal.rows.length - 1) / 5) * 5)),
    rows = proposal.rows.slice(start, start + 5);
  return (
    <>
      <ProposalCardShell
        title={proposal.title}
        status={error && !confirmed ? "failed" : status}
        statusLabel={
          confirmed
            ? "Tercatat"
            : stale
              ? "Data berubah"
              : error
                ? "Perlu diperiksa"
                : ready
                  ? "Usulan"
                  : "Memeriksa"
        }
        isAlreadyConfirmed={confirmed}
        showConfirmAction={false}
        onConfirm={save}
        footer={
          inline ? (
            footer
          ) : (
            <Button
              variant="secondary"
              size="compact"
              disabled={pending}
              onClick={() => {
                setOpen(true);
                void refresh();
              }}
            >
              {confirmed ? "Lihat rincian" : "Tinjau usulan"}
              <AppIcon name="arrow_forward" className="icon-sm" />
            </Button>
          )
        }
      >
        <div className="px-4 py-3">
          <p className="text-row font-semibold">
            {readable ? proposal.entityName : "Sumber tidak tersedia dalam akses Anda"}
          </p>
          {operational && readable && "reason" in input && (
            <p className="mt-1 text-support text-on-surface-variant">
              Alasan perubahan: {input.reason}
            </p>
          )}
          {input.action === "APPROVAL_THRESHOLDS" && readable && (
            <p className="mt-2 text-support text-on-surface-variant">
              Mulai dari ambang ini perlu persetujuan Owner. Ambang nol berlaku untuk semua
              pengajuan terkait.
            </p>
          )}
          {!inline && readable && (
            <p className="text-support text-on-surface-variant">
              {input.action === "CREATE_SCHEDULE"
                ? `${proposal.rows.length} termin · jumlah tepat 100% kontrak`
                : `${proposal.changes.length} perubahan ${operational ? "pengaturan" : "default"}`}
            </p>
          )}
        </div>
        {!readable ? (
          <div className="px-4 pb-3">{feedback}</div>
        ) : inline ? (
          <ProposalInlineReview
            preciseMoney={operational}
            facts={
              input.action === "CREATE_INVOICE"
                ? [
                    { label: "Nomor invoice", value: input.invoiceNumber },
                    ...(proposal.rows[0]?.facts ?? []),
                  ]
                : operational
                  ? []
                  : proposal.summary.filter((fact) => fact.label === "Alokasi kategori")
            }
            comparisons={displayChanges}
          >
            {feedback}
          </ProposalInlineReview>
        ) : (
          <div className="px-4 pb-3">
            {feedback}
            {facts(proposal.summary)}
          </div>
        )}
      </ProposalCardShell>
      <FormSheet
        open={open}
        title={
          operational
            ? input.action === "APPROVAL_THRESHOLDS"
              ? "Review ambang persetujuan"
              : "Review kategori"
            : `Review ${proposal.title}`
        }
        desktopSize="wide"
        desktopFooterPlacement="aside"
        desktopAsideSummary={summary}
        footer={footer}
        sizing="content"
        dismissal={{ mode: "preserve" }}
        pending={pending}
        onClose={() => {
          if (!inFlight.current) {
            setOpen(false);
            setDecision(false);
          }
        }}
      >
        <div className="space-y-5">
          <div>
            <p className="text-section-title font-semibold">
              {readable ? proposal.entityName : "Sumber tidak tersedia dalam akses Anda"}
            </p>
            {readable && <p className="text-support text-on-surface-variant">{proposal.effect}</p>}
            {operational && readable && "reason" in input && (
              <p className="mt-2 text-support text-on-surface-variant">
                Alasan perubahan: {input.reason}
              </p>
            )}
          </div>
          {feedback && <GroupedSurface>{feedback}</GroupedSurface>}
          {!desktop && summary}
          {!readable ? null : input.action === "BUDGET_DEFAULTS" || operational ? (
            <GroupedSurface>
              <ProposalInlineReview comparisons={displayChanges} preciseMoney={operational} />
            </GroupedSurface>
          ) : (
            <ReviewCollection ariaLabel="Termin yang akan dicatat">
              {rows.map((row) => (
                <ReviewItem key={row.id} title={row.title}>
                  {facts(row.facts)}
                </ReviewItem>
              ))}
            </ReviewCollection>
          )}
          {proposal.rows.length > 5 && (
            <nav aria-label="Halaman termin" className="flex items-center justify-between gap-3">
              <Button
                variant="quiet"
                size="compact"
                disabled={start === 0}
                onClick={() => setPage((value) => Math.max(0, value - 1))}
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
                onClick={() => setPage((value) => value + 1)}
              >
                Berikutnya
              </Button>
            </nav>
          )}
        </div>
      </FormSheet>
      <ConfirmationDialog
        actionLayout="adaptive"
        open={decision && !confirmed}
        title={action}
        description={proposal.effect}
        confirmLabel={action}
        pending={pending}
        disabled={!ready || pending}
        onClose={() => {
          if (!inFlight.current) setDecision(false);
        }}
        onConfirm={() => void save()}
      >
        <p className="mb-3 text-row font-semibold">{proposal.entityName}</p>
        {readable && operational && (
          <ProposalInlineReview comparisons={displayChanges} preciseMoney />
        )}
        {readable && !operational && facts(proposal.summary)}
        {readable && operational && "reason" in input && (
          <FactRow label="Alasan" value={<span className="wrap-anywhere">{input.reason}</span>} />
        )}
      </ConfirmationDialog>
    </>
  );
}
