"use client";
import { ProposalReviewFeedback } from "./proposal-review-feedback";
import * as React from "react";
import {
  confirmAiRabDraftProposal,
  getAiRabDraftProposal,
  patchAiRabDraftProposal,
} from "@/app/actions/ai/rab-draft";
import {
  AppIcon,
  Button,
  ButtonLink,
  ChoiceRow,
  ConfirmationDialog,
  ReviewCollection,
  ReviewItem,
  FactRow,
  FormDisclosure,
  FormField,
  FormSection,
  FormSheet,
  GroupedSurface,
  MoneyInput,
  MoneyValue,
  NumericInput,
  Textarea,
  TextInput,
} from "@/components/ui";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import {
  applyRabReview,
  rabDraftPayloadSchema,
  rabLineTotal,
  rabReviewTotal,
  type RabDraftPayload,
  type RabDraftProposal,
  type RabDraftRow,
  type RabDraftView,
} from "@atria/core/ai/rab-draft";
import { ProposalCardShell } from "./proposal-card-shell";

type TextRow = {
  readonly rowId: string;
  readonly selected: boolean;
  readonly clientLabel: string;
  readonly description: string;
  readonly quantity: string;
  readonly unitPrice: string;
};
type TextDraft = {
  readonly title: string;
  readonly clientNotes: string;
  readonly rows: readonly TextRow[];
};
function textDraft(proposal: RabDraftProposal): TextDraft {
  return {
    title: proposal.title,
    clientNotes: proposal.clientNotes,
    rows: proposal.rows.map((row) => ({
      rowId: row.rowId,
      selected: row.selected,
      clientLabel: row.clientLabel,
      description: row.description,
      quantity: String(row.quantity),
      unitPrice: String(row.unitPrice),
    })),
  };
}
const sourceLabels: Record<RabDraftRow["sourceKind"], string> = {
  MATERIAL: "Material",
  TUKANG: "Tukang",
  SUBCON: "Subcon",
};
const statusLabels: Record<RabDraftView["status"], string> = {
  READY: "Usulan",
  STALE: "Data berubah",
  EXPIRED: "Kedaluwarsa",
  CONFIRMED: "Tersimpan",
};
export function RabDraftProposalCard({
  proposal: initial,
  conversationId,
  toolCallId,
  isStreaming,
  isBusy,
  alreadyConfirmed,
  onFollowUp,
}: {
  readonly proposal: RabDraftProposal;
  readonly conversationId: string | null;
  readonly toolCallId: string;
  readonly isStreaming: boolean;
  readonly isBusy: boolean;
  readonly alreadyConfirmed: boolean;
  readonly onFollowUp: (text: string) => void;
}): React.JSX.Element {
  const presentation = useWorkspacePresentation(),
    desktop = presentation === "desktop";
  const [view, setView] = React.useState<RabDraftView | null>(null),
    [local, setLocal] = React.useState<TextDraft | null>(null),
    [open, setOpen] = React.useState(false),
    [expanded, setExpanded] = React.useState<string | null>(null),
    [sourceDetails, setSourceDetails] = React.useState(false),
    [anchor, setAnchor] = React.useState(0),
    [error, setError] = React.useState(""),
    [conflict, setConflict] = React.useState(false),
    [reloadConfirm, setReloadConfirm] = React.useState(false),
    [operation, setOperation] = React.useState<"idle" | "apply" | "save">("idle"),
    [savedId, setSavedId] = React.useState<string | null>(null);
  const [appliedNotice, setAppliedNotice] = React.useState(false);
  const epoch = React.useRef(0),
    inFlight = React.useRef(false);
  const applied = view?.proposal ?? initial,
    fields = local ?? textDraft(applied);
  const dirty = local !== null && JSON.stringify(local) !== JSON.stringify(textDraft(applied));
  const confirmed = alreadyConfirmed || Boolean(savedId) || view?.status === "CONFIRMED",
    pending = operation !== "idle" || isBusy;
  const ready = view?.status === "READY" && !isStreaming && !confirmed;
  const parsed = rabDraftPayloadSchema.safeParse({
    ...fields,
    conversationId: conversationId ?? "",
    toolCallId,
    rows: fields.rows.map((row) => ({
      ...row,
      quantity: row.quantity === "" ? NaN : Number(row.quantity),
      unitPrice: row.unitPrice === "" ? NaN : Number(row.unitPrice),
    })),
  });
  let payload: RabDraftPayload | null = null,
    preview = applied,
    invalid = "";
  if (parsed.success) {
    payload = parsed.data;
    try {
      preview = applyRabReview(applied, payload);
    } catch {
      invalid = "Periksa koreksi baris RAB.";
    }
  } else if (dirty) invalid = "Periksa judul, label, jumlah dan harga jual.";
  const selected = preview.rows.filter((row) => row.selected),
    total = rabReviewTotal(preview.rows),
    pageSize = 5;
  const reviewRows = confirmed ? selected : preview.rows;
  const start = Math.min(
    Math.floor(anchor / pageSize) * pageSize,
    Math.max(0, Math.floor((reviewRows.length - 1) / pageSize) * pageSize),
  );
  const rows = reviewRows.slice(start, start + pageSize);
  const refresh = React.useCallback(
    (discard = false): Promise<void> => {
      if (!conversationId || isStreaming || inFlight.current) return Promise.resolve();
      const request = ++epoch.current;
      return getAiRabDraftProposal({ conversationId, toolCallId })
        .then((response) => {
          if (request !== epoch.current) return;
          if (response.success) {
            setView(response.data);
            setError("");
            if (discard) {
              setLocal(null);
              setConflict(false);
            }
          } else setError(response.error.message);
        })
        .catch(() => {
          if (request === epoch.current)
            setError("Draft belum dapat dimuat. Buka kembali atau coba muat ulang.");
        });
    },
    [conversationId, toolCallId, isStreaming],
  );
  React.useEffect(() => {
    const requests = epoch;
    void refresh();
    return () => {
      requests.current++;
    };
  }, [refresh]);
  function editRow(id: string, patch: Partial<Omit<TextRow, "rowId">>): void {
    setLocal((current) => {
      const draft = current ?? textDraft(applied);
      return {
        ...draft,
        rows: draft.rows.map((row) => (row.rowId === id ? { ...row, ...patch } : row)),
      };
    });
    setError("");
  }
  function editHeader(key: "title" | "clientNotes", value: string): void {
    setLocal((current) => ({ ...(current ?? textDraft(applied)), [key]: value }));
    setError("");
  }
  async function apply(): Promise<void> {
    if (
      !conversationId ||
      !view ||
      !ready ||
      !dirty ||
      !payload ||
      invalid ||
      conflict ||
      inFlight.current ||
      isBusy
    )
      return;
    inFlight.current = true;
    epoch.current++;
    setOperation("apply");
    setError("");
    try {
      const response = await patchAiRabDraftProposal({
        ...payload,
        expectedRevision: view.revision,
      });
      if (response.success) {
        setView(response.data);
        setLocal(null);
        setConflict(false);
        setAppliedNotice(true);
      } else {
        setError(response.error.message);
        setConflict(response.error.code === "CONFLICT");
      }
    } catch {
      setError("Koreksi belum diterapkan. Isian tetap ada; coba lagi.");
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
      dirty ||
      invalid ||
      conflict ||
      !selected.length ||
      inFlight.current ||
      isBusy
    )
      return;
    inFlight.current = true;
    epoch.current++;
    setOperation("save");
    setError("");
    try {
      const response = await confirmAiRabDraftProposal({
        conversationId,
        toolCallId,
        expectedRevision: view.revision,
      });
      if (response.success) {
        setSavedId(response.data.rabEstimateId);
        setView({ ...view, status: "CONFIRMED", rabEstimateId: response.data.rabEstimateId });
      } else {
        setError(response.error.message);
        setConflict(response.error.code === "CONFLICT");
      }
    } catch {
      setError("Draft belum tersimpan. Konfirmasi yang sama aman diulang.");
    } finally {
      inFlight.current = false;
      setOperation("idle");
    }
  }
  function field(
    row: RabDraftRow,
    key: "clientLabel" | "description" | "quantity" | "unitPrice",
    label: string,
  ): React.JSX.Element {
    const text = fields.rows.find((r) => r.rowId === row.rowId)?.[key] ?? String(row[key]);
    const id = `rab-${toolCallId}-${row.rowId}-${key}`;
    const disabled = !ready || pending || conflict;
    if (!ready)
      return (
        <div className="space-y-1">
          <p className="text-meta text-on-surface-variant">{label}</p>
          {key === "unitPrice" ? (
            <MoneyValue amount={row.unitPrice} variant="fullDynamic" size="sm" />
          ) : (
            <p
              className={`${key === "clientLabel" ? "font-semibold" : ""} text-support wrap-anywhere tabular-nums`}
            >
              {key === "quantity" ? `${row.quantity} ${row.unit}` : text || "—"}
            </p>
          )}
        </div>
      );
    return (
      <FormField
        label={label}
        htmlFor={id}
        layout="stacked"
        helper={key === "quantity" ? row.unit : undefined}
      >
        {key === "description" || key === "clientLabel" ? (
          <Textarea
            id={id}
            value={text}
            rows={2}
            onChange={(value) => editRow(row.rowId, { [key]: value })}
            disabled={disabled}
            aria-label={`${label} · ${row.sourceName}`}
          />
        ) : key === "unitPrice" ? (
          <MoneyInput
            id={id}
            value={text}
            onChange={(value) => editRow(row.rowId, { [key]: value })}
            disabled={disabled}
            showPreview={false}
            aria-label={`${label} · ${row.sourceName}`}
          />
        ) : key === "quantity" ? (
          <NumericInput
            id={id}
            value={text}
            onChange={(value) => editRow(row.rowId, { [key]: value })}
            disabled={disabled}
            aria-label={`${label} · ${row.sourceName}`}
          />
        ) : (
          <TextInput
            id={id}
            value={text}
            onChange={(value) => editRow(row.rowId, { [key]: value })}
            disabled={disabled}
            aria-label={`${label} · ${row.sourceName}`}
          />
        )}
      </FormField>
    );
  }
  const money = (amount: number): React.ReactNode => (
    <MoneyValue amount={amount} variant="fullDynamic" size="sm" align="right" />
  );
  const summary = (
    <GroupedSurface>
      <div className="flex items-start gap-2 px-4 py-3">
        <AppIcon
          name={confirmed ? "check_circle" : "description"}
          className="mt-0.5 icon-sm shrink-0"
        />
        <div className="min-w-0 space-y-1">
          <p className="text-row font-semibold">
            {confirmed ? "Draft RAB tersimpan" : "RAB untuk klien"}
          </p>
          <p className="text-meta text-on-surface-variant">
            Revisi {applied.revision} · {selected.length} dari {preview.rows.length} baris dipilih
          </p>
        </div>
      </div>
      <div className="divide-y divide-outline-variant/20">
        <FactRow label="Total harga jual" value={money(total)} wrapLabel />
        <FactRow label="Status hasil simpan" value="Draft" wrapLabel />
      </div>
      <p className="px-4 py-3 text-meta text-on-surface-variant">
        {applied.supersedesId ? "RAB yang sudah disetujui tetap tersimpan sebagai baseline. " : ""}
        Hanya baris terpilih yang masuk ke draft ini.
      </p>
    </GroupedSurface>
  );
  const footer = (
    <div className="space-y-2">
      <p className="text-support font-medium">
        {confirmed
          ? `${selected.length} baris tersimpan`
          : dirty
            ? "Koreksi belum diterapkan"
            : ready
              ? selected.length
                ? `${selected.length} baris siap masuk RAB`
                : "Pilih minimal satu baris"
              : "Periksa status usulan"}
      </p>

      {conflict && (
        <Button
          variant="secondary"
          className="w-full"
          disabled={pending}
          onClick={() => (dirty ? setReloadConfirm(true) : void refresh(true))}
        >
          Muat draft terbaru
        </Button>
      )}
      {!confirmed && (dirty || appliedNotice) && (
        <Button
          className="w-full"
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
          disabled={!ready || pending || dirty || conflict || !selected.length}
          onClick={() => void save()}
        >
          {operation === "save" ? "Menyimpan…" : "Simpan draft RAB"}
        </Button>
      )}
      {confirmed && (
        <ButtonLink href={`/projects/${applied.projectId}`} variant="primary" className="w-full">
          Buka RAB proyek
          <AppIcon name="arrow_forward" className="icon-sm" />
        </ButtonLink>
      )}
      {view && ["STALE", "EXPIRED"].includes(view.status) && (
        <Button
          variant="secondary"
          className="w-full"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            onFollowUp(
              `Siapkan ulang draft RAB untuk ${applied.projectName}. Gunakan getRabDraftContext dengan reviewToolCallId ${toolCallId} untuk membaca pilihan dan koreksi klien yang sudah diterapkan, termasuk halaman lanjut bila hasMore. Baca sumber terbaru dan pertahankan pilihan, label, deskripsi, jumlah dan harga jual review tersebut; tanyakan bila sumber atau harga berubah. Tampilkan review sebelum simpan.`,
            );
          }}
        >
          Minta usulan terbaru
        </Button>
      )}
      <p role="status" className="text-meta text-on-surface-variant">
        {confirmed
          ? "Lanjutkan review dan persetujuan RAB di halaman proyek."
          : dirty
            ? "Terapkan pilihan dan koreksi sebelum menyimpan RAB."
            : view?.status === "STALE"
              ? "Sumber atau RAB proyek berubah. Minta usulan terbaru."
              : view?.status === "EXPIRED"
                ? "Usulan kedaluwarsa. Minta usulan terbaru."
                : "Simpan sebagai draft. Stok, kas dan budget tetap."}
      </p>
    </div>
  );
  return (
    <>
      <ProposalCardShell
        title="RAB klien"
        status={pending ? "submitting" : confirmed ? "submitted" : error ? "failed" : "idle"}
        statusLabel={confirmed ? "Tersimpan" : view ? statusLabels[view.status] : "Memeriksa"}
        isAlreadyConfirmed={confirmed}
        showConfirmAction={false}
        onConfirm={save}
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-meta text-on-surface-variant">
              {selected.length} baris{confirmed ? " tersimpan" : " dipilih"}
            </span>
            <Button
              variant="secondary"
              size="compact"
              onClick={() => {
                setOpen(true);
                void refresh();
              }}
            >
              {confirmed ? "Lihat rincian" : "Review RAB"}
              <AppIcon name="arrow_forward" className="icon-sm" />
            </Button>
          </div>
        }
      >
        <div className="space-y-2 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 text-row font-semibold wrap-anywhere">{applied.projectName}</p>
            {money(rabReviewTotal(applied.rows))}
          </div>
          <p className="text-support text-on-surface-variant">
            {confirmed
              ? "Draft RAB siap dilanjutkan di halaman proyek."
              : `Usulan harga jual · revisi ${applied.revision}`}
          </p>
        </div>
      </ProposalCardShell>
      <FormSheet
        open={open}
        title="Review RAB"
        desktopSize="wide"
        sizing="content"
        desktopFooterPlacement="aside"
        desktopAsideSummary={summary}
        footer={footer}
        pending={pending}
        dismissal={{
          mode: "confirm",
          dirty,
          onDiscard: () => setLocal(null),
          description:
            "Koreksi yang belum diterapkan akan dibuang. Draft review yang sudah diterapkan tetap tersimpan.",
        }}
        onClose={() => setOpen(false)}
      >
        <div className="space-y-5">
          <div className="space-y-1">
            <h3 className="text-section font-bold wrap-anywhere">{applied.projectName}</h3>
            <p className="text-support text-on-surface-variant">
              Tinjau isi dan harga jual yang akan terlihat oleh klien.
            </p>
          </div>
          {(invalid || error) && (
            <ProposalReviewFeedback
              message={invalid || error}
              title={invalid ? "Periksa isian" : undefined}
            />
          )}
          {!desktop && summary}
          <GroupedSurface>
            {confirmed ? (
              <div className="space-y-2 px-4 py-3">
                <p className="text-row font-semibold wrap-anywhere">{fields.title}</p>
                <p className="text-support wrap-anywhere text-on-surface-variant">
                  {fields.clientNotes || "Tanpa catatan tambahan untuk klien."}
                </p>
              </div>
            ) : (
              <FormSection presentation="embedded">
                <FormField label="Judul RAB" layout="stacked" htmlFor={`rab-${toolCallId}-title`}>
                  <TextInput
                    id={`rab-${toolCallId}-title`}
                    value={fields.title}
                    onChange={(value) => editHeader("title", value)}
                    disabled={!ready || pending || conflict}
                  />
                </FormField>
                <FormField
                  label="Catatan untuk klien"
                  layout="stacked"
                  htmlFor={`rab-${toolCallId}-notes`}
                >
                  <Textarea
                    id={`rab-${toolCallId}-notes`}
                    value={fields.clientNotes}
                    onChange={(value) => editHeader("clientNotes", value)}
                    rows={2}
                    disabled={!ready || pending || conflict}
                  />
                </FormField>
              </FormSection>
            )}
          </GroupedSurface>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <h3 className="text-row font-semibold">Isi RAB</h3>
              <Button
                variant="tertiary"
                size="compact"
                disabled={!ready || pending || conflict}
                onClick={() =>
                  setLocal((current) => {
                    const draft = current ?? textDraft(applied);
                    return {
                      ...draft,
                      rows: draft.rows.map((row) => ({
                        ...row,
                        selected: selected.length !== preview.rows.length,
                      })),
                    };
                  })
                }
              >
                {selected.length === preview.rows.length ? "Batalkan semua pilihan" : "Pilih semua"}
              </Button>
            </div>
            <ReviewCollection
              ariaLabel="Baris untuk draft RAB"
              footer={
                reviewRows.length > pageSize ? (
                  <nav
                    aria-label="Halaman RAB"
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
                      {start + 1}–{Math.min(start + pageSize, reviewRows.length)} /{" "}
                      {reviewRows.length}
                    </span>
                    <Button
                      variant="tertiary"
                      size="compact"
                      disabled={start + pageSize >= reviewRows.length || pending}
                      onClick={() => setAnchor(start + pageSize)}
                    >
                      Berikutnya
                    </Button>
                  </nav>
                ) : undefined
              }
            >
              {rows.map((row) => (
                <ReviewItem
                  key={row.rowId}
                  title={row.clientLabel}
                  meta={`${sourceLabels[row.sourceKind]} · ${row.unit}`}
                  primaryValue={money(rabLineTotal(row))}
                  selection={
                    !confirmed ? (
                      <ChoiceRow
                        compact
                        presentation="review"
                        emphasis="neutral"
                        indicatorShape={desktop ? "square" : "circle"}
                        title={`Pilih ${row.sourceName}`}
                        checked={row.selected}
                        onChange={(value) => editRow(row.rowId, { selected: value })}
                        disabled={!ready || pending || conflict}
                      />
                    ) : undefined
                  }
                  summary={
                    <div className="space-y-1">
                      <p className="wrap-anywhere">
                        {row.description || "Tanpa deskripsi tambahan"}
                      </p>
                      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                        <span>
                          {new Intl.NumberFormat("id-ID").format(row.quantity)} {row.unit}
                        </span>
                        <span className="inline-flex items-baseline gap-1">
                          Harga jual{" "}
                          <MoneyValue amount={row.unitPrice} variant="fullDynamic" size="sm" /> /{" "}
                          {row.unit}
                        </span>
                      </div>
                    </div>
                  }
                  expanded={expanded === row.rowId}
                  editable={ready}
                  disabled={pending || conflict}
                  onToggle={() =>
                    setExpanded((current) => (current === row.rowId ? null : row.rowId))
                  }
                  editor={
                    <FormSection
                      presentation="embedded"
                      contentClassName={desktop ? "grid grid-cols-2" : "grid"}
                    >
                      <div className={desktop ? "col-span-2" : ""}>
                        {field(row, "clientLabel", "Nama untuk klien")}
                        {field(row, "description", "Deskripsi untuk klien")}
                      </div>
                      {field(row, "quantity", "Jumlah")}
                      {field(row, "unitPrice", `Harga jual / ${row.unit}`)}
                    </FormSection>
                  }
                />
              ))}
            </ReviewCollection>
          </div>
          <FormDisclosure
            title="Sumber yang digunakan"
            variant="plain"
            expanded={sourceDetails}
            onToggle={() => setSourceDetails((current) => !current)}
          >
            <GroupedSurface>
              <div className="divide-y divide-outline-variant/20">
                {rows
                  .filter((row) => row.selected)
                  .map((row) => (
                    <div key={row.rowId} className="px-4 py-3">
                      <p className="text-support font-medium wrap-anywhere">{row.sourceName}</p>
                      <p className="text-meta text-on-surface-variant">
                        {sourceLabels[row.sourceKind]} · revisi {row.sourceRevision}
                      </p>
                    </div>
                  ))}
              </div>
            </GroupedSurface>
            <p className="pt-2 text-meta text-on-surface-variant">
              Referensi sumber disimpan untuk jejak asal. Biaya internal, margin dan catatan vendor
              tidak disalin ke isi RAB.
            </p>
          </FormDisclosure>
        </div>
      </FormSheet>
      <ConfirmationDialog
        actionLayout="adaptive"
        open={reloadConfirm}
        title="Muat draft terbaru?"
        description="Koreksi yang belum diterapkan akan dibuang; pilihan dan koreksi terakhir dari server akan dimuat."
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
