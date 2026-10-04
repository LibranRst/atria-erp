"use client";

import { useCan } from "@/components/auth/permissions-provider";
import React, { useState, useTransition } from "react";
import { useRouter } from "@/lib/navigation/workspace-navigation";

import { getErrorMessage } from "@atria/core/utils/error-message";
import { toast } from "sonner";
import { ConfirmationDialog } from "@/components/ui";
import {
  createProjectBudget,
  createBudgetItem,
  submitBudgetForApproval,
  approveBudget,
  rejectBudget,
} from "@/app/actions/project/budget";
import { BudgetAlerts } from "./budget-alerts";
import { BudgetApprovalPanel, BudgetDraftActions } from "./budget-approval-panel";
import { BudgetEmptyState } from "./budget-empty-state";
import { BudgetItemForm } from "./budget-item-form";
import { BudgetItemsList } from "./budget-items-list";
import type {
  BudgetHeader,
  BudgetItemFormState,
  CostCategory,
} from "../../types/budget-manager-types";
import {
  getBudgetItemFormValidationMessage,
  groupBudgetItemsByCategory,
  isBudgetEditable,
  isBudgetItemFormValid,
} from "../../utils/budget-manager-utils";

interface BudgetManagerProps {
  projectId: string;
  budget: BudgetHeader | null;
  costCategories: CostCategory[];
  userRole: string;
  userId: string;
}

export function BudgetManager({
  projectId,
  budget,
  costCategories,
}: BudgetManagerProps): React.JSX.Element {
  const can = useCan();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // State Form Tambah Item
  const [itemName, setItemName] = useState<string>("");
  const [budgetCategory, setBudgetCategory] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [unit, setUnit] = useState<string>("m2");
  const [unitPrice, setUnitPrice] = useState<number | "">("");
  const [showItemForm, setShowItemForm] = useState(false);
  const [confirmItemClose, setConfirmItemClose] = useState(false);

  // State Keputusan Owner
  const [showRejectForm, setShowRejectForm] = useState<boolean>(false);
  const [rejectionNotes, setRejectionNotes] = useState<string>("");

  // State Status Eror & Sukses
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Otorisasi sederhana
  /*
   * `update:budget` juga dipegang Finance Admin, sementara versi berbasis nama
   * peran menyembunyikan kontrol ini darinya — padahal server
   * (`workflow-governance.ts`) sejak dulu mengizinkannya. Yang berubah di sini
   * adalah UI menyusul aturan servernya, bukan aturannya yang dilonggarkan.
   */
  const canManage = can("update:budget");
  const canApprove = can("approve:budget");

  const budgetItems = budget?.items || [];
  const budgetItemForm: BudgetItemFormState = {
    itemName,
    budgetCategory,
    selectedCategoryId,
    quantity,
    unit,
    unitPrice,
  };
  const itemsByCategory = groupBudgetItemsByCategory(budgetItems);
  const itemFormDirty = Boolean(
    itemName.trim() ||
    budgetCategory.trim() ||
    selectedCategoryId ||
    quantity !== "" ||
    unitPrice !== "",
  );

  // Action: Buat RAB Baru
  const handleCreateBudget = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await createProjectBudget(projectId);
        if (!res.success) {
          const errMsg = res.error.message || "Gagal membuat draf rencana anggaran.";
          setError(errMsg);
          toast.error(errMsg);
          return;
        }
        const successMsg = "Draft Project Budget berhasil dibuat.";
        setSuccess(successMsg);
        toast.success(successMsg);
        router.refresh();
      } catch (err: unknown) {
        const errMsg = getErrorMessage(err, "Terjadi kesalahan internal.");
        setError(errMsg);
        toast.error(errMsg);
      }
    });
  };

  // Action: Tambah Item Budget
  const handleAddBudgetItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!budget) return;
    if (!isBudgetItemFormValid(budgetItemForm)) {
      const message = getBudgetItemFormValidationMessage();
      setError(message);
      toast.error(message);
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const res = await createBudgetItem({
          projectBudgetId: budget.id,
          costCategoryId: selectedCategoryId,
          name: itemName,
          budgetCategory,
          quantity: Number(quantity),
          unit,
          unitPrice: Number(unitPrice),
        });

        if (!res.success) {
          const errMsg = res.error.message || "Gagal menambahkan item anggaran.";
          setError(errMsg);
          toast.error(errMsg);
          return;
        }

        const successMsg = `Item "${itemName}" ditambahkan ke Project Budget.`;
        setSuccess(successMsg);
        toast.success(successMsg);
        setItemName("");
        setBudgetCategory("");
        setQuantity("");
        setUnit("m2");
        setUnitPrice("");
        setShowItemForm(false);
        router.refresh();
      } catch (err: unknown) {
        const errMsg = getErrorMessage(err, "Terjadi kesalahan internal.");
        setError(errMsg);
        toast.error(errMsg);
      }
    });
  };

  // Action: Ajukan ke Owner
  const handleSubmitBudget = () => {
    if (!budget) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await submitBudgetForApproval(budget.id);
        if (!res.success) {
          const errMsg = res.error.message || "Gagal mengajukan Project Budget.";
          setError(errMsg);
          toast.error(errMsg);
          return;
        }
        const successMsg = "Project Budget diajukan untuk persetujuan Owner.";
        setSuccess(successMsg);
        toast.success(successMsg);
        router.refresh();
      } catch (err: unknown) {
        const errMsg = getErrorMessage(err, "Terjadi kesalahan internal.");
        setError(errMsg);
        toast.error(errMsg);
      }
    });
  };

  // Action: Approve RAB (Owner)
  const handleApproveBudget = () => {
    if (!budget) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await approveBudget(budget.id);
        if (!res.success) {
          const errMsg = res.error.message || "Gagal menyetujui anggaran.";
          setError(errMsg);
          toast.error(errMsg);
          return;
        }
        const successMsg = "Project Budget berhasil disetujui.";
        setSuccess(successMsg);
        toast.success(successMsg);
        router.refresh();
      } catch (err: unknown) {
        const errMsg = getErrorMessage(err, "Terjadi kesalahan internal.");
        setError(errMsg);
        toast.error(errMsg);
      }
    });
  };

  // Action: Reject RAB (Owner)
  const handleRejectBudgetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!budget) return;
    if (!rejectionNotes.trim()) {
      const message = "Silakan isi alasan revisi/penolakan.";
      setError(message);
      toast.error(message);
      return;
    }

    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await rejectBudget(budget.id, rejectionNotes);
        if (!res.success) {
          const errMsg = res.error.message || "Gagal menolak anggaran.";
          setError(errMsg);
          toast.error(errMsg);
          return;
        }
        const successMsg = "Anggaran berhasil ditolak dan dikembalikan ke Draf.";
        setSuccess(successMsg);
        toast.success(successMsg);
        setShowRejectForm(false);
        setRejectionNotes("");
        router.refresh();
      } catch (err: unknown) {
        const errMsg = getErrorMessage(err, "Terjadi kesalahan internal.");
        setError(errMsg);
        toast.error(errMsg);
      }
    });
  };

  // RENDER 1: Belum Ada Budget
  if (!budget) {
    return (
      <BudgetEmptyState
        canManage={canManage}
        isPending={isPending}
        error={error}
        onCreateBudget={handleCreateBudget}
      />
    );
  }

  const isEditable = isBudgetEditable(budget.status);

  return (
    <div className="space-y-md">
      <BudgetAlerts
        error={error}
        success={success}
        rejectedNotes={budget.status === "REJECTED" ? budget.notes : null}
      />

      <BudgetItemsList
        status={budget.status}
        budgetItems={budgetItems}
        itemsByCategory={itemsByCategory}
      />

      {/* PANEL AKSI DRAFT & REJECTED: PM / OWNER BISA TAMBAH ITEM & AJUKAN */}
      {isEditable && canManage && (
        <div className="space-y-md border-t border-outline-variant/10 pt-md">
          <BudgetItemForm
            open={showItemForm}
            form={budgetItemForm}
            setters={{
              setItemName,
              setBudgetCategory,
              setSelectedCategoryId,
              setQuantity,
              setUnit,
              setUnitPrice,
            }}
            costCategories={costCategories}
            isPending={isPending}
            onSubmit={handleAddBudgetItem}
            onClose={() => {
              if (itemFormDirty) setConfirmItemClose(true);
              else setShowItemForm(false);
            }}
          />

          <button
            type="button"
            disabled={isPending}
            onClick={() => setShowItemForm(true)}
            className="min-h-12 w-full rounded-full bg-surface-container-low px-5 text-xs font-bold text-primary ring-1 ring-primary/15 disabled:opacity-40"
          >
            Tambah Item Project Budget
          </button>

          <BudgetDraftActions
            hasItems={budgetItems.length > 0}
            isPending={isPending}
            onSubmitBudget={handleSubmitBudget}
          />
        </div>
      )}

      {budget.status === "PENDING_APPROVAL" && canApprove && (
        <BudgetApprovalPanel
          showRejectForm={showRejectForm}
          setShowRejectForm={setShowRejectForm}
          rejectionNotes={rejectionNotes}
          setRejectionNotes={setRejectionNotes}
          isPending={isPending}
          onApproveBudget={handleApproveBudget}
          onRejectBudgetSubmit={handleRejectBudgetSubmit}
        />
      )}
      <ConfirmationDialog
        open={confirmItemClose}
        title="Buang item yang belum ditambahkan?"
        description="Isian item Project Budget ini akan dikosongkan. Item yang sudah tersimpan tidak berubah."
        confirmLabel="Buang Isian"
        danger
        onClose={() => setConfirmItemClose(false)}
        onConfirm={() => {
          setItemName("");
          setBudgetCategory("");
          setSelectedCategoryId("");
          setQuantity("");
          setUnit("m2");
          setUnitPrice("");
          setConfirmItemClose(false);
          setShowItemForm(false);
        }}
      />
    </div>
  );
}
