"use client";

import React from "react";
import { toast } from "sonner";
import {
  createMaterialCategorySetting,
  createMaterialWithInventoryDefaults,
  setMaterialActive,
  updateMaterial,
  updateMaterialSettingDefaults,
  type MaterialSettingRow,
} from "@/app/actions/settings/system";
import type { InventoryDraft, MaterialDraft, SettingsOption } from "../types/material-types";

type StateSetter<T> = React.Dispatch<React.SetStateAction<T>>;

type MaterialSettingsMutationArgs = {
  readonly draft: MaterialDraft | null;
  readonly inventoryEdit: InventoryDraft | null;
  readonly confirmMaterial: MaterialSettingRow | null;
  readonly categoryName: string;
  readonly canSaveMaterial: boolean;
  readonly onMutationComplete?: () => void;
  readonly setMaterials: StateSetter<readonly MaterialSettingRow[]>;
  readonly setCategories: StateSetter<readonly SettingsOption[]>;
  readonly setDraft: StateSetter<MaterialDraft | null>;
  readonly setInventoryEdit: StateSetter<InventoryDraft | null>;
  readonly setInventoryOriginal: StateSetter<InventoryDraft | null>;
  readonly setDraftBaseline: StateSetter<string>;
  readonly setInventoryBaseline: StateSetter<string>;
  readonly setConfirmMaterial: StateSetter<MaterialSettingRow | null>;
  readonly setSelectedMaterial: StateSetter<MaterialSettingRow | null>;
  readonly setShowCategoryComposer: StateSetter<boolean>;
  readonly setCategoryName: StateSetter<string>;
  readonly setMessage: StateSetter<string | null>;
};

type MaterialSettingsMutations = {
  readonly pending: boolean;
  readonly saveMaterial: () => void;
  readonly confirmToggle: () => void;
  readonly saveInventory: () => void;
  readonly addCategory: () => void;
};

export function useMaterialSettingsMutations({
  draft,
  inventoryEdit,
  confirmMaterial,
  categoryName,
  canSaveMaterial,
  onMutationComplete,
  setMaterials,
  setCategories,
  setDraft,
  setInventoryEdit,
  setInventoryOriginal,
  setDraftBaseline,
  setInventoryBaseline,
  setConfirmMaterial,
  setSelectedMaterial,
  setShowCategoryComposer,
  setCategoryName,
  setMessage,
}: MaterialSettingsMutationArgs): MaterialSettingsMutations {
  const [pending, startTransition] = React.useTransition();
  const saveMaterial = (): void => {
    if (!draft || !canSaveMaterial) return;
    startTransition(async () => {
      const result = draft.id
        ? await updateMaterial({
            materialId: draft.id,
            categoryId: draft.categoryId,
            defaultVendorId: draft.defaultVendorId,
            name: draft.name,
            specification: draft.specification,
            brand: draft.brand,
            code: draft.code,
            color: draft.color,
            unit: draft.unit,
            isActive: draft.isActive,
          })
        : await createMaterialWithInventoryDefaults({
            categoryId: draft.categoryId,
            defaultVendorId: draft.defaultVendorId,
            name: draft.name,
            specification: draft.specification,
            brand: draft.brand,
            code: draft.code,
            color: draft.color,
            unit: draft.unit,
            inventoryDefaults: [
              {
                inventoryLocationId: draft.locationId,
                minimumStock: draft.minimumStock,
                lastPurchasePrice: draft.lastPurchasePrice,
              },
            ],
          });
      if (!result.success) {
        setMessage(result.error.message);
        toast.error(result.error.message);
        return;
      }
      if (draft.id) {
        setMaterials((current) =>
          current.map((row) =>
            row.id === draft.id
              ? {
                  ...row,
                  categoryId: draft.categoryId,
                  defaultVendorId: draft.defaultVendorId,
                  name: draft.name,
                  specification: draft.specification,
                  brand: draft.brand,
                  code: draft.code,
                  color: draft.color,
                  unit: draft.unit,
                  isActive: draft.isActive,
                }
              : row,
          ),
        );
      }
      setDraft(null);
      setDraftBaseline("");
      const message = draft.id
        ? "Material berhasil diperbarui."
        : "Material baru berhasil ditambahkan.";
      setMessage(message);
      toast.success(message);
      onMutationComplete?.();
    });
  };
  const confirmToggle = (): void => {
    if (!confirmMaterial) return;
    const target = confirmMaterial;
    startTransition(async () => {
      const result = await setMaterialActive({ materialId: target.id, isActive: !target.isActive });
      if (!result.success) {
        setMessage(result.error.message);
        toast.error(result.error.message);
        return;
      }
      setMaterials((current) =>
        current.map((row) =>
          row.id === target.id ? { ...row, isActive: result.data.isActive } : row,
        ),
      );
      setSelectedMaterial(null);
      setConfirmMaterial(null);
      toast.success("Material berhasil diperbarui.");
      onMutationComplete?.();
    });
  };
  const saveInventory = (): void => {
    if (!inventoryEdit) return;
    startTransition(async () => {
      const result = await updateMaterialSettingDefaults({
        materialInventoryId: inventoryEdit.id,
        minimumStock: inventoryEdit.minimumStock,
        lastPurchasePrice: inventoryEdit.lastPurchasePrice,
      });
      if (!result.success) {
        setMessage(result.error.message);
        toast.error(result.error.message);
        return;
      }
      setMaterials((current) =>
        current.map((material) =>
          material.id === inventoryEdit.materialId
            ? {
                ...material,
                inventory: material.inventory.map((row) =>
                  row.id === result.data.id ? result.data : row,
                ),
              }
            : material,
        ),
      );
      setInventoryEdit(null);
      setInventoryOriginal(null);
      setInventoryBaseline("");
      setMessage("Default inventory diperbarui.");
      toast.success("Default inventory diperbarui.");
      onMutationComplete?.();
    });
  };
  const addCategory = (): void => {
    const name = categoryName.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await createMaterialCategorySetting({ name, description: null });
      if (!result.success) {
        setMessage(result.error.message);
        toast.error(result.error.message);
        return;
      }
      setCategories((current) =>
        [...current, result.data].sort((a, b) => a.name.localeCompare(b.name)),
      );
      if (draft) setDraft({ ...draft, categoryId: result.data.id });
      setCategoryName("");
      setShowCategoryComposer(false);
      toast.success("Kategori baru berhasil ditambahkan.");
      onMutationComplete?.();
    });
  };
  return { pending, saveMaterial, confirmToggle, saveInventory, addCategory };
}
