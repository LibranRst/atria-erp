"use client";
/** THESIS: show which bank mutations will be imported or matched before explicit approval.
 * OWN-WORLD: inherited Atria Manrope, cool canvas, white divided review owners and quiet capsules.
 * STORY: choose account → review mutations/candidates → apply corrections → confirm → receipt.
 * FIRST VIEWPORT: bank identity and counts in card; retained desktop rows left, summary/actions right; mobile summary first.
 * FORM: local extension of approved AI review family, no concept roll; shared card, fields, review list and overlay owners.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
 */
import * as React from "react";
import {
  AdaptiveSelect,
  Button,
  ButtonLink,
  ChoiceRow,
  ConfirmationDialog,
  DatePickerField,
  FactRow,
  FormField,
  FormSection,
  FormSheet,
  GroupedSurface,
  MoneyInput,
  MoneyValue,
  ReviewCollection,
  ReviewItem,
  SheetFooterActions,
  TextInput,
} from "@/components/ui";
import { useCan } from "@/components/auth/permissions-provider";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import {
  getAiReconciliationProposal,
  patchAiReconciliationProposal,
  confirmAiReconciliationProposal,
  discardAiReconciliationProposal,
} from "@/app/actions/ai/bank-reconciliation";
import {
  reconciliationPayloadSchema,
  type ReconciliationPayload,
  type ReconciliationProposal,
  type ReconciliationView,
} from "@atria/core/ai/bank-reconciliation";
import { ProposalCardShell, ProposalDiffRow } from "./proposal-card-shell";
import { ProposalReviewFeedback } from "./proposal-review-feedback";
type ReviewRows = ReconciliationPayload["rows"];
type Edit = {
  rowId: string;
  date: string;
  description: string;
  amount: string;
  type: "INFLOW" | "OUTFLOW";
};
const money = (amount: number): React.JSX.Element => (
  <MoneyValue amount={amount} variant="fullDynamic" />
);
const date = (value: string): string =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(
    new Date(value),
  );
export function ReconciliationWorkflowCard({
  proposal: initial,
  conversationId,
  toolCallId,
  isStreaming,
  isBusy,
  alreadyConfirmed,
  onFollowUp,
}: {
  readonly proposal: ReconciliationProposal;
  readonly conversationId: string | null;
  readonly toolCallId: string;
  readonly isStreaming: boolean;
  readonly isBusy: boolean;
  readonly alreadyConfirmed: boolean;
  readonly onFollowUp: (text: string) => void;
}): React.JSX.Element {
  const can = useCan(),
    desktop = useWorkspacePresentation() === "desktop";
  const [view, setView] = React.useState<ReconciliationView | null>(null),
    [open, setOpen] = React.useState(false),
    [decision, setDecision] = React.useState(false),
    [discard, setDiscard] = React.useState(false),
    [error, setError] = React.useState(""),
    [denied, setDenied] = React.useState(false),
    [operation, setOperation] = React.useState<"idle" | "apply" | "save">("idle"),
    [local, setLocal] = React.useState<ReviewRows | null>(null),
    [edit, setEdit] = React.useState<Edit | null>(null),
    [expanded, setExpanded] = React.useState<string | null>(null),
    [page, setPage] = React.useState(0);
  const epoch = React.useRef(0),
    inFlight = React.useRef(false),
    savingSelection = React.useRef(false),
    intent = React.useRef<ReviewRows | null>(null),
    current = React.useRef<ReconciliationView | null>(null);
  const proposal = view?.proposal ?? initial,
    action = proposal.input.action,
    list = action === "IMPORT" || action === "MATCH",
    inline = !list || proposal.rows.length === 1;
  const confirmed = alreadyConfirmed || view?.status === "CONFIRMED",
    closed = view?.status === "DISCARDED",
    permitted =
      can("use:ai_chat") && can("view:bank_account") && can("reconcile:ledger") && !denied;
  const pending = operation !== "idle" || isBusy,
    ready =
      view?.status === "READY" &&
      !isStreaming &&
      !confirmed &&
      !closed &&
      permitted &&
      !error &&
      !proposal.warning;
  const rows =
      local ??
      proposal.rows.map((r) => ({
        rowId: r.rowId,
        selected: r.selected,
        mutation: r.mutation,
        chosenCashId: r.chosenCashId,
      })),
    selected = rows.filter((r) => r.selected),
    start = Math.min(page * 5, Math.max(0, Math.floor((rows.length - 1) / 5) * 5)),
    visible = proposal.rows.slice(start, start + 5);
  const label =
    action === "IMPORT"
      ? `Impor ${selected.length} mutasi`
      : action === "MATCH"
        ? `Cocokkan ${selected.length} pasangan`
        : action === "MARK_EXCEPTION"
          ? "Simpan pengecualian"
          : "Hapus pengecualian";
  const usable = new Set<string>(),
    usedCash = new Set<string>();
  for (const row of [...rows].sort((a, b) => Number(b.selected) - Number(a.selected))) {
    const source = proposal.rows.find((s) => s.rowId === row.rowId)!;
    if (action === "IMPORT" && !source.duplicate) usable.add(row.rowId);
    if (action === "MATCH" && row.chosenCashId && !usedCash.has(row.chosenCashId)) {
      usable.add(row.rowId);
      usedCash.add(row.chosenCashId);
    }
  }
  const allUsableSelected =
    usable.size > 0 && rows.filter((r) => usable.has(r.rowId)).every((r) => r.selected);
  const applyView = (next: ReconciliationView): void => {
    current.current = next;
    setView(next);
  };
  const refresh = React.useCallback(async (): Promise<void> => {
    if (!conversationId || isStreaming || inFlight.current || savingSelection.current) return;
    const request = ++epoch.current;
    try {
      const r = await getAiReconciliationProposal({ conversationId, toolCallId });
      if (request !== epoch.current) return;
      if (r.success) {
        current.current = r.data;
        setView(r.data);
        setError("");
        setDenied(false);
      } else {
        setError(r.error.message);
        setDenied(["FORBIDDEN", "NOT_FOUND", "UNAUTHORIZED"].includes(r.error.code));
      }
    } catch {
      if (request === epoch.current) setError("Usulan belum dapat diperiksa. Coba lagi.");
    }
  }, [conversationId, toolCallId, isStreaming]);
  React.useEffect(() => {
    const requests = epoch;
    void Promise.resolve().then(refresh);
    return () => {
      requests.current++;
    };
  }, [refresh]);
  async function flushSelection(): Promise<void> {
    if (savingSelection.current || !conversationId || !current.current || inFlight.current) return;
    savingSelection.current = true;
    try {
      while (intent.current) {
        const payload = intent.current,
          revision = current.current.revision;
        const r = await patchAiReconciliationProposal({
          conversationId,
          toolCallId,
          expectedRevision: revision,
          rows: payload,
        });
        if (!r.success) {
          setError(r.error.message);
          if (["FORBIDDEN", "NOT_FOUND", "UNAUTHORIZED"].includes(r.error.code)) setDenied(true);
          break;
        }
        applyView(r.data);
        if (intent.current === payload) {
          intent.current = null;
          setLocal(null);
        }
      }
    } catch {
      setError("Pilihan belum tersimpan. Periksa lagi sebelum melanjutkan.");
    } finally {
      savingSelection.current = false;
    }
  }
  function changeRows(next: ReviewRows): void {
    if (!ready || pending) return;
    setLocal(next);
    intent.current = next;
    setError("");
    void flushSelection();
  }
  async function applyEdit(): Promise<void> {
    if (!edit || !conversationId || !view || inFlight.current || savingSelection.current) return;
    const payload = reconciliationPayloadSchema.safeParse({
      conversationId,
      toolCallId,
      rows: rows.map((r) =>
        r.rowId === edit.rowId
          ? {
              ...r,
              mutation: {
                ...r.mutation,
                transactionDate: edit.date,
                description: edit.description,
                amount: Number(edit.amount),
                type: edit.type,
              },
            }
          : r,
      ),
    });
    if (!payload.success) {
      setError("Periksa tanggal, deskripsi, arah dana dan nominal positif.");
      return;
    }
    inFlight.current = true;
    setOperation("apply");
    setError("");
    try {
      const r = await patchAiReconciliationProposal({
        ...payload.data,
        expectedRevision: view.revision,
      });
      if (r.success) {
        applyView(r.data);
        setEdit(null);
        setExpanded(null);
        setLocal(null);
      } else {
        setError(r.error.message);
        if (["FORBIDDEN", "NOT_FOUND", "UNAUTHORIZED"].includes(r.error.code)) setDenied(true);
      }
    } catch {
      setError("Koreksi belum diterapkan. Coba lagi.");
    } finally {
      inFlight.current = false;
      setOperation("idle");
    }
  }
  async function save(): Promise<void> {
    if (
      !conversationId ||
      !view ||
      !ready ||
      pending ||
      inFlight.current ||
      savingSelection.current ||
      local ||
      edit ||
      (list && !selected.length)
    )
      return;
    inFlight.current = true;
    epoch.current++;
    setOperation("save");
    setError("");
    try {
      const r = await confirmAiReconciliationProposal({
        conversationId,
        toolCallId,
        expectedRevision: view.revision,
      });
      if (r.success) {
        applyView({ ...view, status: "CONFIRMED", resultId: r.data.resultId });
        setDecision(false);
        setOpen(false);
      } else {
        setError(r.error.message);
        if (["FORBIDDEN", "NOT_FOUND", "UNAUTHORIZED"].includes(r.error.code)) setDenied(true);
      }
    } catch {
      setError("Hasil simpan belum dapat dipastikan. Periksa status sebelum mencoba lagi.");
    } finally {
      inFlight.current = false;
      setOperation("idle");
    }
  }
  async function discardDraft(): Promise<void> {
    if (!conversationId || pending || inFlight.current || savingSelection.current) return;
    inFlight.current = true;
    setOperation("save");
    try {
      const r = await discardAiReconciliationProposal({ conversationId, toolCallId });
      if (r.success) {
        applyView(r.data);
        setDiscard(false);
        setOpen(false);
      } else setError(r.error.message);
    } catch {
      setError("Draft belum dapat dibatalkan. Periksa status lalu coba lagi.");
    } finally {
      inFlight.current = false;
      setOperation("idle");
    }
  }
  const feedback = (embedded = false): React.JSX.Element | null =>
    error ||
    !permitted ||
    proposal.warning ||
    (view && !["READY", "CONFIRMED", "DISCARDED"].includes(view.status)) ? (
      <ProposalReviewFeedback
        embedded={embedded}
        message={
          error ||
          (!permitted
            ? "Akses rekening atau rekonsiliasi tidak tersedia."
            : proposal.warning || "Sumber berubah atau kedaluwarsa. Minta preview terbaru.")
        }
        recovery={
          error
            ? {
                label: "Periksa lagi",
                disabled: pending,
                onClick: () => {
                  intent.current = null;
                  setLocal(null);
                  void refresh();
                },
              }
            : undefined
        }
      />
    ) : null;
  const summaryFacts = (
    <>
      {list ? (
        <>
          <FactRow label="Dipilih" value={`${selected.length} dari ${rows.length} mutasi`} />
          <FactRow
            label="Dana masuk terpilih"
            value={money(
              selected
                .filter((r) => r.mutation.type === "INFLOW")
                .reduce((sum, r) => sum + r.mutation.amount, 0),
            )}
          />
          <FactRow
            label="Dana keluar terpilih"
            value={money(
              selected
                .filter((r) => r.mutation.type === "OUTFLOW")
                .reduce((sum, r) => sum + r.mutation.amount, 0),
            )}
          />
          <FactRow
            label={action === "IMPORT" ? "Duplikat dilewati" : "Belum dipilih"}
            value={
              action === "IMPORT"
                ? proposal.rows.filter((r) => r.duplicate).length
                : rows.length - selected.length
            }
          />
        </>
      ) : (
        <>
          <FactRow label="Nominal transaksi" value={money(proposal.exception?.amount ?? 0)} />
          <FactRow label="Rekening" value={proposal.bankAccountName} wrapLabel />
        </>
      )}
    </>
  );
  const summary = permitted ? <GroupedSurface>{summaryFacts}</GroupedSurface> : undefined;
  const footer = (
    <div className="space-y-3">
      {confirmed || closed ? (
        <ButtonLink fullWidth variant="secondary" href="/reconciliation">
          Buka rekonsiliasi
        </ButtonLink>
      ) : (
        <SheetFooterActions
          layout="adaptive"
          desktopStacked={!inline}
          primaryFirst={!inline}
          primary={{
            label,
            pending: operation === "save",
            pendingLabel: "Menyimpan…",
            disabled:
              !ready || pending || Boolean(local) || Boolean(edit) || (list && !selected.length),
            onClick: () => setDecision(true),
          }}
          secondary={{
            label: "Koreksi lewat chat",
            variant: "quiet",
            disabled: pending,
            onClick: () => {
              setOpen(false);
              onFollowUp(
                `Bantu buat preview terbaru ${proposal.title} pada rekening ${proposal.bankAccountName}. Tanyakan isian yang kurang; jangan simpan atau ubah saldo otomatis.`,
              );
            },
          }}
        />
      )}
      <p role="status" className="text-meta text-on-surface-variant">
        {confirmed
          ? action === "IMPORT"
            ? `${selected.length} mutasi tersimpan. Lanjutkan pencocokan; mutasi lainnya tetap di sumber.`
            : action === "MATCH"
              ? `${selected.length} pasangan cocok. Mutasi lainnya tetap belum cocok.`
              : "Status pengecualian diperbarui."
          : closed
            ? "Draft dibatalkan. Mutasi tersimpan dan saldo tetap."
            : proposal.effect}
      </p>
    </div>
  );
  function editor(row: ReconciliationProposal["rows"][number]): React.JSX.Element | null {
    const value = rows.find((r) => r.rowId === row.rowId)!;
    if (action === "MATCH")
      return (
        <FormSection presentation="embedded">
          <AdaptiveSelect
            label="Pasangkan dengan catatan Paduna Build"
            placeholder="Pilih pasangan yang benar"
            value={value.chosenCashId ?? ""}
            disabled={pending || !ready}
            options={row.candidates.map((c) => ({
              value: c.id,
              label: c.description,
              description: `${date(c.date)} · ${c.reference ?? "Tanpa referensi"}${c.exception ? " · Pengecualian aktif" : ""}`,
            }))}
            onChange={(id) =>
              changeRows(
                rows.map((r) =>
                  r.rowId === row.rowId
                    ? { ...r, chosenCashId: id || null, selected: Boolean(id) }
                    : r,
                ),
              )
            }
          />
        </FormSection>
      );
    if (action !== "IMPORT" || !edit || edit.rowId !== row.rowId) return null;
    return (
      <div className="space-y-3">
        <FormSection
          presentation="embedded"
          contentClassName={desktop ? "grid grid-cols-2" : "grid"}
        >
          <DatePickerField
            label="Tanggal mutasi"
            value={edit.date}
            onChange={(v) => setEdit({ ...edit, date: v })}
            disabled={pending}
          />
          <AdaptiveSelect
            label="Arah dana"
            value={edit.type}
            options={[
              { value: "INFLOW", label: "Dana masuk" },
              { value: "OUTFLOW", label: "Dana keluar" },
            ]}
            onChange={(v) => setEdit({ ...edit, type: v === "INFLOW" ? "INFLOW" : "OUTFLOW" })}
            disabled={pending}
          />
          <FormField label="Deskripsi" layout="stacked">
            <TextInput
              value={edit.description}
              onChange={(e) => setEdit({ ...edit, description: e })}
              disabled={pending}
            />
          </FormField>
          <FormField label="Nominal" layout="stacked">
            <MoneyInput
              value={edit.amount}
              onChange={(v) => setEdit({ ...edit, amount: v })}
              disabled={pending}
            />
          </FormField>
        </FormSection>
        <SheetFooterActions
          layout="adaptive"
          primary={{
            label: "Terapkan koreksi",
            disabled: pending,
            pending: operation === "apply",
            onClick: () => void applyEdit(),
          }}
          secondary={{
            label: "Batal edit",
            variant: "quiet",
            disabled: pending,
            onClick: () => {
              setEdit(null);
              setExpanded(null);
            },
          }}
        />
      </div>
    );
  }
  const collection =
    permitted && list ? (
      <div className="space-y-3">
        <div
          className={`flex flex-wrap items-center justify-between gap-3 ${inline ? "px-4" : ""}`}
        >
          <p className="text-support font-semibold">
            {action === "IMPORT" ? "Mutasi dari sumber" : "Pasangan mutasi"}
          </p>
          <Button
            size="compact"
            variant="secondary"
            disabled={!ready || pending || !usable.size}
            onClick={() =>
              changeRows(
                rows.map((r) => {
                  return { ...r, selected: !allUsableSelected && usable.has(r.rowId) };
                }),
              )
            }
          >
            {allUsableSelected
              ? "Batalkan pilihan"
              : action === "IMPORT"
                ? "Pilih semua baru"
                : "Pilih pasangan siap"}
          </Button>
        </div>
        <ReviewCollection
          ariaLabel="Mutasi bank yang ditinjau"
          embedded={inline}
          footer={
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <Button
                size="compact"
                variant="quiet"
                disabled={start === 0}
                onClick={() => setPage(Math.max(0, page - 1))}
              >
                Sebelumnya
              </Button>
              <p className="text-meta">
                {rows.length ? start + 1 : 0}–{Math.min(start + 5, rows.length)} / {rows.length}
              </p>
              <Button
                size="compact"
                variant="quiet"
                disabled={start + 5 >= rows.length}
                onClick={() => setPage(page + 1)}
              >
                Berikutnya
              </Button>
            </div>
          }
        >
          {visible.map((row) => {
            const value = rows.find((r) => r.rowId === row.rowId)!;
            const chosen = row.candidates.find((c) => c.id === value.chosenCashId);
            return (
              <ReviewItem
                key={row.rowId}
                title={value.mutation.description}
                meta={`${date(value.mutation.transactionDate)} · ${value.mutation.type === "INFLOW" ? "Dana masuk" : "Dana keluar"}`}
                primaryValue={money(value.mutation.amount)}
                summary={
                  <span>
                    {row.duplicate
                      ? "Sudah tercatat · dilewati"
                      : action === "MATCH"
                        ? chosen
                          ? `Catatan Paduna Build: ${chosen.description}`
                          : row.candidates.length
                            ? `${row.candidates.length} kandidat · pilih pasangan`
                            : "Belum ada catatan kas dengan nominal dan arah yang sama"
                        : (value.mutation.source ?? "Isian dari percakapan")}
                  </span>
                }
                selection={
                  confirmed ? undefined : (
                    <ChoiceRow
                      presentation="review"
                      compact
                      title="Sertakan mutasi"
                      checked={value.selected}
                      disabled={
                        !ready ||
                        pending ||
                        row.duplicate ||
                        (action === "MATCH" && !value.chosenCashId)
                      }
                      onChange={(checked) =>
                        changeRows(
                          rows.map((r) =>
                            r.rowId === row.rowId ? { ...r, selected: checked } : r,
                          ),
                        )
                      }
                    />
                  )
                }
                expanded={expanded === row.rowId}
                editable={action === "IMPORT" || action === "MATCH"}
                disabled={!ready || pending || row.duplicate || confirmed}
                onToggle={
                  action === "IMPORT" || row.candidates.length
                    ? () => {
                        if (expanded === row.rowId) {
                          setExpanded(null);
                          if (edit?.rowId === row.rowId) setEdit(null);
                        } else {
                          setExpanded(row.rowId);
                          if (action === "IMPORT")
                            setEdit({
                              rowId: row.rowId,
                              date: value.mutation.transactionDate,
                              description: value.mutation.description,
                              amount: String(value.mutation.amount),
                              type: value.mutation.type,
                            });
                        }
                      }
                    : undefined
                }
                editor={editor(row)}
              >
                {chosen && action === "MATCH" ? (
                  <div className="divide-y divide-outline-variant/20">
                    <FactRow label="Tanggal catatan kas" value={date(chosen.date)} />
                    <FactRow label="Referensi" value={chosen.reference ?? "Tidak ada"} wrapLabel />
                    {chosen.exception && (
                      <p className="px-4 py-3 text-meta text-on-surface-variant">
                        Pencocokan akan menghapus pengecualian: {chosen.exception}
                      </p>
                    )}
                  </div>
                ) : null}
              </ReviewItem>
            );
          })}
        </ReviewCollection>
        {!confirmed && !closed && (
          <Button
            size="compact"
            variant="quiet"
            disabled={pending}
            onClick={() => setDiscard(true)}
          >
            Batalkan draft
          </Button>
        )}
      </div>
    ) : null;
  const exception =
    permitted && !list && proposal.exception ? (
      <div className="divide-y divide-outline-variant/20">
        <p className="px-4 py-3 text-row font-semibold wrap-anywhere">
          {proposal.exception.description}
        </p>
        <FactRow label="Tanggal transaksi" value={date(proposal.exception.date)} />
        <FactRow label="Nominal" value={money(proposal.exception.amount)} />
        <ProposalDiffRow
          label="Status pengecualian"
          before={proposal.exception.exception ? "Pengecualian aktif" : "Belum cocok"}
          after={action === "MARK_EXCEPTION" ? "Pengecualian aktif" : "Belum cocok"}
          strikeBefore={false}
        />
        <FactRow
          label="Alasan"
          wrapLabel
          value={
            <span className="wrap-anywhere">
              {proposal.input.action === "MARK_EXCEPTION"
                ? proposal.input.reason
                : (proposal.exception.exception ?? "Tidak ada")}
            </span>
          }
        />
      </div>
    ) : null;
  return (
    <>
      <ProposalCardShell
        title={proposal.title}
        status={
          operation === "save" ? "submitting" : confirmed ? "submitted" : error ? "failed" : "idle"
        }
        isAlreadyConfirmed={confirmed}
        statusLabel={
          confirmed
            ? "Tercatat"
            : closed
              ? "Dibatalkan"
              : view?.status === "STALE"
                ? "Data berubah"
                : error
                  ? "Periksa lagi"
                  : "Usulan"
        }
        showConfirmAction={false}
        onConfirm={save}
        footer={
          inline ? (
            footer
          ) : (
            <Button fullWidth variant="secondary" onClick={() => setOpen(true)}>
              {confirmed ? "Lihat hasil" : "Buka review"}
            </Button>
          )
        }
      >
        <div className="px-4 py-3">
          <p className="text-row font-semibold wrap-anywhere">
            {permitted ? proposal.bankAccountName : "Rekening tidak tersedia"}
          </p>
          {permitted && (
            <p className="mt-1 text-meta text-on-surface-variant">
              {proposal.accountNumber}
              {list ? ` · ${rows.length} mutasi · ${selected.length} dipilih` : ""}
            </p>
          )}
          {feedback(true)}
        </div>
        {inline ? (list ? collection : exception) : null}
      </ProposalCardShell>
      <FormSheet
        dismissal={{ mode: "preserve", blocked: pending }}
        open={open}
        onClose={() => {
          if (!inFlight.current) setOpen(false);
        }}
        title={proposal.title}
        desktopSize="wide"
        desktopFooterPlacement="aside"
        desktopAsideSummary={summary}
        pending={pending}
        footer={footer}
      >
        <div className="space-y-5">
          <div>
            <p className="text-row font-semibold">
              {permitted ? proposal.bankAccountName : "Rekening tidak tersedia"}
            </p>
            {permitted && (
              <p className="mt-1 text-support text-on-surface-variant">{proposal.accountNumber}</p>
            )}
          </div>
          {feedback()}
          {!desktop && summary}
          {collection}
        </div>
      </FormSheet>
      <ConfirmationDialog
        actionLayout="adaptive"
        open={decision}
        onClose={() => setDecision(false)}
        title={label}
        confirmLabel={label}
        description={proposal.effect}
        pending={operation === "save"}
        disabled={!ready || pending || Boolean(local) || Boolean(edit)}
        onConfirm={() => void save()}
      >
        {permitted && (
          <>
            <p className="mb-3 text-row font-semibold">
              {proposal.bankAccountName} · {proposal.accountNumber}
            </p>
            {list && <div className="divide-y divide-outline-variant/20">{summaryFacts}</div>}
            {!list && exception}
            {list && selected.length === 1 && (
              <div className="mt-3 divide-y divide-outline-variant/20">
                <FactRow label="Mutasi" wrapLabel value={selected[0]!.mutation.description} />
                <FactRow
                  label="Tanggal mutasi"
                  value={date(selected[0]!.mutation.transactionDate)}
                />
                <FactRow
                  label="Arah dana"
                  value={selected[0]!.mutation.type === "INFLOW" ? "Dana masuk" : "Dana keluar"}
                />
                {action === "MATCH" && (
                  <FactRow
                    label="Catatan Paduna Build"
                    wrapLabel
                    value={
                      proposal.rows[0]?.candidates.find((c) => c.id === selected[0]!.chosenCashId)
                        ?.description ?? "Pasangan yang ditinjau"
                    }
                  />
                )}
              </div>
            )}
          </>
        )}
      </ConfirmationDialog>
      <ConfirmationDialog
        actionLayout="adaptive"
        open={discard}
        onClose={() => setDiscard(false)}
        title="Batalkan draft?"
        description="Draft review dibatalkan. Mutasi yang sudah tersimpan dan saldo kas tetap."
        confirmLabel="Batalkan draft"
        danger
        pending={operation === "save"}
        onConfirm={() => void discardDraft()}
      />
    </>
  );
}
