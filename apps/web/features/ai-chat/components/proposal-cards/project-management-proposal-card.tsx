"use client";
/** Inherits Atria Operate: explicit project decisions, complete impact, contextual confirmation.
 * Shared card/disclosure/dialog/sheet ownership; no new visual world or primitive.
 */
import * as React from "react";
import {
  getAiProjectManagementProposal,
  confirmAiProjectManagementProposal,
} from "@/app/actions/ai/project-management";
import { useCan } from "@/components/auth/permissions-provider";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import {
  AppIcon,
  Button,
  ButtonLink,
  SheetFooterActions,
  ConfirmationDialog,
  FactRow,
  FormDisclosure,
  FormSheet,
  GroupedSurface,
  InlineStateRow,
  ReviewCollection,
  ReviewItem,
} from "@/components/ui";
import { ProposalCardShell, ProposalDiffRow } from "./proposal-card-shell";
import {
  ProposalInlineReview,
  inlineFactChanges,
  inlineProposalValue,
} from "./proposal-inline-review";
import { ProposalReviewFeedback } from "./proposal-review-feedback";
import { proposalReviewFlow } from "../../utils/proposal-review-flow";
import {
  projectManagementPermissions,
  type ProjectManagementProposal,
  type ProjectManagementView,
  type ProjectManagementAction,
} from "@atria/core/ai/project-management";
const copy: Readonly<Record<ProjectManagementAction, { commit: string; saved: string }>> = {
  EDIT_PROJECT: { commit: "Simpan koreksi proyek", saved: "Informasi proyek diperbarui." },
  ASSIGN_PM: { commit: "Tugaskan Project Manager", saved: "Project Manager ditugaskan." },
  ACTIVATE_PROJECT: { commit: "Aktifkan proyek", saved: "Proyek diaktifkan." },
  COMPLETE_PROJECT: {
    commit: "Tutup proyek",
    saved: "Proyek ditutup dan snapshot profitabilitas final tercatat.",
  },
  REALLOCATE_BUDGET: { commit: "Simpan alokasi budget", saved: "Alokasi kategori diperbarui." },
  SUBMIT_BUDGET: { commit: "Ajukan budget", saved: "Budget diajukan untuk persetujuan." },
  APPROVE_BUDGET: { commit: "Setujui budget", saved: "Budget proyek disetujui." },
  REJECT_BUDGET: {
    commit: "Minta revisi budget",
    saved: "Budget kembali ke Draft untuk direvisi.",
  },
};
type Fact = { readonly label: string; readonly value: string | number; readonly money?: boolean };
function Facts({
  facts,
  inset = true,
}: {
  readonly facts: readonly Fact[];
  readonly inset?: boolean;
}): React.JSX.Element {
  return (
    <div className="divide-y divide-outline-variant/20">
      {facts.map((f, index) =>
        f.label.startsWith("Alasan") ? (
          <div
            key={`${f.label}-${index}`}
            className={inset ? "space-y-1 px-4 py-3" : "space-y-1 py-3"}
          >
            <p className="text-support font-medium">{f.label}</p>
            <p className="text-support text-on-surface-variant">{f.value}</p>
          </div>
        ) : (
          <FactRow
            key={`${f.label}-${index}`}
            label={f.label}
            wrapLabel
            inset={inset}
            value={inlineProposalValue(f.value, f.money)}
          />
        ),
      )}
    </div>
  );
}
export function ProjectManagementProposalCard({
  proposal: initial,
  conversationId,
  toolCallId,
  isStreaming,
  isBusy,
  alreadyConfirmed,
  onFollowUp,
}: {
  readonly proposal: ProjectManagementProposal;
  readonly conversationId: string | null;
  readonly toolCallId: string;
  readonly isStreaming: boolean;
  readonly isBusy: boolean;
  readonly alreadyConfirmed: boolean;
  readonly onFollowUp: (text: string) => void;
}): React.JSX.Element {
  const can = useCan(),
    desktop = useWorkspacePresentation() === "desktop";
  const [view, setView] = React.useState<ProjectManagementView | null>(null),
    [open, setOpen] = React.useState(false),
    [decision, setDecision] = React.useState(false),
    [page, setPage] = React.useState(0),
    [expanded, setExpanded] = React.useState<string | null>(null),
    [budgetOpen, setBudgetOpen] = React.useState(false),
    [error, setError] = React.useState(""),
    [status, setStatus] = React.useState<"idle" | "submitting" | "submitted" | "failed">("idle");
  const epoch = React.useRef(0),
    inFlight = React.useRef(false);
  const proposal = view?.proposal ?? initial,
    action = copy[proposal.action],
    flow = proposalReviewFlow(proposal),
    inline = flow.review === "inline";
  const confirmed = alreadyConfirmed || view?.status === "CONFIRMED" || status === "submitted",
    pending = isBusy || status === "submitting",
    stale = view?.status === "STALE" || view?.status === "EXPIRED";
  const permitted = can("use:ai_chat") && projectManagementPermissions(proposal.action).every(can);
  const ready =
    view?.status === "READY" &&
    permitted &&
    !confirmed &&
    !isStreaming &&
    !error &&
    !proposal.blockers.length;
  const budgetVisible =
    permitted &&
    !error &&
    (proposal.action === "COMPLETE_PROJECT" ? can("view:profitability") : can("view:budget"));
  const refresh = React.useCallback((): Promise<void> => {
    if (!conversationId || isStreaming || inFlight.current) return Promise.resolve();
    const request = ++epoch.current;
    return getAiProjectManagementProposal({ conversationId, toolCallId })
      .then((result) => {
        if (request !== epoch.current) return;
        if (result.success) {
          setView(result.data);
          setError("");
        } else setError(result.error.message);
      })
      .catch(() => {
        if (request === epoch.current) setError("Usulan belum dapat diperiksa. Coba periksa lagi.");
      });
  }, [conversationId, toolCallId, isStreaming]);
  React.useEffect(() => {
    const request = epoch;
    void refresh();
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
      const result = await confirmAiProjectManagementProposal({ conversationId, toolCallId });
      if (result.success) {
        setStatus("submitted");
        setDecision(false);
      } else {
        setError(result.error.message);
        setStatus("failed");
        setDecision(false);
      }
    } catch {
      setError("Hasil penyimpanan belum diketahui. Periksa lagi sebelum mencoba ulang.");
      setStatus("failed");
      setDecision(false);
    } finally {
      inFlight.current = false;
    }
  }
  const feedback = error ? (
    <ProposalReviewFeedback
      embedded={inline}
      message={error}
      recovery={
        !stale && !confirmed
          ? { label: "Periksa lagi", disabled: pending, onClick: () => void refresh() }
          : undefined
      }
    />
  ) : !confirmed && proposal.blockers.length ? (
    <ProposalReviewFeedback
      embedded={inline}
      title="Syarat belum terpenuhi"
      message={proposal.blockers.join(" ")}
      recovery={{ label: "Periksa lagi", disabled: pending, onClick: () => void refresh() }}
    />
  ) : null;
  const warnings =
    budgetVisible && proposal.warnings.length ? (
      <div className="space-y-2">
        {proposal.warnings.map((w, i) => (
          <InlineStateRow
            key={i}
            icon="warning"
            title="Perlu diperhatikan"
            description={w}
            tone="warning"
          />
        ))}
      </div>
    ) : null;
  const footer = (
    <div className="space-y-3">
      {confirmed ? (
        <ButtonLink fullWidth href={`/projects/${proposal.projectId}`}>
          Buka proyek
        </ButtonLink>
      ) : (
        <SheetFooterActions
          layout="adaptive"
          desktopStacked={!inline}
          primaryFirst={!inline}
          primary={{
            label: action.commit,
            pending: status === "submitting",
            pendingLabel: "Menyimpan…",
            disabled: !ready || pending,
            onClick: () => (flow.confirmation === "dialog" ? setDecision(true) : void save()),
          }}
          secondary={{
            label: stale ? "Minta usulan terbaru" : "Koreksi lewat chat",
            variant: "quiet",
            disabled: pending,
            onClick: () => {
              setOpen(false);
              onFollowUp(
                `Periksa sumber terbaru lalu ${stale ? "buat ulang preview" : "bantu koreksi"} ${proposal.title} untuk ${proposal.entityName}. Tanyakan bagian yang perlu saya ubah sebelum menyiapkan usulan baru.`,
              );
            },
          }}
        />
      )}
      <p role="status" className="text-meta text-on-surface-variant">
        {confirmed
          ? `${action.saved} Stok dan kas tetap.`
          : stale
            ? "Data berubah atau usulan kedaluwarsa. Minta usulan terbaru."
            : proposal.effect}
      </p>
    </div>
  );
  const summary = (
    <GroupedSurface>
      <Facts facts={proposal.summary.filter((f) => !f.label.startsWith("Alasan"))} />
      {budgetVisible && proposal.budget && (
        <Facts
          facts={proposal.budget.filter((f) =>
            [
              "Nilai kontrak",
              "Plafon internal",
              "Total alokasi setelah tindakan",
              "Margin realisasi",
              "Sisa plafon",
            ].includes(f.label),
          )}
        />
      )}
    </GroupedSurface>
  );
  const details =
    budgetVisible && proposal.budget ? (
      <FormDisclosure
        variant="plain"
        title="Rincian budget"
        expanded={budgetOpen}
        onToggle={() => setBudgetOpen((v) => !v)}
      >
        <div className="px-4">
          <Facts facts={proposal.budget} inset={false} />
        </div>
      </FormDisclosure>
    ) : null;
  const start = Math.min(page * 5, Math.max(0, Math.floor((proposal.rows.length - 1) / 5) * 5));
  const rows = proposal.rows.slice(start, start + 5);
  const collection = (
    <>
      <ReviewCollection embedded={inline} ariaLabel="Perubahan proyek dan kategori budget">
        {rows.map((r) => {
          const changes = inlineFactChanges(r.details);
          return (
            <ReviewItem
              key={r.id}
              title={r.title}
              meta={r.meta}
              primaryValue={
                budgetVisible && r.amount !== null ? inlineProposalValue(r.amount, true) : undefined
              }
              expanded={expanded === r.id}
              onToggle={
                r.comparisons.length && r.details.length
                  ? () => setExpanded((v) => (v === r.id ? null : r.id))
                  : undefined
              }
              editor={
                r.comparisons.length ? (
                  <Facts facts={budgetVisible ? r.details : r.details.filter((f) => !f.money)} />
                ) : undefined
              }
            >
              {budgetVisible &&
                r.comparisons.map((c) => (
                  <ProposalDiffRow
                    key={c.label}
                    label={c.label}
                    before={inlineProposalValue(c.before, c.money)}
                    after={inlineProposalValue(c.after, c.money)}
                    layout="inline"
                    inset={false}
                    strikeBefore={false}
                  />
                ))}
              {!r.comparisons.length && (
                <>
                  {changes.comparisons.map((c) => (
                    <ProposalDiffRow
                      key={c.label}
                      label={c.label}
                      before={inlineProposalValue(c.before, c.money)}
                      after={inlineProposalValue(c.after, c.money)}
                      layout="inline"
                      inset={false}
                      strikeBefore={false}
                    />
                  ))}
                  <Facts facts={changes.facts} inset={false} />
                </>
              )}
            </ReviewItem>
          );
        })}
      </ReviewCollection>
      {proposal.rows.length > 5 && (
        <nav aria-label="Halaman perubahan" className="flex items-center justify-between gap-3">
          <Button
            variant="quiet"
            size="compact"
            disabled={start === 0}
            onClick={() => setPage((v) => Math.max(0, v - 1))}
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
            onClick={() => setPage((v) => v + 1)}
          >
            Berikutnya
          </Button>
        </nav>
      )}
    </>
  );
  const changedRows =
    proposal.action === "REALLOCATE_BUDGET"
      ? proposal.rows.filter((r) => r.comparisons.some((c) => c.before !== c.after))
      : proposal.rows;
  const inlineChanges = inlineFactChanges([
    ...proposal.summary,
    ...changedRows.flatMap((r) => (r.comparisons.length ? [] : r.details)),
  ]);
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
              : proposal.blockers.length
                ? "Belum siap"
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
              {confirmed ? "Lihat rincian" : "Buka review"}
              <AppIcon name="arrow_forward" className="icon-sm" />
            </Button>
          )
        }
      >
        <div className="space-y-1 px-4 py-3">
          <p className="text-row font-semibold">{proposal.entityName}</p>
          <p className="text-support text-on-surface-variant">
            {proposal.action === "REALLOCATE_BUDGET"
              ? `${proposal.input.action === "REALLOCATE_BUDGET" ? proposal.input.categories.length : 0} kategori diubah; kategori lainnya tetap.`
              : proposal.meta}
          </p>
        </div>
        {inline && (
          <ProposalInlineReview
            comparisons={inlineChanges.comparisons}
            facts={inlineChanges.facts.filter((f) => !f.label.startsWith("Alasan"))}
            disclosure={details}
          >
            {feedback}
            {warnings}
            <Facts
              facts={inlineChanges.facts.filter((f) => f.label.startsWith("Alasan"))}
              inset={false}
            />
            {proposal.action === "ACTIVATE_PROJECT" && (
              <div className="divide-y divide-outline-variant/20">
                {proposal.rows.map((r) => (
                  <FactRow
                    key={r.id}
                    label={r.title}
                    wrapLabel
                    inset={false}
                    value={
                      <span className="inline-flex items-center gap-1">
                        <AppIcon
                          name={r.meta === "Siap" ? "check_circle" : "error"}
                          className="icon-sm"
                        />
                        {r.meta}
                      </span>
                    }
                  />
                ))}
              </div>
            )}
            {budgetVisible &&
              proposal.action === "REALLOCATE_BUDGET" &&
              changedRows.map((r) => (
                <div key={r.id}>
                  <p className="text-support font-semibold">{r.title}</p>
                  {r.comparisons.map((c) => (
                    <ProposalDiffRow
                      key={c.label}
                      label={c.label}
                      before={inlineProposalValue(c.before, c.money)}
                      after={inlineProposalValue(c.after, c.money)}
                      layout="inline"
                      inset={false}
                      strikeBefore={false}
                    />
                  ))}
                </div>
              ))}
            {budgetVisible &&
              proposal.action.endsWith("BUDGET") &&
              proposal.action !== "REALLOCATE_BUDGET" && (
                <Facts
                  facts={proposal.rows.map((r) => ({
                    label: r.title,
                    value: r.amount ?? 0,
                    money: true,
                  }))}
                  inset={false}
                />
              )}
            {proposal.action === "COMPLETE_PROJECT" && (
              <p className="text-support text-on-surface-variant">
                {proposal.input.action === "COMPLETE_PROJECT" ? proposal.input.closingNote : ""}
              </p>
            )}
            {budgetVisible && proposal.budget && (
              <Facts
                facts={proposal.budget.filter((f) =>
                  (proposal.action === "COMPLETE_PROJECT"
                    ? ["Nilai kontrak", "Realisasi", "Margin realisasi"]
                    : ["Plafon internal", "Total alokasi setelah tindakan", "Sisa plafon"]
                  ).includes(f.label),
                )}
                inset={false}
              />
            )}
          </ProposalInlineReview>
        )}
      </ProposalCardShell>
      <FormSheet
        open={open}
        title={proposal.action === "REALLOCATE_BUDGET" ? "Review alokasi budget" : "Review proyek"}
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
            <p className="text-section-title font-semibold">{proposal.entityName}</p>
            <p className="text-support text-on-surface-variant">{proposal.effect}</p>
          </div>
          {feedback}
          {warnings}
          {!desktop && summary}
          <Facts
            facts={proposal.summary.filter((f) => f.label.startsWith("Alasan"))}
            inset={false}
          />
          {collection}
          {details}
        </div>
      </FormSheet>
      <ConfirmationDialog
        actionLayout="adaptive"
        open={decision && !confirmed}
        title={action.commit}
        confirmLabel={action.commit}
        pending={pending}
        disabled={!ready || pending}
        onClose={() => {
          if (!inFlight.current) setDecision(false);
        }}
        onConfirm={() => void save()}
      >
        <div className="space-y-3">
          <p className="font-semibold">{proposal.entityName}</p>
          <p>{proposal.effect}</p>
          <Facts facts={proposal.summary} />
          {proposal.action === "ASSIGN_PM" && <Facts facts={proposal.rows[0]?.details ?? []} />}
          {proposal.action === "COMPLETE_PROJECT" && (
            <p>{proposal.input.action === "COMPLETE_PROJECT" ? proposal.input.closingNote : ""}</p>
          )}
          {budgetVisible && proposal.budget && (
            <Facts
              facts={proposal.budget.filter((f) =>
                (proposal.action === "COMPLETE_PROJECT"
                  ? ["Nilai kontrak", "Realisasi", "Margin realisasi"]
                  : ["Plafon internal", "Total alokasi setelah tindakan", "Sisa plafon"]
                ).includes(f.label),
              )}
            />
          )}
          {warnings}
        </div>
      </ConfirmationDialog>
    </>
  );
}
