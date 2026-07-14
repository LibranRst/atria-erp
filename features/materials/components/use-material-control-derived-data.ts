"use client";

import { useMemo } from "react";

import type {
  MaterialMovementView,
  MaterialOperationsDashboard,
  ReceiptView,
} from "@/app/actions/material/operations-dashboard";
import type { GroupedMaterial } from "@/features/materials/lib/material-ui-utils";

export type MaterialControlLocation = {
  readonly id: string;
  readonly name: string;
};

export type MaterialControlMaterial = {
  readonly id: string;
  readonly name: string;
  readonly unit: string;
  readonly categoryName: string;
};

type MaterialControlFilters = {
  readonly search: string;
  readonly location: string;
  readonly status: string;
  readonly activityType: string;
  readonly activityProject: string;
  readonly activityLocation: string;
  readonly activityPeriod: string;
};

type UseMaterialControlDerivedDataInput = {
  readonly data: MaterialOperationsDashboard;
  readonly movements: readonly MaterialMovementView[];
  readonly filters: MaterialControlFilters;
  readonly activityNow: number;
  readonly projectId: string;
  readonly rapItemId: string;
};

export function useMaterialControlDerivedData({
  data,
  movements,
  filters,
  activityNow,
  projectId,
  rapItemId,
}: UseMaterialControlDerivedDataInput): {
  readonly locations: readonly MaterialControlLocation[];
  readonly materials: readonly MaterialControlMaterial[];
  readonly grouped: readonly GroupedMaterial[];
  readonly visibleMaterials: readonly GroupedMaterial[];
  readonly movementTypes: readonly string[];
  readonly visibleMovements: readonly MaterialMovementView[];
  readonly locationOptions: readonly { readonly value: string; readonly label: string }[];
  readonly activityProjectOptions: readonly { readonly value: string; readonly label: string }[];
  readonly activityLocationOptions: readonly { readonly value: string; readonly label: string }[];
  readonly visibleReceipts: readonly ReceiptView[];
  readonly selectedProject: MaterialOperationsDashboard["projects"][number] | undefined;
  readonly selectedRap:
    | MaterialOperationsDashboard["projects"][number]["rapItems"][number]
    | undefined;
  readonly selectedMaterial: MaterialOperationsDashboard["inventory"];
  readonly totalStockValue: number;
  readonly availableValue: number;
  readonly lowCount: number;
  readonly pendingApprovals: number;
} {
  const locations = useMemo(
    () =>
      Array.from(
        new Map(
          data.inventory.map((row) => [
            row.locationId,
            { id: row.locationId, name: row.locationName },
          ]),
        ).values(),
      ),
    [data.inventory],
  );

  const materials = useMemo(
    () =>
      Array.from(
        new Map(
          data.inventory.map((row) => [
            row.materialId,
            {
              id: row.materialId,
              name: row.materialName,
              unit: row.unit,
              categoryName: row.categoryName,
            },
          ]),
        ).values(),
      ),
    [data.inventory],
  );

  const grouped = useMemo(
    () =>
      materials.map((material) => ({
        ...material,
        rows: data.inventory.filter((row) => row.materialId === material.id),
        shortages: data.shortages.filter((row) => row.materialId === material.id),
      })),
    [data.inventory, data.shortages, materials],
  );

  const visibleMaterials = useMemo(
    () =>
      grouped.filter((material) => {
        const text = [
          material.name,
          material.categoryName,
          ...material.rows.flatMap((row) => [
            row.specification ?? "",
            row.brand ?? "",
            row.code ?? "",
            row.color ?? "",
            row.locationName,
          ]),
        ]
          .join(" ")
          .toLowerCase();
        return (
          text.includes(filters.search.toLowerCase()) &&
          (filters.location === "ALL" ||
            material.rows.some((row) => row.locationId === filters.location)) &&
          (filters.status === "ALL" ||
            material.rows.some((row) => row.status === filters.status))
        );
      }),
    [filters.location, filters.search, filters.status, grouped],
  );

  const movementTypes = useMemo(
    () => Array.from(new Set(movements.map((row) => row.movementType))).sort(),
    [movements],
  );

  const visibleMovements = useMemo(
    () =>
      movements.filter((row) => {
        const ageLimit = getActivityAgeLimit(filters.activityPeriod, activityNow);
        return (
          (filters.activityType === "ALL" ||
            row.movementType === filters.activityType) &&
          (filters.activityProject === "ALL" ||
            row.projectId === filters.activityProject) &&
          (filters.activityLocation === "ALL" ||
            row.locationId === filters.activityLocation) &&
          (ageLimit === null || new Date(row.createdAt).getTime() >= ageLimit)
        );
      }),
    [
      activityNow,
      filters.activityLocation,
      filters.activityPeriod,
      filters.activityProject,
      filters.activityType,
      movements,
    ],
  );

  const locationOptions = useMemo(
    () => locations.map((row) => ({ value: row.id, label: row.name })),
    [locations],
  );

  const activityProjectOptions = useMemo(
    () => [
      { value: "ALL", label: "Semua project" },
      ...data.projects.map((row) => ({ value: row.id, label: row.name })),
    ],
    [data.projects],
  );

  const activityLocationOptions = useMemo(
    () => [{ value: "ALL", label: "Semua lokasi" }, ...locationOptions],
    [locationOptions],
  );

  const visibleReceipts = useMemo(
    () =>
      data.receipts.filter((row) => {
        const ageLimit = getActivityAgeLimit(filters.activityPeriod, activityNow);
        return (
          (filters.activityType === "ALL" ||
            filters.activityType === "GOODS_RECEIPT") &&
          (filters.activityProject === "ALL" ||
            row.projectId === filters.activityProject) &&
          (filters.activityLocation === "ALL" ||
            row.locationId === filters.activityLocation) &&
          (ageLimit === null || new Date(row.receivedAt).getTime() >= ageLimit)
        );
      }),
    [
      activityNow,
      data.receipts,
      filters.activityLocation,
      filters.activityPeriod,
      filters.activityProject,
      filters.activityType,
    ],
  );

  const selectedProject = data.projects.find((row) => row.id === projectId);
  const selectedRap = selectedProject?.rapItems.find((row) => row.id === rapItemId);
  const selectedMaterial = selectedRap?.materialId
    ? data.inventory.filter((row) => row.materialId === selectedRap.materialId)
    : [];

  const totalStockValue = useMemo(
    () => data.inventory.reduce((sum, row) => sum + row.currentStock * row.averageCost, 0),
    [data.inventory],
  );
  const availableValue = useMemo(
    () =>
      data.inventory.reduce(
        (sum, row) => sum + Math.max(0, row.availableStock) * row.averageCost,
        0,
      ),
    [data.inventory],
  );
  const lowCount = useMemo(
    () => data.inventory.filter((row) => row.status !== "AVAILABLE").length,
    [data.inventory],
  );
  const pendingApprovals = useMemo(
    () =>
      data.counts.filter((row) => row.status === "PENDING_APPROVAL").length +
      data.receipts.filter((row) => row.status === "REVERSAL_REQUESTED").length,
    [data.counts, data.receipts],
  );

  return {
    locations,
    materials,
    grouped,
    visibleMaterials,
    movementTypes,
    visibleMovements,
    locationOptions,
    activityProjectOptions,
    activityLocationOptions,
    visibleReceipts,
    selectedProject,
    selectedRap,
    selectedMaterial,
    totalStockValue,
    availableValue,
    lowCount,
    pendingApprovals,
  };
}

function getActivityAgeLimit(period: string, now: number): number | null {
  return period === "ALL" ? null : now - Number(period) * 86_400_000;
}
