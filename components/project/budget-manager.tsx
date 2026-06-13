"use client";

import React, { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/utils/error-message";
import {
  createProjectBudget,
  createBudgetItem,
  submitBudgetForApproval,
  approveBudget,
  rejectBudget,
} from "@/app/actions/project/budget";

interface BudgetItem {
  id: string;
  name: string;
  budgetCategory: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  allocatedAmount: string;
  actualSpent: string;
  costCategoryId: string;
  costCategory?: {
    id: string;
    name: string;
    description: string | null;
  } | null;
}

interface BudgetHeader {
  id: string;
  projectId: string;
  status: string; // DRAFT, PENDING_APPROVAL, APPROVED, REJECTED
  notes: string | null;
  items?: BudgetItem[];
}

interface CostCategory {
  id: string;
  name: string;
  description: string | null;
}

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
  userRole,
  userId,
}: BudgetManagerProps): React.JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // State Form Tambah Item
  const [itemName, setItemName] = useState<string>("");
  const [budgetCategory, setBudgetCategory] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [unit, setUnit] = useState<string>("m2");
  const [unitPrice, setUnitPrice] = useState<number | "">("");

  // State Keputusan Owner
  const [showRejectForm, setShowRejectForm] = useState<boolean>(false);
  const [rejectionNotes, setRejectionNotes] = useState<string>("");

  // State Status Eror & Sukses
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Otorisasi sederhana
  const canManage = userRole === "OWNER" || userRole === "PROJECT_MANAGER";
  const canApprove = userRole === "OWNER" || userRole === "FINANCE_ADMIN";

  const budgetItems = budget?.items || [];

  // Pengelompokan item anggaran per kategori anggaran (budgetCategory)
  const itemsByCategory: Record<string, BudgetItem[]> = {};
  budgetItems.forEach((item) => {
    const catName = item.budgetCategory || "Umum";
    if (!itemsByCategory[catName]) {
      itemsByCategory[catName] = [];
    }
    itemsByCategory[catName].push(item);
  });

  // Action: Buat RAB Baru
  const handleCreateBudget = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await createProjectBudget(projectId);
        if (!res.success) {
          setError(res.error.message || "Gagal membuat draf rencana anggaran.");
          return;
        }
        setSuccess("Draf Rencana Anggaran (RAB) berhasil dibuat.");
        router.refresh();
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Terjadi kesalahan internal."));
      }
    });
  };

  // Action: Tambah Item Budget
  const handleAddBudgetItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!budget) return;
    if (
      !itemName.trim() ||
      !budgetCategory.trim() ||
      !selectedCategoryId ||
      quantity === "" ||
      Number(quantity) <= 0 ||
      !unit.trim() ||
      unitPrice === "" ||
      Number(unitPrice) < 0
    ) {
      setError("Silakan isi nama item, kategori anggaran, kelompok biaya, kuantitas, satuan, dan harga satuan yang valid.");
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
          setError(res.error.message || "Gagal menambahkan item anggaran.");
          return;
        }

        setSuccess(`Berhasil menambahkan item "${itemName}"`);
        setItemName("");
        setBudgetCategory("");
        setQuantity("");
        setUnit("m2");
        setUnitPrice("");
        router.refresh();
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Terjadi kesalahan internal."));
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
          setError(res.error.message || "Gagal mengajukan persetujuan RAB.");
          return;
        }
        setSuccess("Rencana Anggaran (RAB) berhasil diajukan untuk disetujui Owner.");
        router.refresh();
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Terjadi kesalahan internal."));
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
          setError(res.error.message || "Gagal menyetujui anggaran.");
          return;
        }
        setSuccess("Rencana Anggaran (RAB) proyek berhasil disetujui!");
        router.refresh();
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Terjadi kesalahan internal."));
      }
    });
  };

  // Action: Reject RAB (Owner)
  const handleRejectBudgetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!budget) return;
    if (!rejectionNotes.trim()) {
      setError("Silakan isi alasan revisi/penolakan.");
      return;
    }

    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await rejectBudget(budget.id, rejectionNotes);
        if (!res.success) {
          setError(res.error.message || "Gagal menolak anggaran.");
          return;
        }
        setSuccess("Anggaran berhasil ditolak dan dikembalikan ke Draf.");
        setShowRejectForm(false);
        setRejectionNotes("");
        router.refresh();
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Terjadi kesalahan internal."));
      }
    });
  };

  // RENDER 1: Belum Ada Budget
  if (!budget) {
    return (
      <div className="premium-card p-md flex flex-col items-center justify-center py-10 text-center border border-outline-variant/30 select-none space-y-md">
        <div className="h-12 w-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
          <span className="material-symbols-outlined text-[28px]">description</span>
        </div>
        <div className="space-y-xs">
          <h3 className="font-title-md text-on-surface">RAB Belum Tersedia</h3>
          <p className="font-body-sm text-on-surface-variant max-w-[280px]">
            Rencana Anggaran Biaya (RAB) proyek belum dibuat untuk proyek ini.
          </p>
        </div>
        {canManage && (
          <button
            onClick={handleCreateBudget}
            disabled={isPending}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-xs font-bold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {isPending ? (
              <span className="animate-pulse">Membuat Draf...</span>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Buat Rencana Anggaran (RAB)</span>
              </>
            )}
          </button>
        )}
        {error && <p className="text-xs text-error font-medium">{error}</p>}
      </div>
    );
  }

  const isEditable = budget.status === "DRAFT" || budget.status === "REJECTED";

  return (
    <div className="space-y-md select-none">
      {/* Alert Error / Success */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-error/30 bg-error-container/20 p-3.5 text-xs text-error font-medium">
          <span className="material-symbols-outlined text-error text-[18px]">error</span>
          <div className="leading-relaxed">{error}</div>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-surface-container-low p-3.5 text-xs text-primary font-medium">
          <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
          <div className="leading-relaxed">{success}</div>
        </div>
      )}

      {/* Tampilan Revisi dari Owner jika Status REJECTED */}
      {budget.status === "REJECTED" && budget.notes && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-600 font-medium">
          <span className="material-symbols-outlined text-amber-600 text-[18px]">info</span>
          <div className="leading-relaxed">
            <strong className="block mb-0.5">Catatan Penolakan Owner:</strong>
            {budget.notes}
          </div>
        </div>
      )}

      {/* Rincian Pos Anggaran */}
      <div className="space-y-md">
        <div className="flex items-center justify-between">
          <h2 className="font-label-caps text-on-surface-variant">Rincian Anggaran (BoQ)</h2>
          <Badge status={budget.status as any}>{budget.status}</Badge>
        </div>

        {budgetItems.length === 0 ? (
          <div className="premium-card p-md flex flex-col items-center justify-center py-8 text-center border border-outline-variant/20 bg-surface/40">
            <span className="material-symbols-outlined text-on-surface-variant text-[24px] mb-1">list</span>
            <p className="font-body-xs text-on-surface-variant">Belum ada item anggaran dalam draf RAB ini.</p>
          </div>
        ) : (
          Object.keys(itemsByCategory).map((catName) => {
            const items = itemsByCategory[catName];
            return (
              <div key={catName} className="space-y-sm">
                <div className="flex items-center">
                  <span className="font-label-caps text-[10px] text-primary bg-surface-container border border-outline-variant/20 px-2.5 py-1 rounded-full">
                    Kategori Anggaran: {catName}
                  </span>
                </div>

                <div className="space-y-sm">
                  {items.map((item) => {
                    const allocated = Number(item.allocatedAmount);
                    const spent = Number(item.actualSpent);
                    const remaining = allocated - spent;
                    const percent = allocated > 0 ? (spent / allocated) * 100 : 0;
                    const isOverrun = spent > allocated;

                    return (
                      <div key={item.id} className="premium-card p-md border border-outline-variant/20 bg-surface/60 hover:bg-surface transition-all space-y-md">
                        <div className="flex flex-col gap-sm">
                          <div className="flex items-start justify-between gap-md">
                            <div className="min-w-0 space-y-base">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-body-sm font-bold text-on-surface truncate max-w-[200px]">{item.name}</h3>
                                {item.costCategory && (
                                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
                                    {item.costCategory.name}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                                {Number(item.quantity).toLocaleString("id-ID")} {item.unit} @ Rp {Number(item.unitPrice).toLocaleString("id-ID")}
                              </p>
                              <p className="font-label-caps text-[9px] text-on-surface-variant font-bold tracking-tight">
                                Total Plafon: Rp {allocated.toLocaleString("id-ID")}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <div className={`font-numeral-md font-bold financial-amount ${isOverrun ? "text-error" : "text-primary"}`}>
                                {isOverrun ? "-" : ""}Rp {Math.abs(remaining).toLocaleString("id-ID")}
                              </div>
                              <span className="font-label-caps text-[8px] text-on-surface-variant block">
                                {isOverrun ? "Overrun" : "Sisa Plafon"}
                              </span>
                            </div>
                          </div>

                          {/* Progress Bar Item Anggaran */}
                          <div className="space-y-xs">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container border border-outline-variant/10">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isOverrun ? "bg-error" : percent >= 90 ? "bg-secondary" : "bg-primary"
                                }`}
                                style={{ width: `${Math.min(percent, 100)}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-on-surface-variant">
                              <span>Realisasi: Rp {spent.toLocaleString("id-ID")}</span>
                              <span>{percent.toFixed(1)}% terpakai</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* PANEL AKSI DRAFT & REJECTED: PM / OWNER BISA TAMBAH ITEM & AJUKAN */}
      {isEditable && canManage && (
        <div className="space-y-md border-t border-outline-variant/10 pt-md">
          {/* Form Tambah Item RAB */}
          <form onSubmit={handleAddBudgetItem} className="premium-card p-md border border-outline-variant/30 space-y-md bg-surface-container-lowest">
            <h3 className="font-title-sm text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[20px]">add_circle</span>
              Tambah Item Anggaran RAB (BoQ)
            </h3>

            <div className="space-y-sm text-xs">
              <div className="grid grid-cols-2 gap-md">
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-caps text-[9px] text-on-surface-variant">Nama Item Anggaran</label>
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="Contoh: Carrara Marble Countertop"
                    disabled={isPending}
                    className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 outline-none focus:border-primary disabled:opacity-50 text-on-surface"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-label-caps text-[9px] text-on-surface-variant">Kategori Anggaran</label>
                  <input
                    type="text"
                    value={budgetCategory}
                    onChange={(e) => setBudgetCategory(e.target.value)}
                    placeholder="Contoh: Pekerjaan Dapur, Pekerjaan Lantai"
                    disabled={isPending}
                    className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 outline-none focus:border-primary disabled:opacity-50 text-on-surface"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-md">
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-caps text-[9px] text-on-surface-variant">Kelompok Biaya (Cost Category)</label>
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    disabled={isPending}
                    className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 outline-none focus:border-primary disabled:opacity-50 text-on-surface"
                  >
                    <option value="">-- Pilih Kelompok Biaya --</option>
                    {costCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-label-caps text-[9px] text-on-surface-variant">Satuan Ukur</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="Contoh: m2, pcs, set"
                    disabled={isPending}
                    className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 outline-none focus:border-primary disabled:opacity-50 text-on-surface"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-md">
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-caps text-[9px] text-on-surface-variant">Kuantitas (Volume)</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value !== "" ? Number(e.target.value) : "")}
                    placeholder="Contoh: 15"
                    disabled={isPending}
                    className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 outline-none focus:border-primary disabled:opacity-50 text-on-surface"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-label-caps text-[9px] text-on-surface-variant">Harga Satuan (Rp)</label>
                  <input
                    type="number"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value !== "" ? Number(e.target.value) : "")}
                    placeholder="Contoh: 10000000"
                    disabled={isPending}
                    className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 outline-none focus:border-primary disabled:opacity-50 text-on-surface"
                  />
                </div>
              </div>

              {quantity !== "" && unitPrice !== "" && (
                <div className="rounded-xl border border-primary/20 bg-surface-container-low p-2.5 text-center text-xs text-primary font-bold">
                  Total Estimasi Plafon: Rp {(Number(quantity) * Number(unitPrice)).toLocaleString("id-ID")}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isPending || !itemName.trim() || !budgetCategory.trim() || !selectedCategoryId || quantity === "" || !unit.trim() || unitPrice === ""}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-primary text-xs font-bold text-white shadow transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 cursor-pointer"
            >
              {isPending ? "Menyimpan..." : "Tambah Item ke RAB"}
            </button>
          </form>

          {/* Tombol Ajukan Persetujuan */}
          {budgetItems.length > 0 && (
            <button
              type="button"
              onClick={handleSubmitBudget}
              disabled={isPending}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-secondary text-xs font-bold text-on-secondary shadow-lg transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">publish</span>
              <span>Ajukan Persetujuan RAB ke Owner</span>
            </button>
          )}
        </div>
      )}

      {/* PANEL AKSI PENDING_APPROVAL: OWNER / FINANCE BISA APPROVE / REJECT */}
      {budget.status === "PENDING_APPROVAL" && canApprove && (
        <div className="space-y-sm border-t border-outline-variant/10 pt-md">
          {showRejectForm ? (
            <form onSubmit={handleRejectBudgetSubmit} className="premium-card p-md border border-error/20 bg-error-container/5 space-y-md">
              <h3 className="font-title-sm text-error flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[20px]">cancel</span>
                Tolak & Minta Revisi RAB
              </h3>

              <div className="flex flex-col gap-1.5 text-xs">
                <label className="font-label-caps text-[9px] text-on-surface-variant">Alasan Revisi / Catatan Penolakan</label>
                <textarea
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                  placeholder="Jelaskan bagian RAB mana yang harus diperbaiki oleh PM..."
                  rows={3}
                  disabled={isPending}
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-low p-3 outline-none focus:border-error disabled:opacity-50 text-on-surface"
                />
              </div>

              <div className="flex gap-md">
                <button
                  type="button"
                  onClick={() => setShowRejectForm(false)}
                  disabled={isPending}
                  className="flex-1 flex h-10 items-center justify-center rounded-xl border border-outline-variant text-xs font-semibold text-on-surface transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending || !rejectionNotes.trim()}
                  className="flex-1 flex h-10 items-center justify-center rounded-xl bg-error text-xs font-bold text-white transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? "Mengirim..." : "Tolak & Minta Revisi"}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex gap-md">
              <button
                type="button"
                onClick={() => setShowRejectForm(true)}
                disabled={isPending}
                className="flex-1 flex h-12 items-center justify-center gap-1.5 rounded-xl border border-error text-xs font-bold text-error transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
                <span>Tolak RAB</span>
              </button>

              <button
                type="button"
                onClick={handleApproveBudget}
                disabled={isPending}
                className="flex-1 flex h-12 items-center justify-center gap-1.5 rounded-xl bg-primary text-xs font-bold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">done</span>
                <span>Setujui & Aktifkan RAB</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
