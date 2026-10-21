"use client";
import { proposalReviewFlow } from "../../utils/proposal-review-flow";
import {
  ProposalInlineReview,
  inlineFactChanges,
  inlineProposalValue,
} from "./proposal-inline-review";
/** THESIS: exact procurement/warehouse decisions before commit. OWN-WORLD: inherited Atria Operate.
 * STORY: match sources → review amount/stock → explicit confirmation → receipt.
 * FIRST VIEWPORT: context and grouped rows left, summary/protected actions right; mobile summary first.
 * FORM: shared FormSheet/ReviewCollection, five rows, no new primitive or visual world.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
 */
import * as React from "react";
import {
  getAiProcurementWarehouseProposal,
  confirmAiProcurementWarehouseProposal,
} from "@/app/actions/ai/procurement-warehouse";
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
import { parseDateOnly } from "@atria/core/presentation/date-only";
import {
  procurementWarehousePermission,
  type ProcurementWarehouseProposal,
  type ProcurementWarehouseView,
  type ProcurementWarehouseAction,
} from "@atria/core/ai/procurement-warehouse";
const actions: Readonly<
  Record<
    ProcurementWarehouseAction,
    { commit: string; saved: string; review?: string; intro?: string }
  >
> = {
  STOCK_CORRECT: {
    commit: "Terapkan koreksi stok",
    saved: "Koreksi stok tercatat dengan alasan dan jejak audit.",
    review: "Review koreksi stok",
    intro: "Periksa jumlah koreksi dan hasil stok di lokasi yang dipilih.",
  },
  VENDOR_BILL_CORRECT: {
    commit: "Simpan koreksi tagihan",
    saved: "Koreksi tagihan tersimpan dengan alasan dan jejak audit.",
    review: "Review tagihan",
    intro: "Koreksi tagihan tersimpan; pembayaran dan penerimaan yang tercatat tetap utuh.",
  },
  PROJECT_RECEIPT: {
    commit: "Catat penerimaan",
    saved: "Penerimaan material proyek tercatat dan stok diperbarui.",
    review: "Review penerimaan",
    intro: "Penerimaan menambah stok di lokasi yang dipilih; pembayaran terpisah.",
  },
  WAREHOUSE_STOCK_IN: {
    commit: "Catat stok masuk",
    saved: "Stok masuk gudang tercatat beserta referensi sumbernya.",
    review: "Review stok masuk",
    intro: "Stok masuk perusahaan, tanpa proyek atau pembayaran.",
  },
  OPENING_REQUEST: {
    commit: "Ajukan saldo awal",
    saved: "Saldo awal diajukan kepada pemeriksa lain. Stok belum berubah.",
    review: "Review saldo awal",
    intro: "Stok awal baru diposting setelah disetujui pemeriksa lain.",
  },
  OPENING_APPROVE: {
    commit: "Setujui saldo awal",
    saved: "Saldo awal disetujui dan diposting ke inventory.",
    review: "Setujui saldo awal",
    intro: "Persetujuan memposting jumlah dan harga pokok awal yang ditinjau.",
  },
  OPENING_REJECT: {
    commit: "Tolak saldo awal",
    saved: "Pengajuan saldo awal ditolak dengan alasan. Stok tetap.",
    review: "Tolak saldo awal",
    intro: "Penolakan menyimpan alasan dan mempertahankan stok saat ini.",
  },
  OPENING_REVERSE: {
    commit: "Balik saldo awal",
    saved: "Saldo awal dibalik dengan pergerakan stok dan jejak audit.",
    review: "Balik saldo awal",
    intro: "Pembatalan membalik seluruh saldo awal yang belum memiliki pergerakan berikutnya.",
  },
  VENDOR_BILL_SAVE: {
    commit: "Simpan draft tagihan",
    saved: "Draft tagihan tersimpan. Bisa dikoreksi atau diajukan nanti.",
  },
  VENDOR_BILL_SUBMIT: {
    commit: "Catat tagihan belum dibayar",
    saved: "Tagihan belum dibayar tercatat. Pembayaran tetap tindakan terpisah.",
  },
  RECEIPT_REVERSAL_REQUEST: {
    commit: "Ajukan pembatalan",
    saved: "Pembatalan penerimaan menunggu persetujuan pengguna lain; stok tetap.",
  },
  RECEIPT_REVERSAL_APPROVE: {
    commit: "Setujui pembatalan",
    saved: "Penerimaan dibatalkan dan stok dikoreksi dengan jejak audit.",
  },
  RECEIPT_REVERSAL_REJECT: {
    commit: "Tolak pembatalan",
    saved: "Pengajuan pembatalan ditolak; penerimaan dan stok tetap.",
  },
  WAREHOUSE_TRANSFER: {
    commit: "Konfirmasi transfer",
    saved: "Transfer stok tercatat di kedua lokasi.",
  },
  STOCK_COUNT_SAVE: {
    commit: "Simpan hasil hitung",
    saved: "Draft hasil hitung tersimpan; stok belum dikoreksi.",
  },
  STOCK_COUNT_SUBMIT: {
    commit: "Ajukan persetujuan",
    saved: "Hasil hitung menunggu persetujuan pengguna lain.",
  },
  STOCK_COUNT_APPROVE: {
    commit: "Setujui dan terapkan koreksi",
    saved: "Hasil hitung disetujui dan koreksi stok tercatat.",
  },
  STOCK_COUNT_REJECT: {
    commit: "Tolak hasil hitung",
    saved: "Hasil hitung ditolak dengan alasan; stok tetap.",
  },
};
function amount(value: number, precise = false): React.JSX.Element {
  return (
    <MoneyValue
      amount={value}
      variant="fullDynamic"
      size="sm"
      align="right"
      fractionDigits={precise && !Number.isInteger(value) ? 2 : 0}
    />
  );
}
function factValue(
  fact: ProcurementWarehouseProposal["summary"][number],
  precise = false,
): React.ReactNode {
  if (typeof fact.value === "string" && fact.label.startsWith("Tanggal")) {
    const date = parseDateOnly(fact.value);
    if (date)
      return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  }
  return fact.money && typeof fact.value === "number"
    ? amount(fact.value, precise)
    : typeof fact.value === "number"
      ? fact.value.toLocaleString("id-ID", { maximumFractionDigits: 2 })
      : fact.value;
}
export function ProcurementWarehouseProposalCard({
  proposal: initial,
  conversationId,
  toolCallId,
  isStreaming,
  isBusy,
  alreadyConfirmed,
  onFollowUp,
}: {
  readonly proposal: ProcurementWarehouseProposal;
  readonly conversationId: string | null;
  readonly toolCallId: string;
  readonly isStreaming: boolean;
  readonly isBusy: boolean;
  readonly alreadyConfirmed: boolean;
  readonly onFollowUp: (text: string) => void;
}): React.JSX.Element {
  const can = useCan(),
    desktop = useWorkspacePresentation() === "desktop";
  const [view, setView] = React.useState<ProcurementWarehouseView | null>(null),
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
    action = actions[proposal.action],
    bill = proposal.action.startsWith("VENDOR_BILL");
  const budget = can("view:budget") ? proposal.budget : null,
    facts = can("view:budget")
      ? proposal.summary
      : proposal.summary.filter((f) => f.label !== "Melebihi alokasi termasuk pending");
  const correction = proposal.action === "VENDOR_BILL_CORRECT";
  const stockCorrection = proposal.action === "STOCK_CORRECT";
  const stockReason =
    stockCorrection && proposal.input.action === "STOCK_CORRECT" ? (
      <div className="space-y-1 px-4 py-3 text-support">
        <p className="font-semibold">Alasan koreksi</p>
        <p className="wrap-anywhere text-on-surface-variant">{proposal.input.reason}</p>
      </div>
    ) : null;
  const correctionMoney =
    correction && proposal.rows.some((row) => row.comparisons.some((c) => c.money));
  const correctionUnpaid =
    correction && facts.some((f) => f.label === "Sudah dibayar" && f.value === 0);
  const displayFacts = facts
    .filter((f) => !correctionUnpaid || !["Sudah dibayar", "Sisa tagihan"].includes(f.label))
    .map((fact) =>
      correction && fact.label === "Nominal sebelumnya"
        ? { ...fact, label: "Sebelumnya" }
        : correction && fact.label === "Nominal setelah koreksi"
          ? { ...fact, label: correctionMoney ? "Setelah koreksi" : "Nominal tagihan" }
          : fact.label === "Hasil tindakan"
            ? { ...fact, label: "Hasil" }
            : fact.label === "Status sebelumnya"
              ? { ...fact, label: "Status awal" }
              : fact,
    );
  const warehouseIntake = [
    "PROJECT_RECEIPT",
    "WAREHOUSE_STOCK_IN",
    "OPENING_REQUEST",
    "OPENING_APPROVE",
    "OPENING_REJECT",
    "OPENING_REVERSE",
  ].includes(proposal.action);
  const confirmationFacts = correction
    ? displayFacts.toSorted((left, right) => Number(!left.money) - Number(!right.money))
    : warehouseIntake
      ? displayFacts.toSorted((left, right) => {
          const priority = (fact: (typeof displayFacts)[number]): number =>
            fact.money
              ? 0
              : fact.label.startsWith("Material") || fact.label === "Baris material"
                ? 1
                : 2;
          return priority(left) - priority(right);
        })
      : displayFacts;
  const flow = proposalReviewFlow(proposal),
    inline = flow.review === "inline";
  const correctionChanges = inlineFactChanges(proposal.rows.flatMap((row) => row.details));
  const metadataDecision = [
    "STOCK_COUNT_SUBMIT",
    "STOCK_COUNT_REJECT",
    "RECEIPT_REVERSAL_REQUEST",
    "RECEIPT_REVERSAL_REJECT",
  ].includes(proposal.action);
  const confirmed = alreadyConfirmed || status === "submitted" || view?.status === "CONFIRMED",
    pending = isBusy || status === "submitting",
    stale = view?.status === "STALE" || view?.status === "EXPIRED";
  const permitted =
    can("use:ai_chat") &&
    can(procurementWarehousePermission(proposal.action)) &&
    (bill || (can("view:material") && can("view:inventory")));
  const ready = view?.status === "READY" && !confirmed && !isStreaming && !error && permitted;
  const start = Math.min(page * 5, Math.max(0, Math.floor((proposal.rows.length - 1) / 5) * 5)),
    rows = proposal.rows.slice(start, start + 5);
  const refresh = React.useCallback((): Promise<void> => {
    if (!conversationId || isStreaming || inFlight.current) return Promise.resolve();
    const request = ++epoch.current;
    return getAiProcurementWarehouseProposal({ conversationId, toolCallId })
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
    setStatus("submitting");
    setError("");
    try {
      const result = await confirmAiProcurementWarehouseProposal({ conversationId, toolCallId });
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
      if (stockCorrection) void refresh();
    }
  }
  const budgetRisk = facts.some(
    (fact) =>
      fact.label === "Melebihi alokasi termasuk pending" &&
      typeof fact.value === "number" &&
      fact.value > 0,
  );
  const budgetDisclosure = budget ? (
    <GroupedSurface>
      <div className="px-4">
        <FormDisclosure
          variant="plain"
          title="Rincian budget"
          expanded={budgetOpen}
          onToggle={() => setBudgetOpen((value) => !value)}
        >
          <div className="divide-y divide-outline-variant/20">
            {budget.map((fact, index) => (
              <FactRow
                key={`${fact.label}-${index}`}
                label={fact.label}
                inset={false}
                wrapLabel
                value={factValue(fact, correction)}
              />
            ))}
          </div>
        </FormDisclosure>
      </div>
    </GroupedSurface>
  ) : null;
  const summary = (
    <GroupedSurface>
      <div className="divide-y divide-outline-variant/20">
        <div
          className={`flex items-start gap-2 px-4 py-3 text-support ${budgetRisk ? "text-warning" : ""}`}
        >
          <AppIcon
            name={
              budgetRisk
                ? "warning"
                : proposal.action === "STOCK_COUNT_APPROVE"
                  ? "check_circle"
                  : bill
                    ? "request_quote"
                    : "inventory_2"
            }
            className="icon-sm shrink-0"
          />
          <span>
            {confirmed
              ? "Hasil tersimpan"
              : budgetRisk
                ? "Periksa batas alokasi kategori"
                : "Hasil yang ditinjau"}
          </span>
        </div>
        {displayFacts
          .filter((fact) => !stockCorrection || fact.label !== "Alasan audit")
          .map((fact, index) => (
            <FactRow
              key={`${fact.label}-${index}`}
              label={fact.label}
              wrapLabel={!fact.label.startsWith("Referensi")}
              value={factValue(fact, correction)}
            />
          ))}
        {stockReason}
      </div>
    </GroupedSurface>
  );
  const footer = (
    <div className="space-y-3">
      {confirmed ? (
        <ButtonLink
          fullWidth
          href={
            bill
              ? proposal.action === "VENDOR_BILL_SAVE"
                ? "/expenses?new-vendor-bill=true"
                : "/expenses"
              : proposal.action.startsWith("OPENING_")
                ? "/materials/opening"
                : "/materials"
          }
        >
          {bill
            ? proposal.action === "VENDOR_BILL_SAVE"
              ? "Buka draft tagihan"
              : "Buka pengeluaran"
            : proposal.action.startsWith("OPENING_")
              ? "Buka saldo awal stok"
              : "Buka gudang"}
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
            label: stale ? "Minta preview terbaru" : "Koreksi lewat chat",
            variant: "quiet",
            disabled: pending,
            onClick: () => {
              setOpen(false);
              onFollowUp(
                `Periksa sumber terbaru lalu ${stale ? "buat ulang preview" : "bantu koreksi"} ${proposal.title} untuk ${proposal.entityName}. Tanyakan bagian yang ingin saya ubah sebelum menyiapkan usulan baru.`,
              );
            },
          }}
        />
      )}
      {!error && (
        <p role="status" className="text-meta text-on-surface-variant">
          {confirmed
            ? `${action.saved} Kas tetap.`
            : stale
              ? "Data atau status berubah. Minta preview terbaru."
              : proposal.effect}
        </p>
      )}
    </div>
  );
  const pagination = (
    <>
      {proposal.rows.length > 5 && (
        <nav aria-label="Halaman usulan" className="flex items-center justify-between gap-3">
          <Button
            variant="quiet"
            size="compact"
            disabled={page === 0}
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
    </>
  );
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
              {confirmed ? "Lihat rincian" : "Buka review"}
              <AppIcon name="arrow_forward" className="icon-sm" />
            </Button>
          )
        }
      >
        <div className="space-y-2 px-4 py-3">
          <p className="text-row font-semibold">{proposal.entityName}</p>
          <p className="text-support text-on-surface-variant">{proposal.meta}</p>
          <p className="text-support text-on-surface-variant">
            {action.intro ??
              (bill
                ? proposal.action === "VENDOR_BILL_SAVE"
                  ? "Draft untuk dikoreksi dan diajukan; belum ada pembayaran."
                  : "Tagihan belum dibayar; pembayaran tetap terpisah."
                : proposal.action === "WAREHOUSE_TRANSFER"
                  ? "Stok dipindahkan antar lokasi; reservasi dan kas tetap."
                  : proposal.action === "RECEIPT_REVERSAL_REQUEST"
                    ? "Ajukan pembatalan penerimaan kepada pengguna lain; stok belum berubah."
                    : proposal.action === "RECEIPT_REVERSAL_APPROVE"
                      ? "Batalkan seluruh penerimaan dan koreksi stok; tagihan vendor dan kas tetap."
                      : proposal.action === "RECEIPT_REVERSAL_REJECT"
                        ? "Tolak pengajuan dengan alasan; penerimaan dan stok tetap berlaku."
                        : proposal.action === "STOCK_COUNT_APPROVE"
                          ? "Koreksi stok sesuai hasil hitung; kas tetap."
                          : "Hasil hitung ditinjau sebelum koreksi stok diterapkan.")}
          </p>
        </div>
        {inline && (
          <ProposalInlineReview
            preciseMoney={correction || stockCorrection}
            comparisons={
              correction
                ? [
                    ...proposal.rows.flatMap((row) => row.comparisons),
                    ...correctionChanges.comparisons,
                  ]
                : metadataDecision
                  ? []
                  : (proposal.rows[0]?.comparisons ?? [])
            }
            facts={[
              ...(correctionMoney
                ? displayFacts.filter((f) => !["Sebelumnya", "Setelah koreksi"].includes(f.label))
                : stockCorrection
                  ? displayFacts.filter(
                      (f) => !["Alasan audit", "Material", "Lokasi"].includes(f.label),
                    )
                  : displayFacts),
              ...(metadataDecision
                ? []
                : (proposal.rows[0]?.details.filter((f) =>
                    [
                      "Satuan",
                      "Reservasi tetap",
                      "Reservasi saat ini",
                      "Stok fisik saat ini",
                      "Alasan",
                    ].includes(f.label),
                  ) ?? [])),
              ...(stockCorrection
                ? (proposal.rows[0]?.details.filter(
                    (f) =>
                      ["Koreksi", "Direservasi"].includes(f.label) ||
                      f.label.endsWith("terkait") ||
                      (f.label === "Harga pokok pergerakan" &&
                        proposal.input.action === "STOCK_CORRECT" &&
                        proposal.input.items[0].unitCost !== undefined) ||
                      (f.label === "Alasan audit" &&
                        f.value !== ("reason" in proposal.input ? proposal.input.reason : null)),
                  ) ?? [])
                : []),
              ...("reason" in proposal.input && !stockCorrection
                ? [
                    {
                      label:
                        correction || stockCorrection
                          ? "Alasan koreksi"
                          : proposal.action.includes("REJECT")
                            ? "Alasan penolakan"
                            : "Alasan pengajuan",
                      value: proposal.input.reason,
                    },
                  ]
                : []),
              ...(proposal.action.startsWith("VENDOR_BILL") && !correction
                ? (proposal.rows[0]?.details ?? [])
                : []),
            ]}
            details={
              <>
                <ReviewCollection embedded ariaLabel="Rincian usulan">
                  {rows.map((row) => (
                    <ReviewItem
                      key={row.id}
                      title={row.title}
                      meta={row.meta}
                      primaryValue={
                        row.amount !== null && !correction ? (
                          stockCorrection ? (
                            <div className="space-y-1">
                              <span className="text-meta text-on-surface-variant">
                                Harga pokok pergerakan
                              </span>
                              {amount(row.amount, true)}
                            </div>
                          ) : (
                            amount(row.amount)
                          )
                        ) : undefined
                      }
                    >
                      {row.comparisons.map((c, i) => (
                        <ProposalDiffRow
                          key={`${c.label}-${i}`}
                          label={c.label}
                          before={
                            c.money
                              ? amount(c.before, correction)
                              : c.before.toLocaleString("id-ID")
                          }
                          after={
                            c.money ? amount(c.after, correction) : c.after.toLocaleString("id-ID")
                          }
                          layout="inline"
                          inset={false}
                          strikeBefore={false}
                        />
                      ))}
                    </ReviewItem>
                  ))}
                </ReviewCollection>
                {pagination}
              </>
            }
          >
            {stockReason
              ? React.cloneElement(stockReason, { className: "space-y-1 py-3 text-support" })
              : null}
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
          </ProposalInlineReview>
        )}
      </ProposalCardShell>
      <FormSheet
        open={open}
        title={
          action.review ??
          (proposal.action.startsWith("RECEIPT_REVERSAL")
            ? action.commit
            : `Review ${proposal.title.toLocaleLowerCase("id-ID")}`)
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
            <p className="text-section-title font-semibold">{proposal.entityName}</p>
            <p className="text-support text-on-surface-variant">{proposal.meta}</p>
            {correction && "reason" in proposal.input && (
              <p className="mt-2 text-support text-on-surface-variant">
                Alasan koreksi: {proposal.input.reason}
              </p>
            )}
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
          <ReviewCollection ariaLabel="Usulan yang ditinjau">
            {rows.map((row) => (
              <ReviewItem
                key={row.id}
                title={row.title}
                meta={row.meta}
                primaryValue={row.amount !== null && !correction ? amount(row.amount) : undefined}
                expanded={expanded === row.id}
                onToggle={
                  row.details.length && !correction
                    ? () => setExpanded((current) => (current === row.id ? null : row.id))
                    : undefined
                }
                editor={
                  row.details.length && !correction ? (
                    <div className="divide-y divide-outline-variant/20">
                      {row.details.map((fact, index) => (
                        <FactRow
                          key={`${fact.label}-${index}`}
                          label={fact.label}
                          wrapLabel
                          value={factValue(fact, correction)}
                        />
                      ))}
                    </div>
                  ) : undefined
                }
              >
                {correction &&
                  inlineFactChanges(row.details).comparisons.map((change) => (
                    <div key={change.label} className="divide-y divide-outline-variant/20">
                      <FactRow
                        label="Sebelum"
                        wrapLabel
                        inset={false}
                        value={inlineProposalValue(change.before)}
                      />
                      <FactRow
                        label="Sesudah"
                        wrapLabel
                        inset={false}
                        value={inlineProposalValue(change.after)}
                      />
                    </div>
                  ))}
                {row.comparisons.length > 0 && (
                  <div className="divide-y divide-outline-variant/20">
                    {row.comparisons.map((comparison) => (
                      <ProposalDiffRow
                        key={comparison.label}
                        label={comparison.label}
                        before={
                          comparison.money
                            ? amount(comparison.before, correction)
                            : comparison.before.toLocaleString("id-ID", {
                                maximumFractionDigits: 2,
                              })
                        }
                        after={
                          comparison.money
                            ? amount(comparison.after, correction)
                            : comparison.after.toLocaleString("id-ID", { maximumFractionDigits: 2 })
                        }
                        layout="inline"
                        inset={false}
                        strikeBefore={false}
                      />
                    ))}
                  </div>
                )}
                {stockCorrection &&
                  row.details
                    .filter((f) => f.label.endsWith("terkait"))
                    .map((fact, index) => (
                      <FactRow
                        key={`reference-${index}`}
                        label={fact.label}
                        value={fact.value}
                        wrapLabel
                        inset={false}
                      />
                    ))}
                {stockCorrection &&
                  row.details
                    .filter(
                      (f) =>
                        f.label === "Alasan audit" &&
                        proposal.input.action === "STOCK_CORRECT" &&
                        f.value !== proposal.input.reason,
                    )
                    .map((fact, index) => (
                      <div key={`note-${index}`} className="space-y-1 py-3 text-support">
                        <p className="font-semibold">Alasan untuk material ini</p>
                        <p className="wrap-anywhere text-on-surface-variant">
                          {String(fact.value)}
                        </p>
                      </div>
                    ))}
              </ReviewItem>
            ))}
          </ReviewCollection>
          {pagination}
          {budgetDisclosure}
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
          <p>
            {proposal.entityName} · {proposal.meta}
          </p>
          <p>
            {correction
              ? "Kas dan stok tetap. Koreksi disimpan dengan alasan dan audit."
              : proposal.effect}
          </p>
          <div className="divide-y divide-outline-variant/20">
            {confirmationFacts
              .filter((fact) => !stockCorrection || fact.label !== "Alasan audit")
              .map((fact, index) => (
                <FactRow
                  key={`${fact.label}-${index}`}
                  label={fact.label}
                  wrapLabel={!fact.label.startsWith("Referensi")}
                  value={factValue(fact, correction)}
                />
              ))}
            {stockReason}
            {correction && "reason" in proposal.input && (
              <FactRow label="Alasan koreksi" wrapLabel value={proposal.input.reason} />
            )}
          </div>
        </div>
      </ConfirmationDialog>
    </>
  );
}
