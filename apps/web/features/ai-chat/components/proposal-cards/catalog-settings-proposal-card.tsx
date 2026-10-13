"use client";
import { proposalReviewFlow } from "../../utils/proposal-review-flow";
import { ProposalInlineReview, inlineFactChanges } from "./proposal-inline-review";
/** THESIS: exact catalog settings decisions before commit. OWN-WORLD: inherited Atria Operate.
 * STORY: match sources → review catalog/valuation changes → explicit confirmation → receipt.
 * FIRST VIEWPORT: context and grouped rows left, summary/protected actions right; mobile summary first.
 * FORM: shared FormSheet/ReviewCollection, five rows, no new primitive or visual world.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
 */
import * as React from "react";
import {
  getAiCatalogSettingsProposal,
  confirmAiCatalogSettingsProposal,
} from "@/app/actions/ai/catalog-settings";
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
} from "@/components/ui";
import { ProposalCardShell, ProposalDiffRow } from "./proposal-card-shell";
import { ProposalReviewFeedback } from "./proposal-review-feedback";
import {
  catalogSettingsPermission,
  type CatalogSettingsProposal,
  type CatalogSettingsView,
  type CatalogSettingsAction,
} from "@atria/core/ai/catalog-settings";
const actions: Readonly<Record<CatalogSettingsAction, { commit: string; saved: string }>> = {
  VENDOR_CREATE: { commit: "Buat vendor", saved: "Vendor baru tersimpan." },
  VENDOR_EDIT: { commit: "Simpan koreksi vendor", saved: "Koreksi vendor tersimpan." },
  VENDOR_STATUS: { commit: "Ubah status vendor", saved: "Status vendor diperbarui." },
  LIBRARY_CREATE: { commit: "Buat item library", saved: "Item library baru tersimpan." },
  LIBRARY_EDIT: { commit: "Simpan koreksi item", saved: "Koreksi item library tersimpan." },
  LIBRARY_STATUS: { commit: "Ubah status item", saved: "Status item diperbarui." },
  LIBRARY_ARCHIVE: { commit: "Arsipkan item", saved: "Item library diarsipkan." },
  PRICING_TEMPLATE_SAVE: {
    commit: "Simpan template",
    saved: "Template beserta komponen biaya tersimpan.",
  },
  INVENTORY_DEFAULTS: { commit: "Simpan default", saved: "Default inventory diperbarui." },
  INVENTORY_VALUATION: {
    commit: "Konfirmasi valuasi",
    saved: "Valuasi inventory diperbarui dengan jejak audit.",
  },
};
function cardDescription(action: CatalogSettingsAction): string {
  return action.startsWith("VENDOR_")
    ? "Data vendor untuk transaksi berikutnya; tagihan dan kas tetap."
    : action === "INVENTORY_DEFAULTS"
      ? "Stok minimum dan harga referensi; jumlah stok dan biaya rata-rata tetap."
      : action === "INVENTORY_VALUATION"
        ? "Tinjau perubahan nilai persediaan; jumlah stok, realisasi dan kas tetap."
        : action === "PRICING_TEMPLATE_SAVE"
          ? "Harga dan komponen untuk input berikutnya; RAP/RAB tersimpan tetap."
          : "Referensi library untuk input berikutnya; dokumen proyek tersimpan tetap.";
}
function reviewTitle(action: CatalogSettingsAction, fallback: string): string {
  return action === "LIBRARY_CREATE"
    ? "Item baru"
    : action === "LIBRARY_EDIT"
      ? "Koreksi item"
      : action === "LIBRARY_STATUS"
        ? "Status item"
        : action === "LIBRARY_ARCHIVE"
          ? "Arsip item"
          : action === "INVENTORY_DEFAULTS"
            ? "Default stok"
            : action === "INVENTORY_VALUATION"
              ? "Valuasi stok"
              : fallback;
}
function amount(value: number): React.JSX.Element {
  return <MoneyValue amount={value} variant="fullDynamic" size="sm" align="right" />;
}
function factValue(fact: CatalogSettingsProposal["summary"][number]): React.ReactNode {
  return fact.money && typeof fact.value === "number"
    ? amount(fact.value)
    : typeof fact.value === "number"
      ? fact.value.toLocaleString("id-ID", { maximumFractionDigits: 2 })
      : fact.value;
}
export function CatalogSettingsProposalCard({
  proposal: initial,
  conversationId,
  toolCallId,
  isStreaming,
  isBusy,
  alreadyConfirmed,
  onFollowUp,
}: {
  readonly proposal: CatalogSettingsProposal;
  readonly conversationId: string | null;
  readonly toolCallId: string;
  readonly isStreaming: boolean;
  readonly isBusy: boolean;
  readonly alreadyConfirmed: boolean;
  readonly onFollowUp: (text: string) => void;
}): React.JSX.Element {
  const can = useCan(),
    desktop = useWorkspacePresentation() === "desktop";
  const [view, setView] = React.useState<CatalogSettingsView | null>(null),
    [open, setOpen] = React.useState(false),
    [decision, setDecision] = React.useState(false),
    [page, setPage] = React.useState(0),
    [expanded, setExpanded] = React.useState<string | null>(null),
    [error, setError] = React.useState(""),
    [status, setStatus] = React.useState<"idle" | "submitting" | "submitted" | "failed">("idle");
  const epoch = React.useRef(0),
    inFlight = React.useRef(false);
  const proposal = view?.proposal ?? initial,
    action = {
      ...actions[proposal.action],
      commit:
        proposal.input.action === "VENDOR_STATUS"
          ? proposal.input.isActive
            ? "Aktifkan vendor"
            : "Nonaktifkan vendor"
          : proposal.input.action === "LIBRARY_STATUS"
            ? proposal.input.isActive
              ? "Aktifkan item"
              : "Nonaktifkan item"
            : actions[proposal.action].commit,
    };
  const displayFacts = proposal.summary;
  const flow = proposalReviewFlow(proposal),
    inline = flow.review === "inline";
  const keepReferences =
    proposal.input.action === "LIBRARY_EDIT"
      ? [
          Object.hasOwn(proposal.input.patch, "materialId") ? "Material" : "",
          Object.hasOwn(proposal.input.patch, "expenseCategoryId") ? "Kategori expense" : "",
        ]
      : [];
  const inlineChanges = inlineFactChanges(proposal.rows[0]?.details ?? [], keepReferences);
  const confirmed = alreadyConfirmed || status === "submitted" || view?.status === "CONFIRMED",
    pending = isBusy || status === "submitting",
    stale = view?.status === "STALE" || view?.status === "EXPIRED";
  const permitted = can("use:ai_chat") && can(catalogSettingsPermission(proposal.action));
  const ready = view?.status === "READY" && !confirmed && !isStreaming && !error && permitted;
  const start = Math.min(page * 5, Math.max(0, Math.floor((proposal.rows.length - 1) / 5) * 5)),
    rows = proposal.rows.slice(start, start + 5);
  const refresh = React.useCallback((): Promise<void> => {
    if (!conversationId || isStreaming || inFlight.current) return Promise.resolve();
    const request = ++epoch.current;
    return getAiCatalogSettingsProposal({ conversationId, toolCallId })
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
      const result = await confirmAiCatalogSettingsProposal({ conversationId, toolCallId });
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
      <div className="space-y-1">
        <div className="flex items-center gap-2 px-4 py-3 text-support text-on-surface-variant">
          <AppIcon name="tune" className="icon-sm" />
          <span>{confirmed ? "Hasil tersimpan" : "Hasil yang ditinjau"}</span>
        </div>
        {displayFacts.map((fact, index) => (
          <FactRow
            key={`${fact.label}-${index}`}
            label={fact.label}
            wrapLabel
            value={factValue(fact)}
          />
        ))}
      </div>
    </GroupedSurface>
  );
  const footer = (
    <div className="space-y-3">
      {confirmed ? (
        <ButtonLink fullWidth href="/settings">
          Buka pengaturan
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
          <p className="text-support text-on-surface-variant">{cardDescription(proposal.action)}</p>
        </div>
        {inline && (
          <ProposalInlineReview
            comparisons={[
              ...(proposal.rows[0]?.comparisons.filter(
                (c) => c.before !== c.after || proposal.action === "INVENTORY_VALUATION",
              ) ?? []),
              ...inlineChanges.comparisons,
            ]}
            facts={[
              ...inlineChanges.facts.filter(
                (f) => proposal.action.startsWith("VENDOR_") || f.label.includes("Alasan"),
              ),
              ...proposal.summary.filter(
                (f) =>
                  f.label === "Perubahan nilai" ||
                  (f.label === "Hasil" &&
                    inlineChanges.comparisons.length === 0 &&
                    inlineChanges.facts.length === 0),
              ),
            ]}
            details={
              <div className="divide-y divide-outline-variant/20">
                {proposal.rows[0]?.details.map((f, i) => (
                  <FactRow
                    key={`${f.label}-${i}`}
                    label={f.label}
                    wrapLabel
                    inset={false}
                    value={factValue(f)}
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
          </ProposalInlineReview>
        )}
      </ProposalCardShell>
      <FormSheet
        open={open}
        title={reviewTitle(proposal.action, proposal.title)}
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
                primaryValue={row.amount !== null ? amount(row.amount) : undefined}
                expanded={expanded === row.id}
                onToggle={
                  row.details.length && !proposal.action.startsWith("VENDOR_")
                    ? () => setExpanded((current) => (current === row.id ? null : row.id))
                    : undefined
                }
                editor={
                  row.details.length && !proposal.action.startsWith("VENDOR_") ? (
                    <div className="divide-y divide-outline-variant/20">
                      {row.details.map((fact, index) => (
                        <FactRow
                          key={`${fact.label}-${index}`}
                          label={fact.label}
                          wrapLabel
                          value={factValue(fact)}
                        />
                      ))}
                    </div>
                  ) : undefined
                }
              >
                {proposal.action.startsWith("VENDOR_") && (
                  <div className="divide-y divide-outline-variant/20">
                    {row.details.map((fact, index) => (
                      <FactRow
                        key={`${fact.label}-${index}`}
                        label={fact.label}
                        wrapLabel
                        value={factValue(fact)}
                      />
                    ))}
                  </div>
                )}
                {row.comparisons.length > 0 && (
                  <div className="divide-y divide-outline-variant/20">
                    {row.comparisons.map((comparison) => (
                      <ProposalDiffRow
                        key={comparison.label}
                        label={comparison.label}
                        before={
                          comparison.money
                            ? amount(comparison.before)
                            : comparison.before.toLocaleString("id-ID", {
                                maximumFractionDigits: 2,
                              })
                        }
                        after={
                          comparison.money
                            ? amount(comparison.after)
                            : comparison.after.toLocaleString("id-ID", { maximumFractionDigits: 2 })
                        }
                        layout="inline"
                        inset={false}
                        strikeBefore={false}
                      />
                    ))}
                  </div>
                )}
              </ReviewItem>
            ))}
          </ReviewCollection>
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
          <p>{proposal.effect}</p>
          <div className="divide-y divide-outline-variant/20">
            {displayFacts.map((fact, index) => (
              <FactRow
                key={`${fact.label}-${index}`}
                label={fact.label}
                wrapLabel
                value={factValue(fact)}
              />
            ))}
          </div>
        </div>
      </ConfirmationDialog>
    </>
  );
}
