"use client";
import { proposalReviewFlow } from "../../utils/proposal-review-flow";
import { ProposalInlineReview } from "./proposal-inline-review";
import { ProposalReviewFeedback } from "./proposal-review-feedback";
import * as React from "react";
import {
  getAiRapLifecycleProposal,
  confirmAiRapLifecycleProposal,
} from "@/app/actions/ai/rap-lifecycle";
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
import type { LifecycleProposal, LifecycleView } from "@atria/core/ai/rap-lifecycle";
import { ProposalCardShell } from "./proposal-card-shell";
const labels = {
  ADD: "Tambah Material",
  REVISION: "Draft revisi baru",
  REOPEN: "Edit Lagi",
  DELETE: "Hapus paket Draft",
};
const statuses = {
  NEW: "Baru",
  DRAFT: "Draft",
  ACTIVE: "Siap",
  LOCKED: "Terkunci",
  DELETED: "Dihapus",
};
export function RapLifecycleProposalCard({
  proposal: initial,
  conversationId,
  toolCallId,
  isStreaming,
  isBusy,
  alreadyConfirmed,
  onFollowUp,
}: {
  readonly proposal: LifecycleProposal;
  readonly conversationId: string | null;
  readonly toolCallId: string;
  readonly isStreaming: boolean;
  readonly isBusy: boolean;
  readonly alreadyConfirmed: boolean;
  readonly onFollowUp: (text: string) => void;
}): React.JSX.Element {
  const [view, setView] = React.useState<LifecycleView | null>(null),
    [open, setOpen] = React.useState(false),
    [confirmDelete, setConfirmDelete] = React.useState(false),
    [details, setDetails] = React.useState(false),
    [expandedId, setExpandedId] = React.useState<string | null>(null),
    [anchor, setAnchor] = React.useState(0),
    [error, setError] = React.useState(""),
    [status, setStatus] = React.useState<"idle" | "submitting" | "submitted" | "failed">("idle");
  const epoch = React.useRef(0),
    pending = React.useRef(false);
  const proposal = view?.proposal ?? initial,
    confirmed = alreadyConfirmed || view?.status === "CONFIRMED" || status === "submitted",
    ready = view?.status === "READY" && !confirmed && !isStreaming && !error,
    stale = view?.status === "STALE" || view?.status === "EXPIRED",
    revision = proposal.request.action === "REVISION",
    adding = proposal.request.action === "ADD_MATERIAL",
    deleted = proposal.rows.filter((r) => r.action === "DELETE").length,
    reopened = proposal.rows.filter((r) => r.action === "REOPEN").length;
  const flow = proposalReviewFlow(proposal),
    inline = flow.review === "inline";
  const desktop = useWorkspacePresentation() === "desktop",
    pageSize = 5,
    start = Math.floor(anchor / pageSize) * pageSize,
    rows = proposal.rows.slice(start, start + pageSize),
    budget = proposal.budget;
  const refresh = React.useCallback((): Promise<void> => {
    const request = ++epoch.current;
    if (!conversationId || isStreaming) return Promise.resolve();
    return getAiRapLifecycleProposal({ conversationId, toolCallId })
      .then((response) => {
        if (request !== epoch.current) return;
        if (response.success) {
          setView(response.data);
          setError("");
        } else setError(response.error.message);
      })
      .catch(() => {
        if (request === epoch.current)
          setError("Preview belum dapat diperiksa. Buka kembali atau minta usulan terbaru.");
      });
  }, [conversationId, toolCallId, isStreaming]);
  React.useEffect(() => {
    const requests = epoch;
    void refresh();
    return () => {
      requests.current++;
    };
  }, [refresh]);
  async function confirm(): Promise<void> {
    if (!conversationId || !ready || isBusy || pending.current) return;
    pending.current = true;
    setStatus("submitting");
    setError("");
    try {
      const response = await confirmAiRapLifecycleProposal({ conversationId, toolCallId });
      if (!response.success) {
        setError(response.error.message);
        setStatus("failed");
        await refresh();
      } else {
        setStatus("submitted");
        setConfirmDelete(false);
        await refresh();
      }
    } catch {
      setStatus("failed");
      setError("Hasil belum dapat dipastikan. Buka kembali untuk memeriksa sebelum mencoba ulang.");
    } finally {
      pending.current = false;
    }
  }
  const money = (amount: number): React.ReactNode => (
    <MoneyValue amount={amount} variant="fullDynamic" size="sm" align="right" />
  );
  const risk =
    budget.planTotal > budget.internalCap || budget.categories.some((c) => c.overAllocation > 0);
  const budgetDetailsInMain = desktop;
  const budgetDetails = (
    <div className="px-4">
      <FormDisclosure
        variant="plain"
        title="Rincian budget"
        expanded={details}
        onToggle={() => setDetails(!details)}
      >
        <FactRow inset={false} wrapLabel label="Nilai proyek" value={money(budget.projectValue)} />
        {budget.categories.map((c) => (
          <div key={c.id} className="space-y-1 py-2">
            <p className="text-support font-semibold">{c.name}</p>
            <FactRow inset={false} wrapLabel label="Alokasi" value={money(c.allocated)} />
            {c.planned !== null && (
              <FactRow inset={false} wrapLabel label="Rencana" value={money(c.planned)} />
            )}
            <FactRow inset={false} wrapLabel label="Realisasi" value={money(c.actual)} />
            <FactRow inset={false} wrapLabel label="Menunggu review" value={money(c.pending)} />
            <FactRow inset={false} wrapLabel label="Sisa keuangan" value={money(c.remaining)} />
          </div>
        ))}
        <FactRow
          inset={false}
          wrapLabel
          label="Margin dari realisasi"
          value={money(budget.marginAmount)}
        />
      </FormDisclosure>
    </div>
  );
  const summary = (
    <GroupedSurface>
      <div className="divide-y divide-outline-variant/20">
        <div className="flex items-start gap-2 px-4 py-3 text-support">
          <AppIcon name={risk ? "warning" : "check_circle"} className="icon-sm" />
          <span>
            {risk ? "Periksa rencana terhadap alokasi budget" : "Rencana dalam alokasi budget"}
          </span>
        </div>
        <FactRow wrapLabel label="Rencana setelah tindakan" value={money(budget.planTotal)} />
        <FactRow wrapLabel label="Plafon internal" value={money(budget.internalCap)} />
        {!budgetDetailsInMain && budgetDetails}
      </div>
    </GroupedSurface>
  );
  const actions = (
    <div className="space-y-2">
      {!confirmed && (
        <>
          <Button
            className="w-full"
            disabled={!ready || isBusy || status === "submitting"}
            onClick={() => {
              if (deleted) setConfirmDelete(true);
              else void confirm();
            }}
          >
            {status === "submitting"
              ? "Menyimpan…"
              : revision
                ? "Buat draft revisi RAP"
                : adding
                  ? "Simpan material RAP"
                  : inline
                    ? deleted
                      ? "Hapus paket"
                      : "Buka kembali paket"
                    : "Simpan perubahan paket"}
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            disabled={isBusy || status === "submitting"}
            onClick={() => {
              setOpen(false);
              onFollowUp(
                `Periksa ${proposal.projectName} lalu ${stale ? "buat ulang" : "koreksi"} usulan ${revision ? "revisi RAP" : adding ? "penambahan Material RAP" : "perubahan paket"} terakhir. Tanyakan bagian yang belum jelas.`,
              );
            }}
          >
            {stale ? "Minta usulan terbaru" : "Koreksi melalui chat"}
          </Button>
        </>
      )}
      <p role="status" className="text-meta text-on-surface-variant">
        {confirmed
          ? revision
            ? "Draft revisi sudah dibuat. Tinjau perubahan dan finalisasi kembali setelah semua bagian siap."
            : adding
              ? "Material sudah ditambahkan ke rencana RAP."
              : reopened
                ? "Paket dibuka kembali sebagai Draft. Selesaikan koreksi lalu tandai Siap kembali."
                : "Paket Draft terpilih sudah dihapus."
          : stale
            ? "RAP, paket atau budget berubah. Minta preview terbaru."
            : revision
              ? "Baseline terkunci tetap utuh. Draft revisi perlu ditinjau dan difinalisasi kembali."
              : adding
                ? "Item ditambahkan sebagai rencana Material RAP."
                : "Paket yang dibuka kembali perlu ditandai Siap setelah koreksi."}{" "}
        Stok dan kas tetap.
      </p>
    </div>
  );
  type Row = LifecycleProposal["rows"][number];
  const identity = (row: Row): React.ReactNode => (
    <div className="space-y-1">
      <p className="text-row font-semibold wrap-anywhere">{row.name}</p>
      <p className="text-meta text-on-surface-variant">
        {row.category === "TUKANG" ? "Tukang" : row.category === "SUBCON" ? "Subcon" : "Material"} ·{" "}
        {labels[row.action]}
      </p>
    </div>
  );
  const outcome = (row: Row): React.ReactNode => (
    <div className="space-y-2">
      <p className="text-support">
        {statuses[row.beforeStatus]} → {statuses[row.afterStatus]}
        {row.action === "REVISION" ? ` · revisi ${row.revision}` : ""}
      </p>
      <p className="text-support wrap-anywhere text-on-surface-variant">{row.detail}</p>
      {!desktop && money(row.estimate)}
      {row.action === "ADD" && (
        <FormDisclosure
          variant="plain"
          title="Rincian isian"
          expanded={expandedId === row.id}
          onToggle={() => setExpandedId(expandedId === row.id ? null : row.id)}
        >
          {proposal.materialRows
            .filter((r) => r.rowId === row.id)
            .map((r) => (
              <div key={r.rowId} className="space-y-1">
                <FactRow
                  wrapLabel
                  label="Kebutuhan"
                  value={`${new Intl.NumberFormat("id-ID").format(r.values.requiredQuantity)} ${r.values.unit}`}
                />
                <FactRow
                  wrapLabel
                  label="Buffer"
                  value={`${new Intl.NumberFormat("id-ID").format(r.values.bufferQuantity)} ${r.values.unit}`}
                />
                <FactRow
                  wrapLabel
                  label="Harga per satuan"
                  value={money(r.values.estimatedUnitCost)}
                />
                <FactRow
                  wrapLabel
                  label="Sumber"
                  value={
                    {
                      STOCK: "Stok",
                      PURCHASE: "Pembelian",
                      STOCK_AND_PURCHASE: "Stok dan pembelian",
                      VENDOR: "Vendor",
                    }[r.values.source]
                  }
                />
                <FactRow
                  wrapLabel
                  label="Spesifikasi"
                  value={
                    <span className="text-support wrap-anywhere">
                      {r.values.description || "—"}
                    </span>
                  }
                />
                <FactRow
                  wrapLabel
                  label="Catatan internal"
                  value={
                    <span className="text-support wrap-anywhere">
                      {r.values.internalNote || "—"}
                    </span>
                  }
                />
              </div>
            ))}
        </FormDisclosure>
      )}
    </div>
  );
  return (
    <>
      <ProposalCardShell
        title={revision ? "Revisi RAP" : adding ? "Material RAP" : "Perubahan paket RAP"}
        status={status}
        statusLabel={
          confirmed ? "Tersimpan" : stale ? "Perlu diperbarui" : view ? "Usulan" : "Memeriksa"
        }
        isAlreadyConfirmed={confirmed}
        showConfirmAction={false}
        onConfirm={confirm}
        footer={
          inline ? (
            actions
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-meta text-on-surface-variant">
                {proposal.rows.length} bagian
              </span>
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
          <p className="text-support text-on-surface-variant">
            {revision
              ? confirmed
                ? "Draft revisi telah dibuat; baseline terkunci tetap utuh."
                : "Siapkan draft revisi untuk bagian yang dipilih."
              : adding
                ? `${proposal.rows.length} item Material ${confirmed ? "telah" : "akan"} ditambahkan.`
                : `${reopened} paket ${confirmed ? "dibuka kembali" : "Edit Lagi"} · ${deleted} paket ${confirmed ? "dihapus" : "akan dihapus"}`}
          </p>
          <div className="flex items-center justify-between gap-3">
            <span className="text-support">Rencana setelah tindakan</span>
            {money(budget.planTotal)}
          </div>
        </div>
        {inline && (
          <ProposalInlineReview
            comparisons={[
              {
                label: "Status paket",
                before: statuses[proposal.rows[0].beforeStatus],
                after: statuses[proposal.rows[0].afterStatus],
              },
            ]}
            facts={[
              { label: "Paket", value: proposal.rows[0].name },
              { label: "Lingkup", value: proposal.rows[0].detail },
              {
                label: deleted ? "Nilai paket dihapus" : "Biaya paket tetap",
                value: proposal.rows[0].estimate,
                money: true,
              },
            ]}
            disclosure={budgetDetails}
          >
            {error && <ProposalReviewFeedback message={error} />}
          </ProposalInlineReview>
        )}
      </ProposalCardShell>
      <FormSheet
        open={open}
        title={
          revision ? "Review revisi RAP" : adding ? "Review Material RAP" : "Review perubahan paket"
        }
        desktopSize="wide"
        desktopFooterPlacement="aside"
        desktopAsideSummary={summary}
        sizing="content"
        pending={status === "submitting"}
        footer={actions}
        dismissal={{ mode: "preserve" }}
        onClose={() => {
          if (!pending.current) setOpen(false);
        }}
      >
        <div className="space-y-5">
          <div>
            <p className="text-section-title font-semibold">{proposal.projectName}</p>
            <p className="text-support text-on-surface-variant">
              {revision
                ? "Draft baru dari baseline terkunci"
                : adding
                  ? "Penambahan rencana Material"
                  : "Koreksi kesiapan paket internal"}
            </p>
          </div>
          {error && <ProposalReviewFeedback message={error} />}
          {!desktop && summary}
          {proposal.request.action === "REVISION" && (
            <GroupedSurface className="space-y-1 px-4 py-3">
              <p className="text-support font-semibold">Alasan revisi</p>
              <p className="text-support wrap-anywhere whitespace-pre-wrap text-on-surface-variant">
                {proposal.request.reason}
              </p>
            </GroupedSurface>
          )}
          <section className="space-y-2" aria-label="Yang akan disimpan">
            <h3 className="px-1 text-row font-semibold">Yang akan disimpan</h3>
            <GroupedSurface>
              {desktop ? (
                <ReviewCollection embedded ariaLabel="Bagian RAP yang ditinjau">
                  {rows.map((row) => (
                    <ReviewItem
                      key={row.id}
                      title={identity(row)}
                      primaryValue={money(row.estimate)}
                    >
                      {outcome(row)}
                    </ReviewItem>
                  ))}
                </ReviewCollection>
              ) : (
                <div className="divide-y divide-outline-variant/20">
                  {rows.map((row) => (
                    <section data-review-item="true" key={row.id} className="space-y-3 px-4 py-3">
                      {identity(row)}
                      {outcome(row)}
                    </section>
                  ))}
                </div>
              )}
            </GroupedSurface>
          </section>
          {proposal.rows.length > pageSize && (
            <nav
              aria-label="Halaman tindakan RAP"
              className="flex items-center justify-between gap-3"
            >
              <Button
                variant="secondary"
                size="compact"
                disabled={start === 0}
                onClick={() => setAnchor(Math.max(0, start - pageSize))}
              >
                Sebelumnya
              </Button>
              <span className="text-meta">
                {start + 1}–{Math.min(start + pageSize, proposal.rows.length)} dari{" "}
                {proposal.rows.length}
              </span>
              <Button
                variant="secondary"
                size="compact"
                disabled={start + pageSize >= proposal.rows.length}
                onClick={() => setAnchor(start + pageSize)}
              >
                Berikutnya
              </Button>
            </nav>
          )}
          {budgetDetailsInMain && <GroupedSurface>{budgetDetails}</GroupedSurface>}
        </div>
      </FormSheet>
      <ConfirmationDialog
        actionLayout="adaptive"
        open={confirmDelete}
        title={`Hapus ${deleted} paket Draft?`}
        description="Paket yang ditinjau akan dihapus bersama perubahan lainnya. Material Master, stok, kas dan baseline terkunci tetap utuh."
        confirmLabel="Hapus dan simpan"
        tone="danger"
        pending={status === "submitting"}
        onClose={() => {
          if (!pending.current) setConfirmDelete(false);
        }}
        onConfirm={() => void confirm()}
      />
    </>
  );
}
