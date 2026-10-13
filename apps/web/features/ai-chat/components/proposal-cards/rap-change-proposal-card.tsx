"use client";
import { proposalReviewFlow } from "../../utils/proposal-review-flow";
import { ProposalInlineReview } from "./proposal-inline-review";
import { ProposalReviewFeedback } from "./proposal-review-feedback";
import * as React from "react";
import { getAiRapChangeProposal, confirmAiRapChangeProposal } from "@/app/actions/ai/rap-change";
import {
  AppIcon,
  Button,
  ConfirmationDialog,
  ReviewCollection,
  ReviewItem,
  FactRow,
  FormSheet,
  GroupedSurface,
  MoneyValue,
} from "@/components/ui";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import type { RapChangeProposal, RapChangeView, RapItemSnapshot } from "@atria/core/ai/rap-change";
import { ProposalCardShell, ProposalDiffRow } from "./proposal-card-shell";
const number = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const sourceLabels: Record<string, string> = {
  STOCK: "Stok",
  PURCHASE: "Pembelian",
  STOCK_AND_PURCHASE: "Stok dan pembelian",
  VENDOR: "Vendor",
};
const fields = [
  "materialId",
  "name",
  "unit",
  "description",
  "internalNote",
  "source",
  "area",
  "requiredQuantity",
  "bufferQuantity",
  "estimatedUnitCost",
] as const;
type Key = (typeof fields)[number];
const labels: Record<Key, string> = {
  area: "Area",
  materialId: "Referensi material",
  name: "Nama",
  unit: "Satuan",
  description: "Spesifikasi",
  internalNote: "Catatan internal",
  source: "Sumber material",
  requiredQuantity: "Kebutuhan",
  bufferQuantity: "Buffer",
  estimatedUnitCost: "Harga per satuan",
};
function value(item: RapItemSnapshot, key: Key): React.ReactNode {
  if (key === "materialId")
    return item.materialId ? `Material Master: ${item.name}` : "Tanpa Material Master";
  if (key === "area") return item.area;
  if (key === "source") return sourceLabels[item.source] ?? "Perlu diperiksa";
  if (key === "name" || key === "unit" || key === "description" || key === "internalNote")
    return item[key] || "—";
  if (key === "estimatedUnitCost")
    return <MoneyValue amount={item.estimatedUnitCost} variant="fullDynamic" size="sm" />;
  return `${number.format(item[key])} ${item.unit}`;
}
export function RapChangeProposalCard({
  proposal: initialProposal,
  conversationId,
  toolCallId,
  isStreaming,
  isBusy,
  alreadyConfirmed,
  onFollowUp,
}: {
  readonly proposal: RapChangeProposal;
  readonly conversationId: string | null;
  readonly toolCallId: string;
  readonly isStreaming: boolean;
  readonly isBusy: boolean;
  readonly alreadyConfirmed: boolean;
  readonly onFollowUp: (text: string) => void;
}): React.JSX.Element {
  const [view, setView] = React.useState<RapChangeView | null>(null);
  const [open, setOpen] = React.useState(false);
  const [removeConfirm, setRemoveConfirm] = React.useState(false);
  const [status, setStatus] = React.useState<"idle" | "submitting" | "submitted" | "failed">(
    "idle",
  );
  const [error, setError] = React.useState("");
  const [anchor, setAnchor] = React.useState(0);
  const epoch = React.useRef(0),
    pending = React.useRef(false);
  const proposal = view?.proposal ?? initialProposal;
  const flow = proposalReviewFlow(proposal),
    inline = flow.review === "inline";
  const confirmed = alreadyConfirmed || view?.status === "CONFIRMED" || status === "submitted";
  const ready = view?.status === "READY" && !isStreaming && !confirmed && !error;
  const stale = view?.status === "STALE" || view?.status === "EXPIRED";
  const deleted = proposal.rows.filter((row) => row.action === "DELETE").length;
  const edited = proposal.rows.length - deleted;
  const desktop = useWorkspacePresentation() === "desktop";
  const pageSize = 5;
  const start = Math.floor(anchor / pageSize) * pageSize;
  const rows = proposal.rows.slice(start, start + pageSize);
  const refresh = React.useCallback((): Promise<void> => {
    const request = ++epoch.current;
    if (!conversationId || isStreaming) return Promise.resolve();
    return getAiRapChangeProposal({ conversationId, toolCallId })
      .then((response): void => {
        if (request !== epoch.current) return;
        if (response.success) {
          setView(response.data);
          setError("");
        } else setError(response.error.message);
      })
      .catch((): void => {
        if (request === epoch.current)
          setError("Preview belum dapat diperiksa. Buka kembali atau minta usulan terbaru.");
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
      const response = await confirmAiRapChangeProposal({ conversationId, toolCallId });
      if (response.success) {
        setStatus("submitted");
        setView((current) => (current ? { ...current, status: "CONFIRMED" } : current));
      } else {
        setError(response.error.message);
        setStatus("failed");
        if (response.error.code === "CONFLICT")
          setView((current) => (current ? { ...current, status: "STALE" } : current));
      }
    } catch {
      setStatus("failed");
      setError("Perubahan belum dapat disimpan. Coba lagi dengan usulan yang sama.");
    } finally {
      pending.current = false;
      setRemoveConfirm(false);
    }
  }
  const counts = confirmed
    ? `${edited} diperbarui · ${deleted} dihapus`
    : `${edited} edit · ${deleted} hapus`;
  const result = (
    <MoneyValue amount={proposal.budget.afterPlan} variant="fullDynamic" size="sm" align="right" />
  );
  const summary = (
    <GroupedSurface>
      <div className="divide-y divide-outline-variant/20">
        <div className="flex items-start gap-2 px-4 py-3 text-support">
          <AppIcon
            name={proposal.budget.overAllocation > 0 ? "warning" : "check_circle"}
            className="icon-sm"
          />
          <span>
            {proposal.budget.overAllocation > 0
              ? "Rencana melebihi alokasi Material"
              : "Rencana dalam alokasi Material"}
          </span>
        </div>
        <FactRow
          wrapLabel
          label="RAP sebelum"
          value={
            <MoneyValue
              amount={proposal.budget.beforePlan}
              variant="fullDynamic"
              size="sm"
              align="right"
            />
          }
        />
        <FactRow wrapLabel label="RAP setelah" value={result} />
        <FactRow
          wrapLabel
          label="Alokasi Material"
          value={
            <MoneyValue
              amount={proposal.budget.allocated}
              variant="fullDynamic"
              size="sm"
              align="right"
            />
          }
        />
        {proposal.budget.overAllocation > 0 && (
          <FactRow
            wrapLabel
            label="Melebihi alokasi"
            value={
              <MoneyValue
                amount={proposal.budget.overAllocation}
                variant="fullDynamic"
                size="sm"
                align="right"
              />
            }
          />
        )}
      </div>
    </GroupedSurface>
  );
  const actions = (
    <div className="space-y-2">
      {!confirmed && (
        <Button
          className="w-full"
          disabled={!ready || status === "submitting"}
          onClick={() => (deleted ? setRemoveConfirm(true) : void confirm())}
        >
          {status === "submitting"
            ? "Menyimpan…"
            : deleted
              ? "Konfirmasi perubahan & hapus"
              : "Simpan perubahan RAP"}
        </Button>
      )}
      {!confirmed && (
        <Button
          className="w-full"
          variant="tertiary"
          disabled={isBusy || isStreaming || status === "submitting"}
          onClick={() => {
            setOpen(false);
            onFollowUp(
              `Tinjau kembali item RAP ${proposal.projectName}, lalu ${stale ? "buat ulang" : "bantu koreksi"} usulan perubahan RAP terakhir. Tanyakan bagian yang ingin dikoreksi dan pertahankan seluruh perubahan yang masih saya inginkan.`,
            );
          }}
        >
          {stale ? "Minta usulan terbaru" : "Koreksi melalui chat"}
        </Button>
      )}
      <p role="status" className="text-meta text-on-surface-variant">
        {confirmed
          ? "Perubahan RAP tersimpan."
          : stale
            ? "Data berubah atau usulan kedaluwarsa. Minta preview terbaru."
            : "Perubahan ini tidak memindahkan stok atau kas."}
      </p>
    </div>
  );
  return (
    <>
      <ProposalCardShell
        title="Perubahan RAP"
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
              <span className="text-meta text-on-surface-variant">{counts}</span>
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
          <div className="flex items-center justify-between gap-3">
            <span className="text-support text-on-surface-variant">RAP setelah perubahan</span>
            {result}
          </div>
          {deleted > 0 && !confirmed && (
            <p className="flex items-center gap-2 text-support text-critical">
              <AppIcon name="warning" className="icon-sm" />
              {deleted} baris RAP akan dihapus.
            </p>
          )}
          {error && !inline && (
            <p role="alert" className="text-support text-critical">
              {error}
            </p>
          )}
        </div>
        {inline && (
          <ProposalInlineReview
            facts={[
              { label: "Material", value: proposal.rows[0].before.name },
              { label: "Area", value: proposal.rows[0].before.area },
              ...(proposal.rows[0].after === null
                ? [
                    {
                      label: "Jumlah dihapus",
                      value: `${number.format(proposal.rows[0].before.totalQuantity)} ${proposal.rows[0].before.unit}`,
                    },
                    {
                      label: "Subtotal dihapus",
                      value: proposal.rows[0].before.estimatedTotalCost,
                      money: true,
                    },
                  ]
                : []),
            ]}
            details={
              <div className="divide-y divide-outline-variant/20">
                <FactRow
                  label="Alokasi Material"
                  wrapLabel
                  value={
                    <MoneyValue
                      amount={proposal.budget.allocated}
                      variant="fullDynamic"
                      size="sm"
                      align="right"
                    />
                  }
                />
                <FactRow
                  label="Realisasi tetap"
                  wrapLabel
                  value={
                    <MoneyValue
                      amount={proposal.budget.actual}
                      variant="fullDynamic"
                      size="sm"
                      align="right"
                    />
                  }
                />
              </div>
            }
          >
            {error && <ProposalReviewFeedback message={error} />}
            <div className="divide-y divide-outline-variant/20">
              {proposal.rows[0].after &&
                fields
                  .filter((key) => proposal.rows[0].before[key] !== proposal.rows[0].after?.[key])
                  .map((key) => (
                    <ProposalDiffRow
                      key={key}
                      label={labels[key]}
                      before={value(proposal.rows[0].before, key)}
                      after={proposal.rows[0].after ? value(proposal.rows[0].after, key) : "—"}
                      layout="inline"
                      inset={false}
                      strikeBefore={false}
                    />
                  ))}
              {proposal.rows[0].after &&
                proposal.rows[0].before.estimatedTotalCost !==
                  proposal.rows[0].after.estimatedTotalCost && (
                  <ProposalDiffRow
                    label="Subtotal material"
                    before={
                      <MoneyValue
                        amount={proposal.rows[0].before.estimatedTotalCost}
                        variant="fullDynamic"
                        size="sm"
                      />
                    }
                    after={
                      <MoneyValue
                        amount={proposal.rows[0].after.estimatedTotalCost}
                        variant="fullDynamic"
                        size="sm"
                      />
                    }
                    layout="inline"
                    inset={false}
                    strikeBefore={false}
                  />
                )}
            </div>
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
          <div>
            <h3 className="text-section font-bold">{proposal.projectName}</h3>
            <p className="text-support text-on-surface-variant">{counts}</p>
          </div>
          {error && <ProposalReviewFeedback message={error} />}
          <div className={desktop ? "hidden" : ""}>{summary}</div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3 px-1">
              <h3 className="text-row font-semibold">Perubahan material</h3>
              <span className="text-support text-on-surface-variant tabular-nums">
                {proposal.rows.length} baris
              </span>
            </div>
            {desktop ? (
              <ReviewCollection ariaLabel="Perubahan material RAP">
                {rows.map((row) => (
                  <ReviewItem
                    key={row.before.itemId}
                    title={row.before.name}
                    meta={`${row.before.area} · ${row.before.unit}`}
                    primaryValue={
                      <MoneyValue
                        amount={row.after?.estimatedTotalCost ?? row.before.estimatedTotalCost}
                        variant="fullDynamic"
                        size="sm"
                        align="right"
                      />
                    }
                    summary={
                      <p className={row.action === "DELETE" ? "text-critical" : ""}>
                        {row.action === "DELETE"
                          ? confirmed
                            ? "Dihapus"
                            : "Akan dihapus"
                          : confirmed
                            ? "Diperbarui"
                            : "Akan diedit"}
                      </p>
                    }
                  >
                    {row.after ? (
                      <div className="divide-y divide-outline-variant/20">
                        {fields
                          .filter((key) => row.before[key] !== row.after?.[key])
                          .map((key) => (
                            <ProposalDiffRow
                              key={key}
                              label={labels[key]}
                              before={value(row.before, key)}
                              after={row.after ? value(row.after, key) : ""}
                              layout="stacked"
                            />
                          ))}
                        {row.before.estimatedTotalCost !== row.after.estimatedTotalCost ? (
                          <ProposalDiffRow
                            label="Subtotal"
                            before={
                              <MoneyValue
                                amount={row.before.estimatedTotalCost}
                                variant="fullDynamic"
                                size="sm"
                              />
                            }
                            after={
                              <MoneyValue
                                amount={row.after.estimatedTotalCost}
                                variant="fullDynamic"
                                size="sm"
                              />
                            }
                            layout="stacked"
                          />
                        ) : null}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-support text-critical">
                          Hanya baris RAP ini yang akan dihapus. Material Master tidak diubah.
                        </p>
                        <p className="text-support">
                          {number.format(row.before.totalQuantity)} {row.before.unit}
                        </p>
                      </div>
                    )}
                  </ReviewItem>
                ))}
              </ReviewCollection>
            ) : (
              <GroupedSurface>
                <div className="divide-y divide-outline-variant/20">
                  {rows.map((row) => (
                    <section
                      data-review-item="true"
                      key={row.before.itemId}
                      aria-label={`${row.before.name} · ${row.before.area}`}
                    >
                      <div className="flex items-start justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <h4 className="text-row font-semibold wrap-anywhere">
                            {row.before.name}
                          </h4>
                          <p className="text-support text-on-surface-variant">
                            {row.before.area} · {row.before.unit}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-support ${row.action === "DELETE" ? "text-critical" : "text-on-surface-variant"}`}
                        >
                          {row.action === "DELETE"
                            ? confirmed
                              ? "Dihapus"
                              : "Akan dihapus"
                            : confirmed
                              ? "Diperbarui"
                              : "Akan diedit"}
                        </span>
                      </div>
                      {row.after ? (
                        <div>
                          {fields
                            .filter((key) => row.before[key] !== row.after?.[key])
                            .map((key) => (
                              <ProposalDiffRow
                                key={key}
                                label={labels[key]}
                                before={value(row.before, key)}
                                after={row.after ? value(row.after, key) : ""}
                                layout="stacked"
                              />
                            ))}
                          <ProposalDiffRow
                            label="Subtotal"
                            before={
                              <MoneyValue
                                amount={row.before.estimatedTotalCost}
                                variant="fullDynamic"
                                size="sm"
                              />
                            }
                            after={
                              <MoneyValue
                                amount={row.after.estimatedTotalCost}
                                variant="fullDynamic"
                                size="sm"
                              />
                            }
                            layout="stacked"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2 px-4 pb-3">
                          <p className="text-support text-critical">
                            Hanya baris RAP ini yang akan dihapus. Material Master tidak diubah.
                          </p>
                          <p className="text-support">
                            {number.format(row.before.totalQuantity)} {row.before.unit}
                          </p>
                          <MoneyValue
                            amount={row.before.estimatedTotalCost}
                            variant="fullDynamic"
                            size="sm"
                          />
                        </div>
                      )}
                    </section>
                  ))}
                </div>
              </GroupedSurface>
            )}
            {proposal.rows.length > pageSize && (
              <nav
                aria-label="Halaman perubahan RAP"
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
                <span className="text-meta">
                  {start + 1}–{Math.min(start + pageSize, proposal.rows.length)} /{" "}
                  {proposal.rows.length}
                </span>
                <Button
                  variant="tertiary"
                  size="compact"
                  disabled={start + pageSize >= proposal.rows.length}
                  onClick={() => setAnchor(start + pageSize)}
                >
                  Berikutnya
                </Button>
              </nav>
            )}
          </div>
        </div>
      </FormSheet>
      <ConfirmationDialog
        actionLayout="adaptive"
        open={removeConfirm}
        title={`Hapus ${deleted} baris RAP?`}
        description={`${edited ? `${edited} baris juga akan diperbarui. ` : ""}Seluruh perubahan disimpan bersama. Penghapusan tidak menghapus Material Master dan tidak memindahkan stok atau kas.`}
        confirmLabel="Simpan & hapus baris RAP"
        tone="danger"
        danger
        pending={status === "submitting"}
        disabled={!ready}
        onClose={() => {
          if (!pending.current) setRemoveConfirm(false);
        }}
        onConfirm={() => void confirm()}
      />
    </>
  );
}
