"use client";

import React from "react";

import { BottomSheet, useSheetPresenceValue } from "@/components/ui";
import { Badge, type BadgeStatus } from "@/components/ui/badge";
import { CompactMoney, CompactQty } from "../shared/rap-rab-primitives";
import type {
  ProjectCategoryPlanItemView,
  RapItemView,
  RapView,
} from "../shared/rap-rab-manager";

function toBadgeStatus(status: string): BadgeStatus {
  if (status === "LOCKED" || status === "READY" || status === "APPROVED")
    return "APPROVED";
  if (status === "SHORTAGE" || status === "WAITING_PURCHASE") return "WARNING";
  if (status === "DRAFT" || status === "PLANNED") return "DRAFT";
  return "PRIMARY";
}

export function RapItemDetailDrawer({
  rap,
  rapDetailItemId,
  setRapDetailItemId,
  canEditRap,
  openEditRapForm,
  handleDeleteRapItem,
}: {
  readonly rap: RapView | null;
  readonly rapDetailItemId: string | null;
  readonly setRapDetailItemId: (id: string | null) => void;
  readonly canEditRap: boolean;
  readonly openEditRapForm: (item: RapItemView) => void;
  readonly handleDeleteRapItem: (id: string) => void;
}): React.JSX.Element | null {
  const selectedItem = rap?.items.find((row) => row.id === rapDetailItemId);
  const {
    presentedValue: item,
    open,
    handleExitComplete,
  } = useSheetPresenceValue(selectedItem, rapDetailItemId);
  if (!item) return null;

  return (
    <BottomSheet
      open={open}
      title="Detail Material RAP"
      onClose={() => setRapDetailItemId(null)}
      onExitComplete={handleExitComplete}
      footer={
        canEditRap && rap?.status === "DRAFT" ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setRapDetailItemId(null);
                openEditRapForm(item);
              }}
              className="min-h-12 rounded-full bg-surface-container text-xs font-bold"
            >
              Edit Material
            </button>
            <button
              type="button"
              onClick={() => {
                setRapDetailItemId(null);
                handleDeleteRapItem(item.id);
              }}
              className="min-h-12 rounded-full bg-error-container/25 text-xs font-bold text-error"
            >
              Hapus
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-sm">
        <div>
          <p className="text-lg font-bold">{item.name}</p>
          <p className="text-xs text-on-surface-variant">
            {item.area} - {item.materialName}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <CompactQty
            label="Total Kebutuhan"
            value={`${item.totalQuantity} ${item.unit}`}
          />
          <CompactQty
            label="Perlu Dibeli"
            value={item.needToBuy.toLocaleString("id-ID")}
            danger={item.needToBuy > 0}
          />
          <CompactQty
            label="Tersedia"
            value={item.availableStock.toLocaleString("id-ID")}
          />
          <CompactQty
            label="Terpakai"
            value={item.usedQuantity.toLocaleString("id-ID")}
          />
        </div>
        <CompactMoney
          label="Estimasi Internal"
          value={Number(item.estimatedTotalCost)}
        />
        {item.description && (
          <div className="rounded-2xl bg-surface-container-low p-3 text-xs leading-5">
            {item.description}
          </div>
        )}
        {item.internalNote && (
          <div className="rounded-2xl bg-primary/5 p-3 text-xs leading-5 text-on-surface-variant">
            <strong>Catatan internal:</strong> {item.internalNote}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

export function PackageDetailDrawer({
  categoryPlanItems,
  packageDetailItemId,
  setPackageDetailItemId,
  canEditCategoryPlan,
  openEditCategoryPlanForm,
  handleMarkCategoryPlanActive,
  handleDeleteCategoryPlanItem,
  handleReopenPackage,
}: {
  readonly categoryPlanItems: readonly ProjectCategoryPlanItemView[];
  readonly packageDetailItemId: string | null;
  readonly setPackageDetailItemId: (id: string | null) => void;
  readonly canEditCategoryPlan: boolean;
  readonly openEditCategoryPlanForm: (item: ProjectCategoryPlanItemView) => void;
  readonly handleMarkCategoryPlanActive: (id: string) => void;
  readonly handleDeleteCategoryPlanItem: (id: string) => void;
  readonly handleReopenPackage: (id: string) => void;
}): React.JSX.Element | null {
  const selectedItem = categoryPlanItems.find((row) => row.id === packageDetailItemId);
  const {
    presentedValue: item,
    open,
    handleExitComplete,
  } = useSheetPresenceValue(selectedItem, packageDetailItemId);
  if (!item) return null;

  const editable = canEditCategoryPlan && item.status === "DRAFT";

  return (
    <BottomSheet
      open={open}
      title="Detail Package"
      onClose={() => setPackageDetailItemId(null)}
      onExitComplete={handleExitComplete}
      footer={
        canEditCategoryPlan ? (
          <div className="grid gap-2">
            {editable && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPackageDetailItemId(null);
                    openEditCategoryPlanForm(item);
                  }}
                  className="min-h-12 rounded-full bg-surface-container text-xs font-bold"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleMarkCategoryPlanActive(item.id)}
                  className="min-h-12 rounded-full bg-primary text-xs font-bold text-on-primary"
                >
                  Tandai Siap
                </button>
              </div>
            )}
            {editable && (
              <button
                type="button"
                onClick={() => {
                  setPackageDetailItemId(null);
                  handleDeleteCategoryPlanItem(item.id);
                }}
                className="min-h-12 rounded-full bg-error-container/25 text-xs font-bold text-error"
              >
                Hapus Package
              </button>
            )}
            {item.status === "ACTIVE" && (
              <button
                type="button"
                onClick={() => handleReopenPackage(item.id)}
                className="min-h-12 rounded-full bg-primary/10 text-xs font-bold text-primary"
              >
                Edit Lagi
              </button>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="space-y-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold">{item.name}</p>
            <p className="text-xs text-on-surface-variant">
              {item.expenseCategoryName} - {item.area}
            </p>
          </div>
          <Badge status={toBadgeStatus(item.status)}>
            {item.status === "ACTIVE" ? "Siap" : item.status}
          </Badge>
        </div>
        {item.scopeDescription && (
          <div className="rounded-2xl bg-surface-container-low p-3 text-xs leading-5">
            {item.scopeDescription}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <CompactMoney label="Estimasi" value={Number(item.estimatedTotalCost)} />
          <CompactMoney label="Aktual" value={item.actualCost} />
          <CompactMoney
            label="Sisa Estimasi"
            value={-item.variance}
            danger={item.variance > 0}
          />
        </div>
        {item.vendorName && (
          <div className="rounded-2xl bg-primary/5 p-3 text-xs">
            <strong>Vendor:</strong> {item.vendorName}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
