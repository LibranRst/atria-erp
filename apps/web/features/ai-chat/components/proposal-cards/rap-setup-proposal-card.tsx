"use client";
import { proposalReviewFlow } from "../../utils/proposal-review-flow";
import { ProposalInlineReview } from "./proposal-inline-review";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { ProposalReviewFeedback } from "./proposal-review-feedback";
import * as React from "react";
import {
  getAiRapSetupProposal,
  confirmAiRapSetupProposal,
} from "@/app/actions/ai/rap-finalization";
import {
  AppIcon,
  Button,
  ConfirmationDialog,
  ReviewCollection,
  ReviewItem,
  FactRow,
  FormDisclosure,
  FormSheet,
  GroupedSurface,
  MoneyValue,
} from "@/components/ui";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import {
  setupReadiness,
  type SetupProposal,
  type SetupView,
} from "@atria/core/ai/rap-finalization";
import { setupReviewRows, type SetupReviewRow } from "../../utils/rap-setup-review";
import { ProposalCardShell, ProposalDiffRow } from "./proposal-card-shell";
const qty = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
export function RapSetupProposalCard({
  proposal: initialProposal,
  conversationId,
  toolCallId,
  isStreaming,
  isBusy,
  alreadyConfirmed,
  onFollowUp,
}: {
  readonly proposal: SetupProposal;
  readonly conversationId: string | null;
  readonly toolCallId: string;
  readonly isStreaming: boolean;
  readonly isBusy: boolean;
  readonly alreadyConfirmed: boolean;
  readonly onFollowUp: (text: string) => void;
}): React.JSX.Element {
  const [view, setView] = React.useState<SetupView | null>(null),
    [open, setOpen] = React.useState(false),
    [lockConfirm, setLockConfirm] = React.useState(false),
    [details, setDetails] = React.useState(false),
    [expanded, setExpanded] = React.useState<number | null>(null),
    [anchor, setAnchor] = React.useState(0),
    [status, setStatus] = React.useState<"idle" | "submitting" | "submitted" | "failed">("idle"),
    [error, setError] = React.useState("");
  const epoch = React.useRef(0),
    pending = React.useRef(false);
  const proposal = view?.proposal ?? initialProposal,
    confirmed = alreadyConfirmed || view?.status === "CONFIRMED" || status === "submitted",
    ready = view?.status === "READY" && !confirmed && !isStreaming && !error,
    stale = view?.status === "STALE" || view?.status === "EXPIRED",
    finalize = proposal.steps.some((s) => s.step.action === "FINALIZE");
  const flow = proposalReviewFlow(proposal),
    inline = flow.review === "inline";
  const desktop = useWorkspacePresentation() === "desktop",
    pageSize = 5,
    start = Math.floor(anchor / pageSize) * pageSize;
  const reviewRows = setupReviewRows(proposal.steps);
  const rows = reviewRows.slice(start, start + pageSize),
    readiness = setupReadiness(proposal.after);
  const decisions = proposal.steps.filter((item) => item.step.action !== "ADVANCE").length;
  const decisionSummary = decisions ? `${decisions} keputusan` : "Kesiapan RAP";
  const outcome = confirmed
    ? finalize
      ? "RAP telah difinalisasi dan dikunci."
      : "Kesiapan RAP telah diperbarui."
    : finalize
      ? "RAP akan difinalisasi dan dikunci."
      : "Kesiapan RAP akan diperbarui.";
  const budget = proposal.budget,
    risk =
      budget.planTotal > budget.internalCap || budget.categories.some((c) => c.overAllocation > 0);
  const overCategories = budget.categories
    .filter((category) => category.overAllocation > 0)
    .map((category) => category.name);
  const budgetVerdict = risk
    ? `${overCategories.length ? `Melebihi alokasi ${overCategories.join(" dan ")}` : "Rencana melebihi plafon internal"}${overCategories.length && budget.planTotal > budget.internalCap ? " serta plafon internal" : ""}`
    : "Rencana dalam alokasi budget";
  const refresh = React.useCallback((): Promise<void> => {
    const request = ++epoch.current;
    if (!conversationId || isStreaming) return Promise.resolve();
    return getAiRapSetupProposal({ conversationId, toolCallId })
      .then((response) => {
        if (request !== epoch.current) return;
        if (response.success) {
          setView(response.data);
          setError("");
        } else setError(response.error.message);
      })
      .catch(() => {
        if (request === epoch.current)
          setError("Preview RAP belum dapat diperiksa. Buka kembali atau minta usulan terbaru.");
      });
  }, [conversationId, toolCallId, isStreaming]);
  React.useEffect(() => {
    void refresh();
    return () => {
      epoch.current += 1;
    };
  }, [refresh]);
  async function confirm(): Promise<void> {
    if (!conversationId || !ready || pending.current) return;
    pending.current = true;
    setStatus("submitting");
    setError("");
    try {
      const response = await confirmAiRapSetupProposal({ conversationId, toolCallId });
      if (response.success) {
        setStatus("submitted");
        setView((current) => (current ? { ...current, status: "CONFIRMED" } : current));
      } else {
        setStatus("failed");
        setError(response.error.message);
        if (response.error.code === "CONFLICT")
          setView((current) => (current ? { ...current, status: "STALE" } : current));
        if (response.error.code === "FORBIDDEN") setView(null);
      }
    } catch {
      setStatus("failed");
      setError("Langkah RAP belum dapat disimpan. Coba lagi dengan usulan yang sama.");
    } finally {
      pending.current = false;
      setLockConfirm(false);
    }
  }
  const budgetDetails = (
    <div className="px-4">
      <FormDisclosure
        title="Kategori & realisasi"
        variant="plain"
        expanded={details}
        onToggle={() => setDetails((value) => !value)}
      >
        <div className="divide-y divide-outline-variant/20">
          {[
            { label: "Terpakai", value: budget.actual },
            { label: "Menunggu review", value: budget.pending },
            { label: "Sisa budget", value: budget.remaining },
            { label: "Margin dari realisasi", value: budget.marginAmount },
          ].map((item) => (
            <FactRow
              key={item.label}
              wrapLabel
              inset={false}
              label={item.label}
              value={
                <MoneyValue amount={item.value} variant="fullDynamic" size="sm" align="right" />
              }
            />
          ))}
          {budget.categories.map((category) => (
            <div key={category.id} className="space-y-2 py-3">
              <p className="text-row font-semibold">{category.name}</p>
              {[
                { label: "Alokasi", value: category.allocated },
                { label: "Terpakai", value: category.actual },
                { label: "Menunggu review", value: category.pending },
                { label: "Sisa", value: category.remaining },
                ...(category.planned === null
                  ? []
                  : [{ label: "Rencana RAP", value: category.planned }]),
              ].map((item) => (
                <FactRow
                  key={item.label}
                  wrapLabel
                  inset={false}
                  label={item.label}
                  value={
                    <MoneyValue amount={item.value} variant="fullDynamic" size="sm" align="right" />
                  }
                />
              ))}
              {category.overAllocation > 0 && (
                <p className="flex flex-wrap items-center gap-2 text-support text-critical">
                  Melebihi alokasi{" "}
                  <MoneyValue amount={category.overAllocation} variant="fullDynamic" size="sm" />
                </p>
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-meta text-on-surface-variant">
          Rencana RAP mencakup Material, Tukang dan Subcon. Realisasi seluruh kategori tetap
          terpisah.
        </p>
      </FormDisclosure>
    </div>
  );
  const summary = (
    <section aria-label="Ringkasan budget finalisasi RAP">
      <GroupedSurface>
        <div className="divide-y divide-outline-variant/20">
          <div className="space-y-2 px-4 py-3">
            <h3 className="text-row font-semibold">Budget proyek</h3>
            <p
              className={`flex items-start gap-2 text-support ${risk ? "text-critical" : "text-on-surface-variant"}`}
            >
              <AppIcon name={risk ? "warning" : "check_circle"} className="icon-sm shrink-0" />
              {budgetVerdict}
            </p>
          </div>
          {[
            { label: "Nilai proyek", value: budget.projectValue },
            { label: "Plafon internal", value: budget.internalCap },
            { label: "Rencana RAP", value: budget.planTotal },
          ].map((item) => (
            <FactRow
              key={item.label}
              wrapLabel
              label={item.label}
              value={
                <MoneyValue amount={item.value} variant="fullDynamic" size="sm" align="right" />
              }
            />
          ))}
          {!desktop && budgetDetails}
        </div>
      </GroupedSurface>
    </section>
  );
  const actions = (
    <div className="space-y-2">
      <p className="text-support font-medium">
        {confirmed
          ? finalize
            ? "RAP telah dikunci"
            : "Keputusan RAP tersimpan"
          : `${decisionSummary} disimpan bersama`}
      </p>

      {!confirmed && (
        <>
          <Button
            className="w-full"
            disabled={!ready || status === "submitting"}
            onClick={() => (finalize ? setLockConfirm(true) : void confirm())}
          >
            {status === "submitting"
              ? "Menyimpan…"
              : finalize
                ? "Finalisasi RAP"
                : inline
                  ? proposal.request.steps[0].action === "READY_PACKAGES"
                    ? "Tandai paket siap"
                    : "Simpan keputusan RAP"
                  : "Simpan keputusan RAP"}
          </Button>
          <Button
            className="w-full"
            variant="tertiary"
            disabled={isBusy || isStreaming || status === "submitting"}
            onClick={() => {
              setOpen(false);
              onFollowUp(
                `Periksa kembali kesiapan RAP ${proposal.projectName}, lalu ${stale ? "buat ulang" : "bantu koreksi"} usulan keputusan terakhir. Pertahankan keputusan yang masih saya inginkan dan tanyakan keputusan paket atau scope yang belum jelas.`,
              );
            }}
          >
            {stale ? "Minta usulan terbaru" : "Koreksi melalui chat"}
          </Button>
        </>
      )}
      <p role="status" className="text-meta text-on-surface-variant">
        {stale
          ? "RAP, paket atau budget berubah. Minta preview terbaru."
          : finalize
            ? "RAP terkunci setelah konfirmasi; perubahan berikutnya melalui revisi. Stok dan kas tetap."
            : "Keputusan kesiapan dan scope yang ditinjau disimpan. Stok dan kas tetap."}
      </p>
    </div>
  );
  type Row = SetupReviewRow;
  function rowContent(row: Row): React.ReactNode {
    return (
      <div className="space-y-2">
        <p className="text-support wrap-anywhere text-on-surface-variant">{row.detail}</p>
        {row.packageIds.length > 0 && (
          <FormDisclosure
            variant="plain"
            title={`${row.packageIds.length} paket yang ditinjau`}
            expanded={expanded === row.index}
            onToggle={() => setExpanded((value) => (value === row.index ? null : row.index))}
          >
            <div className="divide-y divide-outline-variant/20">
              {row.packageIds.map((id) => {
                const pkg = proposal.before.packages.find((p) => p.id === id);
                return pkg ? (
                  <div key={id} className="space-y-2 py-3">
                    <p className="text-row font-semibold wrap-anywhere">{pkg.snapshot.name}</p>
                    <p className="text-meta text-on-surface-variant">
                      {pkg.category === "TUKANG" ? "Tukang" : "Subcon"} · {pkg.snapshot.area} ·
                      Draft → Siap
                    </p>
                    {pkg.snapshot.scopeDescription && (
                      <p className="text-support wrap-anywhere whitespace-pre-wrap">
                        {pkg.snapshot.scopeDescription}
                      </p>
                    )}
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-support tabular-nums">
                        {qty.format(pkg.snapshot.quantity)} {pkg.snapshot.unit}
                      </span>
                      <MoneyValue
                        amount={pkg.snapshot.estimatedTotalCost}
                        variant="fullDynamic"
                        size="sm"
                        align="right"
                      />
                    </div>
                    <p className="text-meta text-on-surface-variant">
                      {pkg.snapshot.vendorName ?? "Tanpa vendor"}
                    </p>
                  </div>
                ) : null;
              })}
            </div>
          </FormDisclosure>
        )}
      </div>
    );
  }
  return (
    <>
      <ProposalCardShell
        title={finalize ? "Finalisasi RAP" : "Kesiapan RAP"}
        status={status}
        statusLabel={
          confirmed
            ? finalize
              ? "Terkunci"
              : "Tersimpan"
            : stale
              ? "Perlu diperbarui"
              : view
                ? "Usulan"
                : "Memeriksa"
        }
        isAlreadyConfirmed={confirmed}
        showConfirmAction={false}
        onConfirm={confirm}
        footer={
          inline ? (
            actions
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-meta text-on-surface-variant">{decisionSummary}</span>
              <Button
                variant="secondary"
                size="compact"
                onClick={() => {
                  setOpen(true);
                  setView(null);
                  void refresh();
                }}
              >
                {confirmed ? "Lihat rincian" : "Buka review"}
                <AppIcon name="arrow_forward" className="icon-sm" />
              </Button>
            </div>
          )
        }
      >
        <div className="space-y-2 px-4 py-3">
          <p className="text-row font-semibold">{proposal.projectName}</p>
          <p className="text-support text-on-surface-variant">{outcome}</p>
          <div className="flex items-center justify-between gap-3">
            <span className="text-support text-on-surface-variant">Rencana RAP</span>
            <MoneyValue amount={budget.planTotal} variant="fullDynamic" size="sm" align="right" />
          </div>
          {risk && (
            <p className="flex items-start gap-2 text-support text-critical">
              <AppIcon name="warning" className="icon-sm shrink-0" />
              Ada rencana yang melebihi alokasi atau plafon.
            </p>
          )}
          {error && (
            <ProposalReviewFeedback
              embedded={inline}
              message={error}
              recovery={
                inline && !stale && !confirmed
                  ? {
                      label: "Periksa lagi",
                      disabled: isBusy || status === "submitting",
                      onClick: () => void refresh(),
                    }
                  : undefined
              }
            />
          )}
        </div>
        {inline && (
          <ProposalInlineReview
            comparisons={[
              ...(proposal.before.stage !== proposal.after.stage
                ? [
                    {
                      label: "Tahap RAP",
                      before: formatBusinessLabel(proposal.before.stage),
                      after: formatBusinessLabel(proposal.after.stage),
                    },
                  ]
                : []),
              ...(proposal.before.status !== proposal.after.status
                ? [
                    {
                      label: "Status RAP",
                      before: formatBusinessLabel(proposal.before.status),
                      after: formatBusinessLabel(proposal.after.status),
                    },
                  ]
                : []),
            ]}
            facts={[
              { label: "Keputusan", value: proposal.steps[0].label },
              { label: "Dampak", value: proposal.steps[0].detail },
              ...(finalize
                ? [
                    { label: "Plafon internal", value: budget.internalCap, money: true },
                    { label: "Realisasi tetap", value: budget.actual, money: true },
                  ]
                : []),
            ]}
            disclosure={budgetDetails}
          >
            {proposal.request.steps[0].action === "READY_PACKAGES" &&
              proposal.request.steps[0].itemIds.map((id) => {
                const before = proposal.before.packages.find((p) => p.id === id),
                  after = proposal.after.packages.find((p) => p.id === id);
                return before && after ? (
                  <div key={id}>
                    <p className="text-row font-semibold">{before.snapshot.name}</p>
                    <ProposalDiffRow
                      label="Status paket"
                      before={formatBusinessLabel(before.status)}
                      after={formatBusinessLabel(after.status)}
                      layout="inline"
                      inset={false}
                      strikeBefore={false}
                    />
                  </div>
                ) : null;
              })}
          </ProposalInlineReview>
        )}
      </ProposalCardShell>
      <FormSheet
        open={open}
        title="Review RAP"
        desktopSize="wide"
        desktopFooterPlacement="aside"
        desktopAsideSummary={summary}
        sizing="content"
        pending={status === "submitting"}
        dismissal={{ mode: "preserve" }}
        onClose={() => setOpen(false)}
        footer={actions}
      >
        <div className="space-y-5">
          <div className="space-y-1">
            <h3 className="text-section font-bold wrap-anywhere">{proposal.projectName}</h3>
            <p className="text-support text-on-surface-variant">{outcome}</p>
          </div>
          {error && <ProposalReviewFeedback message={error} />}
          <div className={desktop ? "hidden" : ""}>{summary}</div>
          <section aria-label="Kesiapan setelah konfirmasi">
            <h3 className="mb-2 text-row font-semibold">Kesiapan setelah konfirmasi</h3>
            <GroupedSurface>
              <div className="divide-y divide-outline-variant/20">
                {[
                  {
                    label: "Material",
                    ready: readiness.material,
                    detail: `${proposal.after.materialCount} baris`,
                  },
                  {
                    label: "Tukang",
                    ready: readiness.tukang,
                    detail: proposal.after.tukangSkipped ? "Tidak digunakan" : "Paket ditinjau",
                  },
                  {
                    label: "Subcon",
                    ready: readiness.subcon,
                    detail: proposal.after.subconSkipped ? "Tidak digunakan" : "Paket ditinjau",
                  },
                ].map((item) => (
                  <FactRow
                    key={item.label}
                    label={item.label}
                    value={
                      <span className="flex items-center gap-2 text-support">
                        <AppIcon
                          name={item.ready ? "check_circle" : "warning"}
                          className="icon-sm"
                        />
                        {item.ready ? item.detail : "Belum lengkap"}
                      </span>
                    }
                  />
                ))}
              </div>
            </GroupedSurface>
          </section>
          <section className="space-y-2" aria-label="Yang akan disimpan">
            <div className="flex items-baseline justify-between gap-3 px-1">
              <h3 className="text-row font-semibold">Yang akan disimpan</h3>
              <span className="text-support text-on-surface-variant">{decisionSummary}</span>
            </div>
            <GroupedSurface>
              {desktop ? (
                <ReviewCollection embedded ariaLabel="Keputusan kesiapan dan finalisasi RAP">
                  {rows.map((row) => (
                    <ReviewItem key={row.index} title={row.label}>
                      {rowContent(row)}
                    </ReviewItem>
                  ))}
                </ReviewCollection>
              ) : (
                <div className="divide-y divide-outline-variant/20">
                  {rows.map((row) => (
                    <section
                      data-review-item="true"
                      key={row.index}
                      className="space-y-2 px-4 py-3"
                    >
                      <h4 className="text-row font-semibold wrap-anywhere">{row.label}</h4>
                      {rowContent(row)}
                    </section>
                  ))}
                </div>
              )}
            </GroupedSurface>
            {reviewRows.length > pageSize && (
              <nav
                aria-label="Halaman keputusan RAP"
                className="flex items-center justify-between gap-2"
              >
                <Button
                  variant="tertiary"
                  size="compact"
                  disabled={start === 0}
                  onClick={() => setAnchor(Math.max(0, start - pageSize))}
                >
                  Sebelumnya
                </Button>
                <span className="text-meta tabular-nums">
                  {start + 1}–{Math.min(start + pageSize, reviewRows.length)} / {reviewRows.length}
                </span>
                <Button
                  variant="tertiary"
                  size="compact"
                  disabled={start + pageSize >= reviewRows.length}
                  onClick={() => setAnchor(start + pageSize)}
                >
                  Berikutnya
                </Button>
              </nav>
            )}
          </section>
          {desktop && <GroupedSurface>{budgetDetails}</GroupedSurface>}
        </div>
      </FormSheet>
      <ConfirmationDialog
        actionLayout="adaptive"
        open={lockConfirm}
        title="Finalisasi dan kunci RAP?"
        description={`${decisionSummary} yang ditinjau akan disimpan bersama. ${risk ? "Rencana melebihi alokasi atau plafon telah ditampilkan pada review. " : ""}RAP terkunci dan perubahan berikutnya melalui revisi. Tidak ada pergerakan stok atau kas.`}
        confirmLabel="Konfirmasi & kunci RAP"
        pending={status === "submitting"}
        disabled={!ready}
        onClose={() => {
          if (!pending.current) setLockConfirm(false);
        }}
        onConfirm={() => void confirm()}
      />
    </>
  );
}
