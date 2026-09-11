"use client";

import React from "react";

import {
  AppIcon,
  Badge,
  type BadgeStatus,
  Button,
  DetailSheet,
  FactRow,
  MoneyValue,
  useSheetPresenceValue,
} from "@/components/ui";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
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
    <DetailSheet
      open={open}
      title="Detail Material RAP"
      onClose={() => setRapDetailItemId(null)}
      onExitComplete={handleExitComplete}
      footer={
        canEditRap && rap?.status === "DRAFT" ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={pending}
              leadingIcon={<AppIcon name="edit" className="icon-sm" />}
              onClick={() => {
                setRapDetailItemId(null);
                openEditRapForm(item);
              }}
              fullWidth
            >
              Edit Material
            </Button>
            <Button
              type="button"
              variant="criticalQuiet"
              disabled={pending}
              leadingIcon={<AppIcon name="delete" className="icon-sm" />}
              onClick={() => {
                setRapDetailItemId(null);
                handleDeleteRapItem(item.id);
              }}
              fullWidth
            >
              Hapus
            </Button>
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
              <p className="text-meta font-bold tracking-wide text-on-surface-variant uppercase">
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
                variant="fullDynamic"
                size="md"
                align="right"
              />
            }
          />

          {item.internalNote && (
            <div className="px-4 py-3.5">
              <p className="text-meta font-bold tracking-wide text-on-surface-variant uppercase">
                Catatan Internal
              </p>
              <p className="mt-1 text-xs leading-relaxed text-on-surface">{item.internalNote}</p>
            </div>
          )}
        </div>
      </div>
    </DetailSheet>
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
    <DetailSheet
      open={open}
      title="Detail Paket Kerja"
      onClose={() => setPackageDetailItemId(null)}
      onExitComplete={handleExitComplete}
      footer={
        canEditCategoryPlan ? (
          <div className="grid gap-2">
            {editable && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  leadingIcon={<AppIcon name="edit" className="icon-sm" />}
                  onClick={() => {
                    setPackageDetailItemId(null);
                    openEditCategoryPlanForm(item);
                  }}
                  fullWidth
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={pending}
                  pending={pending}
                  pendingLabel="Memproses…"
                  leadingIcon={<AppIcon name="check" className="icon-sm" />}
                  onClick={() => {
                    handleMarkCategoryPlanActive(item.id);
                  }}
                  fullWidth
                >
                  Tandai Siap
                </Button>
              </div>
            )}
            {editable && (
              <Button
                type="button"
                variant="criticalQuiet"
                disabled={pending}
                leadingIcon={<AppIcon name="delete" className="icon-sm" />}
                onClick={() => {
                  setPackageDetailItemId(null);
                  handleDeleteCategoryPlanItem(item.id);
                }}
                fullWidth
              >
                Hapus Paket
              </Button>
            )}
            {item.status === "ACTIVE" && (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                pending={pending}
                pendingLabel="Memproses…"
                leadingIcon={<AppIcon name="edit" className="icon-sm" />}
                onClick={() => {
                  handleReopenPackage(item.id);
                }}
                fullWidth
              >
                Edit Lagi
              </Button>
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
              <p className="text-meta font-bold tracking-wide text-on-surface-variant uppercase">
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
                variant="compact"
                size="sm"
                align="right"
              />
            }
          />
          <FactRow
            label="Realisasi Aktual"
            value={
              <MoneyValue amount={item.actualCost} variant="compact" size="sm" align="right" />
            }
          />
          <FactRow
            label="Sisa Estimasi"
            value={
              <MoneyValue
                amount={-item.variance}
                variant="compact"
                size="sm"
                align="right"
                tone={item.variance > 0 ? "danger" : "default"}
              />
            }
          />

          {item.vendorName && <FactRow label="Vendor Utama" value={item.vendorName} />}
        </div>
      </div>
    </DetailSheet>
  );
}
