"use client";
import * as React from "react";
import {
  startAiMaterialAnalysis,
  getAiMaterialDraft,
  patchAiMaterialDraft,
  selectAiMaterialRows,
  saveAiMaterialRows,
  confirmAiMaterialReference,
  retryAiMaterialAnalysis,
  discardAiMaterialDraft,
} from "@/app/actions/ai/material-master";
import {
  Button,
  InlineReviewStrip,
  FormSection,
  FormField,
  TextInput,
  Textarea,
  MoneyInput,
  NumericInput,
  SwitchRow,
  WorkflowFormSheet,
  ComboboxField,
  COMMON_UNIT_OPTIONS,
  FormRiskNotice,
  SegmentedTabs,
  ActionMenu,
  ConfirmationDialog,
  useSheetPresenceValue,
  FormDisclosure,
  IconButton,
  AppIcon,
  GroupedSurface,
  FactRow,
  type ActionMenuItem,
} from "@/components/ui";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import {
  type MaterialCandidate,
  type MaterialDraftView,
  type MaterialFields,
} from "@atria/core/ai/material-import";
import type { ActionResponse } from "@atria/core/types/action-response";
import { materialReferenceSuggestions } from "../../lib/material-reference-suggestions";
import {
  materialReviewRows,
  materialReviewState,
  materialReviewFilters,
  materialRowSelection,
  type MaterialReviewFilter,
} from "../../lib/material-review-state";
import { MaterialReviewList } from "./material-review-list";
import { MaterialReferenceReview } from "./material-reference-review";
import {
  reconcileReferenceReview,
  referenceReviewError,
  type ReferenceReviewEntry,
} from "../../lib/material-reference-review";
import { z } from "zod";
import { ProposalCardShell } from "./proposal-card-shell";

type Editor = {
  revision: number;
  row: MaterialCandidate;
  fields: MaterialFields;
  selected: boolean;
};
type SelectionIntent = {
  readonly draftId: string;
  readonly rowIds: readonly string[];
  readonly version: number;
};
function withSelection(view: MaterialDraftView, rowIds: readonly string[]): MaterialDraftView {
  const ids = new Set(rowIds);
  return {
    ...view,
    payload: {
      ...view.payload,
      rows: view.payload.rows.map((row) =>
        row.materialId ? row : { ...row, selected: ids.has(row.id) },
      ),
    },
  };
}
export function MaterialMasterProposalCard({
  toolCallId,
  conversationId,
  isStreaming = false,
}: {
  readonly toolCallId: string;
  readonly conversationId: string | null;
  readonly isStreaming?: boolean;
}): React.JSX.Element {
  const presentation = useWorkspacePresentation();
  const [draft, setDraft] = React.useState<MaterialDraftView | null>(null);
  const [error, setError] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [operation, setOperation] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [selectionPhase, setSelectionPhase] = React.useState<"idle" | "saving" | "failed">("idle");
  const [selectionError, setSelectionError] = React.useState("");
  const selectionIntent = React.useRef<SelectionIntent | null>(null);
  const selectionVersion = React.useRef(0);
  const selectionNeedsRefresh = React.useRef(false);
  const acknowledgedDraft = React.useRef<MaterialDraftView | null>(null);
  const [filter, setFilter] = React.useState<MaterialReviewFilter>("pending");
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const inFlight = React.useRef(false);
  const requestEpoch = React.useRef(0);
  const filterMotionId = React.useId();
  const [editor, setEditor] = React.useState<Editor | null>(null);
  const [editorCache, setEditorCache] = React.useState<Record<string, Editor>>({});
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [referencesOpen, setReferencesOpen] = React.useState(false);
  const [referenceEntries, setReferenceEntries] = React.useState<ReferenceReviewEntry[]>([]);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [pageAnchor, setPageAnchor] = React.useState(0);
  const saveToken = React.useRef<string | null>(null);
  const referenceToken = React.useRef<string | null>(null);
  const bookmarkDraft = React.useRef<string | null>(null);
  const started = React.useRef(false);
  function accept(result: ActionResponse<MaterialDraftView>): void {
    if (result.success) {
      restoreBookmark(result.data.id);
      const current = acknowledgedDraft.current;
      if (current?.id === result.data.id && current.revision > result.data.revision) return;
      acknowledgedDraft.current = result.data;
      const intent = selectionIntent.current;
      setDraft(
        intent?.draftId === result.data.id
          ? withSelection(result.data, intent.rowIds)
          : result.data,
      );
      setError("");
    } else setError(result.error.message);
  }
  async function start(): Promise<void> {
    if (!conversationId) return;
    await perform(() => startAiMaterialAnalysis({ conversationId, toolCallId }), "start");
  }
  React.useEffect(() => {
    if (!conversationId || isStreaming || started.current) return;
    started.current = true;
    void start();
    // Stable proposal identity; start is idempotent and waits for streaming persistence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, toolCallId, isStreaming]);
  const draftId = draft?.id;
  const analysisStatus = draft?.payload.analysisStatus;
  React.useEffect(() => {
    if (!draftId || !analysisStatus || !["QUEUED", "PROCESSING"].includes(analysisStatus)) return;
    let disposed = false;
    const timer = window.setInterval(() => {
      if (inFlight.current) return;
      const epoch = requestEpoch.current;
      void getAiMaterialDraft({ draftId })
        .then((result) => {
          if (!disposed && epoch === requestEpoch.current) accept(result);
        })
        .catch(() => {
          if (!disposed && epoch === requestEpoch.current)
            setError("Progres belum dimuat. Analisis tetap berjalan; coba buka lagi.");
        });
    }, 2500);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [draftId, analysisStatus]);
  const state = materialReviewState(draft);
  const ready = draft?.payload.analysisStatus === "READY";
  function editorDirty(value: Editor): boolean {
    return (
      value.selected !== value.row.selected ||
      JSON.stringify(value.fields) !== JSON.stringify(value.row.fields)
    );
  }
  const pendingEditors = Object.values({
    ...editorCache,
    ...(editor ? { [editor.row.id]: editor } : {}),
  }).filter(editorDirty);
  const hasUnappliedEdit = pendingEditors.length > 0;
  const selectionBusy = selectionPhase !== "idle";

  const eligible = (draft?.payload.rows ?? []).filter(
    (row) => !row.materialId && !row.issues.length,
  );
  const selected = eligible.filter((row) => row.selected);
  async function perform(
    work: () => Promise<ActionResponse<MaterialDraftView>>,
    kind = "edit",
  ): Promise<boolean> {
    if (inFlight.current || selectionIntent.current) return false;
    inFlight.current = true;
    requestEpoch.current++;
    setPending(true);
    setOperation(kind);
    setNotice("");
    try {
      const result = await work();
      accept(result);
      return result.success;
    } catch {
      setError("Koneksi terputus. Coba ulang; penyimpanan yang sama tidak membuat duplikat.");
      return false;
    } finally {
      inFlight.current = false;
      setPending(false);
      setOperation("");
    }
  }
  async function flushSelection(): Promise<void> {
    if (inFlight.current || !selectionIntent.current) return;
    inFlight.current = true;
    requestEpoch.current++;
    setSelectionPhase("saving");
    setSelectionError("");
    function fail(message: string): void {
      selectionNeedsRefresh.current = true;
      setSelectionPhase("failed");
      setSelectionError(message);
    }
    try {
      if (selectionNeedsRefresh.current) {
        const latest = await getAiMaterialDraft({ draftId: selectionIntent.current.draftId });
        if (!latest.success) {
          fail(latest.error.message);
          return;
        }
        const available = new Set(
          latest.data.payload.rows.filter((row) => !row.materialId).map((row) => row.id),
        );
        const intent = selectionIntent.current;
        if (intent)
          selectionIntent.current = {
            ...intent,
            rowIds: intent.rowIds.filter((id) => available.has(id)),
          };
        accept(latest);
        selectionNeedsRefresh.current = false;
      }
      while (selectionIntent.current) {
        const intent: SelectionIntent = selectionIntent.current;
        const checkpoint = acknowledgedDraft.current;
        if (
          !checkpoint ||
          checkpoint.id !== intent.draftId ||
          checkpoint.payload.analysisStatus !== "READY"
        ) {
          fail("Draft belum dapat menerima pilihan. Periksa status analisis.");
          return;
        }
        const result = await selectAiMaterialRows({
          draftId: intent.draftId,
          expectedRevision: checkpoint.revision,
          selectedRowIds: [...intent.rowIds],
        });
        if (!result.success) {
          fail(result.error.message);
          return;
        }
        if (selectionIntent.current?.version === intent.version) selectionIntent.current = null;
        accept(result);
      }
      setSelectionPhase("idle");
    } catch {
      fail("Koneksi terputus. Pilihan masih terlihat, tetapi belum tersimpan di draft.");
    } finally {
      inFlight.current = false;
    }
  }
  function queueSelection(rowIds: readonly string[]): void {
    if (!draft || !ready || hasUnappliedEdit || (inFlight.current && !selectionIntent.current))
      return;
    // A clean editor can close safely; its revision must not race selection metadata.
    setPanelOpen(false);
    setEditor(null);
    setEditorCache({});
    selectionIntent.current = { draftId: draft.id, rowIds, version: ++selectionVersion.current };
    setDraft(withSelection(draft, rowIds));
    saveToken.current = null;
    setNotice("");
    void flushSelection();
  }
  function selectRows(selectAll: boolean): void {
    queueSelection(selectAll ? eligible.map((row) => row.id) : []);
  }
  async function save(): Promise<void> {
    if (!draft || !selected.length || selectionIntent.current) return;
    saveToken.current ??= crypto.randomUUID();
    const ok = await perform(
      () =>
        saveAiMaterialRows({
          draftId: draft.id,
          expectedRevision: draft.revision,
          operationId: saveToken.current,
          rowIds: selected.map((row) => row.id),
        }),
      "save",
    );
    if (ok) {
      saveToken.current = null;
      setNotice(
        `${selected.length} material berhasil disimpan. ${state.remaining > selected.length ? `${state.remaining - selected.length} lainnya tetap di draft.` : "Seluruh material dalam draft sudah tersimpan."}`,
      );
      setFilter("pending");
      setPageAnchor(0);
      remember(0, "pending");
    }
  }
  async function saveEdit(): Promise<void> {
    if (!draft || (!editor && !pendingEditors.length)) return;
    const changes = pendingEditors.length ? pendingEditors : editor ? [editor] : [];
    if (!changes.length) return;
    if (changes.some((entry) => entry.revision !== changes[0].revision)) {
      setError("Draft berubah. Periksa koreksi sebelum menerapkan.");
      return;
    }
    const ok = await perform(() =>
      patchAiMaterialDraft({
        draftId: draft.id,
        expectedRevision: changes[0].revision,
        rows: changes.map((entry) => ({
          id: entry.row.id,
          fields: entry.fields,
          selected: entry.selected,
        })),
      }),
    );
    if (ok) {
      setPanelOpen(false);
      setEditor(null);
      setEditorCache({});
      saveToken.current = null;
    }
  }

  async function saveReferences(): Promise<void> {
    if (!draft || referenceReviewError(referenceEntries)) return;
    referenceToken.current ??= crypto.randomUUID();
    const entries = referenceEntries.filter((entry) => entry.selected);
    const ok = await perform(
      () =>
        confirmAiMaterialReference({
          draftId: draft.id,
          expectedRevision: draft.revision,
          operationId: referenceToken.current,
          references: entries.map(({ reference, sourceName }) => ({ reference, sourceName })),
        }),
      "references",
    );
    if (ok) {
      referenceToken.current = null;
      setReferencesOpen(false);
      setNotice(`${entries.length} referensi tersimpan. Kesiapan material sudah diperbarui.`);
      if (!isBatch) setReviewOpen(false);
    }
  }
  function selectRow(id: string, checked: boolean): void {
    if (!draft) return;
    const intent = selectionIntent.current;
    const current = intent?.draftId === draft.id ? withSelection(draft, intent.rowIds) : draft;
    queueSelection(materialRowSelection(current.payload.rows, id, checked));
  }
  function edit(row: MaterialCandidate): void {
    if (selectionIntent.current) return;
    if (!row.materialId && ready) {
      if (editor && editorDirty(editor))
        setEditorCache((records) => ({ ...records, [editor.row.id]: editor }));
      if (editor?.row.id === row.id && panelOpen) {
        setPanelOpen(false);
        return;
      }
      setReferencesOpen(false);
      const cached = editorCache[row.id];
      setEditor(
        cached && editorDirty(cached)
          ? cached
          : {
              row,
              fields: { ...row.fields },
              selected: row.selected,
              revision: draft?.revision ?? 1,
            },
      );
      setPanelOpen(true);
    }
  }

  function change<K extends keyof MaterialFields>(key: K, value: MaterialFields[K]): void {
    setEditor((current) =>
      current ? { ...current, fields: { ...current.fields, [key]: value } } : null,
    );
  }
  const referenceSuggestions = materialReferenceSuggestions(draft);
  const complete = state.phase === "complete";
  const canReviewList = ready || complete || state.phase === "cancelled";
  const availableFilters = materialReviewFilters(state);
  const isBatch = state.total > 1;
  const visibleFilter = availableFilters.includes(filter) ? filter : complete ? "saved" : "pending";
  const filteredRows =
    ready || complete
      ? materialReviewRows(draft?.payload.rows ?? [], visibleFilter)
      : (draft?.payload.rows ?? []);
  const pageSize = 5;
  const rowCount = filteredRows.length;
  const pageCount = Math.max(1, Math.ceil(rowCount / pageSize));
  const page = Math.min(Math.floor(pageAnchor / pageSize), pageCount - 1);
  const rows = filteredRows.slice(page * pageSize, (page + 1) * pageSize);
  function remember(anchor: number, currentFilter: MaterialReviewFilter): void {
    if (!draft) return;
    try {
      window.sessionStorage.setItem(
        `atria:material-review:${draft.id}`,
        JSON.stringify({ anchor, filter: currentFilter }),
      );
    } catch {
      /* Storage is optional; the server owns rows and selection. */
    }
  }
  function changePage(anchor: number): void {
    setPageAnchor(anchor);
    remember(anchor, visibleFilter);
  }
  function changeFilter(value: MaterialReviewFilter): void {
    setFilter(value);
    setPageAnchor(0);
    remember(0, value);
  }
  function restoreBookmark(draftId: string): void {
    if (bookmarkDraft.current === draftId) return;
    bookmarkDraft.current = draftId;
    try {
      const value: unknown = JSON.parse(
        window.sessionStorage.getItem(`atria:material-review:${draftId}`) ?? "null",
      );
      const parsed = z
        .object({
          anchor: z.number().int().min(0).max(499),
          filter: z.enum(["pending", "review", "saved"]),
        })
        .safeParse(value);
      if (parsed.success) {
        setPageAnchor(parsed.data.anchor);
        setFilter(parsed.data.filter);
      }
    } catch {
      /* A missing bookmark starts at the first page. */
    }
  }
  async function refresh(): Promise<void> {
    if (!draft) return;
    if (await perform(() => getAiMaterialDraft({ draftId: draft.id }), "refresh"))
      setNotice("Draft sudah memakai data terbaru dari server.");
  }
  const overlayOpen = reviewOpen || panelOpen;
  const sheetValue = React.useMemo(
    () =>
      overlayOpen
        ? { editor: isBatch ? editor : panelOpen ? editor : null, references: referencesOpen }
        : null,
    [overlayOpen, panelOpen, editor, referencesOpen, isBatch],
  );
  const sheetPresence = useSheetPresenceValue(sheetValue, overlayOpen ? "material-review" : null);
  const presentedEditor = sheetPresence.presentedValue?.editor;
  const activeEditor = panelOpen ? presentedEditor : null;
  const presentedReferences = sheetPresence.presentedValue?.references;
  function openReview(): void {
    setReviewOpen(true);
    if (editor) setPanelOpen(true);
  }
  function openReferences(): void {
    setReferenceEntries((previous) => reconcileReferenceReview(referenceSuggestions, previous));
    setReviewOpen(true);
    setPanelOpen(false);
    setReferencesOpen(true);
  }
  function closeReview(): void {
    setReviewOpen(false);
    setPanelOpen(false);
  }
  const referenceError = referenceReviewError(referenceEntries);
  const selectedReferences = referenceEntries.filter((entry) => entry.selected).length;
  const menuItems: ActionMenuItem[] = [
    { id: "refresh", label: "Cek pembaruan", onSelect: () => void refresh() },
    ...(ready && !complete && selected.length < eligible.length
      ? [{ id: "select", label: "Pilih semua siap", onSelect: () => void selectRows(true) }]
      : []),
    ...(ready && !complete && selected.length > 0
      ? [{ id: "clear", label: "Kosongkan pilihan", onSelect: () => void selectRows(false) }]
      : []),
    {
      id: "discard",
      label: state.saved ? "Batalkan sisa draft" : "Batalkan draft",
      tone: "critical",
      onSelect: () => setDiscardOpen(true),
    },
  ];
  const summary = complete ? (
    <p className="text-support text-on-surface-variant">
      {state.saved} material sudah ditambahkan ke Material Master.
    </p>
  ) : state.phase === "cancelled" ? (
    <p className="text-support text-on-surface-variant">
      {state.saved} tersimpan · {state.remaining} tidak disimpan.
    </p>
  ) : (
    <InlineReviewStrip
      items={[
        { label: "Siap", value: String(state.valid) },
        {
          label: "Periksa",
          value: String(state.blocked),
          tone: state.blocked ? "warning" : "default",
        },
        { label: "Tersimpan", value: String(state.saved) },
      ]}
    />
  );
  const blockers =
    ready && referenceSuggestions.length > 0 ? (
      <FormRiskNotice title={`${referenceSuggestions.length} referensi perlu didaftarkan`}>
        <div className="space-y-2">
          <p>
            Lengkapi kategori, lokasi, atau vendor yang belum terdaftar agar material terkait siap
            disimpan.
          </p>
          <Button
            variant="secondary"
            size="compact"
            disabled={pending || hasUnappliedEdit || selectionBusy}
            onClick={openReferences}
          >
            Tinjau referensi baru
          </Button>
        </div>
      </FormRiskNotice>
    ) : null;
  const selectionFeedback = selectionError ? (
    <FormRiskNotice title="Pilihan belum tersimpan">
      <p>{selectionError}</p>
      <Button variant="secondary" size="compact" onClick={() => void flushSelection()}>
        Coba simpan pilihan lagi
      </Button>
    </FormRiskNotice>
  ) : null;
  const editorContent = presentedEditor ? (
    <div className="space-y-4">
      {(presentedEditor.row.similarNames?.length ?? 0) > 0 && (
        <FormRiskNotice title="Periksa material yang mirip">
          {presentedEditor.row.similarNames.join(" · ")}. Penyimpanan ini selalu membuat material
          baru.
        </FormRiskNotice>
      )}
      <FormSection
        presentation="embedded"
        title="Identitas material"
        contentClassName={presentation === "desktop" ? "grid grid-cols-2" : ""}
      >
        <FormField label="Nama" required>
          <TextInput
            value={presentedEditor.fields.name}
            onChange={(value) => change("name", value)}
          />
        </FormField>
        <ComboboxField
          label="Kategori"
          value={presentedEditor.fields.categoryName}
          options={draft?.options.categories ?? []}
          onChange={(value) => change("categoryName", value)}
        />
        <ComboboxField
          label="Satuan"
          value={presentedEditor.fields.unit}
          options={COMMON_UNIT_OPTIONS}
          onChange={(value) => change("unit", value)}
        />
        <ComboboxField
          label="Lokasi"
          value={presentedEditor.fields.locationName}
          options={draft?.options.locations ?? []}
          onChange={(value) => change("locationName", value)}
        />
        <ComboboxField
          label="Vendor"
          value={presentedEditor.fields.vendorName}
          options={draft?.options.vendors ?? []}
          onChange={(value) => change("vendorName", value)}
        />
        <SwitchRow
          title="Simpan tanpa vendor"
          checked={presentedEditor.fields.withoutVendor}
          onChange={(value) => change("withoutVendor", value)}
        />
        <SwitchRow
          title="Pilih baris ini untuk disimpan"
          checked={presentedEditor.selected}
          onChange={(selectedValue) => setEditor({ ...presentedEditor, selected: selectedValue })}
        />
      </FormSection>
      <FormSection
        presentation="embedded"
        title="Detail dan acuan"
        contentClassName={presentation === "desktop" ? "grid grid-cols-2" : ""}
      >
        {(["specification", "brand", "code", "color"] as const).map((key) => (
          <FormField
            key={key}
            label={
              key === "specification"
                ? "Spesifikasi"
                : key === "brand"
                  ? "Merek"
                  : key === "code"
                    ? "Kode"
                    : "Warna"
            }
          >
            <TextInput
              value={presentedEditor.fields[key]}
              onChange={(value) => change(key, value)}
            />
          </FormField>
        ))}
        <FormField label="Harga acuan">
          <MoneyInput
            value={presentedEditor.fields.lastPurchasePrice}
            onChange={(value) => change("lastPurchasePrice", Number(value || 0))}
          />
        </FormField>
        <FormField label="Minimum stok">
          <NumericInput
            value={String(presentedEditor.fields.minimumStock)}
            onChange={(value) => change("minimumStock", Number(value || 0))}
          />
        </FormField>
      </FormSection>
      <FormSection
        presentation="embedded"
        title="Sumber"
        helper={`${presentedEditor.row.source.fileName ?? "Percakapan"}${presentedEditor.row.source.sheet ? ` · ${presentedEditor.row.source.sheet}` : ""}${presentedEditor.row.source.imageRegion ? ` · bagian ${presentedEditor.row.source.imageRegion.index + 1}` : ""} · baris ${presentedEditor.row.source.row}`}
      >
        <FormField label="Nilai asli">
          <Textarea value={presentedEditor.row.source.raw} readOnly />
        </FormField>
      </FormSection>
    </div>
  ) : null;
  const list = (
    <div className="space-y-4">
      {presentation !== "desktop" && (
        <div className="space-y-3">
          {summary}
          {error && (
            <Button
              variant="secondary"
              size="compact"
              disabled={pending || hasUnappliedEdit}
              onClick={() => void refresh()}
            >
              Cek pembaruan draft
            </Button>
          )}
          {notice && (
            <p role="status" className="text-support text-on-surface-variant">
              {notice}
            </p>
          )}
          {blockers}
          {selectionFeedback}
        </div>
      )}
      {ready && !complete && availableFilters.length > 1 && (
        <SegmentedTabs
          ariaLabel="Daftar material dalam draft"
          layoutId={filterMotionId}
          density="compact"
          value={visibleFilter}
          onChange={changeFilter}
          options={availableFilters.map((value) => {
            const count =
              value === "pending"
                ? state.remaining
                : value === "review"
                  ? state.blocked
                  : state.saved;
            return {
              value,
              label: value === "pending" ? "Draft" : value === "review" ? "Periksa" : "Tersimpan",
              count,
              countLabel: `${count} material`,
              disabled: pending,
            };
          })}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-support font-semibold">
          {visibleFilter === "saved" ? "Material tersimpan" : `${selected.length} material dipilih`}
        </p>
        {ready && !complete && visibleFilter !== "saved" && (
          <div className="flex gap-2">
            <Button
              variant="tertiary"
              size="compact"
              disabled={
                pending ||
                hasUnappliedEdit ||
                !eligible.length ||
                selected.length === eligible.length
              }
              onClick={() => void selectRows(true)}
            >
              Pilih semua siap
            </Button>
            {selected.length > 0 && (
              <Button
                variant="tertiary"
                size="compact"
                disabled={pending || hasUnappliedEdit}
                onClick={() => void selectRows(false)}
              >
                Kosongkan
              </Button>
            )}
          </div>
        )}
      </div>
      {rows.length && canReviewList ? (
        <MaterialReviewList
          rows={rows}
          desktop={presentation === "desktop"}
          editable={ready && !complete}
          pending={pending}
          editingBlocked={selectionBusy}
          onEdit={edit}
          activeRowId={activeEditor?.row.id ?? null}
          editorRowId={presentedEditor?.row.id ?? null}
          editorContent={editorContent}
          selectionBlocked={hasUnappliedEdit}
          onSelect={(id, checked) => void selectRow(id, checked)}
          page={page}
          pageSize={pageSize}
          rowCount={rowCount}
          onPage={changePage}
        />
      ) : (
        <p className="text-support text-on-surface-variant">Tidak ada material pada daftar ini.</p>
      )}
      {state.duplicates > 0 && (
        <p className="text-meta text-on-surface-variant">
          {state.duplicates} duplikat perlu diperiksa. Material lama tidak akan ditimpa.
        </p>
      )}
      <FormDisclosure
        variant="plain"
        title="Rincian dan riwayat simpan"
        expanded={detailsOpen}
        onToggle={() => setDetailsOpen((value) => !value)}
      >
        <div className="space-y-2 text-meta text-on-surface-variant">
          <p>
            Stok awal 0. Kuantitas sumber tidak menjadi stok masuk. Referensi tetap tersimpan jika
            draft dibatalkan.
          </p>
          <p>Cek pembaruan mengambil draft dan referensi terbaru; tidak mengulang analisis.</p>
          {draft?.payload.receipts.map((receipt, index) => (
            <div key={receipt.operationId}>
              <p className="font-semibold">
                Penyimpanan {index + 1} · {receipt.rows.length} material
              </p>
              <p>
                {receipt.rows
                  .map(
                    (item) => draft.payload.rows.find((row) => row.id === item.rowId)?.fields.name,
                  )
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          ))}
        </div>
      </FormDisclosure>
    </div>
  );
  return (
    <>
      <ProposalCardShell
        title="Material Master"
        headerAction={
          draft && !complete && state.phase !== "cancelled" ? (
            <ActionMenu
              label="Opsi draft material"
              trigger={
                <IconButton
                  label="Opsi draft material"
                  icon={<AppIcon name="more_horiz" />}
                  variant="tertiary"
                  size="compact"
                  disabled={pending || overlayOpen || hasUnappliedEdit || selectionBusy}
                />
              }
              items={menuItems}
            />
          ) : undefined
        }
        status={
          operation === "save" ? "submitting" : error ? "failed" : complete ? "submitted" : "idle"
        }
        statusLabel={
          complete
            ? "Selesai"
            : state.phase === "review"
              ? state.saved
                ? "Sebagian"
                : state.valid
                  ? "Draft"
                  : "Periksa"
              : state.badge
        }
        errorMessage={error}
        isAlreadyConfirmed={complete}
        showConfirmAction={isBatch ? canReviewList : ready && state.valid > 0}
        submittedMessage={`${state.saved} material tersimpan. Stok awal 0.`}
        disabled={pending || (!isBatch && (!selected.length || hasUnappliedEdit || selectionBusy))}
        disabledReason={
          state.phase === "loading" || state.phase === "analysing"
            ? "Analisis tetap berjalan. Chat boleh ditutup; progres tersimpan."
            : state.phase === "failed"
              ? "Lanjutkan analisis untuk mencoba lagi dari progres terakhir."
              : isBatch
                ? state.phase === "review"
                  ? `${state.total} material · pilihan dan koreksi tersimpan dalam draft.`
                  : state.detail
                : selected.length
                  ? "Stok awal 0. Simpan setelah detail material sesuai."
                  : "Lengkapi referensi atau koreksi material terlebih dahulu."
        }
        confirmLabel={
          isBatch ? `Tinjau ${state.total} material` : `Simpan ${selected.length} material`
        }
        onConfirm={isBatch ? async () => openReview() : save}
        viewActionLabel={isBatch ? "Lihat hasil import" : undefined}
        onViewAction={isBatch ? openReview : undefined}
      >
        <div className="space-y-3 p-4">
          <div role="status" aria-live="polite" className="space-y-1">
            <p className="text-support font-semibold text-on-surface">{state.headline}</p>
            {state.phase !== "review" && !complete && (
              <p className="text-support text-on-surface-variant">{state.detail}</p>
            )}
          </div>
          {isBatch ? (
            <>
              {summary}
              {referenceSuggestions.length > 0 && ready && (
                <p className="flex items-start gap-2 text-meta text-on-surface-variant">
                  <AppIcon name="warning" className="icon-sm shrink-0" />
                  {referenceSuggestions.length} referensi perlu didaftarkan sebelum material terkait
                  disimpan.
                </p>
              )}
              {notice && <p className="text-meta text-on-surface-variant">{notice}</p>}
            </>
          ) : canReviewList ? (
            list
          ) : null}
          {draft?.payload.error && (
            <FormRiskNotice
              tone="warning"
              title={
                state.phase === "failed"
                  ? "Analisis belum selesai"
                  : "Menunggu percobaan berikutnya"
              }
            >
              {draft.payload.error}
            </FormRiskNotice>
          )}
          {draft && state.phase === "failed" && (
            <Button
              variant="secondary"
              size="compact"
              disabled={pending}
              onClick={() =>
                void perform(() => retryAiMaterialAnalysis({ draftId: draft.id }), "retry")
              }
            >
              Lanjutkan analisis
            </Button>
          )}
          {!draft && !isStreaming && (
            <Button variant="secondary" disabled={pending} onClick={() => void start()}>
              Ambil draft
            </Button>
          )}
        </div>
      </ProposalCardShell>
      <ConfirmationDialog
        actionLayout="adaptive"
        open={discardOpen}
        title={state.saved ? "Batalkan sisa draft?" : "Batalkan draft material?"}
        description="Analisis dan material yang belum tersimpan akan dihentikan. Material serta referensi yang sudah dibuat tetap ada."
        confirmLabel="Batalkan draft"
        danger
        pending={pending}
        onClose={() => setDiscardOpen(false)}
        onConfirm={async () => {
          if (
            draft &&
            (await perform(() => discardAiMaterialDraft({ draftId: draft.id }), "discard"))
          )
            setDiscardOpen(false);
        }}
      />
      <WorkflowFormSheet
        dismissal={{ mode: "preserve" }}
        open={overlayOpen}
        initialExpanded={isBatch}
        sizing={presentation === "desktop" ? "content" : isBatch ? "maximum" : "content"}
        contentKey={
          activeEditor && !isBatch
            ? `edit:${activeEditor.row.id}`
            : presentedReferences
              ? "references"
              : "review"
        }
        desktopSize="wide"
        desktopFooterPlacement="aside"
        desktopAsideSummary={
          <div className="space-y-4">
            <GroupedSurface>
              <div className="divide-y divide-outline-variant/20">
                {presentedReferences ? (
                  <>
                    <FactRow label="Referensi dipilih" value={selectedReferences} />
                    {(["category", "location", "vendor"] as const).map((kind) => (
                      <FactRow
                        key={kind}
                        label={
                          kind === "category"
                            ? "Kategori"
                            : kind === "location"
                              ? "Lokasi"
                              : "Vendor"
                        }
                        value={
                          referenceEntries.filter(
                            (entry) => entry.selected && entry.reference.kind === kind,
                          ).length
                        }
                      />
                    ))}
                  </>
                ) : (
                  <>
                    <div className="px-4 py-3 text-support font-semibold">
                      {activeEditor ? "Koreksi material" : state.headline}
                      {activeEditor && (
                        <p className="mt-1 text-meta font-normal wrap-anywhere text-on-surface-variant">
                          {activeEditor.fields.name || "Nama belum diisi"}
                        </p>
                      )}
                    </div>
                    <FactRow label="Dipilih untuk disimpan" wrapLabel value={selected.length} />
                    <FactRow label="Siap" value={state.valid} />
                    <FactRow label="Perlu diperiksa" value={state.blocked} />
                    <FactRow label="Tersimpan" value={state.saved} />
                  </>
                )}
              </div>
            </GroupedSurface>
            {!presentedReferences && blockers}
            {selectionFeedback}
            {!presentedReferences && notice && (
              <p role="status" className="text-support text-on-surface-variant">
                {notice}
              </p>
            )}
            {error && (
              <Button
                variant="secondary"
                size="compact"
                disabled={pending || hasUnappliedEdit}
                onClick={() => void refresh()}
              >
                Cek pembaruan draft
              </Button>
            )}
          </div>
        }
        onExitComplete={sheetPresence.handleExitComplete}
        title={
          activeEditor && !isBatch
            ? "Koreksi material"
            : presentedReferences
              ? "Referensi baru"
              : "Tinjau material"
        }
        secondaryLabel={
          activeEditor ? "Batalkan koreksi" : presentedReferences ? "Kembali ke daftar" : undefined
        }
        onSecondary={
          activeEditor || presentedReferences
            ? () => {
                setEditor(null);
                setEditorCache({});
                setPanelOpen(false);
                setReferencesOpen(false);
                referenceToken.current = null;
              }
            : undefined
        }
        primaryLabel={
          hasUnappliedEdit || activeEditor
            ? pendingEditors.length > 1
              ? `Konfirmasi ${pendingEditors.length} koreksi`
              : "Konfirmasi koreksi"
            : presentedReferences
              ? `Buat ${selectedReferences} referensi`
              : complete || state.phase === "cancelled"
                ? "Tutup review"
                : selected.length
                  ? `Simpan ${selected.length} material`
                  : "Simpan material"
        }
        pending={pending}
        pendingLabel={presentedReferences ? "Membuat referensi…" : "Menyimpan…"}
        disabled={
          selectionBusy ||
          (presentedReferences
            ? Boolean(referenceError)
            : !activeEditor &&
              !hasUnappliedEdit &&
              !complete &&
              state.phase !== "cancelled" &&
              (!selected.length || !ready || hasUnappliedEdit))
        }
        disabledReason={
          selectionBusy
            ? undefined
            : presentedReferences
              ? referenceError
              : !activeEditor && !complete && state.phase !== "cancelled"
                ? !selected.length
                  ? "Pilih material yang siap melalui checkbox atau Pilih semua siap."
                  : `${state.remaining - selected.length} lainnya tetap di draft. Stok awal 0.`
                : undefined
        }
        statusText={
          (selectionPhase === "saving" ? "Menyimpan pilihan…" : error) ||
          (activeEditor
            ? "Koreksi memperbarui draft; material belum disimpan."
            : presentedReferences
              ? "Persetujuan ini hanya membuat referensi."
              : complete
                ? `${state.saved} material sudah tersimpan.`
                : undefined)
        }
        statusTone={error ? "danger" : "default"}
        onClose={closeReview}
        onPrimary={() =>
          void (activeEditor || hasUnappliedEdit
            ? saveEdit()
            : presentedReferences
              ? saveReferences()
              : complete || state.phase === "cancelled"
                ? closeReview()
                : save())
        }
      >
        {presentedReferences ? (
          <MaterialReferenceReview
            entries={referenceEntries}
            pending={pending}
            onChange={(entries) => {
              setReferenceEntries(entries);
              referenceToken.current = null;
            }}
          />
        ) : activeEditor && !isBatch ? (
          editorContent
        ) : (
          list
        )}
      </WorkflowFormSheet>
    </>
  );
}
