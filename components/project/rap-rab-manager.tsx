"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  addProjectRapItem,
  approveRabEstimate,
  createProjectRap,
  deleteProjectRapItem,
  generateRabFromSelectedSources,
  lockProjectRap,
  updateProjectRapItem,
  updateRabEstimateItem,
} from "@/app/actions/project/rap-rab";
import {
  createProjectCategoryPlanItem,
  deleteProjectCategoryPlanItem,
  markProjectCategoryPlanItemActive,
  updateProjectCategoryPlanItem,
} from "@/app/actions/project/category-plan";
import { Badge, type BadgeStatus } from "@/components/ui/badge";

export interface MaterialOption {
  readonly id: string;
  readonly name: string;
  readonly unit: string;
  readonly lastPurchasePrice: string;
  readonly availableStock: number;
  readonly categoryName: string;
}

export interface RapItemView {
  readonly id: string;
  readonly materialId: string | null;
  readonly materialName: string;
  readonly area: string;
  readonly name: string;
  readonly description: string | null;
  readonly requiredQuantity: string;
  readonly bufferQuantity: string;
  readonly totalQuantity: string;
  readonly unit: string;
  readonly estimatedUnitCost: string;
  readonly estimatedTotalCost: string;
  readonly source: string;
  readonly status: string;
  readonly internalNote: string | null;
  readonly availableStock: number;
  readonly needToBuy: number;
  readonly reservedQuantity: number;
  readonly boughtQuantity: number;
  readonly usedQuantity: number;
  readonly leftoverQuantity: number;
  readonly actualMaterialCost: number;
  readonly costVariance: number;
}

export interface RapView {
  readonly id: string;
  readonly status: string;
  readonly revision: number;
  readonly notes: string | null;
  readonly items: RapItemView[];
}

export interface RabItemView {
  readonly id: string;
  readonly sourceType: string;
  readonly sourceProjectRapItemId: string | null;
  readonly sourceProjectCategoryPlanItemId: string | null;
  readonly clientLabel: string;
  readonly description: string | null;
  readonly quantity: string;
  readonly unit: string;
  readonly unitPrice: string;
  readonly lineTotal: string;
  readonly displayOrder: number;
  readonly isHidden: boolean;
  readonly isBundle: boolean;
}

export interface RabEstimateView {
  readonly id: string;
  readonly status: string;
  readonly revision: number;
  readonly title: string;
  readonly clientNotes: string | null;
  readonly approvedValue: string;
  readonly items: RabItemView[];
}

export interface ProjectPlanBudgetCategory {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface VendorOption {
  readonly id: string;
  readonly name: string;
}

export interface ProjectCategoryPlanItemView {
  readonly id: string;
  readonly projectBudgetCategoryId: string;
  readonly expenseCategoryCode: string;
  readonly expenseCategoryName: string;
  readonly vendorId: string | null;
  readonly vendorName: string | null;
  readonly name: string;
  readonly scopeDescription: string | null;
  readonly area: string;
  readonly quantity: string;
  readonly unit: string;
  readonly estimatedUnitCost: string;
  readonly estimatedTotalCost: string;
  readonly status: string;
  readonly internalNote: string | null;
  readonly displayOrder: number;
  readonly actualCost: number;
  readonly variance: number;
}

interface RapRabManagerProps {
  readonly projectId: string;
  readonly rap: RapView | null;
  readonly rabEstimate: RabEstimateView | null;
  readonly materials: MaterialOption[];
  readonly userRole: string;
  readonly budgetCategories: ProjectPlanBudgetCategory[];
  readonly categoryPlanItems: ProjectCategoryPlanItemView[];
  readonly vendors: VendorOption[];
}

type RapFormState = {
  materialId: string;
  area: string;
  name: string;
  description: string;
  requiredQuantity: string;
  bufferQuantity: string;
  unit: string;
  estimatedUnitCost: string;
  source: "STOCK" | "PURCHASE" | "STOCK_AND_PURCHASE" | "VENDOR";
  internalNote: string;
};

type CategoryPlanFormState = {
  projectBudgetCategoryId: string;
  vendorId: string;
  name: string;
  scopeDescription: string;
  area: string;
  quantity: string;
  unit: string;
  estimatedUnitCost: string;
  internalNote: string;
};

type ManualQuotationLine = {
  clientLabel: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
};

function formatRp(value: number): string {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function toBadgeStatus(status: string): BadgeStatus {
  if (status === "LOCKED" || status === "READY" || status === "APPROVED") return "APPROVED";
  if (status === "SHORTAGE" || status === "WAITING_PURCHASE") return "WARNING";
  if (status === "DRAFT" || status === "PLANNED") return "DRAFT";
  return "PRIMARY";
}

const emptyRapForm: RapFormState = {
  materialId: "",
  area: "Umum",
  name: "",
  description: "",
  requiredQuantity: "",
  bufferQuantity: "0",
  unit: "",
  estimatedUnitCost: "",
  source: "PURCHASE",
  internalNote: "",
};

const emptyCategoryPlanForm: CategoryPlanFormState = {
  projectBudgetCategoryId: "",
  vendorId: "",
  name: "",
  scopeDescription: "",
  area: "Umum",
  quantity: "1",
  unit: "ls",
  estimatedUnitCost: "",
  internalNote: "",
};

const emptyManualQuotationLine: ManualQuotationLine = {
  clientLabel: "",
  description: "",
  quantity: "1",
  unit: "ls",
  unitPrice: "",
};

export function RapRabManager({
  projectId,
  rap,
  rabEstimate,
  materials,
  userRole,
  budgetCategories,
  categoryPlanItems,
  vendors,
}: RapRabManagerProps): React.JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showRapForm, setShowRapForm] = useState(false);
  const [showCategoryPlanForm, setShowCategoryPlanForm] = useState(false);
  const [rapForm, setRapForm] = useState<RapFormState>(emptyRapForm);
  const [categoryPlanForm, setCategoryPlanForm] = useState<CategoryPlanFormState>(emptyCategoryPlanForm);
  const [editingRapItemId, setEditingRapItemId] = useState<string | null>(null);
  const [editingCategoryPlanItemId, setEditingCategoryPlanItemId] = useState<string | null>(null);
  const [rabDraftEdits, setRabDraftEdits] = useState<Record<string, RabItemView>>({});
  const [selectedRapQuotationIds, setSelectedRapQuotationIds] = useState<string[]>(() => rap?.items.map((item) => item.id) ?? []);
  const [selectedCategoryQuotationIds, setSelectedCategoryQuotationIds] = useState<string[]>(() => categoryPlanItems.map((item) => item.id));
  const [manualQuotationLine, setManualQuotationLine] = useState<ManualQuotationLine>(emptyManualQuotationLine);

  const canEditRap = userRole === "OWNER" || userRole === "FINANCE_ADMIN" || userRole === "PROJECT_MANAGER" || userRole === "PURCHASING";
  const canEditCategoryPlan = userRole === "OWNER" || userRole === "FINANCE_ADMIN" || userRole === "PROJECT_MANAGER";
  const canApproveRab = userRole === "OWNER" || userRole === "FINANCE_ADMIN";
  const rapIsDraft = rap?.status === "DRAFT";
  const plannedCost = rap?.items.reduce((sum, item) => sum + Number(item.estimatedTotalCost), 0) ?? 0;
  const shortageCount = rap?.items.filter((item) => item.needToBuy > 0).length ?? 0;
  const availableCoverage = rap?.items.reduce((sum, item) => sum + Math.min(Number(item.totalQuantity), item.availableStock), 0) ?? 0;
  const needToBuy = rap?.items.reduce((sum, item) => sum + item.needToBuy, 0) ?? 0;
  const visibleRabValue = rabEstimate?.items
    .filter((item) => !item.isHidden)
    .reduce((sum, item) => sum + Number(item.lineTotal), 0) ?? 0;
  const tukangPlanItems = categoryPlanItems
    .filter((item) => item.expenseCategoryCode === "TUKANG")
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const subconPlanItems = categoryPlanItems
    .filter((item) => item.expenseCategoryCode === "SUBCON")
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const selectedMaterial = materials.find((material) => material.id === rapForm.materialId);
  const formTotalQty = (Number(rapForm.requiredQuantity) || 0) + (Number(rapForm.bufferQuantity) || 0);
  const formNeedToBuy = Math.max(0, formTotalQty - (selectedMaterial?.availableStock ?? 0));
  const formEstimatedTotal = formTotalQty * (Number(rapForm.estimatedUnitCost) || 0);
  const categoryFormEstimatedTotal = (Number(categoryPlanForm.quantity) || 0) * (Number(categoryPlanForm.estimatedUnitCost) || 0);

  const sortedRabItems = useMemo(() => {
    return rabEstimate?.items.slice().sort((a, b) => a.displayOrder - b.displayOrder) ?? [];
  }, [rabEstimate?.items]);

  function resetMessages(): void {
    setError(null);
    setSuccess(null);
  }

  function handleCreateRap(): void {
    resetMessages();
    startTransition(async () => {
      const res = await createProjectRap({ projectId, notes: "Draft RAP material internal." });
      if (!res.success) {
        setError(res.error.message);
        return;
      }
      setSuccess("RAP draft berhasil dibuat.");
      router.refresh();
    });
  }

  function handleMaterialChange(materialId: string): void {
    const material = materials.find((item) => item.id === materialId);
    setRapForm((current) => ({
      ...current,
      materialId,
      name: current.name || material?.name || "",
      unit: material?.unit || current.unit,
      estimatedUnitCost: current.estimatedUnitCost || (material ? String(Number(material.lastPurchasePrice)) : ""),
      source: material && material.availableStock > 0 ? "STOCK_AND_PURCHASE" : "PURCHASE",
    }));
  }

  function openAddRapForm(): void {
    setEditingRapItemId(null);
    setRapForm(emptyRapForm);
    setShowRapForm(true);
  }

  function openEditRapForm(item: RapItemView): void {
    setEditingRapItemId(item.id);
    setRapForm({
      materialId: item.materialId ?? "",
      area: item.area,
      name: item.name,
      description: item.description ?? "",
      requiredQuantity: item.requiredQuantity,
      bufferQuantity: item.bufferQuantity,
      unit: item.unit,
      estimatedUnitCost: item.estimatedUnitCost,
      source: item.source as RapFormState["source"],
      internalNote: item.internalNote ?? "",
    });
    setShowRapForm(true);
  }

  function closeRapForm(): void {
    setShowRapForm(false);
    setEditingRapItemId(null);
    setRapForm(emptyRapForm);
  }

  function openAddCategoryPlanForm(categoryCode: "TUKANG" | "SUBCON"): void {
    const category = budgetCategories.find((item) => item.code === categoryCode);
    setEditingCategoryPlanItemId(null);
    setCategoryPlanForm({
      ...emptyCategoryPlanForm,
      projectBudgetCategoryId: category?.id ?? "",
      unit: categoryCode === "SUBCON" ? "paket" : "ls",
    });
    setShowCategoryPlanForm(true);
  }

  function openEditCategoryPlanForm(item: ProjectCategoryPlanItemView): void {
    setEditingCategoryPlanItemId(item.id);
    setCategoryPlanForm({
      projectBudgetCategoryId: item.projectBudgetCategoryId,
      vendorId: item.vendorId ?? "",
      name: item.name,
      scopeDescription: item.scopeDescription ?? "",
      area: item.area,
      quantity: item.quantity,
      unit: item.unit,
      estimatedUnitCost: item.estimatedUnitCost,
      internalNote: item.internalNote ?? "",
    });
    setShowCategoryPlanForm(true);
  }

  function closeCategoryPlanForm(): void {
    setShowCategoryPlanForm(false);
    setEditingCategoryPlanItemId(null);
    setCategoryPlanForm(emptyCategoryPlanForm);
  }

  function handleSubmitCategoryPlanItem(event: React.FormEvent): void {
    event.preventDefault();
    resetMessages();

    const payload = {
      projectId,
      projectBudgetCategoryId: categoryPlanForm.projectBudgetCategoryId,
      vendorId: categoryPlanForm.vendorId || undefined,
      name: categoryPlanForm.name,
      scopeDescription: categoryPlanForm.scopeDescription || undefined,
      area: categoryPlanForm.area,
      quantity: Number(categoryPlanForm.quantity),
      unit: categoryPlanForm.unit,
      estimatedUnitCost: Number(categoryPlanForm.estimatedUnitCost) || 0,
      internalNote: categoryPlanForm.internalNote || undefined,
    };

    startTransition(async () => {
      const res = editingCategoryPlanItemId
        ? await updateProjectCategoryPlanItem({ ...payload, projectCategoryPlanItemId: editingCategoryPlanItemId })
        : await createProjectCategoryPlanItem(payload);
      if (!res.success) {
        setError(res.error.message);
        return;
      }
      setSuccess(editingCategoryPlanItemId ? "Package berhasil diperbarui." : "Package berhasil dibuat.");
      closeCategoryPlanForm();
      router.refresh();
    });
  }

  function handleMarkCategoryPlanActive(projectCategoryPlanItemId: string): void {
    resetMessages();
    startTransition(async () => {
      const res = await markProjectCategoryPlanItemActive(projectCategoryPlanItemId);
      if (!res.success) {
        setError(res.error.message);
        return;
      }
      setSuccess("Package sudah aktif.");
      router.refresh();
    });
  }

  function handleDeleteCategoryPlanItem(projectCategoryPlanItemId: string): void {
    resetMessages();
    startTransition(async () => {
      const res = await deleteProjectCategoryPlanItem(projectCategoryPlanItemId);
      if (!res.success) {
        setError(res.error.message);
        return;
      }
      setSuccess("Package draft berhasil dihapus.");
      router.refresh();
    });
  }

  function handleSubmitRapItem(event: React.FormEvent): void {
    event.preventDefault();
    resetMessages();
    if (!rap) {
      setError("Buat RAP draft terlebih dahulu.");
      return;
    }

    startTransition(async () => {
      const payload = {
        projectRapId: rap.id,
        materialId: rapForm.materialId || undefined,
        area: rapForm.area,
        name: rapForm.name,
        description: rapForm.description || undefined,
        requiredQuantity: Number(rapForm.requiredQuantity),
        bufferQuantity: Number(rapForm.bufferQuantity) || 0,
        unit: rapForm.unit,
        estimatedUnitCost: Number(rapForm.estimatedUnitCost) || 0,
        source: rapForm.source,
        internalNote: rapForm.internalNote || undefined,
      };
      const res = editingRapItemId
        ? await updateProjectRapItem({ ...payload, projectRapItemId: editingRapItemId })
        : await addProjectRapItem(payload);
      if (!res.success) {
        setError(res.error.message);
        return;
      }
      setSuccess(editingRapItemId ? "Item RAP berhasil diperbarui." : "Item material RAP berhasil ditambahkan.");
      closeRapForm();
      router.refresh();
    });
  }

  function handleLockRap(): void {
    if (!rap) return;
    resetMessages();
    startTransition(async () => {
      const res = await lockProjectRap(rap.id);
      if (!res.success) {
        setError(res.error.message);
        return;
      }
      setSuccess("RAP baseline berhasil dikunci.");
      router.refresh();
    });
  }

  function handleDeleteRapItem(projectRapItemId: string): void {
    resetMessages();
    startTransition(async () => {
      const res = await deleteProjectRapItem(projectRapItemId);
      if (!res.success) {
        setError(res.error.message);
        return;
      }
      setSuccess("Item RAP berhasil dihapus.");
      router.refresh();
    });
  }

  function handleGenerateRab(): void {
    resetMessages();
    const manualLines = manualQuotationLine.clientLabel.trim()
      ? [{
        clientLabel: manualQuotationLine.clientLabel.trim(),
        description: manualQuotationLine.description.trim() || undefined,
        quantity: Number(manualQuotationLine.quantity),
        unit: manualQuotationLine.unit.trim(),
        unitPrice: Number(manualQuotationLine.unitPrice) || 0,
      }]
      : [];

    startTransition(async () => {
      const res = await generateRabFromSelectedSources({
        projectId,
        projectRapItemIds: selectedRapQuotationIds,
        projectCategoryPlanItemIds: selectedCategoryQuotationIds,
        manualLines,
        title: "Client Estimate / Quotation",
      });
      if (!res.success) {
        setError(res.error.message);
        return;
      }
      setSuccess("Draft quotation client berhasil dibuat dari sumber terpilih.");
      setManualQuotationLine(emptyManualQuotationLine);
      router.refresh();
    });
  }

  function toggleSelection(currentIds: string[], id: string): string[] {
    return currentIds.includes(id)
      ? currentIds.filter((currentId) => currentId !== id)
      : [...currentIds, id];
  }

  function handleRabEditChange(item: RabItemView, updates: Partial<RabItemView>): void {
    setRabDraftEdits((current) => ({
      ...current,
      [item.id]: {
        ...(current[item.id] ?? item),
        ...updates,
      },
    }));
  }

  function handleSaveRabItem(item: RabItemView): void {
    const draft = rabDraftEdits[item.id] ?? item;
    resetMessages();
    startTransition(async () => {
      const res = await updateRabEstimateItem({
        rabEstimateItemId: item.id,
        clientLabel: draft.clientLabel,
        description: draft.description || undefined,
        quantity: Number(draft.quantity),
        unit: draft.unit,
        unitPrice: Number(draft.unitPrice),
        displayOrder: Number(draft.displayOrder),
        isHidden: draft.isHidden,
        isBundle: draft.isBundle,
      });
      if (!res.success) {
        setError(res.error.message);
        return;
      }
      setSuccess("Item RAB client berhasil diperbarui.");
      router.refresh();
    });
  }

  function handleApproveRab(): void {
    if (!rabEstimate) return;
    resetMessages();
    startTransition(async () => {
      const res = await approveRabEstimate(rabEstimate.id);
      if (!res.success) {
        setError(res.error.message);
        return;
      }
      setSuccess("RAB client berhasil disetujui.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-sm">
      {(error || success) && (
        <div className={`rounded-2xl border p-md text-xs font-semibold ${error ? "border-error/30 bg-error-container/20 text-error" : "border-primary/30 bg-surface-container-low text-primary"}`}>
          {error ?? success}
        </div>
      )}

      <div className="premium-card p-md border border-outline-variant/30 space-y-md">
        <div className="flex items-center justify-between gap-3 border-b border-outline-variant/10 pb-sm">
          <div>
            <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-primary">Internal Material Plan</p>
            <h3 className="font-sans text-[20px] leading-[28px] font-semibold text-[18px] text-on-surface">RAP Material</h3>
          </div>
          <Badge status={toBadgeStatus(rap?.status ?? "WARNING")}>{rap?.status ?? "Belum Ada"}</Badge>
        </div>

        {!rap ? (
          <div className="space-y-md">
            <p className="font-sans text-[14px] leading-[20px] font-normal text-on-surface-variant">
              Buat RAP untuk mencatat kebutuhan material internal, cek stock, dan menyiapkan draft RAB client.
            </p>
            {canEditRap && (
              <button
                type="button"
                onClick={handleCreateRap}
                disabled={isPending}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-on-primary shadow-sm active:scale-[0.98] disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Create RAP Draft
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-md">
            <div className="grid grid-cols-4 gap-sm text-center">
              <div className="rounded-xl bg-surface-container-low p-2 border border-outline-variant/10">
                <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[8px] text-on-surface-variant">Item</p>
                <p className="font-bold text-on-surface">{rap.items.length}</p>
              </div>
              <div className="rounded-xl bg-surface-container-low p-2 border border-outline-variant/10">
                <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[8px] text-on-surface-variant">Shortage</p>
                <p className={`font-bold ${shortageCount > 0 ? "text-secondary" : "text-primary"}`}>{shortageCount}</p>
              </div>
              <div className="rounded-xl bg-surface-container-low p-2 border border-outline-variant/10">
                <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[8px] text-on-surface-variant">Ready Qty</p>
                <p className="font-bold text-on-surface">{availableCoverage.toLocaleString("id-ID")}</p>
              </div>
              <div className="rounded-xl bg-surface-container-low p-2 border border-outline-variant/10">
                <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[8px] text-on-surface-variant">Need Buy</p>
                <p className="font-bold text-secondary">{needToBuy.toLocaleString("id-ID")}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-surface-container-low p-md border border-outline-variant/10">
              <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Planned Internal Material Cost</p>
              <p className="font-mono text-[16px] leading-[20px] font-medium font-bold text-on-surface financial-amount">{formatRp(plannedCost)}</p>
              <p className="mt-1 text-[10px] text-on-surface-variant">Internal-only. Tidak muncul di RAB client preview.</p>
            </div>

            <div className="space-y-sm">
              {rap.items.length === 0 ? (
                <p className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-md text-xs text-on-surface-variant">
                  Belum ada item material. Tambahkan material per area/room.
                </p>
              ) : (
                rap.items.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-md space-y-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-sans text-[14px] leading-[20px] font-normal font-bold text-on-surface truncate">{item.name}</p>
                        <p className="text-[10px] text-on-surface-variant">{item.area} • {item.totalQuantity} {item.unit} • {item.materialName}</p>
                      </div>
                      <Badge status={toBadgeStatus(item.status)}>{item.needToBuy > 0 ? `Beli ${item.needToBuy}` : item.status}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-sm text-[10px]">
                      <div>
                        <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Stock Ready</p>
                        <p className="font-bold text-on-surface">{item.availableStock.toLocaleString("id-ID")}</p>
                      </div>
                      <div>
                        <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Need Buy</p>
                        <p className="font-bold text-secondary">{item.needToBuy.toLocaleString("id-ID")}</p>
                      </div>
                      <div>
                        <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Internal Cost</p>
                        <p className="font-bold text-on-surface">{formatRp(Number(item.estimatedTotalCost))}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-sm rounded-xl border border-outline-variant/10 bg-surface/60 p-sm text-[10px]">
                      <div>
                        <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Bought</p>
                        <p className="font-bold text-on-surface">{item.boughtQuantity.toLocaleString("id-ID")}</p>
                      </div>
                      <div>
                        <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Reserved</p>
                        <p className="font-bold text-on-surface">{item.reservedQuantity.toLocaleString("id-ID")}</p>
                      </div>
                      <div>
                        <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Used</p>
                        <p className="font-bold text-on-surface">{item.usedQuantity.toLocaleString("id-ID")}</p>
                      </div>
                      <div>
                        <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Leftover</p>
                        <p className="font-bold text-primary">{item.leftoverQuantity.toLocaleString("id-ID")}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-outline-variant/10 bg-surface/60 p-sm text-[10px]">
                      <div>
                        <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Actual Material Cost</p>
                        <p className="font-bold text-on-surface">{formatRp(item.actualMaterialCost)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Variance</p>
                        <p className={`font-bold ${item.costVariance > 0 ? "text-error" : "text-primary"}`}>
                          {item.costVariance > 0 ? "+" : ""}{formatRp(item.costVariance)}
                        </p>
                      </div>
                    </div>
                    {item.internalNote && <p className="text-[10px] text-on-surface-variant">Internal note: {item.internalNote}</p>}
                    {canEditRap && rapIsDraft && (
                      <div className="flex flex-wrap gap-sm">
                        <button
                          type="button"
                          onClick={() => openEditRapForm(item)}
                          disabled={isPending}
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/20 px-3 text-[10px] font-bold text-primary active:scale-[0.98] disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                          Edit Draft Item
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRapItem(item.id)}
                          disabled={isPending}
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-error/20 px-3 text-[10px] font-bold text-error active:scale-[0.98] disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                          Delete Draft Item
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {canEditRap && rapIsDraft && (
              <div className="flex flex-wrap gap-sm">
                <button
                  type="button"
                  onClick={openAddRapForm}
                  disabled={isPending}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-on-primary active:scale-[0.98] disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Add Material Item
                </button>
                <button
                  type="button"
                  onClick={handleLockRap}
                  disabled={isPending || rap.items.length === 0}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/20 px-4 text-xs font-bold text-primary active:scale-[0.98] disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">lock</span>
                  Lock RAP Baseline
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-sm">
        {([
          { code: "TUKANG" as const, title: "Tukang Work Packages", eyebrow: "Labor Plan", items: tukangPlanItems },
          { code: "SUBCON" as const, title: "Subcon Packages", eyebrow: "Vendor Scope", items: subconPlanItems },
        ]).map((section) => {
          const estimatedTotal = section.items.reduce((sum, item) => sum + Number(item.estimatedTotalCost), 0);
          const actualTotal = section.items.reduce((sum, item) => sum + item.actualCost, 0);
          return (
            <div key={section.code} className="premium-card p-md border border-outline-variant/30 space-y-md">
              <div className="flex items-center justify-between gap-3 border-b border-outline-variant/10 pb-sm">
                <div>
                  <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-primary">{section.eyebrow}</p>
                  <h3 className="font-sans text-[20px] leading-[28px] font-semibold text-[18px] text-on-surface">{section.title}</h3>
                </div>
                <Badge status={section.items.length > 0 ? "PRIMARY" : "DRAFT"}>{`${section.items.length} item`}</Badge>
              </div>

              <div className="grid grid-cols-3 gap-sm text-center">
                <div className="rounded-xl bg-surface-container-low p-2 border border-outline-variant/10">
                  <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[8px] text-on-surface-variant">Estimate</p>
                  <p className="font-bold text-on-surface text-[11px]">{formatRp(estimatedTotal)}</p>
                </div>
                <div className="rounded-xl bg-surface-container-low p-2 border border-outline-variant/10">
                  <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[8px] text-on-surface-variant">Actual</p>
                  <p className="font-bold text-on-surface text-[11px]">{formatRp(actualTotal)}</p>
                </div>
                <div className="rounded-xl bg-surface-container-low p-2 border border-outline-variant/10">
                  <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[8px] text-on-surface-variant">Variance</p>
                  <p className={`font-bold text-[11px] ${actualTotal > estimatedTotal ? "text-error" : "text-primary"}`}>
                    {actualTotal > estimatedTotal ? "+" : ""}{formatRp(actualTotal - estimatedTotal)}
                  </p>
                </div>
              </div>

              <div className="space-y-sm">
                {section.items.length === 0 ? (
                  <p className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-md text-xs text-on-surface-variant">
                    Belum ada package. Tambahkan package untuk estimasi {section.code === "TUKANG" ? "scope tukang" : "scope vendor/subcon"} tanpa membuat input harian jadi rumit.
                  </p>
                ) : (
                  section.items.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-md space-y-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-sans text-[14px] leading-[20px] font-normal font-bold text-on-surface truncate">{item.name}</p>
                          <p className="text-[10px] text-on-surface-variant">
                            {item.area} • {item.quantity} {item.unit}{item.vendorName ? ` • ${item.vendorName}` : ""}
                          </p>
                        </div>
                        <Badge status={toBadgeStatus(item.status)}>{item.status}</Badge>
                      </div>
                      {item.scopeDescription && <p className="text-xs text-on-surface-variant">{item.scopeDescription}</p>}
                      <div className="grid grid-cols-3 gap-sm text-[10px]">
                        <div>
                          <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Estimate</p>
                          <p className="font-bold text-on-surface">{formatRp(Number(item.estimatedTotalCost))}</p>
                        </div>
                        <div>
                          <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Actual</p>
                          <p className="font-bold text-on-surface">{formatRp(item.actualCost)}</p>
                        </div>
                        <div>
                          <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-on-surface-variant">Variance</p>
                          <p className={`font-bold ${item.variance > 0 ? "text-error" : "text-primary"}`}>
                            {item.variance > 0 ? "+" : ""}{formatRp(item.variance)}
                          </p>
                        </div>
                      </div>
                      {item.internalNote && <p className="text-[10px] text-on-surface-variant">Internal note: {item.internalNote}</p>}
                      {canEditCategoryPlan && (
                        <div className="flex flex-wrap gap-sm">
                          <button
                            type="button"
                            onClick={() => openEditCategoryPlanForm(item)}
                            disabled={isPending}
                            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/20 px-3 text-[10px] font-bold text-primary active:scale-[0.98] disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                            Edit
                          </button>
                          {item.status === "DRAFT" && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleMarkCategoryPlanActive(item.id)}
                                disabled={isPending}
                                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/20 px-3 text-[10px] font-bold text-primary active:scale-[0.98] disabled:opacity-50"
                              >
                                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                Activate
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCategoryPlanItem(item.id)}
                                disabled={isPending}
                                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-error/20 px-3 text-[10px] font-bold text-error active:scale-[0.98] disabled:opacity-50"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {canEditCategoryPlan && (
                <button
                  type="button"
                  onClick={() => openAddCategoryPlanForm(section.code)}
                  disabled={isPending || !budgetCategories.some((category) => category.code === section.code)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-on-primary active:scale-[0.98] disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Add {section.code === "TUKANG" ? "Work Package" : "Subcon Package"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="premium-card p-md border border-outline-variant/30 space-y-md">
        <div className="flex items-center justify-between gap-3 border-b border-outline-variant/10 pb-sm">
          <div>
            <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-primary">Client Estimate / Quotation</p>
            <h3 className="font-sans text-[20px] leading-[28px] font-semibold text-[18px] text-on-surface">Client Quotation</h3>
          </div>
          <Badge status={toBadgeStatus(rabEstimate?.status ?? "WARNING")}>{rabEstimate?.status ?? "Belum Ada"}</Badge>
        </div>

        {!rabEstimate ? (
          <div className="space-y-md">
            <p className="font-sans text-[14px] leading-[20px] font-normal text-on-surface-variant">
              Generate draft quotation dari source internal terpilih. Harga dan label client bisa diedit sebelum approval.
            </p>
            <div className="space-y-sm rounded-2xl border border-outline-variant/15 bg-surface-container-low p-md">
              <p className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[9px] text-on-surface-variant">Pilih source quotation</p>
              {rap && rap.items.length > 0 && (
                <div className="space-y-xs">
                  <p className="text-[10px] font-bold text-on-surface">RAP Material</p>
                  {rap.items.map((item) => (
                    <label key={item.id} className="flex min-h-10 items-center gap-2 rounded-xl bg-surface/70 px-3 text-xs text-on-surface">
                      <input
                        type="checkbox"
                        checked={selectedRapQuotationIds.includes(item.id)}
                        onChange={() => setSelectedRapQuotationIds((current) => toggleSelection(current, item.id))}
                      />
                      <span className="min-w-0 flex-1 truncate">{item.area} - {item.name}</span>
                      <span className="text-[10px] text-on-surface-variant">{item.totalQuantity} {item.unit}</span>
                    </label>
                  ))}
                </div>
              )}
              {categoryPlanItems.length > 0 && (
                <div className="space-y-xs">
                  <p className="text-[10px] font-bold text-on-surface">Work/Subcon Packages</p>
                  {categoryPlanItems.map((item) => (
                    <label key={item.id} className="flex min-h-10 items-center gap-2 rounded-xl bg-surface/70 px-3 text-xs text-on-surface">
                      <input
                        type="checkbox"
                        checked={selectedCategoryQuotationIds.includes(item.id)}
                        onChange={() => setSelectedCategoryQuotationIds((current) => toggleSelection(current, item.id))}
                      />
                      <span className="min-w-0 flex-1 truncate">{item.expenseCategoryName} • {item.area} - {item.name}</span>
                      <span className="text-[10px] text-on-surface-variant">{item.quantity} {item.unit}</span>
                    </label>
                  ))}
                </div>
              )}

              <div className="space-y-xs border-t border-outline-variant/10 pt-sm">
                <p className="text-[10px] font-bold text-on-surface">Manual Client Line</p>
                <input
                  value={manualQuotationLine.clientLabel}
                  onChange={(event) => setManualQuotationLine({ ...manualQuotationLine, clientLabel: event.target.value })}
                  className="h-11 w-full rounded-xl bg-surface px-3 text-xs text-on-surface border border-outline-variant/20"
                  placeholder="Label client opsional"
                />
                <div className="grid grid-cols-3 gap-sm">
                  <input
                    type="number"
                    value={manualQuotationLine.quantity}
                    onChange={(event) => setManualQuotationLine({ ...manualQuotationLine, quantity: event.target.value })}
                    className="h-11 rounded-xl bg-surface px-3 text-xs text-on-surface border border-outline-variant/20"
                    placeholder="Qty"
                  />
                  <input
                    value={manualQuotationLine.unit}
                    onChange={(event) => setManualQuotationLine({ ...manualQuotationLine, unit: event.target.value })}
                    className="h-11 rounded-xl bg-surface px-3 text-xs text-on-surface border border-outline-variant/20"
                    placeholder="Unit"
                  />
                  <input
                    type="number"
                    value={manualQuotationLine.unitPrice}
                    onChange={(event) => setManualQuotationLine({ ...manualQuotationLine, unitPrice: event.target.value })}
                    className="h-11 rounded-xl bg-surface px-3 text-xs text-on-surface border border-outline-variant/20"
                    placeholder="Harga"
                  />
                </div>
                <textarea
                  value={manualQuotationLine.description}
                  onChange={(event) => setManualQuotationLine({ ...manualQuotationLine, description: event.target.value })}
                  rows={2}
                  className="w-full rounded-xl bg-surface px-3 py-2 text-xs text-on-surface border border-outline-variant/20"
                  placeholder="Deskripsi client-safe opsional"
                />
              </div>
            </div>
            {((rap?.items.length ?? 0) > 0 || categoryPlanItems.length > 0 || Boolean(manualQuotationLine.clientLabel.trim())) && (
              <button
                type="button"
                onClick={handleGenerateRab}
                disabled={
                  isPending ||
                  (selectedRapQuotationIds.length + selectedCategoryQuotationIds.length === 0 && !manualQuotationLine.clientLabel.trim())
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-on-primary active:scale-[0.98] disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                Generate Quotation Draft
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-md">
            <div className="rounded-2xl bg-surface-container-low p-md border border-outline-variant/10">
              <p className="font-sans text-[14px] leading-[20px] font-normal font-bold text-on-surface">{rabEstimate.title}</p>
              <p className="text-[10px] text-on-surface-variant">Revision {rabEstimate.revision} • client-safe quotation</p>
              <p className="mt-2 font-mono text-[16px] leading-[20px] font-medium font-bold text-primary financial-amount">{formatRp(visibleRabValue)}</p>
            </div>

            {sortedRabItems.map((item) => {
              const draft = rabDraftEdits[item.id] ?? item;
              const lineTotal = Number(draft.quantity) * Number(draft.unitPrice);
              const isApproved = rabEstimate.status === "APPROVED";

              return (
                <div key={item.id} className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-md space-y-sm">
                  {isApproved ? (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-sans text-[14px] leading-[20px] font-normal font-bold text-on-surface truncate">{item.clientLabel}</p>
                          <p className="text-[10px] text-on-surface-variant">{item.quantity} {item.unit}</p>
                        </div>
                        <p className="font-bold text-primary">{formatRp(Number(item.lineTotal))}</p>
                      </div>
                      {item.description && <p className="text-xs text-on-surface-variant">{item.description}</p>}
                    </>
                  ) : (
                    <>
                      <input
                        value={draft.clientLabel}
                        onChange={(event) => handleRabEditChange(item, { clientLabel: event.target.value })}
                        className="h-11 w-full rounded-xl bg-surface px-3 text-xs font-bold text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary"
                      />
                      <textarea
                        value={draft.description ?? ""}
                        onChange={(event) => handleRabEditChange(item, { description: event.target.value })}
                        rows={2}
                        className="w-full rounded-xl bg-surface px-3 py-2 text-xs text-on-surface border border-outline-variant/30 focus:outline-none focus:border-primary"
                        placeholder="Deskripsi client-safe..."
                      />
                      <div className="grid grid-cols-3 gap-sm">
                        <input
                          type="number"
                          value={draft.quantity}
                          onChange={(event) => handleRabEditChange(item, { quantity: event.target.value })}
                          className="h-11 rounded-xl bg-surface px-3 text-xs text-on-surface border border-outline-variant/30"
                        />
                        <input
                          value={draft.unit}
                          onChange={(event) => handleRabEditChange(item, { unit: event.target.value })}
                          className="h-11 rounded-xl bg-surface px-3 text-xs text-on-surface border border-outline-variant/30"
                        />
                        <input
                          type="number"
                          value={draft.unitPrice}
                          onChange={(event) => handleRabEditChange(item, { unitPrice: event.target.value })}
                          className="h-11 rounded-xl bg-surface px-3 text-xs text-on-surface border border-outline-variant/30"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <label className="inline-flex min-h-11 items-center gap-2 text-on-surface-variant">
                          <input
                            type="checkbox"
                            checked={draft.isHidden}
                            onChange={(event) => handleRabEditChange(item, { isHidden: event.target.checked })}
                          />
                          Hide
                        </label>
                        <label className="inline-flex min-h-11 items-center gap-2 text-on-surface-variant">
                          <input
                            type="checkbox"
                            checked={draft.isBundle}
                            onChange={(event) => handleRabEditChange(item, { isBundle: event.target.checked })}
                          />
                          Bundle
                        </label>
                        <p className="font-bold text-primary">{formatRp(lineTotal)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSaveRabItem(item)}
                        disabled={isPending}
                        className="min-h-11 w-full rounded-xl border border-primary/20 text-xs font-bold text-primary active:scale-[0.98] disabled:opacity-50"
                      >
                        Save Quotation Item
                      </button>
                    </>
                  )}
                </div>
              );
            })}

            {canApproveRab && rabEstimate.status !== "APPROVED" && (
              <button
                type="button"
                onClick={handleApproveRab}
                disabled={isPending || rabEstimate.items.length === 0}
                className="min-h-12 w-full rounded-xl bg-primary text-xs font-bold text-on-primary active:scale-[0.98] disabled:opacity-50"
              >
                Approve Quotation
              </button>
            )}
          </div>
        )}
      </div>

      {showCategoryPlanForm && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
          <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-outline-variant/30 bg-background p-md shadow-2xl sm:rounded-2xl">
            <div className="mb-md flex items-center justify-between border-b border-outline-variant/10 pb-sm">
              <h3 className="font-sans text-[20px] leading-[28px] font-semibold text-[18px] text-on-surface">
                {editingCategoryPlanItemId ? "Edit Package" : "Add Work/Subcon Package"}
              </h3>
              <button
                type="button"
                onClick={closeCategoryPlanForm}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitCategoryPlanItem} className="space-y-md">
              <div className="space-y-xs">
                <label className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[10px] text-on-surface-variant">Budget Category</label>
                <select
                  value={categoryPlanForm.projectBudgetCategoryId}
                  onChange={(event) => setCategoryPlanForm({ ...categoryPlanForm, projectBudgetCategoryId: event.target.value })}
                  className="h-12 w-full rounded-xl bg-surface-container-low px-3 text-xs text-on-surface"
                  required
                >
                  <option value="">Pilih kategori</option>
                  {budgetCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-sm">
                <input
                  className="h-12 rounded-xl bg-surface-container-low px-3 text-xs"
                  placeholder="Area / Scope"
                  value={categoryPlanForm.area}
                  onChange={(event) => setCategoryPlanForm({ ...categoryPlanForm, area: event.target.value })}
                />
                <select
                  value={categoryPlanForm.vendorId}
                  onChange={(event) => setCategoryPlanForm({ ...categoryPlanForm, vendorId: event.target.value })}
                  className="h-12 rounded-xl bg-surface-container-low px-3 text-xs"
                >
                  <option value="">Vendor optional</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                  ))}
                </select>
              </div>

              <input
                className="h-12 w-full rounded-xl bg-surface-container-low px-3 text-xs"
                placeholder="Nama package"
                value={categoryPlanForm.name}
                onChange={(event) => setCategoryPlanForm({ ...categoryPlanForm, name: event.target.value })}
              />
              <textarea
                className="w-full rounded-xl bg-surface-container-low px-3 py-2 text-xs"
                rows={2}
                placeholder="Scope pekerjaan internal"
                value={categoryPlanForm.scopeDescription}
                onChange={(event) => setCategoryPlanForm({ ...categoryPlanForm, scopeDescription: event.target.value })}
              />
              <div className="grid grid-cols-3 gap-sm">
                <input
                  type="number"
                  className="h-12 rounded-xl bg-surface-container-low px-3 text-xs"
                  placeholder="Qty"
                  value={categoryPlanForm.quantity}
                  onChange={(event) => setCategoryPlanForm({ ...categoryPlanForm, quantity: event.target.value })}
                />
                <input
                  className="h-12 rounded-xl bg-surface-container-low px-3 text-xs"
                  placeholder="Unit"
                  value={categoryPlanForm.unit}
                  onChange={(event) => setCategoryPlanForm({ ...categoryPlanForm, unit: event.target.value })}
                />
                <input
                  type="number"
                  className="h-12 rounded-xl bg-surface-container-low px-3 text-xs"
                  placeholder="Cost/unit"
                  value={categoryPlanForm.estimatedUnitCost}
                  onChange={(event) => setCategoryPlanForm({ ...categoryPlanForm, estimatedUnitCost: event.target.value })}
                />
              </div>
              <textarea
                className="w-full rounded-xl bg-surface-container-low px-3 py-2 text-xs"
                rows={2}
                placeholder="Internal note, tidak tampil ke client"
                value={categoryPlanForm.internalNote}
                onChange={(event) => setCategoryPlanForm({ ...categoryPlanForm, internalNote: event.target.value })}
              />

              <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-md text-xs">
                <div className="flex justify-between"><span>Estimated Package Cost</span><strong>{formatRp(categoryFormEstimatedTotal)}</strong></div>
                <p className="mt-1 text-[10px] text-on-surface-variant">Internal-only. Quotation akan membuat client-safe draft yang bisa diedit.</p>
              </div>

              <button
                type="submit"
                disabled={isPending || !categoryPlanForm.projectBudgetCategoryId || !categoryPlanForm.name || !categoryPlanForm.area || !categoryPlanForm.unit}
                className="min-h-12 w-full rounded-xl bg-primary text-xs font-bold text-on-primary active:scale-[0.98] disabled:opacity-50"
              >
                {editingCategoryPlanItemId ? "Update Package" : "Save Package"}
              </button>
            </form>
          </div>
        </div>
      )}

      {showRapForm && rap && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
          <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-outline-variant/30 bg-background p-md shadow-2xl sm:rounded-2xl">
            <div className="mb-md flex items-center justify-between border-b border-outline-variant/10 pb-sm">
              <h3 className="font-sans text-[20px] leading-[28px] font-semibold text-[18px] text-on-surface">
                {editingRapItemId ? "Edit RAP Material" : "Add RAP Material"}
              </h3>
              <button
                type="button"
                onClick={closeRapForm}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitRapItem} className="space-y-md">
              <div className="space-y-xs">
                <label className="font-sans text-[8px] leading-[16px] tracking-wider font-bold uppercase text-[10px] text-on-surface-variant">Material Master</label>
                <select
                  value={rapForm.materialId}
                  onChange={(event) => handleMaterialChange(event.target.value)}
                  className="h-12 w-full rounded-xl bg-surface-container-low px-3 text-xs text-on-surface"
                >
                  <option value="">Manual / belum pilih material</option>
                  {materials.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.name} • ready {material.availableStock} {material.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-sm">
                <input className="h-12 rounded-xl bg-surface-container-low px-3 text-xs" placeholder="Area / Room" value={rapForm.area} onChange={(event) => setRapForm({ ...rapForm, area: event.target.value })} />
                <input className="h-12 rounded-xl bg-surface-container-low px-3 text-xs" placeholder="Unit" value={rapForm.unit} onChange={(event) => setRapForm({ ...rapForm, unit: event.target.value })} />
              </div>
              <input className="h-12 w-full rounded-xl bg-surface-container-low px-3 text-xs" placeholder="Nama item internal" value={rapForm.name} onChange={(event) => setRapForm({ ...rapForm, name: event.target.value })} />
              <textarea className="w-full rounded-xl bg-surface-container-low px-3 py-2 text-xs" rows={2} placeholder="Deskripsi internal" value={rapForm.description} onChange={(event) => setRapForm({ ...rapForm, description: event.target.value })} />
              <div className="grid grid-cols-3 gap-sm">
                <input type="number" className="h-12 rounded-xl bg-surface-container-low px-3 text-xs" placeholder="Qty" value={rapForm.requiredQuantity} onChange={(event) => setRapForm({ ...rapForm, requiredQuantity: event.target.value })} />
                <input type="number" className="h-12 rounded-xl bg-surface-container-low px-3 text-xs" placeholder="Buffer" value={rapForm.bufferQuantity} onChange={(event) => setRapForm({ ...rapForm, bufferQuantity: event.target.value })} />
                <input type="number" className="h-12 rounded-xl bg-surface-container-low px-3 text-xs" placeholder="Cost/unit" value={rapForm.estimatedUnitCost} onChange={(event) => setRapForm({ ...rapForm, estimatedUnitCost: event.target.value })} />
              </div>
              <select className="h-12 w-full rounded-xl bg-surface-container-low px-3 text-xs" value={rapForm.source} onChange={(event) => setRapForm({ ...rapForm, source: event.target.value as RapFormState["source"] })}>
                <option value="PURCHASE">Purchase</option>
                <option value="STOCK">Stock</option>
                <option value="STOCK_AND_PURCHASE">Stock + Purchase</option>
                <option value="VENDOR">Vendor</option>
              </select>
              <textarea className="w-full rounded-xl bg-surface-container-low px-3 py-2 text-xs" rows={2} placeholder="Internal note, tidak tampil ke client" value={rapForm.internalNote} onChange={(event) => setRapForm({ ...rapForm, internalNote: event.target.value })} />

              <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-md text-xs">
                <div className="flex justify-between"><span>Total Qty</span><strong>{formTotalQty.toLocaleString("id-ID")}</strong></div>
                <div className="flex justify-between"><span>Need to Buy</span><strong>{formNeedToBuy.toLocaleString("id-ID")}</strong></div>
                <div className="flex justify-between"><span>Internal Cost</span><strong>{formatRp(formEstimatedTotal)}</strong></div>
              </div>

              <button
                type="submit"
                disabled={isPending || !rapForm.name || !rapForm.area || !rapForm.unit || !rapForm.requiredQuantity}
                className="min-h-12 w-full rounded-xl bg-primary text-xs font-bold text-on-primary active:scale-[0.98] disabled:opacity-50"
              >
                {editingRapItemId ? "Update RAP Item" : "Save RAP Item"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
