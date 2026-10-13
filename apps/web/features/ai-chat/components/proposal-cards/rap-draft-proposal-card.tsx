"use client";
import { ProposalReviewFeedback } from "./proposal-review-feedback";

import * as React from "react";
import {
  confirmAiRapDraftProposal,
  getAiRapDraftProposal,
  patchAiRapDraftProposal,
} from "@/app/actions/ai/rap-draft";
import {
  AppIcon,
  Button,
  ConfirmationDialog,
  ReviewCollection,
  ReviewItem,
  FactRow,
  GroupedSurface,
  FormDisclosure,
  FormField,
  FormSection,
  FormSheet,
  MoneyInput,
  MoneyValue,
  NumericInput,
  Textarea,
} from "@/components/ui";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import {
  rapDraftFieldsSchema,
  type RapDraftFields,
  type RapDraftProposal,
  type RapDraftRow,
  type RapDraftRowPatch,
  type RapDraftView,
} from "@atria/core/ai/rap-draft";
import { applyRapDraftPatches, rapEditableFields } from "@atria/core/ai/rap-review";
import { ProposalCardShell } from "./proposal-card-shell";

const quantity = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const statusLabels: Record<RapDraftView["status"], string> = {
  READY: "Usulan",
  STALE: "Data berubah",
  EXPIRED: "Kedaluwarsa",
  CONFIRMED: "Tersimpan",
};
type EditFields = Record<keyof RapDraftFields, string>;
function editableText(row: RapDraftRow): EditFields {
  return {
    area: row.area,
    requiredQuantity: String(row.requiredQuantity),
    bufferQuantity: String(row.bufferQuantity),
    estimatedUnitCost: String(row.estimatedUnitCost),
  };
}
function parseFields(fields: EditFields): ReturnType<typeof rapDraftFieldsSchema.safeParse> {
  return rapDraftFieldsSchema.safeParse({
    area: fields.area,
    requiredQuantity: fields.requiredQuantity === "" ? NaN : Number(fields.requiredQuantity),
    bufferQuantity: fields.bufferQuantity === "" ? NaN : Number(fields.bufferQuantity),
    estimatedUnitCost: fields.estimatedUnitCost === "" ? NaN : Number(fields.estimatedUnitCost),
  });
}
function BudgetCondition({ proposal }: { readonly proposal: RapDraftProposal }): React.JSX.Element {
  const over = proposal.budget.overAllocation;
  return (
    <div
      className={`flex items-center gap-2 text-support ${over > 0 ? "text-critical" : "text-on-surface-variant"}`}
    >
      <AppIcon name={over > 0 ? "warning" : "check_circle"} className="icon-sm shrink-0" />
      <span className="min-w-0 flex-1">
        {over > 0 ? "Melebihi alokasi " : "Rencana dalam alokasi Material"}
      </span>
      {over > 0 && (
        <MoneyValue
          amount={over}
          variant="fullDynamic"
          size="sm"
          align="right"
          className="shrink-0"
        />
      )}
    </div>
  );
}
function ReviewBudgetDetails({
  budget,
  expanded,
  onToggle,
}: {
  readonly budget: RapDraftProposal["budget"];
  readonly expanded: boolean;
  readonly onToggle: () => void;
}): React.JSX.Element {
  return (
    <div className="px-4">
      <FormDisclosure
        variant="plain"
        title="Rincian budget"
        expanded={expanded}
        onToggle={onToggle}
      >
        <div className="divide-y divide-outline-variant/20">
          {[
            { label: "RAP saat ini", amount: budget.existingPlan },
            { label: "Tambahan usulan", amount: budget.addition },
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
          Rencana RAP terpisah dari realisasi biaya.
        </p>
      </FormDisclosure>
    </div>
  );
}
function ReviewSummary({
  proposal,
  expanded,
  onToggle,
  showDetails = true,
}: {
  readonly proposal: RapDraftProposal;
  readonly showDetails?: boolean;
  readonly expanded: boolean;
  readonly onToggle: () => void;
}): React.JSX.Element {
  const budget = proposal.budget;
  const over = budget.overAllocation > 0;
  return (
    <section aria-label="Ringkasan budget Material">
      <GroupedSurface>
        <div className="divide-y divide-outline-variant/20">
          <div className="flex items-start gap-2 px-4 py-3.5" role="status">
            <AppIcon
              name={over ? "warning" : "check_circle"}
              className={`mt-0.5 icon-sm shrink-0 ${over ? "text-critical" : "text-on-surface-variant"}`}
            />
            <div className="min-w-0 space-y-1">
              <p className={`text-row font-semibold ${over ? "text-critical" : "text-on-surface"}`}>
                {over ? "Rencana melebihi alokasi" : "Rencana dalam alokasi"}
              </p>
              {over && (
                <div className="flex items-center gap-2 text-support text-on-surface-variant">
                  <span>Selisih</span>
                  <MoneyValue amount={budget.overAllocation} variant="fullDynamic" size="sm" />
                </div>
              )}
            </div>
          </div>
          <FactRow
            wrapLabel
            label="RAP setelah usulan"
            value={
              <MoneyValue amount={budget.afterPlan} variant="fullDynamic" size="sm" align="right" />
            }
          />
          <FactRow
            wrapLabel
            label="Alokasi Material"
            value={
              <MoneyValue amount={budget.allocated} variant="fullDynamic" size="sm" align="right" />
            }
          />
          {showDetails && (
            <ReviewBudgetDetails budget={budget} expanded={expanded} onToggle={onToggle} />
          )}
        </div>
      </GroupedSurface>
    </section>
  );
}

export function RapDraftProposalCard({
  proposal: initialProposal,
  conversationId,
  toolCallId,
  isStreaming,
  isBusy,
  alreadyConfirmed,
  onFollowUp,
}: {
  readonly proposal: RapDraftProposal;
  readonly conversationId: string | null;
  readonly toolCallId: string;
  readonly isStreaming: boolean;
  readonly isBusy: boolean;
  readonly alreadyConfirmed: boolean;
  readonly onFollowUp: (text: string) => void;
}): React.JSX.Element {
  const presentation = useWorkspacePresentation();
  const desktop = presentation === "desktop";
  const [view, setView] = React.useState<RapDraftView | null>(null);
  const [operation, setOperation] = React.useState<"idle" | "apply" | "save">("idle");
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState(0);
  const [activeRow, setActiveRow] = React.useState<string | null>(null);
  const [edits, setEdits] = React.useState<Record<string, EditFields>>({});
  const [budgetDetails, setBudgetDetails] = React.useState(false);
  const [notesOpen, setNotesOpen] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [reloadConfirm, setReloadConfirm] = React.useState(false);
  const [conflict, setConflict] = React.useState(false);
  const inFlight = React.useRef(false);
  const epoch = React.useRef(0);
  const applied = view?.proposal ?? initialProposal;
  const confirmed = alreadyConfirmed || saved || view?.status === "CONFIRMED";
  const ready = !confirmed && !isStreaming && view?.status === "READY";
  const pending = operation !== "idle";
  const patches: RapDraftRowPatch[] = [];
  let invalid = "";
  let dirty = false;
  for (const row of applied.rows) {
    const edit = edits[row.rowId];
    if (!edit) continue;
    const parsed = parseFields(edit);
    if (!parsed.success) {
      dirty = true;
      invalid = "Periksa area, jumlah, buffer dan harga. Gunakan maksimal dua desimal.";
    } else if (JSON.stringify(parsed.data) !== JSON.stringify(rapEditableFields(row))) {
      dirty = true;
      patches.push({ rowId: row.rowId, fields: parsed.data });
    }
  }
  let preview = applied;
  if (!invalid) {
    try {
      preview = applyRapDraftPatches(applied, patches);
    } catch (cause: unknown) {
      invalid = cause instanceof Error ? cause.message : "Koreksi belum valid.";
    }
  }
  const pageSize = 5;
  const start = Math.min(
    Math.floor(anchor / pageSize) * pageSize,
    Math.floor((preview.rows.length - 1) / pageSize) * pageSize,
  );
  const rows = preview.rows.slice(start, start + pageSize);
  const refresh = React.useCallback(
    (clearEdits = false): Promise<void> => {
      if (!conversationId || isStreaming) return Promise.resolve();
      const request = ++epoch.current;
      return getAiRapDraftProposal({ conversationId, toolCallId })
        .then((result): void => {
          if (request !== epoch.current) return;
          if (result.success) {
            setView(result.data);
            setError("");
            setConflict(false);
            if (clearEdits) {
              setEdits({});
              setNotice("");
            }
          } else setError(result.error.message);
        })
        .catch((): void => {
          if (request === epoch.current) setError("Draft belum dapat dimuat. Coba lagi.");
        });
    },
    [conversationId, toolCallId, isStreaming],
  );
  React.useEffect(() => {
    void refresh();
    return () => {
      epoch.current += 1;
    };
  }, [refresh]);
  function change(row: RapDraftRow, key: keyof EditFields, value: string): void {
    setEdits((current) => ({
      ...current,
      [row.rowId]: { ...(current[row.rowId] ?? editableText(row)), [key]: value },
    }));
    setNotice("");
  }
  function focusRow(row: RapDraftRow): void {
    setActiveRow(row.rowId);
    setAnchor(applied.rows.findIndex((item) => item.rowId === row.rowId));
  }
  async function apply(): Promise<void> {
    if (!conversationId || !view || !ready || !dirty || invalid || conflict || inFlight.current)
      return;
    inFlight.current = true;
    epoch.current += 1;
    setOperation("apply");
    setError("");
    try {
      const result = await patchAiRapDraftProposal({
        conversationId,
        toolCallId,
        expectedRevision: view.revision,
        rows: patches,
      });
      if (result.success) {
        setView(result.data);
        setEdits({});
        setNotice("Koreksi diterapkan ke draft.");
      } else {
        setError(result.error.message);
        setConflict(result.error.code === "CONFLICT");
      }
    } catch {
      setError("Koreksi belum diterapkan. Coba lagi; isian tetap ada.");
    } finally {
      inFlight.current = false;
      setOperation("idle");
    }
  }
  async function save(): Promise<void> {
    if (!conversationId || !view || !ready || dirty || invalid || conflict || inFlight.current)
      return;
    inFlight.current = true;
    epoch.current += 1;
    setOperation("save");
    setError("");
    try {
      const result = await confirmAiRapDraftProposal({
        conversationId,
        toolCallId,
        expectedRevision: view.revision,
      });
      if (result.success) {
        setSaved(true);
        setOpen(false);
      } else {
        setError(result.error.message);
        setConflict(result.error.code === "CONFLICT");
      }
    } catch {
      setError("Draft belum tersimpan. Coba lagi; konfirmasi yang sama aman diulang.");
    } finally {
      inFlight.current = false;
      setOperation("idle");
    }
  }
  function regenerate(): void {
    setOpen(false);
    onFollowUp(
      `Siapkan ulang draft RAP Material untuk ${applied.projectName}, ${applied.rows.length} baris dengan estimasi Rp${applied.budget.addition}. Baca koreksi review draft yang sudah diterapkan dari getRapDraftContext, pertahankan material, area, kebutuhan, buffer dan harga. Tanyakan jika satuan atau referensi berubah; tampilkan review sebelum menyimpan.`,
    );
  }
  function field(row: RapDraftRow, key: keyof EditFields, label: string): React.JSX.Element {
    const edit = edits[row.rowId] ?? editableText(row);
    if (!ready)
      return (
        <div className="space-y-1 px-4 py-3">
          <p className="text-meta text-on-surface-variant">{label}</p>
          {key === "estimatedUnitCost" ? (
            <MoneyValue amount={row.estimatedUnitCost} variant="fullDynamic" size="sm" />
          ) : (
            <p className="text-support wrap-anywhere tabular-nums">
              {edit[key]}
              {key === "requiredQuantity" || key === "bufferQuantity" ? ` ${row.unit}` : ""}
            </p>
          )}
        </div>
      );
    const parsed = parseFields(edit);
    const hasError = Boolean(
      edits[row.rowId] &&
      !parsed.success &&
      parsed.error.issues.some((issue) => issue.path[0] === key),
    );
    return (
      <div onFocus={() => focusRow(row)}>
        <FormField
          label={label}
          layout="stacked"
          htmlFor={`rap-${toolCallId}-${row.rowId}-${key}`}
          helper={
            key === "estimatedUnitCost"
              ? row.priceSourceLabel
              : desktop && (key === "requiredQuantity" || key === "bufferQuantity")
                ? row.unit
                : undefined
          }
          error={hasError ? "Periksa isian ini." : undefined}
        >
          {key === "area" ? (
            <Textarea
              id={`rap-${toolCallId}-${row.rowId}-${key}`}
              rows={3}
              value={edit[key]}
              onChange={(value) => change(row, key, value)}
              disabled={!ready || pending || conflict}
              aria-label={`${label} · baris ${applied.rows.findIndex((item) => item.rowId === row.rowId) + 1}`}
            />
          ) : key === "estimatedUnitCost" ? (
            <MoneyInput
              id={`rap-${toolCallId}-${row.rowId}-${key}`}
              value={edit[key]}
              onChange={(value) => change(row, key, value)}
              disabled={!ready || pending || conflict}
              aria-label={`${label} · baris ${applied.rows.findIndex((item) => item.rowId === row.rowId) + 1}`}
              showPreview={false}
            />
          ) : (
            <NumericInput
              id={`rap-${toolCallId}-${row.rowId}-${key}`}
              value={edit[key]}
              onChange={(value) => change(row, key, value)}
              disabled={!ready || pending || conflict}
              suffix={desktop ? undefined : row.unit}
              aria-label={`${label} · baris ${applied.rows.findIndex((item) => item.rowId === row.rowId) + 1}`}
            />
          )}
        </FormField>
      </div>
    );
  }
  const summary = (
    <ReviewSummary
      proposal={preview}
      showDetails={!desktop}
      expanded={budgetDetails}
      onToggle={() => setBudgetDetails((value) => !value)}
    />
  );
  const actionArea = (
    <div className="space-y-2">
      <p className="text-support font-medium">
        {confirmed
          ? "Draft RAP tersimpan"
          : dirty
            ? "Koreksi belum diterapkan"
            : ready
              ? `${applied.rows.length} baris siap disimpan ke RAP`
              : "Periksa status usulan"}
      </p>

      {conflict && (
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => (dirty ? setReloadConfirm(true) : void refresh(true))}
        >
          Muat draft terbaru
        </Button>
      )}
      {!confirmed && (dirty || Boolean(notice)) && (
        <Button
          className="w-full"
          variant="primary"
          disabled={!ready || !dirty || pending || Boolean(invalid) || conflict}
          onClick={() => void apply()}
        >
          {operation === "apply" ? "Menerapkan…" : "Terapkan koreksi"}
        </Button>
      )}
      {!confirmed && (
        <Button
          className="w-full"
          variant={dirty ? "secondary" : "primary"}
          disabled={!ready || dirty || pending || conflict}
          onClick={() => void save()}
        >
          {operation === "save" ? "Menyimpan…" : "Simpan draft RAP"}
        </Button>
      )}
      {view && ["STALE", "EXPIRED"].includes(view.status) && (
        <Button
          variant="secondary"
          className="w-full"
          disabled={isBusy || pending}
          onClick={regenerate}
        >
          Minta usulan terbaru
        </Button>
      )}
      <p className="text-meta text-on-surface-variant" role="status">
        {confirmed
          ? `${applied.rows.length} baris sudah tersimpan.`
          : dirty
            ? "Terapkan koreksi sebelum menyimpan RAP."
            : view?.status === "STALE"
              ? "Data proyek atau material berubah. Minta usulan terbaru."
              : view?.status === "EXPIRED"
                ? "Usulan kedaluwarsa. Minta usulan terbaru."
                : notice || "Stok dan kas tetap saat draft disimpan."}
      </p>
    </div>
  );
  return (
    <>
      <ProposalCardShell
        title="RAP Material"
        status={pending ? "submitting" : confirmed ? "submitted" : error ? "failed" : "idle"}
        statusLabel={confirmed ? "Tersimpan" : view ? statusLabels[view.status] : "Memeriksa"}
        isAlreadyConfirmed={confirmed}
        showConfirmAction={false}
        onConfirm={save}
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-meta text-on-surface-variant">
              {confirmed
                ? `${applied.rows.length} baris tersimpan`
                : `${applied.rows.length} baris material`}
            </span>
            <Button variant="secondary" size="compact" onClick={() => setOpen(true)}>
              {confirmed ? "Lihat rincian" : "Review draft"}
              <AppIcon name="arrow_forward" className="icon-sm" />
            </Button>
          </div>
        }
      >
        <div className="space-y-3 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 text-row font-semibold wrap-anywhere">{applied.projectName}</p>
            <MoneyValue
              amount={applied.budget.addition}
              variant="fullDynamic"
              size="md"
              align="right"
            />
          </div>
          <BudgetCondition proposal={applied} />
          {error && <p className="text-meta text-critical">{error}</p>}
        </div>
      </ProposalCardShell>
      <FormSheet
        open={open}
        title="Review RAP"
        desktopSize="wide"
        desktopFooterPlacement="aside"
        desktopAsideSummary={summary}
        sizing="content"
        footer={actionArea}
        pending={pending}
        dismissal={{
          mode: "confirm",
          dirty,
          onDiscard: () => {
            setEdits({});
            setNotice("");
          },
          description:
            "Koreksi yang belum diterapkan akan dibuang. Draft yang sudah diterapkan tetap tersimpan.",
        }}
        onClose={() => setOpen(false)}
      >
        <div className="space-y-5">
          <div className="space-y-1">
            <h3 className="text-section font-bold wrap-anywhere">{applied.projectName}</h3>
            <p className="text-support text-on-surface-variant">Usulan rencana material proyek</p>
          </div>
          {(invalid || error) && (
            <ProposalReviewFeedback
              message={invalid || error}
              title={invalid ? "Periksa isian" : undefined}
            />
          )}
          <div className={desktop ? "hidden" : ""}>{summary}</div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3 px-1">
              <h3 className="text-row font-semibold">Material</h3>
              <span className="text-support text-on-surface-variant tabular-nums">
                {applied.rows.length} baris
              </span>
            </div>
            <ReviewCollection
              ariaLabel="Material untuk draft RAP"
              footer={
                preview.rows.length > pageSize ? (
                  <nav
                    aria-label="Halaman material RAP"
                    className="flex items-center justify-between gap-2 px-3 py-2"
                  >
                    <Button
                      variant="tertiary"
                      size="compact"
                      disabled={start === 0 || pending}
                      onClick={() => setAnchor(Math.max(0, start - pageSize))}
                    >
                      Sebelumnya
                    </Button>
                    <span className="text-meta tabular-nums">
                      {start + 1}–{Math.min(start + pageSize, preview.rows.length)} /{" "}
                      {preview.rows.length}
                    </span>
                    <Button
                      variant="tertiary"
                      size="compact"
                      disabled={start + pageSize >= preview.rows.length || pending}
                      onClick={() => setAnchor(start + pageSize)}
                    >
                      Berikutnya
                    </Button>
                  </nav>
                ) : undefined
              }
            >
              {rows.map((row) => {
                const stock = preview.stock.find((item) =>
                  item.materialId
                    ? item.materialId === row.materialId
                    : item.materialName === row.materialName && item.unit === row.unit,
                );
                return (
                  <ReviewItem
                    key={row.rowId}
                    title={row.name}
                    meta={`${row.area} · ${row.unit}`}
                    primaryValue={
                      <MoneyValue
                        amount={row.estimatedTotalCost}
                        variant="fullDynamic"
                        size="sm"
                        align="right"
                      />
                    }
                    summary={
                      <div className="space-y-1">
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <span>
                            Kebutuhan {quantity.format(row.requiredQuantity)} {row.unit}
                          </span>
                          <span>
                            Buffer {quantity.format(row.bufferQuantity)} {row.unit}
                          </span>
                          <span className="inline-flex items-baseline gap-1">
                            Harga{" "}
                            <MoneyValue
                              amount={row.estimatedUnitCost}
                              variant="fullDynamic"
                              size="sm"
                            />{" "}
                            / {row.unit}
                          </span>
                        </div>
                        <p className="text-meta">
                          Stok {quantity.format(stock?.available ?? row.availableStock)} {row.unit}
                          {stock && stock.shortage > 0
                            ? ` · kurang ${quantity.format(stock.shortage)} untuk RAP`
                            : ""}{" "}
                          · {row.priceSourceLabel}
                        </p>
                      </div>
                    }
                    expanded={activeRow === row.rowId}
                    editable={ready}
                    disabled={pending || conflict}
                    onToggle={
                      !confirmed
                        ? () =>
                            setActiveRow((current) => (current === row.rowId ? null : row.rowId))
                        : undefined
                    }
                    editor={
                      !confirmed ? (
                        <FormSection
                          presentation="embedded"
                          contentClassName={desktop ? "grid grid-cols-2" : "grid"}
                        >
                          <div className={desktop ? "col-span-2" : ""}>
                            {field(row, "area", "Area")}
                          </div>
                          {field(row, "requiredQuantity", "Kebutuhan")}
                          {field(row, "bufferQuantity", "Buffer")}
                          <div className={desktop ? "col-span-2" : ""}>
                            {field(row, "estimatedUnitCost", `Harga / ${row.unit}`)}
                          </div>
                        </FormSection>
                      ) : undefined
                    }
                  />
                );
              })}
            </ReviewCollection>
          </div>
          {desktop && (
            <GroupedSurface>
              <ReviewBudgetDetails
                budget={preview.budget}
                expanded={budgetDetails}
                onToggle={() => setBudgetDetails((value) => !value)}
              />
            </GroupedSurface>
          )}
          {applied.notes && (
            <FormDisclosure
              variant="plain"
              title="Catatan usulan"
              expanded={notesOpen}
              onToggle={() => setNotesOpen((value) => !value)}
            >
              <p className="text-support wrap-anywhere text-on-surface-variant">{applied.notes}</p>
            </FormDisclosure>
          )}
        </div>
      </FormSheet>
      <ConfirmationDialog
        actionLayout="adaptive"
        open={reloadConfirm}
        title="Muat draft terbaru?"
        description="Koreksi yang belum diterapkan akan dibuang. Draft terbaru dari server akan dimuat."
        confirmLabel="Muat draft terbaru"
        onClose={() => setReloadConfirm(false)}
        onConfirm={() => {
          setReloadConfirm(false);
          void refresh(true);
        }}
      />
    </>
  );
}
