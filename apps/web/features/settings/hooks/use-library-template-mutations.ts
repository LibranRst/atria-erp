"use client";

import React from "react";
import { toast } from "sonner";
import { setItemPriceLibraryItemActive } from "@/app/actions/settings/system";
import {
  upsertPricingTemplate,
  type PricingTemplateRow,
} from "@/app/actions/settings/pricing-library";
import type { Draft } from "../types/library-types";

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;
type Args = {
  readonly draft: Draft | null;
  readonly confirmItem: PricingTemplateRow | null;
  readonly canSave: boolean;
  readonly onMutationComplete?: () => void;
  readonly setItems: Setter<readonly PricingTemplateRow[]>;
  readonly setDraft: Setter<Draft | null>;
  readonly setBaseline: Setter<string>;
  readonly setConfirmItem: Setter<PricingTemplateRow | null>;
  readonly setMessage: Setter<string | null>;
};
type Result = {
  readonly pending: boolean;
  readonly save: () => void;
  readonly confirmToggle: () => void;
};

export function useLibraryTemplateMutations({
  draft,
  confirmItem,
  canSave,
  onMutationComplete,
  setItems,
  setDraft,
  setBaseline,
  setConfirmItem,
  setMessage,
}: Args): Result {
  const [pending, startTransition] = React.useTransition();
  const save = (): void => {
    if (!draft || !canSave) return;
    startTransition(async () => {
      const result = await upsertPricingTemplate({
        itemPriceLibraryId: draft.id,
        expenseCategoryId: draft.expenseCategoryId,
        materialId: draft.materialId,
        defaultVendorId: draft.defaultVendorId,
        code: draft.code || null,
        itemType: draft.itemType,
        itemCategory: draft.itemCategory,
        name: draft.name,
        description: draft.description || null,
        unit: draft.unit,
        pricingMode: draft.pricingMode,
        targetGrossPercentage: draft.targetGrossPercentage,
        fixedClientPrice:
          draft.pricingMode === "FIXED_CLIENT_PRICE" ? draft.fixedClientPrice : undefined,
        priceSourceType: draft.priceSourceType,
        sourceNote: draft.sourceNote,
        effectiveFrom: new Date(draft.effectiveFrom),
        isActive: draft.isActive,
        components: draft.components.map((component, index) => ({
          vendorId: component.vendorId,
          componentType: component.componentType,
          label: component.label,
          quantity: component.quantity,
          unit: component.unit,
          unitCost: component.unitCost,
          note: component.note || null,
          displayOrder: index,
        })),
      });
      if (!result.success) {
        setMessage(result.error.message);
        toast.error(result.error.message);
        return;
      }
      setItems((current) =>
        draft.id
          ? current.map((item) => (item.id === result.data.id ? result.data : item))
          : [result.data, ...current],
      );
      setDraft(null);
      setBaseline("");
      setMessage("Template dan breakdown harga berhasil disimpan.");
      toast.success("Template dan breakdown harga berhasil disimpan.");
      onMutationComplete?.();
    });
  };
  const confirmToggle = (): void => {
    if (!confirmItem) return;
    const target = confirmItem;
    startTransition(async () => {
      const result = await setItemPriceLibraryItemActive({
        itemPriceLibraryId: target.id,
        isActive: !target.isActive,
      });
      if (!result.success) {
        setMessage(result.error.message);
        toast.error(result.error.message);
        return;
      }
      setItems((current) =>
        current.map((item) =>
          item.id === target.id ? { ...item, isActive: result.data.isActive } : item,
        ),
      );
      if (draft?.id === target.id) {
        setDraft(null);
        setBaseline("");
      }
      setConfirmItem(null);
      toast.success("Item berhasil diperbarui.");
      onMutationComplete?.();
    });
  };
  return { pending, save, confirmToggle };
}
