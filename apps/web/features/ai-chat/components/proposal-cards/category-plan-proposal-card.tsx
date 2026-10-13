"use client";
import { proposalReviewFlow } from "../../utils/proposal-review-flow";
import { ProposalInlineReview } from "./proposal-inline-review";
import { ProposalReviewFeedback } from "./proposal-review-feedback";
import * as React from "react";
import {
  getAiCategoryPlanProposal,
  confirmAiCategoryPlanProposal,
} from "@/app/actions/ai/category-plan";
import {
  AppIcon,
  Button,
  ReviewCollection,
  ReviewItem,
  FactRow,
  FormDisclosure,
  FormSheet,
  GroupedSurface,
  MoneyValue,
} from "@/components/ui";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import type {
  PackageCategory,
  PackageFields,
  PackageProposal,
  PackageSnapshot,
  PackageView,
} from "@atria/core/ai/category-plan";
import { ProposalCardShell, ProposalDiffRow } from "./proposal-card-shell";
const categoryLabel: Record<PackageCategory, string> = { TUKANG: "Tukang", SUBCON: "Subcon" };
const quantity = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const fieldLabels: Record<keyof PackageFields, string> = {
  name: "Nama paket",
  scopeDescription: "Lingkup pekerjaan",
  area: "Area",
  quantity: "Jumlah",
  unit: "Satuan",
  estimatedUnitCost: "Biaya per satuan",
  vendorId: "Vendor",
  internalNote: "Catatan internal",
};
const fieldKeys: readonly (keyof PackageFields)[] = [
  "name",
  "scopeDescription",
  "area",
  "quantity",
  "unit",
  "estimatedUnitCost",
  "vendorId",
  "internalNote",
];
function display(item: PackageSnapshot, key: keyof PackageFields): React.ReactNode {
  if (key === "estimatedUnitCost")
    return <MoneyValue amount={item.estimatedUnitCost} variant="fullDynamic" size="sm" />;
  if (key === "quantity") return `${quantity.format(item.quantity)} ${item.unit}`;
  if (key === "vendorId") return item.vendorName ?? "Tanpa vendor";
  return item[key] ?? "Belum diisi";
}
export function CategoryPlanProposalCard({
  proposal: initialProposal,
  conversationId,
  toolCallId,
  isStreaming,
  isBusy,
  alreadyConfirmed,
  onFollowUp,
}: {
  readonly proposal: PackageProposal;
  readonly conversationId: string | null;
  readonly toolCallId: string;
  readonly isStreaming: boolean;
  readonly isBusy: boolean;
  readonly alreadyConfirmed: boolean;
  readonly onFollowUp: (text: string) => void;
}): React.JSX.Element {
  const [view, setView] = React.useState<PackageView | null>(null),
    [open, setOpen] = React.useState(false),
    [status, setStatus] = React.useState<"idle" | "submitting" | "submitted" | "failed">("idle"),
    [error, setError] = React.useState(""),
    [anchor, setAnchor] = React.useState(0);
  const [details, setDetails] = React.useState<Partial<Record<PackageCategory, boolean>>>({});
  const epoch = React.useRef(0),
    pending = React.useRef(false);
  const proposal = view?.proposal ?? initialProposal;
  const flow = proposalReviewFlow(proposal),
    inline = flow.review === "inline";
  const confirmed = alreadyConfirmed || view?.status === "CONFIRMED" || status === "submitted";
  const ready = view?.status === "READY" && !isStreaming && !confirmed && !error;
  const stale = view?.status === "STALE" || view?.status === "EXPIRED";
  const desktop = useWorkspacePresentation() === "desktop",
    pageSize = 5;
  const start = Math.floor(anchor / pageSize) * pageSize,
    rows = proposal.rows.slice(start, start + pageSize);
  const creates = proposal.rows.filter((r) => r.action === "CREATE").length,
    updates = proposal.rows.length - creates;
  const counts = confirmed
    ? `${creates} dibuat · ${updates} diperbarui`
    : `${creates} baru · ${updates} koreksi`;
  const refresh = React.useCallback((): Promise<void> => {
    const request = ++epoch.current;
    if (!conversationId || isStreaming) return Promise.resolve();
    return getAiCategoryPlanProposal({ conversationId, toolCallId })
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
      const response = await confirmAiCategoryPlanProposal({ conversationId, toolCallId });
      if (response.success) {
        setStatus("submitted");
        setView((current) => (current ? { ...current, status: "CONFIRMED" } : current));
      } else {
        setStatus("failed");
        setError(response.error.message);
        if (response.error.code === "CONFLICT")
          setView((current) => (current ? { ...current, status: "STALE" } : current));
      }
    } catch {
      setStatus("failed");
      setError("Paket belum dapat disimpan. Coba lagi dengan usulan yang sama.");
    } finally {
      pending.current = false;
    }
  }
  const renderBudgetDetails = (budget: PackageProposal["budgets"][number]): React.ReactNode => (
    <div className="px-4">
      <FormDisclosure
        title={desktop ? `Rincian budget ${categoryLabel[budget.category]}` : "Rincian budget"}
        variant="plain"
        expanded={Boolean(details[budget.category])}
        onToggle={() =>
          setDetails((current) => ({
            ...current,
            [budget.category]: !current[budget.category],
          }))
        }
      >
        <div className="divide-y divide-outline-variant/20">
          {[
            { label: "Rencana sebelum", amount: budget.beforePlan },
            { label: "Terpakai", amount: budget.actual },
            { label: "Menunggu review", amount: budget.pending },
            { label: "Sisa budget", amount: budget.remaining },
          ].map((item) => (
            <FactRow
              key={item.label}
              inset={false}
              wrapLabel
              label={item.label}
              value={
                <MoneyValue amount={item.amount} variant="fullDynamic" size="sm" align="right" />
              }
            />
          ))}
        </div>
        <p className="mt-3 text-meta text-on-surface-variant">
          Rencana paket terpisah dari realisasi biaya.
        </p>
      </FormDisclosure>
    </div>
  );
  const summary = (
    <div className="space-y-4">
      {proposal.budgets.map((budget) => (
        <section
          key={budget.category}
          aria-label={`Ringkasan budget ${categoryLabel[budget.category]}`}
        >
          <GroupedSurface>
            <div className="divide-y divide-outline-variant/20">
              <div className="space-y-2 px-4 py-3">
                <h3 className="text-row font-semibold">Budget {categoryLabel[budget.category]}</h3>
                <p
                  className={`flex items-start gap-2 text-support ${budget.overAllocation > 0 ? "text-critical" : "text-on-surface-variant"}`}
                >
                  <AppIcon
                    name={budget.overAllocation > 0 ? "warning" : "check_circle"}
                    className="icon-sm shrink-0"
                  />
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span>
                      {budget.overAllocation > 0 ? "Melebihi alokasi" : "Rencana dalam alokasi"}
                    </span>
                    {budget.overAllocation > 0 && (
                      <MoneyValue amount={budget.overAllocation} variant="fullDynamic" size="sm" />
                    )}
                  </span>
                </p>
              </div>
              {[
                { label: "Rencana setelah", amount: budget.afterPlan },
                { label: "Alokasi", amount: budget.allocated },
              ].map((item) => (
                <FactRow
                  key={item.label}
                  wrapLabel
                  label={item.label}
                  value={
                    <MoneyValue
                      amount={item.amount}
                      variant="fullDynamic"
                      size="sm"
                      align="right"
                    />
                  }
                />
              ))}
              {!desktop && renderBudgetDetails(budget)}
            </div>
          </GroupedSurface>
        </section>
      ))}
    </div>
  );
  const actions = (
    <div className="space-y-2">
      <p className="text-support font-medium">
        {confirmed ? "Paket Draft tersimpan" : `${proposal.rows.length} paket dalam usulan`}
      </p>

      {!confirmed && (
        <>
          <Button
            className="w-full"
            disabled={!ready || status === "submitting"}
            onClick={() => void confirm()}
          >
            {status === "submitting" ? "Menyimpan…" : "Simpan paket Draft"}
          </Button>
          <Button
            className="w-full"
            variant="tertiary"
            disabled={isBusy || isStreaming || status === "submitting"}
            onClick={() => {
              setOpen(false);
              onFollowUp(
                `Tinjau kembali paket Tukang dan Subcon ${proposal.projectName}, lalu ${stale ? "buat ulang" : "bantu koreksi"} usulan terakhir. Tanyakan bagian yang perlu dikoreksi dan pertahankan seluruh paket yang masih saya inginkan.`,
              );
            }}
          >
            {stale ? "Minta usulan terbaru" : "Koreksi melalui chat"}
          </Button>
        </>
      )}
      <p role="status" className="text-meta text-on-surface-variant">
        {confirmed
          ? "Paket tersimpan sebagai Draft. Status Siap mengikuti review proyek."
          : stale
            ? "Data berubah atau usulan kedaluwarsa. Minta preview terbaru."
            : "Stok, kas dan realisasi budget tetap saat paket disimpan."}
      </p>
    </div>
  );
  function identity(row: PackageProposal["rows"][number]): React.ReactNode {
    return (
      <div className="min-w-0 space-y-1">
        <p className="text-row font-semibold wrap-anywhere">{row.after.name}</p>
        <p className="text-meta wrap-anywhere text-on-surface-variant">
          {categoryLabel[row.category]} · {row.after.area} · {row.after.unit}
        </p>
        <p className="text-support text-on-surface-variant">
          {row.action === "CREATE"
            ? confirmed
              ? "Dibuat"
              : "Akan dibuat"
            : confirmed
              ? "Diperbarui"
              : "Akan diperbarui"}
        </p>
        <p className="text-meta wrap-anywhere text-on-surface-variant">
          {row.after.vendorName ?? "Tanpa vendor"}
        </p>
      </div>
    );
  }
  function changes(row: PackageProposal["rows"][number]): React.ReactNode {
    if (row.before)
      return (
        <div className="divide-y divide-outline-variant/20">
          {fieldKeys
            .filter((key) => row.before?.[key] !== row.after[key])
            .map((key) => (
              <ProposalDiffRow
                key={key}
                label={fieldLabels[key]}
                before={row.before ? display(row.before, key) : ""}
                after={display(row.after, key)}
                layout="stacked"
              />
            ))}
        </div>
      );
    return (
      <div className="divide-y divide-outline-variant/20">
        <FactRow wrapLabel label="Jumlah" value={display(row.after, "quantity")} />
        <FactRow wrapLabel label="Biaya / satuan" value={display(row.after, "estimatedUnitCost")} />
        {row.after.scopeDescription && (
          <div className="space-y-1 px-4 py-3">
            <p className="text-meta text-on-surface-variant">Lingkup pekerjaan</p>
            <p className="text-support wrap-anywhere whitespace-pre-wrap">
              {row.after.scopeDescription}
            </p>
          </div>
        )}
        {row.after.internalNote && (
          <div className="space-y-1 px-4 py-3">
            <p className="text-meta text-on-surface-variant">Catatan internal</p>
            <p className="text-support wrap-anywhere whitespace-pre-wrap">
              {row.after.internalNote}
            </p>
          </div>
        )}
      </div>
    );
  }
  function total(row: PackageProposal["rows"][number]): React.ReactNode {
    return row.before ? (
      <ProposalDiffRow
        label="Subtotal"
        before={
          <MoneyValue amount={row.before.estimatedTotalCost} variant="fullDynamic" size="sm" />
        }
        after={<MoneyValue amount={row.after.estimatedTotalCost} variant="fullDynamic" size="sm" />}
        layout={desktop ? "vertical" : "stacked"}
      />
    ) : desktop ? (
      <MoneyValue amount={row.after.estimatedTotalCost} variant="fullDynamic" size="sm" />
    ) : (
      <FactRow
        wrapLabel
        label="Subtotal"
        value={
          <MoneyValue
            amount={row.after.estimatedTotalCost}
            variant="fullDynamic"
            size="sm"
            align="right"
          />
        }
      />
    );
  }
  return (
    <>
      <ProposalCardShell
        title="Paket pekerjaan"
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
          {proposal.budgets.map((budget) => (
            <div key={budget.category} className="flex items-center justify-between gap-3">
              <span className="text-support text-on-surface-variant">
                {categoryLabel[budget.category]} setelah usulan
              </span>
              <MoneyValue amount={budget.afterPlan} variant="fullDynamic" size="sm" align="right" />
            </div>
          ))}
          {proposal.budgets.some((budget) => budget.overAllocation > 0) && (
            <p className="flex items-start gap-2 text-support text-critical">
              <AppIcon name="warning" className="icon-sm shrink-0" />
              Rencana melebihi alokasi{" "}
              {proposal.budgets
                .filter((budget) => budget.overAllocation > 0)
                .map((budget) => categoryLabel[budget.category])
                .join(" dan ")}
              .
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
              { label: "Paket", value: proposal.rows[0].after.name },
              { label: "Kategori", value: categoryLabel[proposal.rows[0].category] },
            ]}
            details={
              <div>
                {proposal.budgets.map((b) => (
                  <FactRow
                    key={b.category}
                    label={`Alokasi ${categoryLabel[b.category]}`}
                    wrapLabel
                    value={
                      <MoneyValue
                        amount={b.allocated}
                        variant="fullDynamic"
                        size="sm"
                        align="right"
                      />
                    }
                  />
                ))}
              </div>
            }
          >
            {error && <ProposalReviewFeedback message={error} />}
            <div className="divide-y divide-outline-variant/20">
              {fieldKeys
                .filter((key) => proposal.rows[0].before?.[key] !== proposal.rows[0].after[key])
                .map((key) => (
                  <ProposalDiffRow
                    key={key}
                    label={fieldLabels[key]}
                    before={proposal.rows[0].before ? display(proposal.rows[0].before, key) : "—"}
                    after={display(proposal.rows[0].after, key)}
                    layout="inline"
                    inset={false}
                    strikeBefore={false}
                  />
                ))}
              {proposal.rows[0].before?.estimatedTotalCost !==
                proposal.rows[0].after.estimatedTotalCost && (
                <ProposalDiffRow
                  label="Subtotal paket"
                  before={
                    <MoneyValue
                      amount={proposal.rows[0].before?.estimatedTotalCost ?? 0}
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
        title="Buka review"
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
            <p className="text-support text-on-surface-variant">{counts}</p>
          </div>
          {error && <ProposalReviewFeedback message={error} />}
          <div className={desktop ? "hidden" : ""}>{summary}</div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3 px-1">
              <h3 className="text-row font-semibold">Paket pekerjaan</h3>
              <span className="text-support text-on-surface-variant">
                {proposal.rows.length} paket
              </span>
            </div>
            <GroupedSurface>
              {desktop ? (
                <ReviewCollection embedded ariaLabel="Usulan paket Tukang dan Subcon">
                  {rows.map((row) => (
                    <ReviewItem
                      key={row.rowId}
                      title={row.after.name}
                      meta={`${categoryLabel[row.category]} · ${row.after.area} · ${row.after.unit}`}
                      primaryValue={
                        <MoneyValue
                          amount={row.after.estimatedTotalCost}
                          variant="fullDynamic"
                          size="sm"
                          align="right"
                        />
                      }
                      summary={
                        <p>
                          {row.action === "CREATE"
                            ? confirmed
                              ? "Dibuat"
                              : "Akan dibuat"
                            : confirmed
                              ? "Diperbarui"
                              : "Akan diperbarui"}{" "}
                          · {row.after.vendorName ?? "Tanpa vendor"}
                        </p>
                      }
                    >
                      <div className="space-y-2">
                        {changes(row)}
                        {row.before &&
                        row.before.estimatedTotalCost !== row.after.estimatedTotalCost ? (
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
                        <p className="text-meta text-on-surface-variant">{row.priceSourceLabel}</p>
                      </div>
                    </ReviewItem>
                  ))}
                </ReviewCollection>
              ) : (
                <div className="divide-y divide-outline-variant/20">
                  {rows.map((row) => (
                    <section
                      data-review-item="true"
                      key={row.rowId}
                      aria-label={`${row.after.name} · ${row.after.area}`}
                    >
                      <div className="px-4 py-3">{identity(row)}</div>
                      {changes(row)}
                      {total(row)}
                      <p className="px-4 pb-3 text-meta wrap-anywhere text-on-surface-variant">
                        {row.priceSourceLabel}
                      </p>
                    </section>
                  ))}
                </div>
              )}
            </GroupedSurface>
            {proposal.rows.length > pageSize && (
              <nav
                aria-label="Halaman paket pekerjaan"
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
          {desktop && (
            <GroupedSurface>
              <div className="divide-y divide-outline-variant/20">
                {proposal.budgets.map((budget) => (
                  <section key={budget.category}>{renderBudgetDetails(budget)}</section>
                ))}
              </div>
            </GroupedSurface>
          )}
        </div>
      </FormSheet>
    </>
  );
}
