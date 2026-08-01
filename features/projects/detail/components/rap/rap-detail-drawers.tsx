"use client";

import React from "react";

import {
  Badge,
  type BadgeStatus,
  BottomSheet,
  FactRow,
  MoneyValue,
  useSheetPresenceValue,
} from "@/components/ui";
import { formatBusinessLabel } from "@/lib/presentation/business-labels";
import type { ProjectCategoryPlanItemView, RapItemView, RapView } from "../shared/rap-rab-manager";

function toBadgeStatus(status: string): BadgeStatus {
  if (status === "LOCKED" || status === "READY" || status === "APPROVED") return "APPROVED";
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
  pending = false,
}: {
  readonly rap: RapView | null;
  readonly rapDetailItemId: string | null;
  readonly setRapDetailItemId: (id: string | null) => void;
  readonly canEditRap: boolean;
  readonly openEditRapForm: (item: RapItemView) => void;
  readonly handleDeleteRapItem: (id: string) => void;
  readonly pending?: boolean;
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
              disabled={pending}
              onClick={() => {
                setRapDetailItemId(null);
                openEditRapForm(item);
              }}
              className="min-h-12 rounded-full bg-surface-container text-xs font-bold transition active:scale-[0.97] disabled:opacity-50"
            >
              Edit Material
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setRapDetailItemId(null);
                handleDeleteRapItem(item.id);
              }}
              className="min-h-12 rounded-full bg-error-container/25 text-xs font-bold text-error transition active:scale-[0.97] disabled:opacity-50"
            >
              Hapus
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-md">
        <div className="flex items-start justify-between gap-3 px-1">
          <div className="min-w-0">
            <p className="text-base font-bold text-on-surface">{item.name}</p>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              {item.area} · {item.materialName}
            </p>
          </div>
          <Badge status={toBadgeStatus(item.status)}>{formatBusinessLabel(item.status)}</Badge>
        </div>

        <div className="divide-y divide-outline-variant/15 overflow-hidden rounded-[22px] bg-surface-container-lowest shadow-surface ring-1 ring-ring-subtle">
          {item.description && (
            <div className="bg-surface-container-low/20 px-4 py-3.5">
              <p className="text-[10px] font-bold tracking-wide text-on-surface-variant uppercase">
                Spesifikasi / Penggunaan
              </p>
              <p className="mt-1 text-xs leading-relaxed text-on-surface">{item.description}</p>
            </div>
          )}

          <FactRow label="Total Kebutuhan" value={`${item.totalQuantity} ${item.unit}`} />
          <FactRow
            label="Perlu Dibeli"
            value={
              <span className={item.needToBuy > 0 ? "text-error" : "text-on-surface"}>
                {item.needToBuy} {item.unit}
              </span>
            }
          />
          <FactRow label="Stok Fisik Tersedia" value={`${item.availableStock} ${item.unit}`} />
          <FactRow label="Stok Terreservasi" value={`${item.reservedQuantity} ${item.unit}`} />
          <FactRow label="Stok Terpakai" value={`${item.usedQuantity} ${item.unit}`} />

          <FactRow
            label="Estimasi Internal"
            value={
              <MoneyValue
                amount={Number(item.estimatedTotalCost)}
                variant="compactWithFull"
                size="sm"
                align="right"
              />
            }
          />

          {item.internalNote && (
            <div className="px-4 py-3.5">
              <p className="text-[10px] font-bold tracking-wide text-on-surface-variant uppercase">
                Catatan Internal
              </p>
              <p className="mt-1 text-xs leading-relaxed text-on-surface">{item.internalNote}</p>
            </div>
          )}
        </div>
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
  pending = false,
}: {
  readonly categoryPlanItems: readonly ProjectCategoryPlanItemView[];
  readonly packageDetailItemId: string | null;
  readonly setPackageDetailItemId: (id: string | null) => void;
  readonly canEditCategoryPlan: boolean;
  readonly openEditCategoryPlanForm: (item: ProjectCategoryPlanItemView) => void;
  readonly handleMarkCategoryPlanActive: (id: string) => void;
  readonly handleDeleteCategoryPlanItem: (id: string) => void;
  readonly handleReopenPackage: (id: string) => void;
  readonly pending?: boolean;
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
      title="Detail Paket Kerja"
      onClose={() => setPackageDetailItemId(null)}
      onExitComplete={handleExitComplete}
      footer={
        canEditCategoryPlan ? (
          <div className="grid gap-2">
            {editable && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setPackageDetailItemId(null);
                    openEditCategoryPlanForm(item);
                  }}
                  className="min-h-12 rounded-full bg-surface-container text-xs font-bold transition active:scale-[0.97] disabled:opacity-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    handleMarkCategoryPlanActive(item.id);
                  }}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary text-xs font-bold text-on-primary transition active:scale-[0.97] disabled:opacity-50"
                >
                  {pending ? "Memproses…" : "Tandai Siap"}
                </button>
              </div>
            )}
            {editable && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setPackageDetailItemId(null);
                  handleDeleteCategoryPlanItem(item.id);
                }}
                className="min-h-12 rounded-full bg-error-container/25 text-xs font-bold text-error transition active:scale-[0.97] disabled:opacity-50"
              >
                Hapus Paket
              </button>
            )}
            {item.status === "ACTIVE" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  handleReopenPackage(item.id);
                }}
                className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary/10 text-xs font-bold text-primary transition active:scale-[0.97] disabled:opacity-50"
              >
                {pending ? "Memproses…" : "Edit Lagi"}
              </button>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="space-y-md">
        <div className="flex items-start justify-between gap-3 px-1">
          <div className="min-w-0">
            <p className="text-base font-bold text-on-surface">{item.name}</p>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              {item.expenseCategoryName} · {item.area}
            </p>
          </div>
          <Badge status={toBadgeStatus(item.status)}>
            {item.status === "ACTIVE" ? "Siap" : formatBusinessLabel(item.status)}
          </Badge>
        </div>

        <div className="divide-y divide-outline-variant/15 overflow-hidden rounded-[22px] bg-surface-container-lowest shadow-surface ring-1 ring-ring-subtle">
          {item.scopeDescription && (
            <div className="bg-surface-container-low/20 px-4 py-3.5">
              <p className="text-[10px] font-bold tracking-wide text-on-surface-variant uppercase">
                Lingkup Pekerjaan
              </p>
              <p className="mt-1 text-xs leading-relaxed text-on-surface">
                {item.scopeDescription}
              </p>
            </div>
          )}

          <FactRow
            label="Estimasi Paket"
            value={
              <MoneyValue
                amount={Number(item.estimatedTotalCost)}
                variant="compactWithFull"
                size="sm"
                align="right"
              />
            }
          />
          <FactRow
            label="Realisasi Aktual"
            value={
              <MoneyValue
                amount={item.actualCost}
                variant="compactWithFull"
                size="sm"
                align="right"
              />
            }
          />
          <FactRow
            label="Sisa Estimasi"
            value={
              <MoneyValue
                amount={-item.variance}
                variant="compactWithFull"
                size="sm"
                align="right"
                tone={item.variance > 0 ? "danger" : "default"}
              />
            }
          />

          {item.vendorName && <FactRow label="Vendor Utama" value={item.vendorName} />}
        </div>
      </div>
    </BottomSheet>
  );
}
