"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  discardVendorBillDraft,
  getVendorBillDraft,
  listVendorBillDrafts,
  submitVendorBillDraft,
  type VendorBillDraftSummary,
} from "@/app/actions/finance/vendor-bill-drafts";
import type { ProjectForExpense } from "@/app/actions/project/budget";
import {
  Button,
  ConfirmationSheet,
  DatePickerField,
  FormField,
  FormRiskNotice,
  FormSection,
  MoneyInput,
  SheetSelect,
  Textarea,
  TextInput,
  useAnimatedSheetClose,
  WorkflowFormSheet,
} from "@/components/ui";
import {
  OperationSuccessSheet,
  FinanceUnsavedChangesModal,
  type OperationSuccess,
} from "@/components/ui";
import { useHybridVendorBillDraft } from "@/features/expenses/hooks/use-hybrid-vendor-bill-draft";
import type { VendorBillDraftPayload } from "@/lib/validations/vendor-bill-draft";
import { updateUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { AppIcon } from "@/components/ui/icon/app-icon";

export interface VendorBillFormVendor {
  readonly id: string;
  readonly name: string;
}
interface VendorBillFormProps {
  readonly open?: boolean;
  readonly onClose?: () => void;
  readonly projects: ProjectForExpense[];
  readonly vendors: VendorBillFormVendor[];
  readonly loading?: boolean;
}

function initialPayload(projectId = ""): VendorBillDraftPayload {
  return {
    vendorId: "",
    projectId,
    projectBudgetCategoryId: "",
    projectBudgetItemId: "",
    projectCategoryPlanItemId: "",
    billNumber: "",
    amount: "",
    dueDate: "",
    notes: "",
  };
}

export function VendorBillForm({
  open = true,
  onClose,
  projects,
  vendors,
  loading = false,
}: VendorBillFormProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = React.useTransition();
  const [reviewing, setReviewing] = React.useState(false);
  const [confirmClose, setConfirmClose] = React.useState(false);
  const [pendingProjectId, setPendingProjectId] = React.useState<string | null>(null);
  const [pendingDiscardDraftId, setPendingDiscardDraftId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<OperationSuccess | null>(null);
  const [drafts, setDrafts] = React.useState<readonly VendorBillDraftSummary[]>([]);
  const currentProjectId = React.useMemo(() => {
    const parts = pathname.split("/");
    const index = parts.indexOf("projects");
    const candidate = index >= 0 ? parts[index + 1] : "";
    return projects.some((project) => project.id === candidate) ? candidate : "";
  }, [pathname, projects]);
  const draft = useHybridVendorBillDraft(initialPayload(currentProjectId));
  const payload = draft.payload;
  const activeProject = projects.find((project) => project.id === payload.projectId);
  const categories =
    activeProject?.canonicalBudgets?.[0]?.categories
      ?.slice()
      .sort((a, b) => a.sortOrder - b.sortOrder) ?? [];
  const selectedCategory = categories.find(
    (category) => category.id === payload.projectBudgetCategoryId,
  );
  const packageOptions =
    activeProject?.categoryPlanItems?.filter(
      (item) => item.projectBudgetCategoryId === payload.projectBudgetCategoryId,
    ) ?? [];
  const selectedVendor = vendors.find((vendor) => vendor.id === payload.vendorId);
  const amount = Number(payload.amount || 0);
  const remainingBefore = Number(selectedCategory?.remainingAmount ?? 0);
  const remainingAfter = remainingBefore - amount;
  const canReview =
    Boolean(
      payload.vendorId &&
      payload.projectId &&
      payload.projectBudgetCategoryId &&
      payload.billNumber.trim() &&
      payload.dueDate,
    ) && amount > 0;
  const disabledReason = !payload.projectId
    ? "Pilih proyek."
    : !payload.vendorId
      ? "Pilih vendor."
      : !payload.projectBudgetCategoryId
        ? "Pilih kategori budget."
        : !payload.billNumber.trim()
          ? "Isi nomor tagihan."
          : amount <= 0
            ? "Nominal harus lebih besar dari Rp 0."
            : !payload.dueDate
              ? "Pilih tanggal jatuh tempo."
              : undefined;

  const refreshDrafts = React.useCallback((): void => {
    startTransition(async () => {
      const response = await listVendorBillDrafts();
      if (response.success) setDrafts(response.data);
    });
  }, []);

  React.useEffect(() => {
    if (open) refreshDrafts();
  }, [open, refreshDrafts]);

  function patch(next: Partial<VendorBillDraftPayload>): void {
    draft.updatePayload((current) => ({ ...current, ...next }));
    setError(null);
  }

  function applyProject(projectId: string): void {
    patch({
      projectId,
      projectBudgetCategoryId: "",
      projectBudgetItemId: "",
      projectCategoryPlanItemId: "",
    });
  }

  const completeClose = React.useCallback((): void => {
    if (onClose) onClose();
    else if (new URLSearchParams(window.location.search).get("new-vendor-bill") === "true")
      updateUrlSearchParam("new-vendor-bill", null, "replace");
    else router.back();
  }, [onClose, router]);
  const animatedClose = useAnimatedSheetClose(open, completeClose);

  function requestClose(): void {
    if (reviewing) {
      setReviewing(false);
      return;
    }
    if (draft.isDirty) {
      setConfirmClose(true);
      return;
    }
    animatedClose.close();
  }

  async function loadDraft(id: string): Promise<void> {
    const response = await getVendorBillDraft({ draftId: id });
    if (!response.success) {
      setError(response.error.message);
      return;
    }
    draft.hydrate(response.data);
    setReviewing(false);
  }

  async function discardDraftById(id: string): Promise<void> {
    const response = await discardVendorBillDraft({ draftId: id });
    if (!response.success) {
      setError(response.error.message);
      return;
    }
    if (draft.draftId === id) draft.reset(initialPayload(currentProjectId));
    setDrafts((current) => current.filter((item) => item.id !== id));
    toast.success("Draft tagihan dibuang.");
  }

  async function saveAndClose(): Promise<void> {
    const result = await draft.saveNow();
    if (!result.success) {
      setError(result.message);
      setConfirmClose(false);
      return;
    }
    setConfirmClose(false);
    animatedClose.close();
  }

  async function discardAndClose(): Promise<void> {
    if (draft.draftId) await discardVendorBillDraft({ draftId: draft.draftId });
    draft.reset(initialPayload(currentProjectId));
    setConfirmClose(false);
    animatedClose.close();
  }

  async function submit(): Promise<void> {
    if (!canReview) return;
    const saved = await draft.saveNow();
    if (!saved.success) {
      setError(saved.message);
      return;
    }
    const response = await submitVendorBillDraft({
      draftId: saved.record.id,
      expectedRevision: saved.record.revision,
    });
    if (!response.success) {
      setError(response.error.message);
      toast.error(response.error.message);
      return;
    }
    draft.reset(initialPayload(currentProjectId));
    setReviewing(false);
    animatedClose.close();
    router.refresh();
    setSuccess({
      title: "Tagihan vendor dibuat",
      description:
        "Tagihan dan biaya proyek sudah tercatat. Saldo kas belum berubah sampai pembayaran dicairkan.",
      facts: [
        { label: "Nomor", value: response.data.billNumber },
        { label: "Vendor", value: selectedVendor?.name ?? "Vendor" },
        {
          label: "Nominal",
          value: `Rp ${response.data.amount.toLocaleString("id-ID")}`,
        },
      ],
    });
  }

  return (
    <>
      <WorkflowFormSheet
        open={animatedClose.visible}
        title={reviewing ? "Tinjau tagihan vendor" : "Tagihan vendor baru"}
        onClose={requestClose}
        onExitComplete={animatedClose.handleExitComplete}
        pending={pending || draft.status === "saving"}
        pendingLabel={reviewing ? "Membuat…" : "Menyimpan…"}
        disabled={!canReview}
        disabledReason={disabledReason}
        primaryLabel={reviewing ? "Buat" : "Tinjau"}
        secondaryLabel={reviewing ? "Ubah" : undefined}
        statusText={draft.errorMessage ?? draft.statusLabel}
        statusTone={
          draft.status === "conflict" || draft.status === "error"
            ? "danger"
            : draft.status === "offline"
              ? "warning"
              : "success"
        }
        onPrimary={() => (reviewing ? void submit() : setReviewing(true))}
        onSecondary={() => setReviewing(false)}
      >
        <div className="space-y-md">
          {error ? (
            <div
              className="rounded-2xl bg-error-container/20 p-3 text-xs font-medium text-error"
              role="alert"
            >
              {error}
            </div>
          ) : null}
          {draft.status === "conflict" ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => (draft.draftId ? void loadDraft(draft.draftId) : undefined)}
              >
                Muat
              </Button>
              <Button
                type="button"
                variant="primary"
                fullWidth
                onClick={() => void draft.saveAsCopy()}
              >
                Salin
              </Button>
            </div>
          ) : null}
          {!reviewing && drafts.length > 0 && !draft.draftId ? (
            <FormSection
              title="Draft aktif"
              helper="Lanjutkan tagihan yang pernah disimpan."
              presentation="plain"
            >
              <div className="divide-y divide-outline-variant/15 overflow-hidden rounded-3xl bg-surface-container-lowest shadow-surface ring-1 ring-ring-subtle">
                {drafts.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex min-h-18 min-w-0 items-center gap-1 px-2 py-1.5"
                  >
                    <button
                      type="button"
                      onClick={() => void loadDraft(item.id)}
                      className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-[18px] px-2.5 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-surface-container-low"
                      aria-label={`Lanjutkan draft ${item.payload.billNumber || "tagihan belum bernomor"}`}
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant"
                        aria-hidden="true"
                      >
                        <AppIcon name="edit_note" className="text-[18px] leading-none" />
                      </span>
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <span className="truncate text-xs leading-[1.15] font-bold text-on-surface">
                          {item.payload.billNumber || "Tagihan belum bernomor"}
                        </span>
                        <span className="truncate text-[10px] leading-[1.2] text-on-surface-variant">
                          {item.projectName} · Rp{" "}
                          {Number(item.payload.amount || 0).toLocaleString("id-ID")}
                        </span>
                        <span className="text-[9px] leading-[1.2] text-on-surface-variant/75">
                          Disimpan{" "}
                          {new Date(item.lastSavedAt).toLocaleString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </span>
                      <AppIcon
                        name="chevron_right"
                        className="shrink-0 text-[18px] leading-none text-on-surface-variant"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDiscardDraftId(item.id)}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-error transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-error-container/20"
                      aria-label={`Buang draft ${item.payload.billNumber || "tagihan belum bernomor"}`}
                    >
                      <AppIcon name="delete" className="text-[18px] leading-none" />
                    </button>
                  </div>
                ))}
              </div>
            </FormSection>
          ) : null}
          {loading && projects.length === 0 ? (
            <p className="py-12 text-center text-xs text-on-surface-variant">
              Mengambil proyek dan vendor…
            </p>
          ) : reviewing ? (
            <div className="space-y-3">
              <FormSection
                title="Tagihan yang akan dibuat"
                helper="Periksa dokumen dan dampak budget sebelum membuat tagihan."
              >
                <div className="grid grid-cols-1 divide-y divide-outline-variant/20">
                  <ReviewFact label="Vendor" value={selectedVendor?.name ?? "–"} />
                  <ReviewFact label="Proyek" value={activeProject?.name ?? "–"} />
                  <ReviewFact label="Kategori" value={selectedCategory?.name ?? "–"} />
                  <ReviewFact label="Nomor" value={payload.billNumber} />
                  <ReviewFact label="Nominal" value={`Rp ${amount.toLocaleString("id-ID")}`} />
                  <ReviewFact
                    label="Jatuh tempo"
                    value={new Date(payload.dueDate).toLocaleDateString("id-ID", {
                      dateStyle: "long",
                    })}
                  />
                  <ReviewFact
                    label="Sisa budget kategori"
                    value={
                      <span
                        className={
                          remainingAfter < 0 ? "font-bold text-error" : "font-bold text-primary"
                        }
                      >
                        Rp {remainingBefore.toLocaleString("id-ID")} → Rp{" "}
                        {remainingAfter.toLocaleString("id-ID")}
                      </span>
                    }
                  />
                </div>
              </FormSection>
              <FormRiskNotice
                title={remainingAfter < 0 ? "Melebihi budget kategori" : "Saldo kas belum berubah"}
                tone={remainingAfter < 0 ? "warning" : "default"}
              >
                {remainingAfter < 0
                  ? "Tagihan tetap dapat dibuat, tetapi kondisi overbudget akan terlihat pada kontrol budget dan jalur pembayaran."
                  : "Tagihan mencatat kewajiban. Kas berkurang hanya setelah pembayaran vendor dikonfirmasi."}
              </FormRiskNotice>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setReviewing(true);
              }}
              className="space-y-md"
            >
              <FormSection
                title="Vendor dan proyek"
                helper="Proyek dari halaman aktif dipakai sebagai default aman."
              >
                <div className="grid grid-cols-1 divide-y divide-outline-variant/20">
                  <SheetSelect
                    label="Vendor"
                    value={payload.vendorId}
                    disabled={pending}
                    onChange={(value) => patch({ vendorId: value })}
                    options={vendors.map((vendor) => ({
                      value: vendor.id,
                      label: vendor.name,
                    }))}
                    required
                  />
                  <SheetSelect
                    label="Proyek"
                    value={payload.projectId}
                    disabled={pending}
                    onChange={(value) => {
                      if (payload.projectBudgetCategoryId && value !== payload.projectId)
                        setPendingProjectId(value);
                      else applyProject(value);
                    }}
                    options={projects.map((project) => ({
                      value: project.id,
                      label: project.name,
                    }))}
                    required
                  />
                  <SheetSelect
                    label="Kategori Budget"
                    value={payload.projectBudgetCategoryId}
                    disabled={pending || !payload.projectId}
                    onChange={(value) =>
                      patch({
                        projectBudgetCategoryId: value,
                        projectBudgetItemId: "",
                        projectCategoryPlanItemId: "",
                      })
                    }
                    options={categories.map((category) => ({
                      value: category.id,
                      label: category.name,
                      description: `Sisa Rp ${Number(category.remainingAmount).toLocaleString("id-ID")}`,
                      meta: `${category.usedPercentage}% terpakai`,
                    }))}
                    required
                  />
                  {selectedCategory && ["TUKANG", "SUBCON"].includes(selectedCategory.code) ? (
                    <SheetSelect
                      label={selectedCategory.code === "SUBCON" ? "Paket Subkon" : "Paket Tukang"}
                      optional
                      value={payload.projectCategoryPlanItemId}
                      onChange={(value) => patch({ projectCategoryPlanItemId: value })}
                      options={[
                        { value: "", label: "Tanpa tautan paket" },
                        ...packageOptions.map((item) => ({
                          value: item.id,
                          label: `${item.area} · ${item.label}`,
                          description: `${item.quantity} ${item.unit}`,
                        })),
                      ]}
                    />
                  ) : null}
                </div>
              </FormSection>
              <FormSection title="Dokumen tagihan" helper="Nominal dan nomor selalu diisi manual.">
                <div className="grid grid-cols-1 divide-y divide-outline-variant/20">
                  <FormField label="Nomor Tagihan" required>
                    <TextInput
                      value={payload.billNumber}
                      disabled={pending}
                      onChange={(value) => patch({ billNumber: value })}
                      placeholder="Contoh: BILL-2026-099"
                    />
                  </FormField>
                  <FormField label="Nominal Tagihan" required>
                    <MoneyInput
                      value={payload.amount}
                      disabled={pending}
                      onChange={(value) => patch({ amount: value === "" ? "" : Number(value) })}
                    />
                  </FormField>
                  <DatePickerField
                    label="Tanggal Jatuh Tempo"
                    value={payload.dueDate}
                    disabled={pending}
                    onChange={(value) => patch({ dueDate: value })}
                    required
                  />
                  <FormField label="Catatan" optional>
                    <Textarea
                      value={payload.notes}
                      disabled={pending}
                      onChange={(value) => patch({ notes: value })}
                      rows={2}
                      placeholder="Detail untuk tim finance"
                    />
                  </FormField>
                </div>
              </FormSection>
            </form>
          )}
        </div>
      </WorkflowFormSheet>
      <FinanceUnsavedChangesModal
        open={confirmClose}
        onKeep={() => void saveAndClose()}
        onDiscard={() => void discardAndClose()}
        onContinue={() => setConfirmClose(false)}
      />
      <ConfirmationSheet
        open={Boolean(pendingProjectId)}
        title="Ganti proyek?"
        description="Kategori budget dan tautan paket akan dikosongkan agar tagihan tidak terhubung ke proyek yang salah."
        confirmLabel="Ganti Proyek"
        danger
        onClose={() => setPendingProjectId(null)}
        onConfirm={() => {
          if (pendingProjectId) applyProject(pendingProjectId);
          setPendingProjectId(null);
        }}
      />
      <ConfirmationSheet
        open={Boolean(pendingDiscardDraftId)}
        title="Buang draft tagihan?"
        description="Draft ini akan dihapus dan tidak dapat dilanjutkan lagi. Belum ada tagihan atau saldo kas yang berubah."
        confirmLabel="Buang Draft"
        danger
        onClose={() => setPendingDiscardDraftId(null)}
        onConfirm={() => {
          if (pendingDiscardDraftId) void discardDraftById(pendingDiscardDraftId);
          setPendingDiscardDraftId(null);
        }}
      />
      <OperationSuccessSheet
        success={success}
        secondaryLabel="Tambah"
        onClose={() => setSuccess(null)}
        onSecondary={() => {
          setSuccess(null);
          draft.reset(initialPayload(currentProjectId));
          updateUrlSearchParam("new-vendor-bill", "true", "push");
        }}
      />
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
      <span className="shrink-0 text-on-surface-variant">{label}</span>
      <span className="text-right font-bold text-on-surface">{value}</span>
    </div>
  );
}
