"use client";
import { proposalReviewFlow } from "../../utils/proposal-review-flow";
import { ProposalInlineReview } from "./proposal-inline-review";
import { ProposalReviewFeedback } from "./proposal-review-feedback";
import * as React from "react";
import {
  getAiRabWorkflowProposal,
  confirmAiRabWorkflowProposal,
} from "@/app/actions/ai/rab-workflow";
import { useCan } from "@/components/auth/permissions-provider";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import {
  Button,
  ButtonLink,
  SheetFooterActions,
  AppIcon,
  FormSheet,
  ConfirmationDialog,
  FormDisclosure,
  GroupedSurface,
  FactRow,
  MoneyValue,
  ReviewCollection,
  ReviewItem,
} from "@/components/ui";
import { ProposalCardShell, ProposalDiffRow } from "./proposal-card-shell";
import { rabLineTotal } from "@atria/core/ai/rab-draft";
import type {
  RabWorkflowProposal,
  RabWorkflowView,
  RabWorkflowLine,
  RabWorkflowRequest,
} from "@atria/core/ai/rab-workflow";
import { rabWorkflowPermission } from "@atria/core/ai/rab-workflow";

const labels: Record<RabWorkflowRequest["action"], { title: string; action: string }> = {
  REFRESH_SOURCES: { title: "Pembaruan sumber RAB", action: "Perbarui sumber RAB" },
  EDIT_DRAFT: { title: "Koreksi RAB", action: "Simpan koreksi RAB" },
  CREATE_BUNDLE: { title: "Paket RAB", action: "Buat paket RAB" },
  UPDATE_BUNDLE: { title: "Koreksi paket RAB", action: "Simpan paket RAB" },
  DISSOLVE_BUNDLE: { title: "Bongkar paket RAB", action: "Bongkar paket" },
  APPROVE_INITIAL: { title: "Persetujuan RAB", action: "Setujui RAB" },
  CREATE_REVISION: { title: "Revisi RAB", action: "Buat Draft revisi" },
  VOID_REVISION: { title: "Pembatalan revisi RAB", action: "Batalkan revisi" },
  CREATE_CHANGE_ORDER: { title: "Draft Change Order", action: "Simpan Draft Change Order" },
  CONFIRM_CLIENT: { title: "Konfirmasi klien", action: "Catat konfirmasi klien" },
  APPROVE_CHANGE_ORDER: { title: "Persetujuan Change Order", action: "Setujui Change Order" },
  REJECT_CHANGE_ORDER: { title: "Penolakan Change Order", action: "Tolak Change Order" },
};
const fieldLabels: Record<keyof RabWorkflowLine, string> = {
  clientLabel: "Nama untuk klien",
  description: "Deskripsi",
  quantity: "Jumlah",
  unit: "Satuan",
  unitPrice: "Harga jual / satuan",
  itemNature: "Jenis baris",
  isHidden: "Tampil pada penawaran",
};
const fieldKeys: readonly (keyof RabWorkflowLine)[] = [
  "clientLabel",
  "description",
  "quantity",
  "unit",
  "unitPrice",
  "itemNature",
  "isHidden",
];
const savedMessages: Record<RabWorkflowRequest["action"], string> = {
  REFRESH_SOURCES: "Sumber tertaut diperbarui; label klien dan paket tetap.",
  EDIT_DRAFT: "Koreksi RAB Draft tersimpan.",
  CREATE_BUNDLE: "Paket dibuat; total penawaran memakai harga paket.",
  UPDATE_BUNDLE: "Paket RAB sudah diperbarui.",
  DISSOLVE_BUNDLE: "Paket dibongkar; anggota kembali menjadi baris tersendiri.",
  APPROVE_INITIAL: "RAB awal disetujui. Nilai kontrak dan budget yang tersedia telah diperbarui.",
  CREATE_REVISION: "Draft revisi dibuat. Koreksi lalu siapkan Change Order; baseline tetap utuh.",
  VOID_REVISION: "Revisi dibatalkan; baseline tetap digunakan.",
  CREATE_CHANGE_ORDER:
    "Draft Change Order tersimpan. Catat bukti persetujuan klien sebelum keputusan internal.",
  CONFIRM_CLIENT: "Bukti persetujuan klien tercatat; menunggu keputusan pemeriksa.",
  APPROVE_CHANGE_ORDER: "Change Order disetujui; revisi menjadi baseline baru.",
  REJECT_CHANGE_ORDER:
    "Change Order ditolak. Koreksi Draft, perbarui Change Order dan catat konfirmasi klien baru.",
};
function money(amount: number, align: "left" | "right" = "right"): React.JSX.Element {
  return <MoneyValue amount={amount} variant="fullDynamic" size="sm" align={align} />;
}
function fieldValue(row: RabWorkflowLine, key: keyof RabWorkflowLine): React.ReactNode {
  if (key === "unitPrice") return money(row.unitPrice, "left");
  if (key === "quantity") return `${row.quantity.toLocaleString("id-ID")} ${row.unit}`;
  if (key === "isHidden") return row.isHidden ? "Tidak" : "Ya";
  if (key === "itemNature") return row.itemNature === "SERVICE_FEE" ? "Biaya jasa" : "Produksi";
  return row[key] || "—";
}
export function RabWorkflowProposalCard({
  proposal: initial,
  conversationId,
  toolCallId,
  isStreaming,
  isBusy,
  alreadyConfirmed,
  onFollowUp,
}: {
  readonly proposal: RabWorkflowProposal;
  readonly conversationId: string | null;
  readonly toolCallId: string;
  readonly isStreaming: boolean;
  readonly isBusy: boolean;
  readonly alreadyConfirmed: boolean;
  readonly onFollowUp: (text: string) => void;
}): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop",
    can = useCan();
  const [view, setView] = React.useState<RabWorkflowView | null>(null),
    [open, setOpen] = React.useState(false),
    [decision, setDecision] = React.useState(false),
    [anchor, setAnchor] = React.useState(0),
    [expanded, setExpanded] = React.useState<string | null>(null),
    [details, setDetails] = React.useState(false),
    [error, setError] = React.useState(""),
    [status, setStatus] = React.useState<"idle" | "submitting" | "submitted" | "failed">("idle");
  const inFlight = React.useRef(false),
    epoch = React.useRef(0);
  const proposal = view?.proposal ?? initial,
    request = proposal.request,
    label = labels[request.action];
  const flow = proposalReviewFlow(proposal),
    inline = flow.review === "inline";
  const confirmed = alreadyConfirmed || status === "submitted" || view?.status === "CONFIRMED",
    pending = status === "submitting" || isBusy;
  const ready =
      view?.status === "READY" &&
      !confirmed &&
      !isStreaming &&
      can("use:ai_chat") &&
      can("view:rab") &&
      can(rabWorkflowPermission(request)),
    stale = view?.status === "STALE" || view?.status === "EXPIRED";
  const approval =
      request.action === "APPROVE_INITIAL" || request.action === "APPROVE_CHANGE_ORDER",
    destructive =
      request.action === "DISSOLVE_BUNDLE" ||
      request.action === "VOID_REVISION" ||
      request.action === "REJECT_CHANGE_ORDER" ||
      (request.action === "EDIT_DRAFT" && request.rows.some((row) => row.action === "EXCLUDE"));
  const protectedDecision = approval || destructive || request.action === "CONFIRM_CLIENT";
  const start = Math.min(
      Math.floor(anchor / 5) * 5,
      Math.max(0, Math.floor((proposal.rows.length - 1) / 5) * 5),
    ),
    rows = proposal.rows.slice(start, start + 5);
  const impact = can("view:budget") ? proposal.budgetImpact : null;
  const budgetRisks =
    impact?.categories.filter((category) => category.after < category.actual) ?? [];
  const budgetRiskVerdict =
    budgetRisks.length > 0 ? (
      <div className="space-y-2 px-4 py-3" role="note" aria-label="Risiko alokasi budget">
        <p className="flex items-start gap-2 text-support font-semibold text-critical">
          <AppIcon name="warning" className="icon-sm shrink-0" />
          Alokasi di bawah realisasi
        </p>
        {budgetRisks.map((category) => (
          <div
            key={category.name}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-support"
          >
            <span>{category.name} · kekurangan</span>
            {money(category.actual - category.after)}
          </div>
        ))}
      </div>
    ) : null;
  const refresh = React.useCallback((): Promise<void> => {
    if (!conversationId || isStreaming || inFlight.current) return Promise.resolve();
    const id = ++epoch.current;
    return getAiRabWorkflowProposal({ conversationId, toolCallId })
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
    const requests = epoch;
    void refresh();
    return () => {
      requests.current++;
    };
  }, [refresh]);
  async function confirm(): Promise<void> {
    if (!conversationId || !ready || pending || inFlight.current) return;
    inFlight.current = true;
    epoch.current++;
    setStatus("submitting");
    setError("");
    try {
      const result = await confirmAiRabWorkflowProposal({ conversationId, toolCallId });
      if (result.success) {
        setStatus("submitted");
        setDecision(false);
        setView({ proposal, status: "CONFIRMED", resultId: result.data.resultId });
      } else {
        setStatus("failed");
        setError(result.error.message);
        if (result.error.code === "CONFLICT")
          setView({ proposal, status: "STALE", resultId: null });
      }
    } catch {
      setStatus("failed");
      setError("Tindakan belum tersimpan. Coba lagi; konfirmasi yang sama aman diulang.");
    } finally {
      inFlight.current = false;
    }
  }
  async function act(): Promise<void> {
    if (!ready || pending) return;
    if (protectedDecision) setDecision(true);
    else await confirm();
  }
  const summary = (
    <GroupedSurface>
      <div className="divide-y divide-outline-variant/20">
        {budgetRiskVerdict}
        {!impact && (
          <FactRow
            label="Penawaran setelah tindakan"
            wrapLabel
            value={money(proposal.totalAfter)}
          />
        )}
        {!impact && proposal.totalBefore !== proposal.totalAfter && (
          <FactRow label="Sebelumnya" value={money(proposal.totalBefore)} />
        )}
        <FactRow label="Revisi RAB" value={proposal.revision} />
        {impact && (
          <>
            <FactRow
              label="Nilai kontrak setelah persetujuan"
              wrapLabel
              value={money(impact.contractAfter)}
            />
            <FactRow
              label="Plafon internal setelah persetujuan"
              wrapLabel
              value={money(impact.capAfter)}
            />
          </>
        )}
      </div>
    </GroupedSurface>
  );
  const footer = (
    <div className="space-y-3">
      {confirmed ? (
        <ButtonLink href={`/projects/${proposal.projectId}?tab=rab`} fullWidth>
          Buka RAB proyek
        </ButtonLink>
      ) : (
        <SheetFooterActions
          layout="adaptive"
          desktopStacked={!inline}
          primaryFirst={!inline}
          primary={{
            label: label.action,
            disabled: !ready || pending,
            pending,
            pendingLabel: "Menyimpan…",
            variant: destructive ? "critical" : "primary",
            onClick: act,
          }}
          secondary={{
            label: stale ? "Minta usulan terbaru" : "Koreksi lewat chat",
            variant: "quiet",
            disabled: pending,
            onClick: () =>
              stale
                ? onFollowUp(
                    `Siapkan usulan terbaru untuk ${label.title} pada ${proposal.projectName}, ${proposal.title}. Periksa data RAB dan Change Order terbaru.`,
                  )
                : onFollowUp(
                    `Bantu koreksi usulan ${label.title} untuk ${proposal.projectName}, ${proposal.title}. Tanyakan bagian yang ingin saya ubah sebelum menyiapkan usulan baru.`,
                  ),
          }}
        />
      )}
      {!error && (
        <p role="status" className="text-meta text-on-surface-variant">
          {confirmed
            ? `${savedMessages[request.action]} Stok dan kas tetap.`
            : stale
              ? "Data berubah atau usulan kedaluwarsa. Periksa usulan terbaru."
              : "Perubahan berlaku setelah konfirmasi. Stok dan kas tetap."}
        </p>
      )}
    </div>
  );
  const confirmationTitle =
    request.action === "CONFIRM_CLIENT"
      ? "Catat persetujuan klien?"
      : approval
        ? "Terapkan persetujuan RAB?"
        : "Terapkan perubahan ini?";
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
        onConfirm={act}
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
            {proposal.title} · revisi {proposal.revision}
          </p>
          <div className="flex items-center justify-between gap-3">
            <span className="text-support">{proposal.rows.length} bagian ditinjau</span>
            {money(proposal.totalAfter)}
          </div>
        </div>
        {inline && (
          <ProposalInlineReview
            comparisons={[
              ...(proposal.totalBefore !== proposal.totalAfter
                ? [
                    {
                      label: "Nilai RAB",
                      before: proposal.totalBefore,
                      after: proposal.totalAfter,
                      money: true,
                    },
                  ]
                : []),
              ...(impact
                ? [
                    {
                      label: "Nilai kontrak",
                      before: impact.contractBefore,
                      after: impact.contractAfter,
                      money: true,
                    },
                    {
                      label: "Plafon internal",
                      before: impact.capBefore,
                      after: impact.capAfter,
                      money: true,
                    },
                  ]
                : []),
            ]}
            facts={[
              { label: "Revisi RAB", value: proposal.revision },
              ...(request.action === "CONFIRM_CLIENT"
                ? [
                    {
                      label: "Tanggal persetujuan klien",
                      value: new Date(request.confirmedAt).toLocaleString("id-ID"),
                    },
                    { label: "Bukti persetujuan", value: request.confirmationReference },
                  ]
                : []),
              ...("reason" in request && request.reason
                ? [{ label: "Alasan", value: request.reason }]
                : []),
            ]}
            details={
              impact ? (
                <div className="divide-y divide-outline-variant/20">
                  {impact.categories.map((c) => (
                    <div key={c.name}>
                      <ProposalDiffRow
                        label={`Alokasi ${c.name}`}
                        before={money(c.before)}
                        after={money(c.after)}
                        layout="inline"
                        inset={false}
                        strikeBefore={false}
                      />
                      <FactRow label="Realisasi tetap" wrapLabel value={money(c.actual)} />
                    </div>
                  ))}
                </div>
              ) : undefined
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
            <div className="divide-y divide-outline-variant/20">
              {proposal.rows.map((row) => (
                <div key={row.id} className="py-2">
                  <p className="text-row font-semibold">{row.title}</p>
                  {row.detail && (
                    <p className="text-support text-on-surface-variant">{row.detail}</p>
                  )}
                  {row.beforeState !== null && row.afterState !== null && (
                    <ProposalDiffRow
                      label="Hasil tindakan"
                      before={row.beforeState}
                      after={row.afterState}
                      layout="inline"
                      inset={false}
                      strikeBefore={false}
                    />
                  )}{" "}
                  {row.before &&
                    row.after &&
                    fieldKeys
                      .filter((key) => row.before?.[key] !== row.after?.[key])
                      .map((key) => (
                        <ProposalDiffRow
                          key={key}
                          label={fieldLabels[key]}
                          before={row.before ? fieldValue(row.before, key) : "—"}
                          after={row.after ? fieldValue(row.after, key) : "—"}
                          layout="inline"
                          inset={false}
                          strikeBefore={false}
                        />
                      ))}
                </div>
              ))}
            </div>
          </ProposalInlineReview>
        )}
      </ProposalCardShell>
      <FormSheet
        open={open}
        title={`Review ${label.title}`}
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
            <p className="text-support text-on-surface-variant">{proposal.title}</p>
          </div>
          {error && (
            <ProposalReviewFeedback
              message={error}
              recovery={
                !stale && !confirmed
                  ? {
                      label: "Periksa lagi",
                      disabled: pending,
                      onClick: () => void refresh(),
                    }
                  : undefined
              }
            />
          )}
          {!desktop && summary}
          {proposal.warning && (
            <p className="text-support text-on-surface-variant">{proposal.warning}</p>
          )}
          <ReviewCollection ariaLabel="Perubahan RAB yang ditinjau">
            {rows.map((row) => {
              const fields = row.after ?? row.before;
              const differences =
                row.before && row.after
                  ? fieldKeys.filter((key) => row.before?.[key] !== row.after?.[key])
                  : [];
              return (
                <ReviewItem
                  key={row.id}
                  title={row.title}
                  meta={[row.action, fields?.unit].filter(Boolean).join(" · ")}
                  primaryValue={
                    fields ? money(row.after?.isHidden ? 0 : rabLineTotal(fields)) : undefined
                  }
                  summary={
                    fields
                      ? `${fields.quantity.toLocaleString("id-ID")} ${fields.unit}${fields.isHidden ? " · tidak ditampilkan" : ""}`
                      : undefined
                  }
                  expanded={expanded === row.id}
                  onToggle={
                    fields ? () => setExpanded((id) => (id === row.id ? null : row.id)) : undefined
                  }
                  editor={
                    fields ? (
                      <div className="divide-y divide-outline-variant/20">
                        {fieldKeys.map((key) => (
                          <FactRow
                            key={key}
                            label={fieldLabels[key]}
                            wrapLabel
                            value={fieldValue(fields, key)}
                          />
                        ))}
                      </div>
                    ) : undefined
                  }
                >
                  {row.beforeState !== null && row.afterState !== null && (
                    <ProposalDiffRow
                      inset={false}
                      label="Hasil tindakan"
                      before={row.beforeState}
                      after={row.afterState}
                      layout={desktop ? "stacked" : "vertical"}
                    />
                  )}
                  {differences.map((key) =>
                    row.before && row.after ? (
                      <ProposalDiffRow
                        inset={false}
                        key={key}
                        label={fieldLabels[key]}
                        before={fieldValue(row.before, key)}
                        after={fieldValue(row.after, key)}
                        layout={desktop ? "stacked" : "vertical"}
                      />
                    ) : null,
                  )}
                  {row.detail && (
                    <p className="text-support wrap-anywhere whitespace-pre-wrap text-on-surface-variant">
                      {row.detail}
                    </p>
                  )}
                </ReviewItem>
              );
            })}
          </ReviewCollection>
          {proposal.rows.length > 5 && (
            <nav
              aria-label="Halaman perubahan RAB"
              className="flex items-center justify-between gap-2"
            >
              <Button
                variant="secondary"
                size="compact"
                disabled={start === 0 || pending}
                onClick={() => setAnchor(start - 5)}
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
                onClick={() => setAnchor(start + 5)}
              >
                Berikutnya
              </Button>
            </nav>
          )}
          {impact && (
            <GroupedSurface>
              <div className="px-4">
                <FormDisclosure
                  title="Rincian dampak budget"
                  variant="plain"
                  expanded={details}
                  onToggle={() => setDetails((value) => !value)}
                >
                  <div className="divide-y divide-outline-variant/20">
                    <ProposalDiffRow
                      inset={false}
                      label="Nilai kontrak"
                      before={money(impact.contractBefore, "left")}
                      after={money(impact.contractAfter, "left")}
                      layout={desktop ? "stacked" : "vertical"}
                    />
                    <ProposalDiffRow
                      inset={false}
                      label="Plafon internal"
                      before={money(impact.capBefore, "left")}
                      after={money(impact.capAfter, "left")}
                      layout={desktop ? "stacked" : "vertical"}
                    />
                    {impact.categories.map((category) => (
                      <div key={category.name}>
                        <ProposalDiffRow
                          inset={false}
                          label={`${category.name}${category.manual ? " · alokasi manual dipertahankan" : ""}`}
                          before={money(category.before, "left")}
                          after={money(category.after, "left")}
                          layout={desktop ? "stacked" : "vertical"}
                        />
                        <FactRow
                          label="Realisasi tetap"
                          inset={false}
                          value={money(category.actual)}
                        />
                        {category.after < category.actual && (
                          <p className="pb-3 text-support text-critical">
                            Alokasi baru di bawah realisasi.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </FormDisclosure>
              </div>
            </GroupedSurface>
          )}
          {(request.action === "CREATE_REVISION" ||
            request.action === "CREATE_CHANGE_ORDER" ||
            request.action === "APPROVE_CHANGE_ORDER" ||
            request.action === "CONFIRM_CLIENT") && (
            <GroupedSurface>
              <div className="divide-y divide-outline-variant/20">
                {"reason" in request && request.reason && (
                  <div className="px-4 py-3">
                    <p className="text-support font-semibold">
                      {request.action === "CREATE_REVISION" ? "Alasan revisi" : "Alasan"}
                    </p>
                    <p className="mt-1 text-support wrap-anywhere whitespace-pre-wrap text-on-surface-variant">
                      {request.reason}
                    </p>
                  </div>
                )}
                {request.action === "CREATE_CHANGE_ORDER" && (
                  <div className="px-4 py-3">
                    <p className="text-support font-semibold">Ringkasan lingkup</p>
                    <p className="mt-1 text-support wrap-anywhere whitespace-pre-wrap text-on-surface-variant">
                      {request.scopeSummary}
                    </p>
                  </div>
                )}
                {request.action === "CONFIRM_CLIENT" && (
                  <>
                    <FactRow
                      label="Tanggal konfirmasi klien"
                      wrapLabel
                      value={new Date(request.confirmedAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        timeZone: "Asia/Jakarta",
                      })}
                    />
                    <FactRow
                      label="Bukti / referensi"
                      wrapLabel
                      value={request.confirmationReference}
                    />
                  </>
                )}
              </div>
            </GroupedSurface>
          )}
        </div>
      </FormSheet>
      <ConfirmationDialog
        actionLayout="adaptive"
        open={decision && (inline || open)}
        title={confirmationTitle}
        description={proposal.warning ?? "Terapkan tepat perubahan yang ditinjau pada RAB ini."}
        confirmLabel={label.action}
        danger={destructive}
        pending={pending}
        onClose={() => {
          if (!inFlight.current) setDecision(false);
        }}
        onConfirm={() => void confirm()}
      >
        <div className="space-y-2">
          {budgetRiskVerdict && <GroupedSurface>{budgetRiskVerdict}</GroupedSurface>}
          <FactRow
            label="Penawaran setelah tindakan"
            wrapLabel
            value={money(proposal.totalAfter)}
          />
          {impact && (
            <>
              <FactRow
                label="Nilai kontrak setelah persetujuan"
                wrapLabel
                value={money(impact.contractAfter)}
              />
              <FactRow label="Plafon internal" wrapLabel value={money(impact.capAfter)} />
            </>
          )}
          {request.action === "APPROVE_CHANGE_ORDER" && request.emergencyOverride && (
            <p className="text-support text-critical">
              Override diminta secara eksplisit dengan alasan: {request.reason}
            </p>
          )}
        </div>
      </ConfirmationDialog>
    </>
  );
}
