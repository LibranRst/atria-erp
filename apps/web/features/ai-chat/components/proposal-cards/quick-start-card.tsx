"use client";
import * as React from "react";
import { getAiQuickStartProposal, confirmAiQuickStartProposal } from "@/app/actions/ai/quick-start";
import { useCan } from "@/components/auth/permissions-provider";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { useRouter } from "@/lib/navigation/workspace-navigation";
import {
  Button,
  ButtonLink,
  GroupedSurface,
  FactRow,
  MoneyValue,
  FormSheet,
  FormDisclosure,
  ReviewCollection,
  ReviewItem,
  SheetFooterActions,
  ConfirmationDialog,
  InlineStateRow,
} from "@/components/ui";
import type { QuickStartProposal, QuickStartView } from "@atria/core/ai/quick-start";
import { ProposalCardShell } from "./proposal-card-shell";
import { ProposalInlineReview, inlineProposalValue } from "./proposal-inline-review";
import { ProposalReviewFeedback } from "./proposal-review-feedback";
/** THESIS: one clearly reviewed setup decision; the first project completes the stored workflow.
 * OWN-WORLD: inherited Atria Operate, grouped white surfaces, compact values, capsule actions.
 * STORY: actual setup/Settings → explicit proposal → human Save → recorded position/project.
 * FIRST VIEWPORT: current/next step or first-project identity, financial facts and category review.
 * FORM: shared inline review; first project uses FormSheet two panels/mobile stack, five rows/page.
 * FINISH: unreviewed and undocumented is unfinished; finish reviewer and DESIGN.md close this extension.
 */
const labels: Record<QuickStartProposal["input"]["action"], { title: string; commit: string }> = {
  ADVANCE: { title: "Lanjutkan setup", commit: "Lanjutkan tahap" },
  PAUSE: { title: "Tunda setup", commit: "Tunda setup" },
  RESUME: { title: "Lanjutkan setup", commit: "Lanjutkan setup" },
  RETRY: { title: "Percobaan ulang setup", commit: "Coba kembali" },
  STOCK_DECISION: { title: "Kesiapan stok awal", commit: "Simpan keputusan" },
  CREATE_PROJECT: { title: "Proyek pertama", commit: "Buat proyek pertama" },
};
export function QuickStartCard({
  proposal: initial,
  conversationId,
  toolCallId,
  isStreaming,
  isBusy,
  alreadyConfirmed,
  onFollowUp,
}: {
  readonly proposal: QuickStartProposal;
  readonly conversationId: string | null;
  readonly toolCallId: string;
  readonly isStreaming: boolean;
  readonly isBusy: boolean;
  readonly alreadyConfirmed: boolean;
  readonly onFollowUp: (text: string) => void;
}): React.JSX.Element {
  const can = useCan(),
    desktop = useWorkspacePresentation() === "desktop",
    router = useRouter();
  const [view, setView] = React.useState<QuickStartView | null>(null),
    [error, setError] = React.useState(""),
    [denied, setDenied] = React.useState(false),
    [checking, setChecking] = React.useState(false),
    [open, setOpen] = React.useState(false),
    [decision, setDecision] = React.useState(false),
    [page, setPage] = React.useState(0),
    [budgetOpen, setBudgetOpen] = React.useState(false),
    [status, setStatus] = React.useState<"idle" | "submitting" | "submitted" | "failed">("idle");
  const epoch = React.useRef(0),
    flight = React.useRef(false);
  const proposal = view?.proposal ?? initial,
    kind = proposal.input.action,
    project = kind === "CREATE_PROJECT",
    copy = labels[kind],
    pending = isBusy || status === "submitting",
    confirmed = alreadyConfirmed || status === "submitted" || view?.status === "CONFIRMED",
    stale = view?.status === "STALE" || view?.status === "EXPIRED";
  const readable =
    can("use:ai_chat") &&
    !denied &&
    (kind === "STOCK_DECISION"
      ? can("manage:onboarding") || can("create:opening_inventory")
      : can("manage:onboarding")) &&
    (!project || (can("create:project") && can("view:settings")));
  const ready =
    readable &&
    view?.status === "READY" &&
    proposal.changed &&
    !confirmed &&
    !pending &&
    !checking &&
    !isStreaming &&
    !error;
  const refresh = React.useCallback(async (): Promise<void> => {
    if (!conversationId || isStreaming || flight.current) return;
    const request = ++epoch.current;
    setChecking(true);
    try {
      const result = await getAiQuickStartProposal({ conversationId, toolCallId });
      if (request !== epoch.current) return;
      if (result.success) {
        setView(result.data);
        setError("");
        setDenied(false);
      } else {
        setError(result.error.message);
        setDenied(["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"].includes(result.error.code));
      }
    } catch {
      if (request === epoch.current) setError("Usulan setup belum dapat diperiksa. Periksa lagi.");
    } finally {
      if (request === epoch.current) setChecking(false);
    }
  }, [conversationId, toolCallId, isStreaming]);
  React.useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void refresh();
    });
    const request = epoch;
    return () => {
      active = false;
      request.current++;
    };
  }, [refresh]);
  async function save(): Promise<void> {
    if (!conversationId || !ready || flight.current) return;
    flight.current = true;
    epoch.current++;
    setStatus("submitting");
    setError("");
    try {
      const result = await confirmAiQuickStartProposal({ conversationId, toolCallId });
      if (result.success) {
        setStatus("submitted");
        setDecision(false);
        router.refresh();
      } else {
        setStatus("failed");
        setDecision(false);
        setError(result.error.message);
        setDenied(["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"].includes(result.error.code));
      }
    } catch {
      setStatus("failed");
      setDecision(false);
      setError("Hasil simpan belum diketahui. Periksa lagi sebelum mengulang.");
    } finally {
      flight.current = false;
      void refresh();
    }
  }
  const follow = (): void =>
    onFollowUp(
      "Baca posisi Quick Start dan kesiapan setup saya saat ini. Bantu lanjutkan tahap berikutnya dengan preview terbaru; tanyakan isian atau keputusan yang belum saya berikan, jangan menyimpan sebelum saya menekan tombol.",
    );
  const feedback = error ? (
    <ProposalReviewFeedback
      embedded
      message={error}
      recovery={{
        label: "Periksa lagi",
        disabled: pending || checking,
        onClick: () => void refresh(),
      }}
    />
  ) : stale ? (
    <ProposalReviewFeedback
      embedded
      message={
        view?.status === "EXPIRED"
          ? "Usulan setup kedaluwarsa. Minta preview terbaru."
          : (view?.blockedReason ??
            "Progres, Settings atau sumber setup berubah. Minta preview terbaru sebelum melanjutkan.")
      }
      recovery={
        project && !open
          ? { label: "Minta preview terbaru", disabled: pending, onClick: follow }
          : undefined
      }
    />
  ) : null;
  const factRows = (facts: QuickStartProposal["facts"], inset = true): React.JSX.Element => (
    <div className="divide-y divide-ring-subtle">
      {facts.map((f) => (
        <FactRow
          key={f.label}
          label={f.label}
          wrapLabel
          inset={inset}
          value={inlineProposalValue(f.value, f.money, true)}
        />
      ))}
    </div>
  );
  const budgetDetails = (
    <div className="px-4">
      <FormDisclosure
        variant="plain"
        title="Rincian budget"
        expanded={budgetOpen}
        onToggle={() => setBudgetOpen((value) => !value)}
      >
        {factRows(
          proposal.facts.filter(
            (f) =>
              f.label === "Target margin" ||
              f.label === "Default budget" ||
              f.label === "Belum dialokasikan",
          ),
          false,
        )}
      </FormDisclosure>
    </div>
  );
  const summary = readable ? (
    <GroupedSurface>
      {factRows(proposal.facts.filter((f) => f.money && f.label !== "Belum dialokasikan"))}
      {!desktop && budgetDetails}
    </GroupedSurface>
  ) : null;
  const destination = view?.destination ?? "/onboarding";
  const footer = (
    <div className="space-y-3">
      {readable &&
        (confirmed || !proposal.changed ? (
          <div className="space-y-2">
            <ButtonLink fullWidth href={destination}>
              {project && confirmed ? "Buka proyek" : "Buka setup"}
            </ButtonLink>
            {!project && (
              <Button fullWidth variant="secondary" disabled={pending} onClick={follow}>
                Lanjutkan lewat chat
              </Button>
            )}
          </div>
        ) : (
          <SheetFooterActions
            desktopStacked={project}
            primaryFirst={project}
            layout="adaptive"
            primary={{
              label: copy.commit,
              pending: status === "submitting",
              pendingLabel: "Menyimpan…",
              disabled: !ready,
              onClick: () => (kind === "STOCK_DECISION" ? setDecision(true) : void save()),
            }}
            secondary={{
              label: stale ? "Minta preview terbaru" : "Koreksi lewat chat",
              variant: "quiet",
              disabled: pending,
              onClick: follow,
            }}
          />
        ))}
      <p role="status" className="text-meta text-on-surface-variant">
        {confirmed
          ? project
            ? "Proyek Draft dan budget kategori tersimpan. Quick Start selesai."
            : "Keputusan setup tercatat."
          : !proposal.changed
            ? "Sudah sesuai. Tidak perlu menyimpan."
            : readable
              ? project
                ? "Membuat proyek Draft dan budget dari Settings; Quick Start selesai. Stok dan kas tetap."
                : proposal.effect
              : "Periksa akses akun untuk melanjutkan."}
      </p>
    </div>
  );
  const pages = Math.max(1, Math.ceil(proposal.categories.length / 5)),
    currentPage = Math.min(page, pages - 1),
    rows = proposal.categories.slice(currentPage * 5, currentPage * 5 + 5);
  return (
    <>
      <ProposalCardShell
        title={copy.title}
        status={error && !confirmed ? "failed" : status}
        isAlreadyConfirmed={confirmed}
        statusLabel={
          confirmed
            ? "Tercatat"
            : stale
              ? "Data berubah"
              : error
                ? "Perlu diperiksa"
                : checking || !view
                  ? "Memeriksa"
                  : proposal.changed
                    ? "Usulan"
                    : "Sesuai"
        }
        showConfirmAction={false}
        onConfirm={save}
        footer={
          project ? (
            readable ? (
              <Button
                fullWidth
                variant={confirmed ? "secondary" : "primary"}
                disabled={pending || checking || isStreaming}
                onClick={() => setOpen(true)}
              >
                {confirmed ? "Lihat rincian" : "Review proyek pertama"}
              </Button>
            ) : undefined
          ) : (
            footer
          )
        }
      >
        <div className="px-4 py-3">
          <p className="text-section-title font-semibold wrap-anywhere">
            {readable
              ? project
                ? proposal.title
                : "Quick Start perusahaan"
              : "Setup tidak tersedia dalam akses Anda"}
          </p>
          <p className="mt-1 text-support text-on-surface-variant">
            {project
              ? "Proyek dan budget awal dari Settings perusahaan."
              : "Progres setup yang tersimpan menjadi acuan."}
          </p>
        </div>
        {readable ? (
          <ProposalInlineReview
            preciseMoney
            comparisons={
              project
                ? []
                : proposal.comparisons.map((c) => ({
                    ...c,
                    layout: desktop ? ("inline" as const) : ("vertical" as const),
                  }))
            }
            facts={
              project
                ? proposal.facts.filter(
                    (f) =>
                      f.label === "Klien" ||
                      f.label === "Nilai proyek" ||
                      f.label === "Budget internal",
                  )
                : proposal.facts
            }
          >
            {feedback}
          </ProposalInlineReview>
        ) : (
          <div className="px-4 pb-3">{feedback}</div>
        )}
      </ProposalCardShell>
      <FormSheet
        open={open && project}
        title="Review proyek"
        desktopSize="wide"
        desktopFooterPlacement="aside"
        desktopAsideSummary={summary}
        footer={footer}
        sizing="content"
        dismissal={{ mode: "preserve" }}
        pending={pending}
        onClose={() => {
          if (!flight.current) setOpen(false);
        }}
      >
        {readable ? (
          <div className="space-y-5">
            <div>
              <p className="text-section-title font-semibold wrap-anywhere">{proposal.title}</p>
              <p className="mt-1 text-support text-on-surface-variant">
                Proyek Draft · Quick Start selesai setelah Simpan
              </p>
            </div>
            {feedback}
            {!desktop && summary}
            <GroupedSurface>
              {factRows(
                proposal.facts.filter(
                  (f) => !f.money && f.label !== "Default budget" && f.label !== "Target margin",
                ),
              )}
            </GroupedSurface>
            <div className="space-y-2">
              <p className="text-row font-semibold">Alokasi kategori</p>
              <ReviewCollection
                ariaLabel="Alokasi budget proyek pertama"
                footer={
                  pages > 1 ? (
                    <div className="flex items-center justify-between gap-2 px-4 py-2">
                      <Button
                        variant="secondary"
                        size="compact"
                        disabled={currentPage === 0}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                      >
                        Sebelumnya
                      </Button>
                      <span className="text-meta">
                        {currentPage * 5 + 1}–
                        {Math.min((currentPage + 1) * 5, proposal.categories.length)} /{" "}
                        {proposal.categories.length}
                      </span>
                      <Button
                        variant="secondary"
                        size="compact"
                        disabled={currentPage + 1 >= pages}
                        onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                      >
                        Berikutnya
                      </Button>
                    </div>
                  ) : undefined
                }
              >
                {rows.map((c) => (
                  <ReviewItem
                    key={c.id}
                    title={c.name}
                    meta={`${Number((c.ratio * 100).toFixed(4))}% dari plafon internal`}
                    primaryValue={
                      <MoneyValue
                        amount={c.amount}
                        variant="fullDynamic"
                        size="sm"
                        fractionDigits={Number.isInteger(c.amount) ? 0 : 2}
                      />
                    }
                  />
                ))}
              </ReviewCollection>
            </div>
            {desktop && <GroupedSurface>{budgetDetails}</GroupedSurface>}
            <InlineStateRow
              icon="info"
              tone="neutral"
              title="Mengikuti default perusahaan"
              description="Alokasi ini berasal dari Settings. Nilai kontrak dan RAB disetujui dicatat; dokumen RAB belum dibuat oleh tindakan ini."
            />
          </div>
        ) : (
          feedback
        )}
      </FormSheet>
      <ConfirmationDialog
        open={decision && readable && !confirmed}
        title="Simpan keputusan stok awal"
        confirmLabel="Simpan keputusan"
        actionLayout="adaptive"
        pending={pending}
        disabled={!ready}
        onClose={() => {
          if (!flight.current) setDecision(false);
        }}
        onConfirm={() => void save()}
      >
        <div className="space-y-3">
          {proposal.comparisons.map((c) => (
            <p key={c.label}>
              {c.before} → <strong>{c.after}</strong>
            </p>
          ))}
          <p>{proposal.effect}</p>
        </div>
      </ConfirmationDialog>
    </>
  );
}
