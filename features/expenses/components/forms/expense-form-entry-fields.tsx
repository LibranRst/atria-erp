"use client";

import { motion } from "framer-motion";
import { AppIcon, FormRiskNotice, FormSection, SheetSelect } from "@/components/ui";
import { ExpenseItemsSection } from "@/features/expenses/components/forms/expense-form-sections";
import { ExpenseReceiptUpload } from "@/features/expenses/components/forms/expense-receipt-upload";
import type {
  ExpenseDraftPayload,
  ExpenseFormProject,
  ExpenseLine,
  InventoryLocationOption,
  ProjectBudgetCategoryOption,
} from "@/features/expenses/types/expense-form-types";
import { transitionSpringSnappy } from "@/lib/utils/motion";

interface ProjectOption {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
  readonly meta?: string;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
}

interface ExpenseFormEntryFieldsProps {
  readonly payload: ExpenseDraftPayload;
  readonly selectedProject: ExpenseFormProject | undefined;
  readonly selectedProjectApproved: boolean;
  readonly lastProjectSuggestion: ExpenseFormProject | undefined;
  readonly safeRouteProjectId: string;
  readonly projectOptions: readonly ProjectOption[];
  readonly budgetCategories: ProjectBudgetCategoryOption[];
  readonly inventoryLocations: InventoryLocationOption[];
  readonly incompleteCount: number;
  readonly busy: boolean;
  readonly uploading: boolean;
  readonly processingOcr: boolean;
  readonly uploadError: string | null;
  readonly onProjectChange: (projectId: string) => void;
  readonly onUseLastProject: (projectId: string) => void;
  readonly onSelectReceipt: (file: File) => void;
  readonly onClearReceipt: () => void;
  readonly onUploadError: (message: string | null) => void;
  readonly onAddLine: () => void;
  readonly onDuplicateLine: (key: string) => void;
  readonly onRemoveLine: (key: string) => void;
  readonly onMoveLine: (key: string, direction: -1 | 1) => void;
  readonly onRestoreLine: (line: ExpenseLine, index: number) => void;
  readonly onUpdateLine: (line: ExpenseLine) => void;
}

export function ExpenseFormEntryFields({
  payload,
  selectedProject,
  selectedProjectApproved,
  lastProjectSuggestion,
  safeRouteProjectId,
  projectOptions,
  budgetCategories,
  inventoryLocations,
  incompleteCount,
  busy,
  uploading,
  processingOcr,
  uploadError,
  onProjectChange,
  onUseLastProject,
  onSelectReceipt,
  onClearReceipt,
  onUploadError,
  onAddLine,
  onDuplicateLine,
  onRemoveLine,
  onMoveLine,
  onRestoreLine,
  onUpdateLine,
}: ExpenseFormEntryFieldsProps): React.JSX.Element {
  return (
    <>
      <FormSection
        title="Proyek"
        helper="Kategori, budget, stok, dan approval mengikuti proyek ini."
      >
        <SheetSelect
          label="Proyek"
          value={payload.projectId}
          onChange={onProjectChange}
          options={projectOptions}
          placeholder="Pilih proyek aktif"
          disabled={busy}
          required
        />
        {!safeRouteProjectId &&
        !payload.projectId &&
        lastProjectSuggestion?.canonicalBudgets?.[0]?.status === "APPROVED" ? (
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            transition={transitionSpringSnappy}
            onClick={() => onUseLastProject(lastProjectSuggestion.id)}
            className="flex min-h-14 w-full min-w-0 items-center gap-3 bg-surface-container-lowest px-4 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset active:bg-surface-container-low"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant"
              aria-hidden="true"
            >
              <AppIcon name="history" className="icon-md leading-none" />
            </span>
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="block text-[10px] leading-[1.15] font-semibold text-on-surface-variant">
                Proyek terakhir
              </span>
              <span className="block truncate text-xs leading-[1.15] font-bold text-on-surface">
                {lastProjectSuggestion.name}
              </span>
            </span>
            <span className="shrink-0 text-[11px] font-bold text-accent">Gunakan</span>
          </motion.button>
        ) : null}
        {selectedProject && !selectedProjectApproved ? (
          <FormRiskNotice title="Budget belum disetujui" tone="warning">
            Pengeluaran dapat disiapkan sebagai draft, tetapi belum dapat ditinjau atau diajukan.
          </FormRiskNotice>
        ) : null}
      </FormSection>

      <FormSection
        title="Nota (opsional)"
        helper="Unggah untuk membaca item otomatis, atau lewati dan isi rincian."
        presentation="plain"
      >
        <ExpenseReceiptUpload
          attachment={payload.receipt}
          selectedProjectId={payload.projectId}
          disabled={busy}
          isUploading={uploading}
          isProcessingOCR={processingOcr}
          uploadError={uploadError}
          onSelectFile={onSelectReceipt}
          onClearReceipt={onClearReceipt}
          onValidationError={onUploadError}
        />
      </FormSection>

      <FormSection
        title="Rincian item"
        helper={`${payload.lines.length - incompleteCount} dari ${payload.lines.length} item sudah lengkap.`}
        presentation="plain"
      >
        <ExpenseItemsSection
          disabled={busy}
          selectedProjectId={payload.projectId}
          lines={payload.lines}
          budgetCategories={budgetCategories}
          materialOptions={selectedProject?.materialOptions ?? []}
          rapItems={selectedProject?.rapItems ?? []}
          categoryPlanItems={selectedProject?.categoryPlanItems ?? []}
          defaultInventoryLocationId={inventoryLocations[0]?.id ?? ""}
          inventoryLocations={inventoryLocations}
          onAdd={onAddLine}
          onDuplicate={onDuplicateLine}
          onRemove={onRemoveLine}
          onMove={onMoveLine}
          onRestore={onRestoreLine}
          onUpdate={onUpdateLine}
        />
      </FormSection>
    </>
  );
}
