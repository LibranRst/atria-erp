"use client";
/** THESIS: exact account and cash decisions before an explicit save.
 * OWN-WORLD: inherited Atria Operate, Manrope, cool canvases, white grouped owners and quiet capsules.
 * STORY: resolve accounts → inspect identity/balance/date/reference → confirm → saved receipt.
 * FIRST VIEWPORT: movement amount/date/reference lead confirmation; complex metadata starts with a concise summary on mobile and uses a desktop aside.
 * FORM: local extension of the approved Atria proposal family; new-work § Extend an existing surface excludes concept-seed. Reuse ProposalCardShell/ProposalInlineReview/FormSheet and one shared confirmation owner.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
 */
import * as React from "react";
import {
  Button,
  ButtonLink,
  ConfirmationDialog,
  FactRow,
  FormSheet,
  GroupedSurface,
  ReviewCollection,
  ReviewItem,
  SheetFooterActions,
} from "@/components/ui";
import { useCan } from "@/components/auth/permissions-provider";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { getAiBankCashProposal, confirmAiBankCashProposal } from "@/app/actions/ai/bank-cash";
import {
  bankCashPermission,
  type BankCashProposal,
  type BankCashView,
} from "@atria/core/ai/bank-cash";
import { ProposalCardShell, ProposalDiffRow } from "./proposal-card-shell";
import { ProposalInlineReview, inlineProposalValue } from "./proposal-inline-review";
import { ProposalReviewFeedback } from "./proposal-review-feedback";
import { proposalReviewFlow } from "../../utils/proposal-review-flow";
import { bankAccountsHref } from "../../utils/deep-links";

export function BankCashProposalCard({
  proposal: initial,
  conversationId,
  toolCallId,
  isStreaming,
  isBusy,
  alreadyConfirmed,
  onFollowUp,
}: {
  readonly proposal: BankCashProposal;
  readonly conversationId: string | null;
  readonly toolCallId: string;
  readonly isStreaming: boolean;
  readonly isBusy: boolean;
  readonly alreadyConfirmed: boolean;
  readonly onFollowUp: (text: string) => void;
}): React.JSX.Element {
  const can = useCan(),
    desktop = useWorkspacePresentation() === "desktop";
  const [view, setView] = React.useState<BankCashView | null>(null),
    [open, setOpen] = React.useState(false),
    [decision, setDecision] = React.useState(false),
    [error, setError] = React.useState(""),
    [denied, setDenied] = React.useState(false),
    [status, setStatus] = React.useState<"idle" | "submitting" | "submitted" | "failed">("idle");
  const epoch = React.useRef(0),
    inFlight = React.useRef(false);
  const proposal = view?.proposal ?? initial,
    input = proposal.input,
    flow = proposalReviewFlow(proposal),
    inline = flow.review === "inline";
  const confirmed = alreadyConfirmed || status === "submitted" || view?.status === "CONFIRMED",
    pending = isBusy || status === "submitting",
    stale = view?.status === "STALE" || view?.status === "EXPIRED";
  const readable = can("view:bank_account") && !denied,
    permitted = readable && can("use:ai_chat") && can(bankCashPermission(input));
  const ready = view?.status === "READY" && !confirmed && !isStreaming && !error && permitted;
  const action =
    input.action === "CREATE_ACCOUNT"
      ? "Buat rekening"
      : input.action === "EDIT_ACCOUNT"
        ? "Simpan koreksi rekening"
        : input.action === "ACCOUNT_STATUS"
          ? input.isActive
            ? "Aktifkan rekening"
            : "Nonaktifkan rekening"
          : input.action === "CASH_MOVEMENT"
            ? input.type === "INFLOW"
              ? "Catat dana masuk"
              : "Catat dana keluar"
            : "Catat transfer";
  const saved =
    input.action === "CREATE_ACCOUNT"
      ? "Rekening berhasil dibuat."
      : input.action === "EDIT_ACCOUNT"
        ? "Informasi rekening diperbarui."
        : input.action === "ACCOUNT_STATUS"
          ? input.isActive
            ? "Rekening diaktifkan kembali."
            : "Rekening dinonaktifkan; saldo dan transaksi tetap tersimpan."
          : input.action === "CASH_MOVEMENT"
            ? "Mutasi kas berhasil dicatat."
            : "Transfer antarrekening dicatat; total kas tetap.";
  const refresh = React.useCallback((): Promise<void> => {
    if (!conversationId || isStreaming || inFlight.current) return Promise.resolve();
    const request = ++epoch.current;
    return getAiBankCashProposal({ conversationId, toolCallId })
      .then((result) => {
        if (request !== epoch.current) return;
        if (result.success) {
          setView(result.data);
          setError("");
          setDenied(false);
        } else {
          setError(result.error.message);
          setDenied(["FORBIDDEN", "NOT_FOUND", "UNAUTHORIZED"].includes(result.error.code));
        }
      })
      .catch(() => {
        if (request === epoch.current) setError("Usulan belum dapat diperiksa. Coba periksa lagi.");
      });
  }, [conversationId, toolCallId, isStreaming]);
  React.useEffect(() => {
    const current = epoch;
    void refresh();
    return () => {
      current.current++;
    };
  }, [refresh]);
  async function save(): Promise<void> {
    if (!conversationId || !ready || pending || inFlight.current) return;
    inFlight.current = true;
    epoch.current++;
    setStatus("submitting");
    setError("");
    try {
      const result = await confirmAiBankCashProposal({ conversationId, toolCallId });
      if (result.success) {
        setStatus("submitted");
        setDecision(false);
        setOpen(false);
        setView({ proposal, status: "CONFIRMED", resultId: result.data.resultId });
      } else {
        setStatus("failed");
        setError(result.error.message);
        if (["FORBIDDEN", "NOT_FOUND", "UNAUTHORIZED"].includes(result.error.code)) setDenied(true);
      }
    } catch {
      setStatus("failed");
      setError("Penyimpanan belum dapat dikonfirmasi. Periksa status sebelum mencoba lagi.");
    } finally {
      inFlight.current = false;
    }
  }
  const feedback = (embedded = false): React.JSX.Element | null =>
    error || stale || !permitted ? (
      <ProposalReviewFeedback
        embedded={embedded}
        message={
          error ||
          (!permitted
            ? "Akses rekening atau tindakan kas tidak tersedia."
            : "Rekening atau saldo berubah. Minta preview terbaru sebelum menyimpan.")
        }
        recovery={
          error
            ? { label: "Periksa lagi", disabled: pending, onClick: () => void refresh() }
            : undefined
        }
      />
    ) : null;
  const facts = (items: BankCashProposal["facts"]): React.JSX.Element => (
    <div className="divide-y divide-outline-variant/20">
      {items.map((f, i) => (
        <FactRow
          key={`${f.label}-${i}`}
          label={f.label}
          wrapLabel
          value={<span className="wrap-anywhere">{inlineProposalValue(f.value, f.money)}</span>}
        />
      ))}
    </div>
  );
  const comparisons = proposal.comparisons.map((c) => ({
    ...c,
    layout:
      c.money || String(c.before).length > 24 || String(c.after).length > 24
        ? ("stacked" as const)
        : ("inline" as const),
  }));
  const reviewSummary = readable ? (
    <GroupedSurface>
      {facts([
        { label: "Bidang berubah", value: proposal.comparisons.length, money: false },
        ...proposal.facts.filter((f) => f.money),
      ])}
    </GroupedSurface>
  ) : undefined;
  const confirmationPriority = (label: string): number => {
    if (label === "Nominal" || label === "Saldo awal") return 0;
    if (label.startsWith("Tanggal")) return 1;
    if (label.startsWith("Referensi")) return 2;
    return 3;
  };
  const confirmationFacts = [...proposal.facts].sort(
    (a, b) => confirmationPriority(a.label) - confirmationPriority(b.label),
  );
  const footer = (
    <div className="space-y-3">
      {confirmed ? (
        <ButtonLink fullWidth variant="secondary" href={bankAccountsHref()}>
          Buka rekening dan kas
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
                `Periksa sumber terbaru lalu bantu ${stale ? "buat ulang preview" : "koreksi"} ${proposal.title} untuk ${proposal.entityName}. Tanyakan data rekening, nominal, tanggal atau referensi yang kurang. Jangan simpan atau mencatat kas otomatis.`,
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
            <Button fullWidth variant="secondary" onClick={() => setOpen(true)}>
              {confirmed ? "Lihat hasil" : "Buka review"}
            </Button>
          )
        }
      >
        <div className="px-4 py-3">
          {readable && (
            <p className="text-row font-semibold wrap-anywhere">{proposal.entityName}</p>
          )}
          {feedback(true)}
          {!inline && readable && (
            <p className="mt-1 text-support text-on-surface-variant">
              {proposal.comparisons.length} bidang rekening ditinjau
            </p>
          )}
        </div>
        {inline && readable && (
          <ProposalInlineReview
            facts={proposal.facts}
            comparisons={comparisons}
            details={proposal.details.length ? facts(proposal.details) : undefined}
          />
        )}
      </ProposalCardShell>
      <FormSheet
        dismissal={{ mode: "preserve", blocked: pending }}
        open={open}
        onClose={() => {
          if (!inFlight.current) {
            setOpen(false);
            setDecision(false);
          }
        }}
        title={proposal.title}
        desktopSize="wide"
        desktopFooterPlacement="aside"
        desktopAsideSummary={reviewSummary}
        footer={footer}
        pending={pending}
      >
        <div className="space-y-4">
          {readable && (
            <p className="text-row font-semibold wrap-anywhere">{proposal.entityName}</p>
          )}
          {feedback()}
          {!desktop && reviewSummary}
          {readable && (
            <ReviewCollection ariaLabel="Data rekening yang dikoreksi">
              <ReviewItem title="Informasi rekening">
                {comparisons.map((c, i) => (
                  <ProposalDiffRow
                    key={`${c.label}-${i}`}
                    label={c.label}
                    before={inlineProposalValue(c.before, c.money)}
                    after={inlineProposalValue(c.after, c.money)}
                    layout={desktop ? "stacked" : "vertical"}
                    strikeBefore={false}
                  />
                ))}
              </ReviewItem>
            </ReviewCollection>
          )}
        </div>
      </FormSheet>
      <ConfirmationDialog
        actionLayout="adaptive"
        open={decision}
        onClose={() => setDecision(false)}
        title={action}
        confirmLabel={action}
        pending={status === "submitting"}
        disabled={!ready || pending}
        description={proposal.effect}
        onConfirm={() => void save()}
      >
        {readable && (
          <>
            <p className="mb-3 text-row font-semibold wrap-anywhere">{proposal.entityName}</p>
            {facts(confirmationFacts)}
            {comparisons.map((c, i) => (
              <ProposalDiffRow
                key={`${c.label}-${i}`}
                label={c.label}
                before={inlineProposalValue(c.before, c.money)}
                after={inlineProposalValue(c.after, c.money)}
                layout="stacked"
                strikeBefore={false}
              />
            ))}
          </>
        )}
      </ConfirmationDialog>
    </>
  );
}
