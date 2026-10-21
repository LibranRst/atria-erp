"use client";
import { proposalReviewFlow } from "../../utils/proposal-review-flow";
import { ProposalInlineReview } from "./proposal-inline-review";
/** THESIS: exact stock consequences before commit. OWN-WORLD: inherited Atria Operate.
 * STORY: project/source → stock/budget → explicit confirmation → receipt.
 * FIRST VIEWPORT: contextual rows left, concise protected actions right; mobile one column.
 * FORM: approved shared grouped review, five rows; no new primitive.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
 */
import * as React from "react";
import {
  getAiProjectStockProposal,
  confirmAiProjectStockProposal,
} from "@/app/actions/ai/project-stock";
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
  MoneyValue,
  ReviewCollection,
  ReviewItem,
  FormDisclosure,
} from "@/components/ui";
import { ProposalCardShell, ProposalDiffRow } from "./proposal-card-shell";
import { ProposalReviewFeedback } from "./proposal-review-feedback";
import {
  projectStockPermission,
  type ProjectStockProposal,
  type ProjectStockView,
  type ProjectStockAction,
  type ProjectStockState,
} from "@atria/core/ai/project-stock";
const labels: Record<
  ProjectStockAction,
  { title: string; action: string; effect: string; saved: string }
> = {
  RESERVE: {
    title: "Reservasi stok",
    action: "Konfirmasi reservasi",
    effect: "Reservasi menahan kuota untuk proyek ini. Stok fisik, realisasi dan kas tetap.",
    saved: "Stok berhasil direservasi untuk proyek.",
  },
  USE: {
    title: "Pemakaian stok",
    action: "Catat pemakaian",
    effect:
      "Stok fisik berkurang; reservasi milik proyek ini digunakan lebih dahulu. Realisasi Material mengikuti sumber biaya yang tercatat. Kas tetap.",
    saved: "Pemakaian stok proyek tercatat.",
  },
  RELEASE_RESERVATION: {
    title: "Pelepasan reservasi",
    action: "Lepas reservasi",
    effect:
      "Kuota reservasi proyek ini dilepas menjadi stok tersedia. Stok fisik, realisasi Material dan kas tetap.",
    saved: "Reservasi proyek berhasil dilepas.",
  },
  WASTE: {
    title: "Material terbuang",
    action: "Catat material terbuang",
    effect:
      "Stok fisik berkurang dan reservasi proyek ini dikurangi lebih dahulu. Realisasi Material mengikuti sumber biaya; alasan waste masuk audit. Kas tetap.",
    saved: "Material terbuang tercatat beserta alasan audit.",
  },
  RETURN: {
    title: "Pengembalian stok",
    action: "Catat pengembalian",
    effect:
      "Material yang belum terpakai masuk kembali ke gudang. Realisasi Material dapat berkurang; kuota reservasi tidak otomatis ditambah. Kas tetap.",
    saved: "Pengembalian material proyek tercatat.",
  },
};
function money(amount: number): React.JSX.Element {
  return <MoneyValue amount={amount} variant="fullDynamic" size="sm" align="right" />;
}
function quantity(value: number): string {
  return value.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}
const metricNames: Record<keyof ProjectStockState, string> = {
  current: "Stok fisik",
  available: "Stok tersedia",
  reserved: "Total reservasi",
  ownReserved: "Reservasi terkait",
  netUsed: "Pemakaian bersih terkait",
};
const allMetrics: readonly (keyof ProjectStockState)[] = [
  "current",
  "available",
  "reserved",
  "ownReserved",
  "netUsed",
];
export function ProjectStockProposalCard({
  proposal: initial,
  conversationId,
  toolCallId,
  isStreaming,
  isBusy,
  alreadyConfirmed,
  onFollowUp,
}: {
  readonly proposal: ProjectStockProposal;
  readonly conversationId: string | null;
  readonly toolCallId: string;
  readonly isStreaming: boolean;
  readonly isBusy: boolean;
  readonly alreadyConfirmed: boolean;
  readonly onFollowUp: (text: string) => void;
}): React.JSX.Element {
  const can = useCan(),
    desktop = useWorkspacePresentation() === "desktop";
  const [view, setView] = React.useState<ProjectStockView | null>(null),
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
    label = labels[proposal.action],
    budget = can("view:budget") ? proposal.budget : null;
  const flow = proposalReviewFlow(proposal),
    inline = flow.review === "inline";
  const confirmed = alreadyConfirmed || status === "submitted" || view?.status === "CONFIRMED",
    pending = isBusy || status === "submitting",
    stale = view?.status === "STALE" || view?.status === "EXPIRED";
  const ready =
    view?.status === "READY" &&
    !confirmed &&
    !isStreaming &&
    !error &&
    can("use:ai_chat") &&
    can("view:material") &&
    can(projectStockPermission(proposal.action));
  const start = Math.min(page * 5, Math.max(0, Math.floor((proposal.rows.length - 1) / 5) * 5)),
    rows = proposal.rows.slice(start, start + 5);
  const refresh = React.useCallback((): Promise<void> => {
    if (!conversationId || isStreaming || inFlight.current) return Promise.resolve();
    const id = ++epoch.current;
    return getAiProjectStockProposal({ conversationId, toolCallId })
      .then((result) => {
        if (id !== epoch.current) return;
        if (result.success) {
          setView(result.data);
          setError("");
        } else setError(result.error.message);
      })
      .catch(() => {
        if (id === epoch.current) setError("Usulan belum dapat diperiksa. Coba periksa kembali.");
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
    setStatus("submitting");
    setError("");
    try {
      const result = await confirmAiProjectStockProposal({ conversationId, toolCallId });
      if (result.success) {
        setStatus("submitted");
        setDecision(false);
      } else {
        setError(result.error.message);
        setStatus("failed");
        setDecision(false);
      }
    } catch {
      setError("Hasil penyimpanan belum dapat diperiksa. Periksa lagi sebelum mencoba ulang.");
      setStatus("failed");
      setDecision(false);
    } finally {
      inFlight.current = false;
    }
  }
  const summary = (
    <GroupedSurface>
      <div className="divide-y divide-outline-variant/20">
        <div className="flex items-start gap-2 px-4 py-3 text-support">
          <AppIcon
            name={budget?.overAllocation ? "warning" : "inventory_2"}
            className="icon-sm shrink-0"
          />
          <span>
            {budget?.overAllocation
              ? "Periksa realisasi terhadap alokasi Material"
              : "Stok untuk proyek"}
          </span>
        </div>
        <FactRow label="Material ditinjau" value={proposal.rows.length} />
        {budget && (
          <>
            <FactRow wrapLabel label="Alokasi Material" value={money(budget.allocated)} />
            <FactRow
              wrapLabel
              label="Realisasi setelah tindakan"
              value={money(budget.actualAfter)}
            />
            {budget.costDelta !== 0 && (
              <FactRow
                wrapLabel
                label={
                  budget.costDelta > 0
                    ? "Tambahan realisasi nonkas"
                    : "Pengurangan realisasi nonkas"
                }
                value={money(Math.abs(budget.costDelta))}
              />
            )}
            {budget.overAllocation > 0 && (
              <FactRow
                wrapLabel
                label="Melebihi alokasi termasuk pending"
                value={money(budget.overAllocation)}
              />
            )}
          </>
        )}
      </div>
    </GroupedSurface>
  );
  const footer = (
    <div className="space-y-3">
      {confirmed ? (
        <ButtonLink href="/materials" fullWidth>
          Buka stok material
        </ButtonLink>
      ) : (
        <SheetFooterActions
          layout="adaptive"
          desktopStacked={!inline}
          primaryFirst={!inline}
          primary={{
            label: label.action,
            pending: pending,
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
                `Periksa kembali stok dan budget ${proposal.projectName}, lalu ${stale ? "buat ulang" : "bantu koreksi"} usulan ${label.title}. Tanyakan jumlah, lokasi dan sumber yang ingin saya ubah sebelum menyiapkan preview baru.`,
              );
            },
          }}
        />
      )}
      {!error && (
        <p role="status" className="text-meta text-on-surface-variant">
          {confirmed
            ? `${label.saved} Kas tetap.`
            : stale
              ? "Stok, sumber atau budget berubah. Minta preview terbaru."
              : label.effect}
        </p>
      )}
    </div>
  );
  const metrics: readonly (keyof ProjectStockState)[] =
    proposal.action === "RETURN"
      ? ["current", "available", "netUsed"]
      : ["current", "available", "ownReserved"];
  return (
    <>
      <ProposalCardShell
        title={label.title}
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
              {confirmed ? "Lihat rincian" : "Buka review"}
              <AppIcon name="arrow_forward" className="icon-sm" />
            </Button>
          )
        }
      >
        <div className="space-y-2 px-4 py-3">
          <p className="text-row font-semibold">{proposal.projectName}</p>
          <p className="text-support text-on-surface-variant">
            {proposal.rows.length} material · {label.title}
          </p>
          <p className="text-support text-on-surface-variant">
            {inline
              ? proposal.action === "RESERVE" || proposal.action === "RELEASE_RESERVATION"
                ? "Kuota proyek diperbarui; stok fisik dan kas tetap."
                : "Stok fisik dan realisasi Material ditinjau; kas tetap."
              : label.effect}
          </p>
        </div>
        {inline && (
          <ProposalInlineReview
            comparisons={metrics.map((key) => ({
              label: metricNames[key],
              before: proposal.rows[0].before[key],
              after: proposal.rows[0].after[key],
            }))}
            facts={[
              ...(proposal.action === "RESERVE" || proposal.action === "RELEASE_RESERVATION"
                ? []
                : [{ label: "Biaya / satuan", value: proposal.rows[0].unitCost, money: true }]),
              ...(budget
                ? [
                    { label: "Perubahan realisasi Material", value: budget.costDelta, money: true },
                    { label: "Sisa setelah tindakan", value: budget.remainingAfter, money: true },
                  ]
                : []),
            ]}
            details={
              <div className="divide-y divide-outline-variant/20">
                {allMetrics.map((key) => (
                  <FactRow
                    key={key}
                    label={metricNames[key]}
                    wrapLabel
                    value={`${quantity(proposal.rows[0].before[key])} → ${quantity(proposal.rows[0].after[key])}`}
                  />
                ))}
              </div>
            }
          >
            {error && (
              <ProposalReviewFeedback
                embedded
                message={error}
                recovery={
                  !stale && !confirmed
                    ? { label: "Periksa lagi", disabled: pending, onClick: () => void refresh() }
                    : undefined
                }
              />
            )}
            <div className="space-y-1">
              <p className="text-row font-semibold">{proposal.rows[0].materialName}</p>
              <p className="text-support text-on-surface-variant">
                {proposal.rows[0].locationName} · {quantity(proposal.rows[0].quantity)}{" "}
                {proposal.rows[0].unit}
              </p>
              <p className="text-support text-on-surface-variant">{proposal.rows[0].sourceLabel}</p>
              <p className="text-support wrap-anywhere whitespace-pre-wrap">
                {proposal.rows[0].note}
              </p>
              {proposal.rows[0].costOverride && (
                <p className="text-meta text-on-surface-variant">Harga koreksi dari pengguna.</p>
              )}
            </div>
            {budget && budget.overAllocation > 0 && (
              <p
                role="note"
                className="flex flex-wrap items-center gap-2 text-support text-critical"
              >
                <AppIcon name="warning" className="icon-sm" />
                Realisasi melebihi alokasi Material sebesar {money(budget.overAllocation)}.
              </p>
            )}
          </ProposalInlineReview>
        )}
      </ProposalCardShell>
      <FormSheet
        open={open}
        title={
          proposal.action === "RELEASE_RESERVATION"
            ? "Lepas reservasi"
            : proposal.action === "WASTE"
              ? "Material terbuang"
              : `Review ${label.title.toLocaleLowerCase("id-ID")}`
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
            <p className="text-section-title font-semibold">{proposal.projectName}</p>
            <p className="text-support text-on-surface-variant">
              {label.title} · {proposal.rows.length} material
            </p>
          </div>
          {error && (
            <ProposalReviewFeedback
              message={error}
              recovery={
                !stale && !confirmed
                  ? { label: "Periksa lagi", disabled: pending, onClick: () => void refresh() }
                  : undefined
              }
            />
          )}
          {!desktop && summary}
          <ReviewCollection ariaLabel="Perubahan stok yang ditinjau">
            {rows.map((row) => (
              <ReviewItem
                key={row.id}
                title={row.materialName}
                meta={`${row.locationName} · ${row.unit}`}
                primaryValue={
                  <span className="text-support font-semibold tabular-nums">
                    {quantity(row.quantity)} {row.unit}
                  </span>
                }
                summary={row.sourceLabel}
                expanded={expanded === row.id}
                onToggle={() => setExpanded((current) => (current === row.id ? null : row.id))}
                editor={
                  <div className="divide-y divide-outline-variant/20">
                    <FactRow label="Harga satuan stok" value={money(row.unitCost)} />
                    <FactRow
                      label="Sumber harga"
                      wrapLabel
                      value={
                        row.costOverride ? "Nilai override yang ditinjau" : "Biaya rata-rata lokasi"
                      }
                    />
                    {(
                      [
                        "current",
                        "reserved",
                        "available",
                        "ownReserved",
                        "netUsed",
                      ] satisfies readonly (keyof ProjectStockState)[]
                    ).map((metric) => (
                      <ProposalDiffRow
                        key={metric}
                        label={`${metricNames[metric]} · ${row.unit}`}
                        before={quantity(row.before[metric])}
                        after={quantity(row.after[metric])}
                        inset={false}
                        strikeBefore={false}
                        layout="inline"
                      />
                    ))}
                  </div>
                }
              >
                <div className="divide-y divide-outline-variant/20">
                  {metrics
                    .filter((metric) => row.before[metric] !== row.after[metric])
                    .map((metric) => (
                      <ProposalDiffRow
                        key={metric}
                        inset={false}
                        label={metricNames[metric]}
                        before={quantity(row.before[metric])}
                        after={quantity(row.after[metric])}
                        layout="inline"
                        strikeBefore={false}
                      />
                    ))}
                </div>
                <p className="mt-3 text-support wrap-anywhere whitespace-pre-wrap text-on-surface-variant">
                  {row.note}
                </p>
              </ReviewItem>
            ))}
          </ReviewCollection>
          {proposal.rows.length > 5 && (
            <nav
              aria-label="Halaman stok proyek"
              className="flex items-center justify-between gap-2"
            >
              <Button
                variant="secondary"
                size="compact"
                disabled={start === 0 || pending}
                onClick={() => setPage(Math.max(0, page - 1))}
              >
                Sebelumnya
              </Button>
              <span className="text-meta tabular-nums">
                {start + 1}–{Math.min(start + 5, proposal.rows.length)} / {proposal.rows.length}
              </span>
              <Button
                variant="secondary"
                size="compact"
                disabled={start + 5 >= proposal.rows.length || pending}
                onClick={() => setPage(page + 1)}
              >
                Berikutnya
              </Button>
            </nav>
          )}
          {budget && (
            <GroupedSurface>
              <div className="px-4">
                <FormDisclosure
                  variant="plain"
                  title="Rincian budget Material"
                  expanded={budgetOpen}
                  onToggle={() => setBudgetOpen((value) => !value)}
                >
                  <div className="divide-y divide-outline-variant/20">
                    <FactRow inset={false} label="Rencana RAP" value={money(budget.rapTotal)} />
                    <FactRow
                      inset={false}
                      label="Realisasi sebelumnya"
                      value={money(budget.actualBefore)}
                    />
                    <FactRow inset={false} label="Menunggu review" value={money(budget.pending)} />
                    <FactRow
                      inset={false}
                      label="Sisa setelah tindakan"
                      value={money(budget.remainingAfter)}
                    />
                  </div>
                  <p className="mt-3 text-meta text-on-surface-variant">
                    Realisasi stok bersifat nonkas; alokasi budget dan saldo kas tetap.
                  </p>
                </FormDisclosure>
              </div>
            </GroupedSurface>
          )}
        </div>
      </FormSheet>
      <ConfirmationDialog
        actionLayout="adaptive"
        open={decision && (inline || open)}
        title={`${label.action}?`}
        description={label.effect}
        confirmLabel={label.action}
        pending={pending}
        onClose={() => {
          if (!inFlight.current) setDecision(false);
        }}
        onConfirm={() => void save()}
      >
        <div className="space-y-3">
          <FactRow label="Proyek" wrapLabel value={proposal.projectName} />
          <FactRow label="Material" value={proposal.rows.length} />
          {budget && budget.costDelta !== 0 && (
            <FactRow
              wrapLabel
              label={
                budget.costDelta > 0 ? "Tambahan realisasi nonkas" : "Pengurangan realisasi nonkas"
              }
              value={money(Math.abs(budget.costDelta))}
            />
          )}{" "}
          {budget && budget.overAllocation > 0 && (
            <p className="flex items-start gap-2 text-support text-critical">
              <AppIcon name="warning" className="icon-sm shrink-0" />
              Realisasi termasuk pending melebihi alokasi Material sebesar{" "}
              {money(budget.overAllocation)}.
            </p>
          )}
          <p className="text-support text-on-surface-variant">
            Seluruh {proposal.rows.length} baris yang ditinjau akan dicatat bersama.
          </p>
        </div>
      </ConfirmationDialog>
    </>
  );
}
