"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  discardExpenseDraft,
  getExpenseDraft,
  listExpenseDrafts,
  submitExpenseDraft,
  type ExpenseDraftSummary,
} from "@/app/actions/finance/expense-drafts";
import { WorkflowFormSheet } from "@/components/ui";
import type { OperationSuccess } from "@/components/ui";
import { ExpenseFormNotice } from "@/features/expenses/components/forms/expense-form-sections";
import { ExpenseActiveDrafts } from "@/features/expenses/components/forms/expense-active-drafts";
import { ExpenseFormEntryFields } from "@/features/expenses/components/forms/expense-form-entry-fields";
import { ExpenseFormReview } from "@/features/expenses/components/forms/expense-form-review";
import { ExpenseFormOverlays } from "@/features/expenses/components/forms/expense-form-overlays";
import type {
  ExpenseDraftPayload,
  ExpenseFormProject,
  InventoryLocationOption,
} from "@/features/expenses/types/expense-form-types";
import {
  createBlankExpenseDraft,
  isExpenseLineComplete,
  mergeExpenseLines,
  STOCK_HANDLING_OPTIONS,
} from "@/features/expenses/utils/expense-form-utils";
import {
  uploadAndParseExpenseReceipt,
  type ExpenseReceiptOcrResult,
} from "@/features/expenses/utils/expense-receipt-ocr";
import { useHybridExpenseDraft } from "@/features/expenses/hooks/use-hybrid-expense-draft";
import { useExpenseLineMutations } from "@/features/expenses/hooks/use-expense-line-mutations";
import {
  getLastExpenseProject,
  getServerLastExpenseProject,
  hasMeaningfulLine,
  routeProjectId,
  subscribeLastExpenseProject,
} from "@/features/expenses/utils/expense-form-local-utils";
import { updateUrlSearchParam } from "@/lib/utils/use-url-search-param";

export type { ExpenseFormProject } from "@/features/expenses/types/expense-form-types";

interface ExpenseFormProps {
  readonly open?: boolean;
  readonly onClose?: () => void;
  readonly projects: ExpenseFormProject[];
  readonly inventoryLocations?: InventoryLocationOption[];
  readonly requestedDraftId?: string | null;
}

export function ExpenseForm({
  open = true,
  onClose,
  projects,
  inventoryLocations = [],
  requestedDraftId = null,
}: ExpenseFormProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const safeRouteProjectId = routeProjectId(pathname);
  const lastProjectId = React.useSyncExternalStore(
    subscribeLastExpenseProject,
    getLastExpenseProject,
    getServerLastExpenseProject,
  );
  const draft = useHybridExpenseDraft(
    createBlankExpenseDraft(safeRouteProjectId),
    !requestedDraftId,
  );
  const hydrateDraft = draft.hydrate;
  const [loadedDraftId, setLoadedDraftId] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [processingOcr, setProcessingOcr] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [closeGuardOpen, setCloseGuardOpen] = React.useState(false);
  const [conflictOpen, setConflictOpen] = React.useState(false);
  const [projectChange, setProjectChange] = React.useState<string | null>(null);
  const [pendingOcr, setPendingOcr] = React.useState<ExpenseReceiptOcrResult | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [discarding, setDiscarding] = React.useState(false);
  const [success, setSuccess] = React.useState<OperationSuccess | null>(null);
  const [drafts, setDrafts] = React.useState<readonly ExpenseDraftSummary[]>([]);
  const [pendingDiscardDraftId, setPendingDiscardDraftId] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  const refreshDrafts = React.useCallback((): void => {
    startTransition(async () => {
      const response = await listExpenseDrafts();
      if (response.success) setDrafts(response.data);
    });
  }, []);

  React.useEffect(() => {
    if (open) refreshDrafts();
  }, [open, refreshDrafts]);

  React.useEffect(() => {
    if (!open || !requestedDraftId) return;
    let cancelled = false;
    void getExpenseDraft({ draftId: requestedDraftId }).then((response) => {
      if (cancelled) return;
      setLoadedDraftId(requestedDraftId);
      if (!response.success) {
        setFormError(response.error.message);
        return;
      }
      hydrateDraft(response.data);
    });
    return () => {
      cancelled = true;
    };
  }, [hydrateDraft, open, requestedDraftId]);

  const selectedProject = projects.find((project) => project.id === draft.payload.projectId);
  const budgetCategories =
    selectedProject?.canonicalBudgets?.[0]?.categories
      ?.slice()
      .sort((left, right) => left.sortOrder - right.sortOrder) ?? [];
  const selectedProjectApproved = selectedProject?.canonicalBudgets?.[0]?.status === "APPROVED";
  const lineCompleteness = draft.payload.lines.map((line) => {
    const category = budgetCategories.find((item) => item.id === line.projectBudgetCategoryId);
    return isExpenseLineComplete(line, category?.code);
  });
  const incompleteCount = lineCompleteness.filter((complete) => !complete).length;
  const totalAmount = draft.payload.lines.reduce(
    (total, line) => total + (Number(line.amount) || 0),
    0,
  );
  const loadingDraft = Boolean(open && requestedDraftId && loadedDraftId !== requestedDraftId);
  const busy = loadingDraft || uploading || processingOcr || submitting || discarding;
  const canReview =
    Boolean(draft.payload.projectId) && selectedProjectApproved && incompleteCount === 0;
  const reviewDisabledReason = !draft.payload.projectId
    ? "Pilih proyek agar kategori budget dan jalur approval dapat disiapkan."
    : !selectedProjectApproved
      ? "Budget proyek belum disetujui. Pengeluaran belum dapat diajukan."
      : incompleteCount > 0
        ? `${incompleteCount} item masih perlu dilengkapi.`
        : undefined;

  const projectOptions = projects.map((project) => {
    const approved = project.canonicalBudgets?.[0]?.status === "APPROVED";
    return {
      value: project.id,
      label: project.name,
      description: approved
        ? "Budget disetujui · siap mencatat pengeluaran"
        : "Budget belum disetujui",
      disabled: !approved,
      disabledReason: approved ? undefined : "Setujui budget proyek sebelum mencatat pengeluaran.",
    };
  });
  const { updateLine, addLine, duplicateLine, removeLine, restoreLine, moveLine } =
    useExpenseLineMutations({ budgetCategories, updatePayload });

  function closeForm(): void {
    if (onClose) {
      onClose();
      return;
    }
    router.push("/expenses");
  }

  function requestClose(): void {
    if (reviewOpen) {
      setReviewOpen(false);
      return;
    }
    if (draft.isDirty) {
      setCloseGuardOpen(true);
      return;
    }
    closeForm();
  }

  function updatePayload(change: (payload: ExpenseDraftPayload) => ExpenseDraftPayload): void {
    setFormError(null);
    draft.updatePayload(change);
  }

  function applyProjectChange(projectId: string): void {
    updatePayload((current) => ({
      ...current,
      projectId,
      lines: current.lines.map((line) => ({
        ...line,
        projectBudgetCategoryId: "",
        projectBudgetItemId: "",
        materialId: "",
        projectRapItemId: "",
        projectCategoryPlanItemId: "",
        stockHandling: "EXPENSE_ONLY",
        inventoryLocationId: "",
      })),
      ocrWarning: null,
    }));
    if (typeof window !== "undefined") {
      window.localStorage.setItem("atria:last-expense-project", projectId);
      window.dispatchEvent(new Event("atria:last-expense-project-changed"));
    }
    setProjectChange(null);
  }

  function requestProjectChange(projectId: string): void {
    if (
      draft.payload.projectId &&
      draft.payload.projectId !== projectId &&
      draft.payload.lines.some(hasMeaningfulLine)
    ) {
      setProjectChange(projectId);
      return;
    }
    applyProjectChange(projectId);
  }

  async function loadDraft(id: string): Promise<void> {
    const response = await getExpenseDraft({ draftId: id });
    if (!response.success) {
      setFormError(response.error.message);
      return;
    }
    hydrateDraft(response.data);
    setLoadedDraftId(id);
    setReviewOpen(false);
  }

  async function discardDraftById(id: string): Promise<void> {
    const response = await discardExpenseDraft({ draftId: id });
    if (!response.success) {
      setFormError(response.error.message);
      return;
    }
    if (draft.draftId === id) draft.reset(createBlankExpenseDraft(safeRouteProjectId));
    setDrafts((current) => current.filter((item) => item.id !== id));
    window.dispatchEvent(new Event("atria:expense-drafts-changed"));
    toast.success("Draft pengeluaran dibuang.");
  }

  async function handleReceipt(file: File): Promise<void> {
    setUploadError(null);
    setFormError(null);
    setUploading(true);
    setProcessingOcr(false);
    try {
      const resultPromise = uploadAndParseExpenseReceipt({
        file,
        budgetCategories,
      });
      setUploading(false);
      setProcessingOcr(true);
      const result = await resultPromise;
      setProcessingOcr(false);
      updatePayload((current) => ({
        ...current,
        inputMode: "RECEIPT",
        receipt: result.attachment,
        ocrWarning: result.warning,
      }));
      if (result.lines.length === 0) {
        toast.info("Nota tersimpan. Item dapat dilengkapi secara manual.");
        return;
      }
      if (draft.payload.lines.some(hasMeaningfulLine)) {
        setPendingOcr(result);
      } else {
        updatePayload((current) => ({
          ...current,
          lines: mergeExpenseLines(current.lines, result.lines, "REPLACE"),
        }));
        toast.success("Hasil scan siap diperiksa.");
      }
    } catch (error) {
      setUploading(false);
      setProcessingOcr(false);
      const message = error instanceof Error ? error.message : "Gagal mengunggah nota.";
      setUploadError(`${message} Item yang sudah diisi tetap aman.`);
    }
  }

  async function openReview(): Promise<void> {
    if (!canReview) {
      setFormError(reviewDisabledReason ?? "Lengkapi form sebelum meninjau.");
      window.setTimeout(() => {
        document
          .querySelector<HTMLElement>('[data-expense-incomplete="true"]')
          ?.focus({ preventScroll: false });
      }, 0);
      return;
    }
    const saved = await draft.saveNow();
    if (!saved.success && saved.reason === "conflict") {
      setConflictOpen(true);
      return;
    }
    setReviewOpen(true);
  }

  async function submitDraft(): Promise<void> {
    if (submitting) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setFormError("Hubungkan kembali perangkat sebelum mengajukan pengeluaran.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const saved = await draft.saveNow();
    if (!saved.success) {
      setSubmitting(false);
      if (saved.reason === "conflict") setConflictOpen(true);
      else setFormError(saved.message);
      return;
    }
    const response = await submitExpenseDraft({
      draftId: saved.record.id,
      expectedRevision: saved.record.revision,
    });
    setSubmitting(false);
    if (!response.success) {
      setFormError(response.error.message);
      if (response.error.code === "CONFLICT") setConflictOpen(true);
      return;
    }
    draft.clearRecovery();
    window.dispatchEvent(new Event("atria:expense-drafts-changed"));
    setReviewOpen(false);
    toast.success("Pengeluaran berhasil diajukan.");
    setSuccess({
      title: "Pengeluaran Berhasil Diajukan",
      description: "Pengeluaran tercatat dan siap diproses oleh tim Finance.",
      facts: [
        { label: "Proyek", value: selectedProject?.name ?? "–" },
        { label: "Jumlah Item", value: `${response.data.itemCount} item` },
        {
          label: "Total Pengeluaran",
          value: `Rp ${response.data.totalAmount.toLocaleString("id-ID")}`,
        },
      ],
    });
  }

  async function saveAndClose(): Promise<void> {
    const result = await draft.saveNow();
    if (!result.success && result.reason !== "offline") {
      if (result.reason === "conflict") setConflictOpen(true);
      else setFormError(result.message);
      return;
    }
    setCloseGuardOpen(false);
    closeForm();
  }

  async function discardAndClose(): Promise<void> {
    setDiscarding(true);
    if (draft.draftId) {
      const response = await discardExpenseDraft({ draftId: draft.draftId });
      if (!response.success) {
        setDiscarding(false);
        setFormError(response.error.message);
        return;
      }
    }
    draft.clearRecovery();
    window.dispatchEvent(new Event("atria:expense-drafts-changed"));
    setDiscarding(false);
    setCloseGuardOpen(false);
    closeForm();
  }

  async function loadServerVersion(): Promise<void> {
    if (!draft.draftId) return;
    const response = await getExpenseDraft({ draftId: draft.draftId });
    if (!response.success) {
      setFormError(response.error.message);
      return;
    }
    draft.hydrate(response.data);
    setConflictOpen(false);
  }

  async function saveConflictCopy(): Promise<void> {
    const result = await draft.saveAsCopy();
    if (!result.success) {
      setFormError(result.message);
      return;
    }
    setConflictOpen(false);
    toast.success("Versi lokal disimpan sebagai draft baru.");
  }

  const categorySummaries = budgetCategories
    .map((category) => {
      const amount = draft.payload.lines
        .filter((line) => line.projectBudgetCategoryId === category.id)
        .reduce((total, line) => total + Number(line.amount || 0), 0);
      return { category, amount };
    })
    .filter((summary) => summary.amount > 0);
  const stockLines = draft.payload.lines.filter((line) => line.stockHandling !== "EXPENSE_ONLY");
  const online = typeof navigator === "undefined" || navigator.onLine;
  const submitBlocked =
    submitting ||
    !online ||
    draft.status === "offline" ||
    draft.status === "dirty" ||
    draft.status === "saving" ||
    draft.status === "conflict";
  const syncTone =
    draft.status === "saved"
      ? "success"
      : draft.status === "offline" || draft.status === "conflict" || draft.status === "error"
        ? "danger"
        : "warning";
  const lastProjectSuggestion = projects.find((project) => project.id === lastProjectId);

  return (
    <>
      <WorkflowFormSheet
        open={open && success === null}
        title={
          reviewOpen
            ? "Tinjau Pengeluaran"
            : requestedDraftId
              ? "Lanjutkan Draft"
              : "Tambah Pengeluaran"
        }
        primaryLabel={reviewOpen ? "Ajukan" : "Tinjau"}
        secondaryLabel={reviewOpen ? "Ubah" : "Simpan"}
        pending={reviewOpen ? submitting : loadingDraft}
        pendingLabel={reviewOpen ? "Mengajukan…" : "Memuat Draft…"}
        disabled={reviewOpen ? submitBlocked : busy || !canReview}
        disabledReason={
          reviewOpen
            ? !online
              ? "Perangkat sedang offline. Sambungkan kembali sebelum mengajukan."
              : draft.status !== "saved"
                ? "Tunggu hingga draft selesai tersinkron sebelum mengajukan."
                : undefined
            : reviewDisabledReason
        }
        statusText={`${draft.statusLabel} · ${draft.payload.lines.length} item · Rp ${totalAmount.toLocaleString("id-ID")}`}
        statusTone={
          reviewOpen
            ? categorySummaries.some(
                ({ category, amount }) => amount > Number(category.remainingAmount),
              )
              ? "danger"
              : "success"
            : syncTone
        }
        onClose={requestClose}
        onPrimary={() => (reviewOpen ? void submitDraft() : void openReview())}
        onSecondary={() => (reviewOpen ? setReviewOpen(false) : void saveAndClose())}
      >
        <div className="space-y-5">
          {formError ? (
            <ExpenseFormNotice tone="error" icon="error">
              {formError}
            </ExpenseFormNotice>
          ) : null}
          {draft.errorMessage && !formError ? (
            <ExpenseFormNotice tone="warning" icon="sync_problem">
              {draft.errorMessage}
            </ExpenseFormNotice>
          ) : null}
          {draft.payload.ocrWarning ? (
            <ExpenseFormNotice
              tone="warning"
              icon="fact_check"
              onDismiss={() => updatePayload((current) => ({ ...current, ocrWarning: null }))}
            >
              {draft.payload.ocrWarning}
            </ExpenseFormNotice>
          ) : null}

          {reviewOpen ? (
            <ExpenseFormReview
              projectName={selectedProject?.name ?? "–"}
              documentName={draft.payload.receipt?.fileName ?? "Tanpa nota"}
              stockHandlingLabels={stockLines.map(
                (line) =>
                  STOCK_HANDLING_OPTIONS.find((option) => option.value === line.stockHandling)
                    ?.label ?? line.stockHandling,
              )}
              categorySummaries={categorySummaries}
            />
          ) : (
            <>
              {!reviewOpen &&
              drafts.length > 0 &&
              !requestedDraftId &&
              !loadedDraftId &&
              !draft.draftId ? (
                <ExpenseActiveDrafts
                  drafts={drafts}
                  onLoad={(id) => void loadDraft(id)}
                  onDiscard={setPendingDiscardDraftId}
                />
              ) : null}

              <ExpenseFormEntryFields
                payload={draft.payload}
                selectedProject={selectedProject}
                selectedProjectApproved={selectedProjectApproved}
                lastProjectSuggestion={lastProjectSuggestion}
                safeRouteProjectId={safeRouteProjectId}
                projectOptions={projectOptions}
                budgetCategories={budgetCategories}
                inventoryLocations={inventoryLocations}
                incompleteCount={incompleteCount}
                busy={busy}
                uploading={uploading}
                processingOcr={processingOcr}
                uploadError={uploadError}
                onProjectChange={requestProjectChange}
                onUseLastProject={applyProjectChange}
                onSelectReceipt={(file) => void handleReceipt(file)}
                onClearReceipt={() =>
                  updatePayload((current) => ({
                    ...current,
                    inputMode: "MANUAL",
                    receipt: null,
                    ocrWarning: null,
                  }))
                }
                onUploadError={setUploadError}
                onAddLine={addLine}
                onDuplicateLine={duplicateLine}
                onRemoveLine={removeLine}
                onMoveLine={moveLine}
                onRestoreLine={restoreLine}
                onUpdateLine={updateLine}
              />
            </>
          )}
        </div>
      </WorkflowFormSheet>

      <ExpenseFormOverlays
        closeGuardOpen={closeGuardOpen}
        closeGuardPending={discarding || draft.status === "saving"}
        conflictOpen={conflictOpen}
        pendingOcr={pendingOcr}
        projectChange={projectChange}
        pendingDiscardDraftId={pendingDiscardDraftId}
        success={success}
        onKeepDraft={() => void saveAndClose()}
        onDiscardDraft={() => void discardAndClose()}
        onContinueEditing={() => setCloseGuardOpen(false)}
        onCloseConflict={() => setConflictOpen(false)}
        onSaveConflictCopy={() => void saveConflictCopy()}
        onLoadServerVersion={() => void loadServerVersion()}
        onCloseOcr={() => setPendingOcr(null)}
        onAppendOcr={() => {
          if (!pendingOcr) return;
          updatePayload((current) => ({
            ...current,
            lines: mergeExpenseLines(current.lines, pendingOcr.lines, "APPEND"),
          }));
          setPendingOcr(null);
        }}
        onReplaceOcr={() => {
          if (!pendingOcr) return;
          updatePayload((current) => ({
            ...current,
            lines: mergeExpenseLines(current.lines, pendingOcr.lines, "REPLACE"),
          }));
          setPendingOcr(null);
        }}
        onCloseProjectChange={() => setProjectChange(null)}
        onConfirmProjectChange={() => {
          if (projectChange) applyProjectChange(projectChange);
          setProjectChange(null);
        }}
        onCloseDiscardDraft={() => setPendingDiscardDraftId(null)}
        onConfirmDiscardDraft={() => {
          if (pendingDiscardDraftId) void discardDraftById(pendingDiscardDraftId);
          setPendingDiscardDraftId(null);
        }}
        onCloseSuccess={() => {
          setSuccess(null);
          closeForm();
        }}
        onAddAnotherExpense={() => {
          setSuccess(null);
          const nextProjectId = draft.payload.projectId;
          updateUrlSearchParam("expense-draft", null, "replace");
          draft.reset(createBlankExpenseDraft(nextProjectId));
          setFormError(null);
        }}
      />
    </>
  );
}
