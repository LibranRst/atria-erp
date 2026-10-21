"use client";
import * as React from "react";
import {
  getAiAdministrationProposal,
  confirmAiAdministrationProposal,
} from "@/app/actions/ai/administration";
import { useCan } from "@/components/auth/permissions-provider";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import {
  AppIcon,
  Button,
  ButtonLink,
  FactRow,
  FormSheet,
  ConfirmationDialog,
  GroupedSurface,
  ReviewCollection,
  ReviewItem,
  SheetFooterActions,
} from "@/components/ui";
import {
  administrationPermission,
  type AdministrationProposal,
  type AdministrationView,
} from "@atria/core/ai/administration";
import { ProposalCardShell, ProposalDiffRow } from "./proposal-card-shell";
import type { InlineProposalComparison } from "./proposal-inline-review";
import { ProposalReviewFeedback } from "./proposal-review-feedback";
import { proposalReviewFlow } from "../../utils/proposal-review-flow";
/** Inherited Atria Operate: immutable people/access review, shared focus/motion and explicit human commit. */
export function AdministrationProposalCard({
  proposal: initial,
  conversationId,
  toolCallId,
  isStreaming,
  isBusy,
  alreadyConfirmed,
  onFollowUp,
}: {
  readonly proposal: AdministrationProposal;
  readonly conversationId: string | null;
  readonly toolCallId: string;
  readonly isStreaming: boolean;
  readonly isBusy: boolean;
  readonly alreadyConfirmed: boolean;
  readonly onFollowUp: (text: string) => void;
}): React.JSX.Element {
  const can = useCan(),
    desktop = useWorkspacePresentation() === "desktop";
  const [view, setView] = React.useState<AdministrationView | null>(null),
    [open, setOpen] = React.useState(false),
    [decision, setDecision] = React.useState(false),
    [page, setPage] = React.useState(0),
    [error, setError] = React.useState(""),
    [denied, setDenied] = React.useState(false),
    [status, setStatus] = React.useState<"idle" | "submitting" | "submitted" | "failed">("idle");
  const epoch = React.useRef(0),
    inFlight = React.useRef(false);
  const proposal = view?.proposal ?? initial,
    input = proposal.input,
    flow = proposalReviewFlow(proposal),
    inline = flow.review === "inline",
    deleting = input.action === "ROLE_DELETE";
  const confirmed = alreadyConfirmed || status === "submitted" || view?.status === "CONFIRMED",
    stale = view?.status === "STALE" || view?.status === "EXPIRED",
    pending = isBusy || status === "submitting";
  const readable = can(administrationPermission(input)) && !denied,
    permitted = readable && can("use:ai_chat"),
    ready = permitted && view?.status === "READY" && !confirmed && !isStreaming && !error;
  const action = deleting
    ? "Hapus peran"
    : input.action === "ROLE_DETAILS"
      ? "Simpan detail peran"
      : proposal.rows.length === 1 &&
          proposal.rows[0].changes.length === 1 &&
          proposal.rows[0].changes[0].label === "Status akun"
        ? proposal.rows[0].changes[0].after === "Aktif"
          ? "Aktifkan staf"
          : "Nonaktifkan staf"
        : `Simpan perubahan${proposal.rows.length > 1 ? ` ${proposal.rows.length} staf` : " staf"}`;
  const href =
    input.action === "STAFF_CHANGES"
      ? "/settings?tab=organization&admin=team"
      : "/settings?tab=organization&admin=roles";
  const refresh = React.useCallback((): Promise<void> => {
    if (!conversationId || isStreaming || inFlight.current) return Promise.resolve();
    const request = ++epoch.current;
    return getAiAdministrationProposal({ conversationId, toolCallId })
      .then((r) => {
        if (request !== epoch.current) return;
        if (r.success) {
          setView(r.data);
          setError("");
          setDenied(false);
        } else {
          setError(r.error.message);
          setDenied(["FORBIDDEN", "NOT_FOUND", "UNAUTHORIZED"].includes(r.error.code));
        }
      })
      .catch(() => {
        if (request === epoch.current) setError("Usulan belum dapat diperiksa. Coba periksa lagi.");
      });
  }, [conversationId, toolCallId, isStreaming]);
  React.useEffect(() => {
    void refresh();
    const request = epoch;
    return () => {
      request.current++;
    };
  }, [refresh]);
  async function save(): Promise<void> {
    if (!conversationId || !ready || pending || inFlight.current) return;
    inFlight.current = true;
    epoch.current++;
    setStatus("submitting");
    setError("");
    try {
      const r = await confirmAiAdministrationProposal({ conversationId, toolCallId });
      if (r.success) {
        setStatus("submitted");
        setOpen(false);
        setDecision(false);
      } else {
        setStatus("failed");
        setError(r.error.message);
        setDenied(["FORBIDDEN", "NOT_FOUND", "UNAUTHORIZED"].includes(r.error.code));
        setDecision(false);
        if (r.error.code === "CONFLICT") setView((v) => (v ? { ...v, status: "STALE" } : v));
      }
    } catch {
      setStatus("failed");
      setError("Hasil penyimpanan belum dapat dipastikan. Periksa lagi sebelum mengulang.");
      setDecision(false);
    } finally {
      inFlight.current = false;
    }
  }
  const feedback =
    error || stale ? (
      <ProposalReviewFeedback
        embedded
        message={error || "Data atau usulan berubah. Minta preview terbaru sebelum menyimpan."}
        recovery={
          error && !stale && !confirmed
            ? { label: "Periksa lagi", disabled: pending, onClick: () => void refresh() }
            : undefined
        }
      />
    ) : null;
  const facts = (items: AdministrationProposal["summary"]): React.JSX.Element => (
    <div className="divide-y divide-outline-variant/20">
      {items.map((f, i) => (
        <FactRow
          key={`${f.label}-${i}`}
          label={f.label}
          value={
            <span className="wrap-anywhere">
              {typeof f.value === "number" ? f.value.toLocaleString("id-ID") : f.value}
            </span>
          }
        />
      ))}
    </div>
  );
  const changes = (row: AdministrationProposal["rows"][number]): InlineProposalComparison[] =>
    row.changes.map((c) => ({
      ...c,
      ...(c.before.length > 40 || c.after.length > 40
        ? { layout: desktop ? "stacked" : "vertical" }
        : {}),
    }));
  const rowContent = (
    row: AdministrationProposal["rows"][number],
    inset = true,
  ): React.JSX.Element => (
    <div className={inset ? "px-4" : undefined}>
      <div className="divide-y divide-outline-variant/20">
        {changes(row).map((c) => (
          <ProposalDiffRow
            key={c.label}
            label={c.label}
            before={c.before}
            after={c.after}
            layout={c.layout ?? "inline"}
            inset={false}
            strikeBefore={false}
          />
        ))}
        {row.facts
          .filter((f) => f.label !== "Proyek tetap terkait" || f.value !== 0)
          .map((f, i) => (
            <FactRow
              key={`${f.label}-${i}`}
              label={f.label}
              inset={false}
              value={typeof f.value === "number" ? f.value.toLocaleString("id-ID") : f.value}
            />
          ))}
      </div>
      {(row.added.length > 0 || row.removed.length > 0) && (
        <div className="space-y-3 py-3">
          {row.added.length > 0 && (
            <div className="space-y-1">
              <p className="text-support font-semibold">Akses ditambahkan</p>
              <ul className="list-disc space-y-1 pl-4 text-support text-on-surface-variant">
                {row.added.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </div>
          )}
          {row.removed.length > 0 && (
            <div className="space-y-1">
              <p className="text-support font-semibold">
                {deleting ? "Izin pada peran yang dihapus" : "Akses dihentikan"}
              </p>
              <ul className="list-disc space-y-1 pl-4 text-support text-on-surface-variant">
                {row.removed.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
  const summary = readable ? <GroupedSurface>{facts(proposal.summary)}</GroupedSurface> : null;
  const footer = (
    <div className="space-y-3">
      {confirmed ? (
        <ButtonLink fullWidth href={href}>
          Buka pengaturan
        </ButtonLink>
      ) : (
        <SheetFooterActions
          layout="adaptive"
          desktopStacked={!inline}
          primaryFirst={!inline}
          primary={{
            label: action,
            variant: deleting ? "critical" : "primary",
            pending: status === "submitting",
            pendingLabel: deleting ? "Menghapus…" : "Menyimpan…",
            disabled: !ready || pending,
            onClick: () => (flow.confirmation === "dialog" ? setDecision(true) : void save()),
          }}
          secondary={{
            label: stale ? "Minta preview terbaru" : "Koreksi lewat chat",
            variant: "quiet",
            disabled: pending || !readable,
            onClick: () => {
              setOpen(false);
              onFollowUp(
                `Periksa sumber administrasi terbaru lalu ${stale ? "buat ulang preview" : "bantu koreksi"} ${proposal.title} untuk ${proposal.entityName}. Tanyakan bagian yang ingin diubah; jangan simpan tanpa tombol konfirmasi.`,
              );
            },
          }}
        />
      )}
      <p role="status" className="text-meta text-on-surface-variant">
        {!readable
          ? "Periksa akses administrasi sebelum melanjutkan."
          : confirmed
            ? deleting
              ? "Peran tidak terpakai dihapus dengan audit; akun dan riwayat bisnis tetap."
              : "Perubahan administrasi tersimpan dengan audit; riwayat bisnis tetap."
            : proposal.effect}
      </p>
    </div>
  );
  const start = Math.min(page * 5, Math.max(0, Math.floor((proposal.rows.length - 1) / 5) * 5)),
    rows = proposal.rows.slice(start, start + 5);
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
        <div className="space-y-1 px-4 py-3">
          <p className="text-row font-semibold">
            {readable ? proposal.entityName : "Data administrasi tidak tersedia"}
          </p>
          {readable && inline && proposal.rows[0]?.meta && (
            <p className="text-support text-on-surface-variant">{proposal.rows[0].meta}</p>
          )}
          {readable && (
            <p className="text-support text-on-surface-variant">Alasan: {input.reason}</p>
          )}
        </div>
        <div className="px-4 pb-3">{feedback}</div>
        {readable &&
          (inline ? (
            <div>
              {proposal.rows.map((r) => (
                <React.Fragment key={r.id}>{rowContent(r)}</React.Fragment>
              ))}
            </div>
          ) : (
            facts(proposal.summary)
          ))}
      </ProposalCardShell>
      <FormSheet
        open={open}
        title={
          input.action === "STAFF_CHANGES"
            ? "Review staf"
            : deleting
              ? "Hapus peran"
              : "Review peran"
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
          <div className="space-y-1">
            <p className="text-section-title font-semibold">
              {readable ? proposal.entityName : "Data administrasi tidak tersedia"}
            </p>
            {readable && (
              <>
                <p className="text-support text-on-surface-variant">{proposal.effect}</p>
                <p className="text-support text-on-surface-variant">Alasan: {input.reason}</p>
              </>
            )}
          </div>
          {feedback && <GroupedSurface>{feedback}</GroupedSurface>}
          {!desktop && summary}
          {readable && (
            <ReviewCollection ariaLabel="Perubahan yang ditinjau">
              {rows.map((r) => (
                <ReviewItem key={r.id} title={r.title} meta={r.meta}>
                  {rowContent(r, false)}
                </ReviewItem>
              ))}
            </ReviewCollection>
          )}
          {readable && proposal.rows.length > 5 && (
            <nav
              aria-label="Halaman administrasi"
              className="flex items-center justify-between gap-3"
            >
              <Button
                variant="quiet"
                size="compact"
                disabled={start === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
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
                onClick={() => setPage((p) => p + 1)}
              >
                Berikutnya
              </Button>
            </nav>
          )}
        </div>
      </FormSheet>
      <ConfirmationDialog
        tone={deleting ? "danger" : "default"}
        actionLayout="adaptive"
        open={decision && !confirmed}
        title={action}
        description={
          readable
            ? proposal.effect
            : "Akses administrasi tidak tersedia. Periksa izin sebelum melanjutkan."
        }
        confirmLabel={action}
        pending={pending}
        disabled={!ready || pending}
        onClose={() => {
          if (!inFlight.current) setDecision(false);
        }}
        onConfirm={() => void save()}
      >
        <p className="mb-3 text-row font-semibold">
          {readable ? proposal.entityName : "Data administrasi tidak tersedia"}
        </p>
        {readable && (
          <>
            {inline && proposal.rows.map((r) => <div key={r.id}>{rowContent(r)}</div>)}
            {!inline && facts(proposal.summary)}
            <FactRow label="Alasan" value={<span className="wrap-anywhere">{input.reason}</span>} />
          </>
        )}
      </ConfirmationDialog>
    </>
  );
}
