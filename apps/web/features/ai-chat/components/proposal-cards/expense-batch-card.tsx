"use client";
import * as React from "react";
import { z } from "zod";
import { useCan } from "@/components/auth/permissions-provider";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { useLocalFormRecovery } from "@/lib/hooks/use-local-form-recovery";
import {
  Button,
  ButtonLink,
  SheetFooterActions,
  FormSheet,
  ConfirmationDialog,
  ReviewCollection,
  ReviewItem,
  ChoiceRow,
  GroupedSurface,
  FactRow,
  MoneyValue,
  FormSection,
  FormField,
  Textarea,
  NumericInput,
  MoneyInput,
  AdaptiveSelect,
  FormDisclosure,
  AppIcon,
} from "@/components/ui";
import {
  startAiExpenseBatchReview,
  getAiExpenseBatchReview,
  patchAiExpenseBatchReview,
  submitAiExpenseBatchReview,
  discardAiExpenseBatchReview,
} from "@/app/actions/ai/expense-batch";
import {
  expenseDraftPayloadSchema,
  type ExpenseDraftPayloadInput,
} from "@atria/core/validations/expense-draft";
import type { ExpenseBatchProposal, ExpenseBatchView } from "@atria/core/ai/expense-batch";
import { ProposalCardShell } from "./proposal-card-shell";
import { ProposalReviewFeedback } from "./proposal-review-feedback";
const recoverySchema = z.object({
  revision: z.number().int().nonnegative(),
  payload: expenseDraftPayloadSchema,
  selectedKeys: z.array(z.string()).max(50),
});
type Recovery = z.infer<typeof recoverySchema>;
const appliedNotice = "Koreksi tersimpan dalam draft; belum diajukan.";
/** Atria Operate: one editable grouped batch, persistent selection and explicit separate business stages.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.
 */
export function ExpenseBatchCard({
  proposal,
  conversationId,
  toolCallId,
  isStreaming,
  isBusy,
  onFollowUp,
}: {
  readonly proposal: ExpenseBatchProposal;
  readonly conversationId: string | null;
  readonly toolCallId: string;
  readonly isStreaming: boolean;
  readonly isBusy: boolean;
  readonly onFollowUp: (text: string) => void;
}): React.JSX.Element {
  const can = useCan(),
    desktop = useWorkspacePresentation() === "desktop";
  const initial = React.useCallback(
    (): Recovery => ({ revision: 0, payload: proposal.payload, selectedKeys: [] }),
    [proposal.payload],
  );
  const recovery = useLocalFormRecovery({
    storageKey: `atria:ai:expense:${conversationId}:${toolCallId}`,
    schema: recoverySchema,
    initialPayload: initial,
  });
  const { reset: resetRecovery, recoveredAt } = recovery;
  const [view, setView] = React.useState<ExpenseBatchView | null>(null),
    [open, setOpen] = React.useState(false),
    [page, setPage] = React.useState(0),
    [expanded, setExpanded] = React.useState<string | null>(null),
    [error, setError] = React.useState(""),
    [notice, setNotice] = React.useState(""),
    [operation, setOperation] = React.useState<"idle" | "apply" | "submit">("idle"),
    [decision, setDecision] = React.useState<"submit" | "discard" | "reload" | null>(null),
    [conflict, setConflict] = React.useState(false),
    [budgetExpanded, setBudgetExpanded] = React.useState(false),
    [selectionSaving, setSelectionSaving] = React.useState(false),
    [selectionUnsaved, setSelectionUnsaved] = React.useState(false);
  const acknowledged = React.useRef<ExpenseBatchView | null>(null),
    boot = React.useRef(false),
    epoch = React.useRef(0),
    inFlight = React.useRef(false),
    intent = React.useRef<readonly string[] | null>(null),
    selectionFlight = React.useRef(false),
    token = React.useRef<string | null>(null);
  const current = recovery.payload,
    payload = view ? current.payload : proposal.payload;
  const dirty = view ? JSON.stringify(payload) !== JSON.stringify(view.state.payload) : false;
  const pending = operation !== "idle" || isBusy,
    complete = view?.status === "COMPLETE",
    inactive = complete || view?.status === "EXPIRED" || view?.status === "DISCARDED",
    stale = view?.status === "STALE";
  const ready = Boolean(
    view &&
    view.status === "ACTIVE" &&
    !isStreaming &&
    can("create:cost") &&
    can("use:ai_chat") &&
    !conflict &&
    !error &&
    !view.blockers.length,
  );
  const selected = current.selectedKeys,
    submitted = new Set(view?.state.submitted.map((s) => s.key) ?? []),
    rows = view?.rows ?? [],
    readyRows = rows.filter((r) => !submitted.has(r.key) && !r.issues.length),
    total = payload.lines
      .filter((l) => selected.includes(l.key) && !submitted.has(l.key))
      .reduce((s, l) => s + Number(l.amount || 0), 0);
  const localRef = React.useRef(current);
  React.useEffect(() => {
    localRef.current = current;
  }, [current]);
  const accept = React.useCallback(
    (next: ExpenseBatchView, discard = false): void => {
      const previous = acknowledged.current;
      acknowledged.current = next;
      setView(next);
      setError("");
      if (!boot.current) {
        boot.current = true;
        if (recoveredAt && !discard) {
          if (localRef.current.revision !== next.revision) setConflict(true);
          return;
        }
      }
      if (discard) {
        setConflict(false);
        intent.current = null;
        setSelectionUnsaved(false);
        resetRecovery({
          revision: next.revision,
          payload: next.state.payload,
          selectedKeys: [...next.state.selectedKeys],
        });
        return;
      }
      if (
        !discard &&
        previous &&
        JSON.stringify(localRef.current.payload) !== JSON.stringify(previous.state.payload)
      ) {
        if (next.revision !== previous.revision) setConflict(true);
        return;
      }
      resetRecovery({
        revision: next.revision,
        payload: next.state.payload,
        selectedKeys: [...(intent.current ?? next.state.selectedKeys)],
      });
    },
    [recoveredAt, resetRecovery],
  );
  const refresh = React.useCallback(
    (discard = false): Promise<void> => {
      if (!conversationId || isStreaming || inFlight.current || selectionFlight.current)
        return Promise.resolve();
      const n = ++epoch.current;
      return startAiExpenseBatchReview({ conversationId, toolCallId })
        .then((result) => {
          if (n !== epoch.current) return;
          if (result.success) accept(result.data, discard);
          else setError(result.error.message);
        })
        .catch(() => {
          if (n === epoch.current) setError("Review belum dapat dibaca. Periksa lagi.");
        });
    },
    [conversationId, toolCallId, isStreaming, accept],
  );
  React.useEffect(() => {
    void refresh();
    const e = epoch;
    return () => {
      e.current++;
    };
  }, [refresh]);
  async function flushSelection(): Promise<void> {
    if (selectionFlight.current || !intent.current || !conversationId) return;
    selectionFlight.current = true;
    epoch.current++;
    setSelectionSaving(true);
    setError("");
    try {
      while (intent.current) {
        const keys: readonly string[] = intent.current;
        const base = acknowledged.current;
        if (!base) break;
        const result = await patchAiExpenseBatchReview({
          conversationId,
          toolCallId,
          expectedRevision: base.revision,
          payload: base.state.payload,
          selectedKeys: [...keys],
        });
        if (!result.success) {
          setError(result.error.message);
          setConflict(result.error.code === "CONFLICT");
          break;
        }
        if (intent.current === keys) intent.current = null;
        accept(result.data);
      }
    } catch {
      setError("Pilihan terlihat, tetapi belum tersimpan. Periksa koneksi lalu coba lagi.");
    } finally {
      selectionFlight.current = false;
      setSelectionSaving(false);
      setSelectionUnsaved(Boolean(intent.current));
    }
  }
  function select(keys: readonly string[]): void {
    if (!view || !ready || dirty || pending) return;
    intent.current = [...keys];
    setSelectionUnsaved(true);
    token.current = null;
    recovery.setPayload({ ...current, selectedKeys: [...keys] });
    setNotice("");
    void flushSelection();
  }
  function edit(key: string, patch: Partial<ExpenseDraftPayloadInput["lines"][number]>): void {
    token.current = null;
    recovery.setPayload((value) => ({
      ...value,
      payload: {
        ...value.payload,
        lines: value.payload.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)),
      },
    }));
  }
  async function apply(): Promise<void> {
    if (!view || !conversationId || pending || selectionSaving || inFlight.current || conflict)
      return;
    inFlight.current = true;
    epoch.current++;
    setOperation("apply");
    setError("");
    try {
      const result = await patchAiExpenseBatchReview({
        conversationId,
        toolCallId,
        expectedRevision: view.revision,
        payload,
        selectedKeys: selected,
      });
      if (result.success) {
        accept(result.data, true);
        token.current = null;
        setNotice(appliedNotice);
      } else {
        setError(result.error.message);
        setConflict(result.error.code === "CONFLICT");
      }
    } catch {
      setError("Koreksi belum tersimpan. Isian lokal tetap tersedia.");
    } finally {
      inFlight.current = false;
      setOperation("idle");
    }
  }
  async function submit(): Promise<void> {
    if (
      !view ||
      !conversationId ||
      !ready ||
      dirty ||
      pending ||
      selectionSaving ||
      Boolean(intent.current) ||
      !selected.length ||
      inFlight.current
    )
      return;
    inFlight.current = true;
    epoch.current++;
    setOperation("submit");
    setError("");
    token.current ??= crypto.randomUUID();
    try {
      const result = await submitAiExpenseBatchReview({
        conversationId,
        toolCallId,
        expectedRevision: view.revision,
        token: token.current,
      });
      if (result.success) {
        const latest = await getAiExpenseBatchReview({ conversationId, toolCallId });
        if (latest.success) accept(latest.data, true);
        token.current = null;
        setNotice(
          `${result.data.costIds.length} baris diajukan. Baris lain tetap draft; kas belum dibayarkan.`,
        );
        setExpanded(null);
      } else {
        setError(result.error.message);
        setConflict(result.error.code === "CONFLICT");
      }
    } catch {
      setError(
        "Hasil pengajuan belum diketahui. Periksa lagi sebelum mengulang; token retry dipertahankan.",
      );
    } finally {
      setDecision(null);
      inFlight.current = false;
      setOperation("idle");
    }
  }
  async function discard(): Promise<void> {
    if (!conversationId || pending) return;
    const result = await discardAiExpenseBatchReview({ conversationId, toolCallId });
    if (result.success) {
      setOpen(false);
      setDecision(null);
      void refresh(true);
    } else setError(result.error.message);
  }
  const feedback =
    error || conflict ? (
      <ProposalReviewFeedback
        message={error || "Draft server berubah; koreksi lokal tetap tersedia."}
        recovery={{
          label: conflict ? "Muat versi server" : "Periksa lagi",
          disabled: pending || selectionSaving,
          onClick: () =>
            conflict ? setDecision("reload") : void refresh().then(() => flushSelection()),
        }}
      />
    ) : stale ? (
      <ProposalReviewFeedback message="Sumber berubah. Periksa ringkasan terbaru lalu Terapkan ke draft sebelum mengajukan." />
    ) : null;
  const money = (amount: number): React.JSX.Element => (
    <MoneyValue amount={amount} variant="fullDynamic" size="sm" align="right" />
  );
  const summary = (
    <GroupedSurface>
      <FactRow label="Dipilih" value={`${selected.length} baris`} />
      <FactRow label="Total pengajuan" value={money(total)} />
    </GroupedSurface>
  );
  const budgetDetails = can("view:budget") ? (
    <GroupedSurface>
      <div className="px-4">
        <FormDisclosure
          title="Rincian budget"
          variant="plain"
          expanded={budgetExpanded}
          onToggle={() => setBudgetExpanded((v) => !v)}
        >
          {view?.categories
            .filter((c) => c.proposed > 0)
            .map((c) => (
              <div key={c.id} className="divide-y divide-outline-variant/20">
                <p className="py-3 text-row font-semibold">{c.name}</p>
                <FactRow inset={false} label="Pengajuan ini" value={money(c.proposed)} />
                <FactRow inset={false} label="Alokasi" value={money(c.allocated)} />
                <FactRow inset={false} label="Realisasi saat ini" value={money(c.actual)} />
                <FactRow inset={false} label="Pengajuan tertunda" value={money(c.pending)} />
              </div>
            ))}
        </FormDisclosure>
      </div>
    </GroupedSurface>
  ) : null;
  const footer = (
    <div className="space-y-2">
      <p role="status" className="text-support">
        {notice ||
          (dirty || stale
            ? "Terapkan koreksi sebelum mengajukan."
            : selectionSaving
              ? "Menyimpan pilihan…"
              : inactive
                ? `${submitted.size} baris sudah diajukan`
                : `${selected.length} baris dipilih untuk diajukan`)}
      </p>
      {!inactive && (
        <>
          {(dirty || stale || notice === appliedNotice) && (
            <Button
              fullWidth
              variant="secondary"
              disabled={
                pending || selectionSaving || selectionUnsaved || conflict || (!dirty && !stale)
              }
              pending={operation === "apply"}
              onClick={() => void apply()}
            >
              {operation === "apply" ? "Menerapkan…" : "Terapkan ke draft"}
            </Button>
          )}
          <SheetFooterActions
            layout="adaptive"
            desktopStacked
            primaryFirst
            primary={{
              label: `Ajukan ${selected.length} baris`,
              variant: "primary",
              disabled:
                dirty ||
                stale ||
                pending ||
                selectionSaving ||
                selectionUnsaved ||
                conflict ||
                !ready ||
                !selected.length ||
                rows.some((r) => selected.includes(r.key) && r.issues.length),
              pending: operation === "submit",
              pendingLabel: "Mengajukan…",
              onClick: () => setDecision("submit"),
            }}
            secondary={{
              label: "Koreksi lewat chat",
              variant: "quiet",
              disabled: pending,
              onClick: () => {
                setOpen(false);
                onFollowUp(
                  `Koreksi draft pengeluaran untuk ${proposal.projectName}. Tanyakan bagian yang ingin saya ubah, periksa draft terbaru dan pertahankan baris yang sudah diajukan. Jangan ajukan atau bayar otomatis.`,
                );
              },
            }}
          />
        </>
      )}
      {view?.state.submitted.length ? (
        <Button
          fullWidth
          variant="secondary"
          disabled={pending}
          onClick={() =>
            onFollowUp(
              `Periksa pengeluaran batch terakhir yang saya ajukan untuk ${proposal.projectName}. ${can("verify:cost") && can("update:cost") ? "Siapkan preview verifikasi hanya untuk baris batch tersebut yang belum diverifikasi." : "Jelaskan status dan langkah yang tersedia sesuai akses saya."} Jangan memproses atau membayar otomatis.`,
            )
          }
        >
          {can("verify:cost") && can("update:cost")
            ? "Siapkan verifikasi"
            : "Periksa status pengeluaran"}
        </Button>
      ) : null}
      {inactive && (
        <ButtonLink
          fullWidth
          variant="secondary"
          href={`/projects/${payload.projectId}?tab=budget`}
        >
          Buka pengeluaran proyek
        </ButtonLink>
      )}
      <p className="text-meta text-on-surface-variant">
        Pengajuan belum membayar kas. Perubahan stok hanya untuk baris Material yang ditinjau.
      </p>
    </div>
  );
  const start = Math.min(page * 5, Math.max(0, Math.floor((rows.length - 1) / 5) * 5));
  function editor(key: string): React.JSX.Element {
    const line = payload.lines.find((l) => l.key === key)!;
    const category = view?.categories.find((c) => c.id === line.projectBudgetCategoryId);
    const locked = pending || selectionSaving || !ready;
    const numberField = (
      field: "quantity" | "unitPrice" | "amount",
      label: string,
    ): React.JSX.Element => {
      const id = `exp-${toolCallId}-${key}-${field}`,
        value = String(line[field]);
      const onChange = (text: string): void => {
        const next = text === "" ? "" : Number(text);
        const patch: Partial<typeof line> = { [field]: next };
        if (
          field !== "amount" &&
          next !== "" &&
          line[field === "quantity" ? "unitPrice" : "quantity"] !== ""
        )
          patch.amount =
            Math.round(
              Number(field === "quantity" ? next : line.quantity) *
                Number(field === "unitPrice" ? next : line.unitPrice) *
                100,
            ) / 100;
        edit(key, patch);
      };
      return (
        <FormField label={label} htmlFor={id} layout="stacked">
          {field === "quantity" ? (
            <NumericInput
              id={id}
              value={value}
              onChange={onChange}
              disabled={locked}
              aria-label={`${label} · ${line.description || "pengeluaran"}`}
            />
          ) : (
            <MoneyInput
              id={id}
              value={value}
              onChange={onChange}
              showPreview={false}
              disabled={locked}
              aria-label={`${label} · ${line.description || "pengeluaran"}`}
            />
          )}
        </FormField>
      );
    };
    return (
      <FormSection presentation="embedded" contentClassName={desktop ? "grid grid-cols-2" : "grid"}>
        <div className={desktop ? "col-span-2" : ""}>
          <FormField label="Deskripsi" layout="stacked">
            <Textarea
              value={line.description}
              onChange={(description) => edit(key, { description })}
              rows={2}
              disabled={locked}
            />
          </FormField>
        </div>
        <div className={desktop ? "col-span-2" : ""}>
          <AdaptiveSelect
            label="Kategori"
            value={line.projectBudgetCategoryId}
            options={view?.categories.map((c) => ({ value: c.id, label: c.name })) ?? []}
            onChange={(value) => edit(key, { projectBudgetCategoryId: value })}
            placeholder="Pilih kategori"
            disabled={locked}
          />
        </div>
        {numberField("quantity", "Jumlah")}
        {numberField("unitPrice", "Harga per satuan")}
        <div className={desktop ? "col-span-2" : ""}>
          {numberField("amount", "Nominal pengeluaran")}
        </div>
        {category?.code === "MATERIAL" && (
          <>
            <AdaptiveSelect
              label="Material"
              value={line.materialId}
              options={[
                { value: "", label: "Tanpa tautan material" },
                ...(view?.materials.map((m) => ({
                  value: m.id,
                  label: `${m.name} · ${m.unit}`,
                })) ?? []),
              ]}
              onChange={(materialId) => edit(key, { materialId })}
              disabled={locked}
            />
            <AdaptiveSelect
              label="Penanganan stok"
              value={line.stockHandling}
              options={[
                { value: "EXPENSE_ONLY", label: "Catat biaya saja" },
                ...(view?.canStock
                  ? [
                      { value: "STOCK_IN", label: "Masuk gudang" },
                      { value: "DIRECT_USE", label: "Masuk lalu langsung dipakai" },
                      { value: "RESERVE_FOR_PROJECT", label: "Masuk lalu cadangkan" },
                    ]
                  : []),
              ]}
              onChange={(value) => {
                if (
                  value === "EXPENSE_ONLY" ||
                  value === "STOCK_IN" ||
                  value === "DIRECT_USE" ||
                  value === "RESERVE_FOR_PROJECT"
                )
                  edit(key, { stockHandling: value });
              }}
              disabled={locked}
            />
            {line.stockHandling !== "EXPENSE_ONLY" && (
              <AdaptiveSelect
                label="Lokasi stok"
                value={line.inventoryLocationId}
                options={view?.locations.map((l) => ({ value: l.id, label: l.name })) ?? []}
                placeholder="Pilih lokasi"
                onChange={(inventoryLocationId) => edit(key, { inventoryLocationId })}
                disabled={locked}
              />
            )}
            <AdaptiveSelect
              label="Item RAP"
              value={line.projectRapItemId}
              options={[
                { value: "", label: "Tanpa tautan RAP" },
                ...(view?.rapItems
                  .filter((r) => !r.materialId || r.materialId === line.materialId)
                  .map((r) => ({ value: r.id, label: r.name })) ?? []),
              ]}
              onChange={(projectRapItemId) => edit(key, { projectRapItemId })}
              disabled={locked}
            />
          </>
        )}
        {["TUKANG", "SUBCON"].includes(category?.code ?? "") && (
          <AdaptiveSelect
            label="Paket kerja"
            value={line.projectCategoryPlanItemId}
            options={[
              { value: "", label: "Tanpa paket" },
              ...(view?.packages
                .filter((p) => p.categoryId === line.projectBudgetCategoryId)
                .map((p) => ({ value: p.id, label: p.name })) ?? []),
            ]}
            onChange={(projectCategoryPlanItemId) => edit(key, { projectCategoryPlanItemId })}
            disabled={locked}
          />
        )}
        <div className={desktop ? "col-span-2" : ""}>
          <FactRow label="Hasil nominal" value={money(Number(line.amount || 0))} />
        </div>
      </FormSection>
    );
  }
  return (
    <>
      <ProposalCardShell
        title="Pengeluaran batch"
        status={complete ? "submitted" : error ? "failed" : "idle"}
        statusLabel={
          complete
            ? "Diajukan"
            : view?.state.submitted.length
              ? "Sebagian diajukan"
              : inactive
                ? "Tidak aktif"
                : stale
                  ? "Data berubah"
                  : "Draft"
        }
        isAlreadyConfirmed={Boolean(complete)}
        showConfirmAction={false}
        onConfirm={submit}
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-meta text-on-surface-variant">
              {complete
                ? `${submitted.size} baris diajukan`
                : `${rows.length || payload.lines.length} baris pengeluaran`}
            </span>
            <Button
              size="compact"
              variant="secondary"
              disabled={!view || isStreaming}
              onClick={() => {
                if (!dirty && notice === appliedNotice) setNotice("");
                setOpen(true);
                void refresh();
              }}
            >
              {complete ? "Lihat hasil" : "Review draft"}
              <AppIcon name="arrow_forward" className="icon-sm" />
            </Button>
          </div>
        }
      >
        <div className="space-y-3 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-row font-semibold">{proposal.projectName}</p>
            {money(total)}
          </div>
          <p className="text-support">
            {readyRows.length} siap ·{" "}
            {rows.filter((r) => !submitted.has(r.key) && r.issues.length).length} perlu diperiksa ·{" "}
            {submitted.size} diajukan
          </p>
          <p className="text-support">{selected.length} baris dipilih</p>
          {notice && (
            <p role="status" className="text-meta">
              {notice}
            </p>
          )}
          {!view && error && feedback}
        </div>
      </ProposalCardShell>
      <FormSheet
        open={open}
        title="Review biaya"
        desktopSize="wide"
        desktopFooterPlacement="aside"
        desktopAsideSummary={summary}
        footer={footer}
        sizing="content"
        pending={pending}
        dismissal={{ mode: "preserve" }}
        onClose={() => {
          if (!inFlight.current) setOpen(false);
        }}
      >
        <div className="space-y-5">
          <div>
            <h3 className="text-section font-bold wrap-anywhere">{proposal.projectName}</h3>
            <p className="text-support text-on-surface-variant">
              {submitted.size
                ? `${submitted.size} diajukan · ${rows.length - submitted.size} masih draft`
                : "Pilih dan periksa pengeluaran sebelum mengajukan."}
            </p>
          </div>
          {feedback}
          {view?.blockers.map((b) => (
            <ProposalReviewFeedback key={b} message={b} />
          ))}
          {!desktop && summary}
          {payload.receipt && (
            <GroupedSurface>
              <FactRow
                label="Bukti untuk baris draft"
                value={
                  <ButtonLink href={payload.receipt.url} size="compact" variant="quiet">
                    {payload.receipt.fileName}
                  </ButtonLink>
                }
              />
              {!inactive && (
                <Button
                  variant="quiet"
                  size="compact"
                  disabled={!ready || pending || selectionSaving}
                  onClick={() =>
                    recovery.setPayload((value) => ({
                      ...value,
                      payload: { ...value.payload, receipt: null, inputMode: "MANUAL" },
                    }))
                  }
                >
                  Lepas bukti dari draft
                </Button>
              )}
            </GroupedSurface>
          )}
          {!inactive && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-row font-semibold">Baris pengeluaran</p>
              <Button
                variant="secondary"
                size="compact"
                disabled={!ready || dirty || pending}
                onClick={() =>
                  select(selected.length === readyRows.length ? [] : readyRows.map((r) => r.key))
                }
              >
                {selected.length === readyRows.length ? "Batalkan pilihan" : "Pilih semua siap"}
              </Button>
            </div>
          )}
          <ReviewCollection
            ariaLabel="Baris pengeluaran batch"
            footer={
              rows.length > 5 ? (
                <nav
                  aria-label="Halaman pengeluaran"
                  className="flex items-center justify-between gap-3 px-4 py-2"
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
                    {start + 1}–{Math.min(start + 5, rows.length)} / {rows.length}
                  </span>
                  <Button
                    variant="quiet"
                    size="compact"
                    disabled={start + 5 >= rows.length}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Berikutnya
                  </Button>
                </nav>
              ) : undefined
            }
          >
            {rows.slice(start, start + 5).map((row) => {
              const sent = submitted.has(row.key),
                line = payload.lines.find((l) => l.key === row.key)!;
              return (
                <ReviewItem
                  key={row.key}
                  title={line.description || "Deskripsi belum diisi"}
                  meta={`${row.categoryName}${row.materialName ? ` · ${row.materialName}` : ""}`}
                  primaryValue={money(Number(line.amount || 0))}
                  selection={
                    !sent && !inactive ? (
                      <ChoiceRow
                        compact
                        presentation="review"
                        emphasis="neutral"
                        indicatorShape="square"
                        title={`Pilih ${row.description || "pengeluaran tanpa deskripsi"}`}
                        checked={selected.includes(row.key)}
                        disabled={!ready || dirty || pending || row.issues.length > 0}
                        onChange={(checked) =>
                          select(
                            checked
                              ? [...selected, row.key]
                              : selected.filter((k) => k !== row.key),
                          )
                        }
                      />
                    ) : undefined
                  }
                  summary={
                    sent ? (
                      <p role="status">Sudah diajukan; tahap verifikasi/pembayaran terpisah.</p>
                    ) : (
                      <p>
                        {line.quantity === ""
                          ? "—"
                          : Number(line.quantity).toLocaleString("id-ID", {
                              maximumFractionDigits: 2,
                            })}{" "}
                        {row.unit ?? "item"}
                        {line.stockHandling !== "EXPENSE_ONLY" ? ` · ${row.stockEffect}` : ""}
                      </p>
                    )
                  }
                  expanded={expanded === row.key}
                  editable={!sent && !inactive}
                  onToggle={
                    !sent && !inactive
                      ? () => setExpanded(expanded === row.key ? null : row.key)
                      : undefined
                  }
                  disabled={pending}
                  editor={editor(row.key)}
                >
                  {!sent &&
                    row.issues.map((issue) => (
                      <p key={issue} className="text-support text-critical">
                        {issue}
                      </p>
                    ))}
                  {!sent && (row.requiresApproval || row.locationName) && (
                    <p className="text-meta text-on-surface-variant">
                      {row.requiresApproval ? "Memerlukan persetujuan setelah verifikasi." : ""}
                      {row.locationName ? ` Lokasi: ${row.locationName}.` : ""}
                    </p>
                  )}
                  {!sent && row.stockBefore !== null && (
                    <div className="divide-y divide-outline-variant/20">
                      <FactRow
                        label="Stok fisik"
                        value={`${row.stockBefore} → ${row.stockAfter} ${row.unit ?? ""}`}
                        inset={false}
                      />
                      <FactRow
                        label="Dicadangkan"
                        value={`${row.reservedBefore} → ${row.reservedAfter} ${row.unit ?? ""}`}
                        inset={false}
                      />
                    </div>
                  )}
                </ReviewItem>
              );
            })}
          </ReviewCollection>
          {budgetDetails}
          {!inactive && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="quiet"
                size="compact"
                disabled={pending}
                onClick={() => setDecision("discard")}
              >
                Batalkan sisa draft
              </Button>
              <ButtonLink
                size="compact"
                variant="quiet"
                href={`/projects/${payload.projectId}?tab=budget`}
              >
                Buka pengeluaran
                <AppIcon name="arrow_forward" className="icon-sm" />
              </ButtonLink>
            </div>
          )}
        </div>
      </FormSheet>
      <ConfirmationDialog
        actionLayout="adaptive"
        open={decision !== null}
        title={
          decision === "submit"
            ? `Ajukan ${selected.length} baris`
            : decision === "discard"
              ? "Batalkan sisa draft?"
              : "Muat versi server?"
        }
        confirmLabel={
          decision === "submit"
            ? "Ajukan pengeluaran"
            : decision === "discard"
              ? "Batalkan sisa draft"
              : "Muat versi server"
        }
        tone={decision === "discard" ? "danger" : "default"}
        description={
          decision === "submit"
            ? "Baris terpilih diajukan dalam satu transaksi. Penanganan stok Material yang ditinjau ikut diterapkan; kas belum dibayarkan."
            : decision === "discard"
              ? "Pengeluaran yang sudah diajukan tetap tersimpan. Draft sumber manual tetap tersedia."
              : "Koreksi lokal yang belum diterapkan akan diganti oleh draft server terbaru."
        }
        pending={pending}
        disabled={pending}
        onClose={() => setDecision(null)}
        onConfirm={() => {
          if (decision === "submit") void submit();
          else if (decision === "discard") void discard();
          else {
            setDecision(null);
            void refresh(true);
          }
        }}
      >
        {decision === "submit" ? (
          <>
            <FactRow label="Total pengajuan" value={money(total)} />
            <FactRow label="Baris dipilih" value={selected.length} />
          </>
        ) : null}
      </ConfirmationDialog>
    </>
  );
}
