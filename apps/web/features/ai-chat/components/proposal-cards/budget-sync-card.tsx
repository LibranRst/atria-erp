"use client";
import * as React from "react";
import { getAiBudgetSyncProposal, confirmAiBudgetSyncProposal } from "@/app/actions/ai/budget-sync";
import { useCan } from "@/components/auth/permissions-provider";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import {
  AppIcon,
  InlineStateRow,
  Button,
  ButtonLink,
  FactRow,
  GroupedSurface,
  FormSheet,
  ConfirmationDialog,
  SheetFooterActions,
  ReviewCollection,
  ReviewItem,
  FormDisclosure,
} from "@/components/ui";
import { ProposalCardShell } from "./proposal-card-shell";
import {
  ProposalInlineReview,
  inlineProposalValue,
  type InlineProposalComparison,
} from "./proposal-inline-review";
import { ProposalReviewFeedback } from "./proposal-review-feedback";
import {
  budgetSummaryFields,
  budgetSummaryChanges,
  type BudgetSyncProposal,
  type BudgetSyncView,
} from "@atria/core/ai/budget-sync";
import { fromCents, parseNumericToCents } from "@atria/core/finance/money-minor";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
type Category = BudgetSyncProposal["categories"][number];
function display(value: string, key: string): string | number {
  return key === "status"
    ? formatBusinessLabel(value)
    : key === "usedPercentage"
      ? `${Number(value).toLocaleString("id-ID", { maximumFractionDigits: 4 })}%`
      : Number(value);
}
function comparisons(row: Category): InlineProposalComparison[] {
  return budgetSummaryChanges(row).map(([key, label, money]) => ({
    label: `${row.name} · ${label}`,
    before: display(row.before[key], key),
    after: display(row.after[key], key),
    money,
    layout: "stacked",
  }));
}
/** THESIS: show the actual mismatch and one explicit repair; a clean inspection needs no commit.
 * OWN-WORLD: inherited Atria grouped surfaces, compact exact money and shared controls.
 * STORY: inspect → compare → human approval → verified persisted summary.
 * FIRST VIEWPORT: compact chat verdict/deltas; optional grouped categories, desktop summary aside.
 * FORM: extension of established AI proposal family, no new visual world or overlay primitive.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
 */
export function BudgetSyncCard({
  proposal: initial,
  conversationId,
  toolCallId,
  isStreaming,
  isBusy,
  alreadyConfirmed,
  onFollowUp,
}: {
  readonly proposal: BudgetSyncProposal;
  readonly conversationId: string | null;
  readonly toolCallId: string;
  readonly isStreaming: boolean;
  readonly isBusy: boolean;
  readonly alreadyConfirmed: boolean;
  readonly onFollowUp: (text: string) => void;
}): React.JSX.Element {
  const can = useCan(),
    desktop = useWorkspacePresentation() === "desktop";
  const [view, setView] = React.useState<BudgetSyncView | null>(null),
    [open, setOpen] = React.useState(false),
    [decision, setDecision] = React.useState(false),
    [page, setPage] = React.useState(0),
    [error, setError] = React.useState(""),
    [denied, setDenied] = React.useState(false),
    [checking, setChecking] = React.useState(false),
    [status, setStatus] = React.useState<"idle" | "submitting" | "submitted" | "failed">("idle");
  const epoch = React.useRef(0),
    flight = React.useRef(false);
  const proposal = view?.proposal ?? initial,
    changed = proposal.categories.filter((c) => budgetSummaryChanges(c).length),
    confirmed = alreadyConfirmed || status === "submitted" || view?.status === "CONFIRMED",
    stale = view?.status === "STALE" || view?.status === "EXPIRED",
    pending = isBusy || status === "submitting",
    readable = !denied && can("use:ai_chat") && can("view:project") && can("view:budget"),
    permitted = readable && can("update:budget"),
    ready =
      view?.status === "READY" &&
      permitted &&
      !checking &&
      !pending &&
      !confirmed &&
      !isStreaming &&
      !error &&
      changed.length > 0;
  const refresh = React.useCallback(async (): Promise<void> => {
    if (!conversationId || isStreaming || flight.current) return;
    const request = ++epoch.current;
    setChecking(true);
    try {
      const result = await getAiBudgetSyncProposal({ conversationId, toolCallId });
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
      if (request === epoch.current) setError("Pemeriksaan belum dapat dimuat. Coba periksa lagi.");
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
      const result = await confirmAiBudgetSyncProposal({ conversationId, toolCallId });
      setDecision(false);
      if (result.success) {
        setStatus("submitted");
      } else {
        setError(result.error.message);
        setDenied(["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"].includes(result.error.code));
        setStatus("failed");
      }
    } catch {
      setError("Hasil sinkronisasi belum diketahui. Periksa lagi sebelum mengulang.");
      setStatus("failed");
      setDecision(false);
    } finally {
      flight.current = false;
      void refresh();
    }
  }
  const verdict = confirmed
    ? view?.verified
      ? "Ringkasan tersimpan dan sesuai"
      : "Sinkronisasi tercatat"
    : changed.length
      ? `${changed.length} kategori memiliki selisih`
      : "Seluruh kategori sesuai";
  const follow = (): void => {
    setOpen(false);
    onFollowUp(
      `Periksa ulang ringkasan budget proyek ${proposal.projectName} dari sumber transaksi terbaru. Tampilkan selisih dan tunggu tombol persetujuan sebelum sinkronisasi.`,
    );
  };
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
      message="Data berubah atau pemeriksaan kedaluwarsa. Minta pemeriksaan terbaru sebelum sinkronisasi."
      recovery={{ label: "Periksa ulang lewat chat", disabled: pending, onClick: follow }}
    />
  ) : confirmed && view && !view.verified ? (
    <ProposalReviewFeedback
      embedded
      message="Sinkronisasi sudah tercatat, tetapi ada selisih baru pada pemeriksaan terbaru."
      recovery={{ label: "Periksa ulang lewat chat", disabled: pending, onClick: follow }}
    />
  ) : changed.length && !permitted ? (
    <ProposalReviewFeedback
      embedded
      message="Anda dapat melihat hasil pemeriksaan. Sinkronisasi memerlukan izin memperbarui budget."
    />
  ) : null;
  const risks = proposal.categories.filter((c) =>
    ["CRITICAL", "OVER_BUDGET"].includes(c.after.status),
  );
  const riskSummary =
    readable && risks.length > 0 ? (
      <InlineStateRow
        icon="warning"
        tone="critical"
        title={risks.map((c) => `${c.name}: ${formatBusinessLabel(c.after.status)}`).join(" · ")}
        description="Kondisi mengikuti transaksi tersimpan. Sinkronisasi memperbarui penanda budget."
      />
    ) : null;
  const summary = readable ? (
    <GroupedSurface>
      <div className="px-4 py-3">
        <p className="text-row font-semibold">{verdict}</p>
        <p className="mt-1 text-support text-on-surface-variant">
          {proposal.categories.length} kategori diperiksa
        </p>
      </div>
      <FactRow
        label="Plafon internal"
        wrapLabel
        value={inlineProposalValue(Number(proposal.internalBudget), true, true)}
      />
      <FactRow label="Kategori berbeda" value={changed.length} />
      {riskSummary}
    </GroupedSurface>
  ) : null;
  const footer = (aside: boolean): React.JSX.Element => (
    <div className="space-y-3">
      {!confirmed && changed.length > 0 ? (
        <SheetFooterActions
          layout="adaptive"
          desktopStacked={aside}
          primaryFirst={aside}
          primary={{
            label: "Sinkronkan ringkasan",
            pending: status === "submitting",
            pendingLabel: "Menyinkronkan…",
            disabled: !ready,
            onClick: () => setDecision(true),
          }}
          secondary={{
            label: stale ? "Periksa ulang" : "Koreksi lewat chat",
            variant: "quiet",
            disabled: pending,
            onClick: follow,
          }}
        />
      ) : (
        <ButtonLink fullWidth href={`/projects/${proposal.input.projectId}?tab=budget`}>
          Buka budget proyek
        </ButtonLink>
      )}
      <p role="status" className="text-meta text-on-surface-variant">
        {confirmed && view?.verified
          ? "Hasil tersimpan sudah diperiksa kembali."
          : !changed.length
            ? "Ringkasan sesuai dengan transaksi tersimpan. Tidak perlu sinkronisasi."
            : "Hanya ringkasan pemakaian diperbarui dari pengeluaran dan pembayaran tercatat."}
      </p>
    </div>
  );
  const allChanges = changed.flatMap(comparisons),
    maxPage = Math.max(0, Math.ceil(proposal.categories.length / 5) - 1),
    start = Math.min(page, maxPage) * 5;
  const [references, setReferences] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  return (
    <>
      <ProposalCardShell
        title="Pemeriksaan ringkasan budget"
        status={error && !confirmed ? "failed" : status}
        isAlreadyConfirmed={confirmed}
        statusLabel={
          confirmed
            ? "Tersimpan"
            : stale
              ? "Data berubah"
              : error
                ? "Perlu diperiksa"
                : checking || !view
                  ? "Memeriksa"
                  : changed.length
                    ? "Ada selisih"
                    : "Sesuai"
        }
        showConfirmAction={false}
        onConfirm={save}
        footer={readable ? footer(false) : undefined}
      >
        <div className="px-4 py-3">
          <p className="text-row font-semibold">
            {readable ? proposal.projectName : "Sumber tidak tersedia dalam akses Anda"}
          </p>
          {readable && (
            <p className="mt-1 text-support text-on-surface-variant">
              {verdict} · {proposal.categories.length} kategori diperiksa
            </p>
          )}
        </div>
        {readable && (
          <ProposalInlineReview
            preciseMoney
            comparisons={allChanges.slice(0, 3)}
            facts={
              !changed.length
                ? [
                    {
                      label: "Terpakai",
                      value: Number(
                        fromCents(
                          proposal.categories.reduce(
                            (n, c) => n + parseNumericToCents(c.after.actualAmount),
                            0n,
                          ),
                        ),
                      ),
                      money: true,
                    },
                  ]
                : []
            }
          >
            {feedback}
            {riskSummary}
          </ProposalInlineReview>
        )}
        {!readable && <div className="px-4 pb-3">{feedback}</div>}
        {readable && (
          <div className="px-4 pb-3">
            <Button
              variant="quiet"
              size="compact"
              disabled={pending}
              onClick={() => {
                setOpen(true);
                void refresh();
              }}
            >
              {allChanges.length > 3
                ? `Lihat ${allChanges.length} perbedaan`
                : "Rincian per kategori"}
              <AppIcon name="arrow_forward" className="icon-sm" />
            </Button>
          </div>
        )}
      </ProposalCardShell>
      <FormSheet
        open={open}
        title="Cek budget"
        desktopSize="wide"
        sizing="content"
        desktopFooterPlacement="aside"
        desktopAsideSummary={summary}
        footer={footer(true)}
        pending={pending}
        dismissal={{ mode: "preserve" }}
        onClose={() => {
          if (!flight.current) setOpen(false);
        }}
      >
        <div className="space-y-5">
          <div>
            <p className="text-section-title font-semibold">
              {readable ? proposal.projectName : "Sumber tidak tersedia dalam akses Anda"}
            </p>
            <p className="text-support text-on-surface-variant">
              {readable
                ? "Ringkasan berdasarkan transaksi tersimpan"
                : "Periksa akses untuk melanjutkan."}
            </p>
          </div>
          {feedback && <GroupedSurface>{feedback}</GroupedSurface>}
          {!desktop && summary}
          {readable && (
            <ReviewCollection ariaLabel="Hasil pemeriksaan per kategori">
              {proposal.categories.slice(start, start + 5).map((row) => (
                <ReviewItem
                  key={row.id}
                  title={row.name}
                  meta={
                    budgetSummaryChanges(row).length
                      ? `${budgetSummaryChanges(row).length} nilai perlu disinkronkan`
                      : "Ringkasan sesuai"
                  }
                  primaryValue={
                    <div className="space-y-1">
                      <p className="text-meta text-on-surface-variant">
                        Terpakai setelah sinkronisasi
                      </p>
                      {inlineProposalValue(Number(row.after.actualAmount), true, true)}
                    </div>
                  }
                  summary={
                    <span
                      className={
                        row.after.status === "OVER_BUDGET" || row.after.status === "CRITICAL"
                          ? "text-critical"
                          : "text-on-surface-variant"
                      }
                    >
                      {formatBusinessLabel(row.after.status)}
                    </span>
                  }
                  expanded={detailId === row.id}
                  onToggle={() => setDetailId((value) => (value === row.id ? null : row.id))}
                  editor={
                    <>
                      <FactRow
                        label="Alokasi kategori"
                        inset={false}
                        wrapLabel
                        value={inlineProposalValue(Number(row.allocatedAmount), true, true)}
                      />
                      {budgetSummaryChanges(row).length ? (
                        <ProposalInlineReview
                          comparisons={comparisons(row).map((c) => ({
                            ...c,
                            label: c.label.replace(`${row.name} · `, ""),
                          }))}
                          preciseMoney
                        />
                      ) : (
                        <div className="divide-y divide-outline-variant/20">
                          {budgetSummaryFields.map(([key, label, money]) => (
                            <FactRow
                              key={key}
                              label={label}
                              inset={false}
                              wrapLabel
                              value={inlineProposalValue(display(row.after[key], key), money, true)}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  }
                >
                  <FactRow
                    label="Sisa setelah sinkronisasi"
                    inset={false}
                    wrapLabel
                    value={inlineProposalValue(Number(row.after.remainingAmount), true, true)}
                  />
                </ReviewItem>
              ))}
            </ReviewCollection>
          )}
          {readable && proposal.categories.length > 5 && (
            <nav aria-label="Halaman kategori" className="flex items-center justify-between gap-3">
              <Button
                variant="quiet"
                size="compact"
                disabled={!start}
                onClick={() => setPage((v) => Math.max(0, v - 1))}
              >
                Sebelumnya
              </Button>
              <span className="text-support tabular-nums">
                {start + 1}–{Math.min(start + 5, proposal.categories.length)} /{" "}
                {proposal.categories.length}
              </span>
              <Button
                variant="quiet"
                size="compact"
                disabled={page >= maxPage}
                onClick={() => setPage((v) => v + 1)}
              >
                Berikutnya
              </Button>
            </nav>
          )}
          {readable && (
            <GroupedSurface>
              <FormDisclosure
                variant="plain"
                title="Dasar pemeriksaan"
                expanded={references}
                onToggle={() => setReferences((v) => !v)}
              >
                <p className="px-4 pb-3 text-support text-on-surface-variant">
                  Menunggu persetujuan berasal dari pengeluaran diajukan dan terverifikasi. Terpakai
                  berasal dari pengeluaran disetujui dan dibayar. Dibayar mencakup pengeluaran lunas
                  serta pembayaran vendor selesai, sampai nominal pengeluarannya. Sisa alokasi
                  adalah alokasi dikurangi terpakai; kondisi mengikuti persentase pemakaian.
                </p>
              </FormDisclosure>
            </GroupedSurface>
          )}
        </div>
      </FormSheet>
      <ConfirmationDialog
        open={decision && !confirmed}
        title="Sinkronkan ringkasan budget?"
        description="Memperbarui nilai ringkasan yang berbeda dari transaksi tersimpan. Kontrak, plafon, alokasi, status pengeluaran, saldo kas dan stok tetap."
        confirmLabel="Sinkronkan ringkasan"
        actionLayout="adaptive"
        pending={pending}
        disabled={!ready}
        onClose={() => {
          if (!flight.current) setDecision(false);
        }}
        onConfirm={() => void save()}
      >
        <p className="text-row font-semibold">{proposal.projectName}</p>
        <FactRow label="Kategori diperbarui" value={changed.length} />
        {readable && (
          <ProposalInlineReview
            comparisons={changed.flatMap((row) => {
              const fields = comparisons(row);
              const main = fields.find((c) => c.label === `${row.name} · Terpakai`) ?? fields[0];
              return main ? [main] : [];
            })}
            preciseMoney
          />
        )}
        {readable && (
          <div className="space-y-2 px-4 pb-3 text-support text-on-surface-variant">
            {changed.map((row) => (
              <p key={row.id}>
                <span className="font-semibold">{row.name}: </span>
                {budgetSummaryChanges(row)
                  .map(([, label]) => label)
                  .join(", ")}
                .
              </p>
            ))}
          </div>
        )}
        {riskSummary}
      </ConfirmationDialog>
    </>
  );
}
