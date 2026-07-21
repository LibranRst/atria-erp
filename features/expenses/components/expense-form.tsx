"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";

import {
  discardExpenseDraft,
  getExpenseDraft,
  submitExpenseDraft,
  type SubmittedExpenseDraft,
} from "@/app/actions/finance/expense-drafts";
import {
  ConfirmationModal,
  FormRiskNotice,
  FormSection,
  SheetSelect,
  WorkflowFormSheet,
} from "@/components/ui";
import { FinanceUnsavedChangesModal } from "@/features/finance/components/finance-form-patterns";
import { ExpenseItemsSection, ExpenseFormNotice } from "./expense-form-sections";
import { ExpenseReceiptUpload } from "./expense-receipt-upload";
import type {
  ExpenseDraftPayload,
  ExpenseFormProject,
  ExpenseLine,
  InventoryLocationOption,
} from "./expense-form-types";
import {
  createBlankExpenseDraft,
  createBlankExpenseLine,
  isExpenseLineComplete,
  mergeExpenseLines,
  STOCK_HANDLING_OPTIONS,
} from "./expense-form-utils";
import { uploadAndParseExpenseReceipt, type ExpenseReceiptOcrResult } from "./expense-receipt-ocr";
import { useHybridExpenseDraft } from "./use-hybrid-expense-draft";
import { createClientId } from "@/lib/utils/client-id";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { updateUrlSearchParam } from "@/lib/utils/use-url-search-param";

export type { ExpenseFormProject } from "./expense-form-types";

interface ExpenseFormProps {
  readonly open?: boolean;
  readonly onClose?: () => void;
  readonly projects: ExpenseFormProject[];
  readonly inventoryLocations?: InventoryLocationOption[];
  readonly requestedDraftId?: string | null;
}

function routeProjectId(pathname: string): string {
  const parts = pathname.split("/");
  const projectIndex = parts.indexOf("projects");
  return projectIndex >= 0 ? (parts[projectIndex + 1] ?? "") : "";
}

function hasMeaningfulLine(line: ExpenseLine): boolean {
  return Boolean(
    line.projectBudgetCategoryId || line.description.trim() || Number(line.amount) > 0,
  );
}

function subscribeLastExpenseProject(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener("atria:last-expense-project-changed", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("atria:last-expense-project-changed", onChange);
  };
}

function getLastExpenseProject(): string {
  return window.localStorage.getItem("atria:last-expense-project") ?? "";
}

function getServerLastExpenseProject(): string {
  return "";
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
  const [success, setSuccess] = React.useState<SubmittedExpenseDraft | null>(null);

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

  function closeForm(): void {
    if (onClose) {
      onClose();
      return;
    }
    router.push("/expenses");
  }

  function requestClose(): void {
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

  function updateLine(nextLine: ExpenseLine): void {
    updatePayload((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.key === nextLine.key ? nextLine : line)),
    }));
  }

  function addLine(): void {
    const nextLine = createBlankExpenseLine();
    const firstCategory = budgetCategories[0];
    if (firstCategory) nextLine.projectBudgetCategoryId = firstCategory.id;
    updatePayload((current) => ({ ...current, lines: [...current.lines, nextLine] }));
  }

  function duplicateLine(key: string): void {
    updatePayload((current) => {
      const index = current.lines.findIndex((line) => line.key === key);
      if (index < 0) return current;
      const source = current.lines[index];
      const copy = { ...source, key: createClientId("expense-line") };
      const lines = [...current.lines];
      lines.splice(index + 1, 0, copy);
      return { ...current, lines };
    });
  }

  function removeLine(key: string): void {
    updatePayload((current) => ({
      ...current,
      lines: current.lines.filter((line) => line.key !== key),
    }));
  }

  function restoreLine(line: ExpenseLine, index: number): void {
    updatePayload((current) => {
      const lines = [...current.lines];
      lines.splice(Math.min(index, lines.length), 0, line);
      return { ...current, lines };
    });
  }

  function moveLine(key: string, direction: -1 | 1): void {
    updatePayload((current) => {
      const from = current.lines.findIndex((line) => line.key === key);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= current.lines.length) return current;
      const lines = [...current.lines];
      const [moved] = lines.splice(from, 1);
      lines.splice(to, 0, moved);
      return { ...current, lines };
    });
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
    setSuccess(response.data);
    toast.success("Pengeluaran berhasil diajukan.");
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
        title={requestedDraftId ? "Lanjutkan Draft" : "Tambah Pengeluaran"}
        primaryLabel="Tinjau"
        secondaryLabel="Simpan"
        pending={loadingDraft}
        pendingLabel="Memuat Draft…"
        disabled={busy || !canReview}
        disabledReason={reviewDisabledReason}
        statusText={`${draft.statusLabel} · ${draft.payload.lines.length} item · Rp ${totalAmount.toLocaleString("id-ID")}`}
        statusTone={syncTone}
        onClose={requestClose}
        onPrimary={() => void openReview()}
        onSecondary={() => void saveAndClose()}
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

          <FormSection
            title="1 · Proyek"
            helper="Kategori, budget, stok, dan approval mengikuti proyek ini."
          >
            <SheetSelect
              label="Proyek"
              value={draft.payload.projectId}
              onChange={requestProjectChange}
              options={projectOptions}
              placeholder="Pilih proyek aktif"
              disabled={busy}
              required
            />
            {!safeRouteProjectId &&
            !draft.payload.projectId &&
            lastProjectSuggestion?.canonicalBudgets?.[0]?.status === "APPROVED" ? (
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                transition={transitionSpringSnappy}
                onClick={() => applyProjectChange(lastProjectSuggestion.id)}
                className="flex min-h-14 w-full min-w-0 items-center gap-3 bg-surface-container-lowest px-4 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:ring-inset active:bg-surface-container-low"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant"
                  aria-hidden="true"
                >
                  <span className="material-symbols-outlined text-[18px] leading-none">
                    history
                  </span>
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="block text-[10px] leading-[1.15] font-semibold text-on-surface-variant">
                    Proyek terakhir
                  </span>
                  <span className="block truncate text-xs leading-[1.15] font-bold text-on-surface">
                    {lastProjectSuggestion.name}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] font-bold text-blue-600">Gunakan</span>
              </motion.button>
            ) : null}
            {selectedProject && !selectedProjectApproved ? (
              <FormRiskNotice title="Budget belum disetujui" tone="warning">
                Pengeluaran dapat disiapkan sebagai draft, tetapi belum dapat ditinjau atau
                diajukan.
              </FormRiskNotice>
            ) : null}
          </FormSection>

          <FormSection
            title="2 · Nota (opsional)"
            helper="Unggah untuk membaca item otomatis, atau lewati dan isi rincian."
            presentation="plain"
          >
            <ExpenseReceiptUpload
              attachment={draft.payload.receipt}
              selectedProjectId={draft.payload.projectId}
              disabled={busy}
              isUploading={uploading}
              isProcessingOCR={processingOcr}
              uploadError={uploadError}
              onSelectFile={(file) => void handleReceipt(file)}
              onClearReceipt={() =>
                updatePayload((current) => ({
                  ...current,
                  inputMode: "MANUAL",
                  receipt: null,
                  ocrWarning: null,
                }))
              }
              onValidationError={setUploadError}
            />
          </FormSection>

          <FormSection
            title="3 · Rincian"
            helper={`${draft.payload.lines.length - incompleteCount} dari ${draft.payload.lines.length} item sudah lengkap.`}
            presentation="plain"
          >
            <ExpenseItemsSection
              disabled={busy}
              selectedProjectId={draft.payload.projectId}
              lines={draft.payload.lines}
              budgetCategories={budgetCategories}
              materialOptions={selectedProject?.materialOptions ?? []}
              rapItems={selectedProject?.rapItems ?? []}
              categoryPlanItems={selectedProject?.categoryPlanItems ?? []}
              defaultInventoryLocationId={inventoryLocations[0]?.id ?? ""}
              inventoryLocations={inventoryLocations}
              onAdd={addLine}
              onDuplicate={duplicateLine}
              onRemove={removeLine}
              onMove={moveLine}
              onRestore={restoreLine}
              onUpdate={updateLine}
            />
          </FormSection>
        </div>
      </WorkflowFormSheet>

      <WorkflowFormSheet
        open={reviewOpen}
        title="Tinjau Pengeluaran"
        primaryLabel="Ajukan"
        secondaryLabel="Ubah"
        pending={submitting}
        pendingLabel="Mengajukan…"
        disabled={submitBlocked}
        disabledReason={
          !online
            ? "Perangkat sedang offline. Sambungkan kembali sebelum mengajukan."
            : draft.status !== "saved"
              ? "Tunggu hingga draft selesai tersinkron sebelum mengajukan."
              : undefined
        }
        statusText={`${draft.payload.lines.length} item · Rp ${totalAmount.toLocaleString("id-ID")}`}
        statusTone={
          categorySummaries.some(
            ({ category, amount }) => amount > Number(category.remainingAmount),
          )
            ? "danger"
            : "success"
        }
        onClose={() => setReviewOpen(false)}
        onSecondary={() => setReviewOpen(false)}
        onPrimary={() => void submitDraft()}
      >
        <div className="space-y-4">
          <FormSection
            title="Rincian Pengeluaran"
            helper="Periksa kembali proyek dan kelengkapan dokumen pengeluaran."
          >
            <div className="grid grid-cols-1 divide-y divide-outline-variant/20">
              <ReviewFact label="Proyek" value={selectedProject?.name ?? "–"} />
              <ReviewFact
                label="Dokumen"
                value={draft.payload.receipt ? draft.payload.receipt.fileName : "Tanpa nota"}
              />
              <ReviewFact
                label="Perubahan Stok"
                value={
                  stockLines.length === 0
                    ? "Tidak ada perubahan stok"
                    : stockLines
                        .map(
                          (line) =>
                            STOCK_HANDLING_OPTIONS.find(
                              (option) => option.value === line.stockHandling,
                            )?.label ?? line.stockHandling,
                        )
                        .join(" · ")
                }
              />
              <ReviewFact
                label="Langkah Berikutnya"
                value="Finance memverifikasi, lalu approval mengikuti aturan budget proyek."
              />
            </div>
          </FormSection>

          {categorySummaries.length > 0 && (
            <FormSection
              title="Dampak Budget"
              helper="Kondisi overbudget akan mengharuskan persetujuan khusus Owner."
            >
              <div className="grid grid-cols-1 divide-y divide-outline-variant/20">
                {categorySummaries.map(({ category, amount }) => {
                  const before = Number(category.remainingAmount);
                  const after = before - amount;
                  return (
                    <div key={category.id} className="px-4 py-3 text-xs">
                      <div className="flex items-center justify-between gap-3 font-semibold">
                        <span className="text-on-surface">{category.name}</span>
                        <span className="font-bold text-primary tabular-nums">
                          Rp {amount.toLocaleString("id-ID")}
                        </span>
                      </div>
                      <p
                        className={`mt-1 text-[11px] font-medium ${after < 0 ? "font-bold text-error" : "text-on-surface-variant"}`}
                      >
                        Sisa: Rp {before.toLocaleString("id-ID")} → Rp{" "}
                        {after.toLocaleString("id-ID")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </FormSection>
          )}
        </div>
      </WorkflowFormSheet>

      <FinanceUnsavedChangesModal
        open={closeGuardOpen}
        pending={discarding || draft.status === "saving"}
        onKeep={() => void saveAndClose()}
        onDiscard={() => void discardAndClose()}
        onContinue={() => setCloseGuardOpen(false)}
      />

      <ConfirmationModal
        open={conflictOpen}
        title="Draft Berubah"
        description="Draft ini diperbarui dari sesi lain. Muat versi server atau pertahankan isian lokal sebagai draft terpisah."
        tone="warning"
        onClose={() => setConflictOpen(false)}
        actions={
          <div className="space-y-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={() => void saveConflictCopy()}
              className="min-h-12 w-full rounded-full bg-primary px-5 text-xs font-bold text-white"
            >
              Simpan sebagai Draft Baru
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={() => void loadServerVersion()}
              className="min-h-12 w-full rounded-full bg-surface-container px-5 text-xs font-bold text-on-surface"
            >
              Muat Versi Server
            </motion.button>
          </div>
        }
      />

      <ConfirmationModal
        open={pendingOcr !== null}
        title="Gabungkan Hasil Scan"
        description={`${pendingOcr?.lines.length ?? 0} item terdeteksi. Item yang sudah Anda isi tidak akan diubah tanpa pilihan eksplisit.`}
        onClose={() => setPendingOcr(null)}
        actions={
          <div className="space-y-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={() => {
                if (!pendingOcr) return;
                updatePayload((current) => ({
                  ...current,
                  lines: mergeExpenseLines(current.lines, pendingOcr.lines, "APPEND"),
                }));
                setPendingOcr(null);
              }}
              className="min-h-12 w-full rounded-full bg-primary px-5 text-xs font-bold text-white"
            >
              Tambahkan Hasil Scan
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={() => {
                if (!pendingOcr) return;
                updatePayload((current) => ({
                  ...current,
                  lines: mergeExpenseLines(current.lines, pendingOcr.lines, "REPLACE"),
                }));
                setPendingOcr(null);
              }}
              className="min-h-12 w-full rounded-full bg-surface-container px-5 text-xs font-bold text-on-surface"
            >
              Ganti Item Saat Ini
            </motion.button>
          </div>
        }
      />

      <ConfirmationModal
        open={projectChange !== null}
        title="Ganti Proyek?"
        description="Kategori, tautan RAP, material, paket, dan lokasi stok akan dikosongkan. Nominal dan keterangan tetap aman."
        tone="warning"
        onClose={() => setProjectChange(null)}
        actions={
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={() => setProjectChange(null)}
              className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold text-on-surface"
            >
              Pertahankan
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={() => {
                if (projectChange) applyProjectChange(projectChange);
              }}
              className="min-h-12 rounded-full bg-primary px-4 text-xs font-bold text-white"
            >
              Ganti Proyek
            </motion.button>
          </div>
        }
      />

      <WorkflowFormSheet
        open={success !== null}
        title="Pengeluaran Diajukan"
        primaryLabel="Lihat"
        secondaryLabel="Tambah"
        statusText={
          success
            ? `${success.itemCount} item · Rp ${success.totalAmount.toLocaleString("id-ID")}`
            : undefined
        }
        statusTone="success"
        onClose={() => {
          setSuccess(null);
          closeForm();
        }}
        onPrimary={() => {
          setSuccess(null);
          closeForm();
          router.push("/expenses");
          router.refresh();
        }}
        onSecondary={() => {
          const nextProjectId = draft.payload.projectId;
          updateUrlSearchParam("expense-draft", null, "replace");
          draft.reset(createBlankExpenseDraft(nextProjectId));
          setSuccess(null);
          setFormError(null);
        }}
      >
        <div className="space-y-3 py-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-[30px]">check_circle</span>
          </div>
          <div>
            <p className="text-sm font-bold text-on-surface">Menunggu verifikasi Finance</p>
            <p className="mt-1 text-xs leading-5 text-on-surface-variant">
              Data final tidak dapat diedit langsung. Koreksi berikutnya mengikuti proses reject,
              salin draft, void, atau reversal.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSuccess(null);
              closeForm();
            }}
            className="min-h-12 w-full rounded-full text-sm font-bold text-on-surface"
          >
            Selesai
          </button>
        </div>
      </WorkflowFormSheet>
    </>
  );
}

function ReviewFact({
  label,
  value,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 text-xs">
      <span className="shrink-0 font-semibold text-on-surface-variant">{label}</span>
      <span className="text-right font-bold text-on-surface">{value}</span>
    </div>
  );
}
