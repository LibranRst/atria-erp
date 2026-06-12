"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { signImagekit } from "@/app/actions/media/sign-imagekit";
import { processReceipt } from "@/app/actions/ai/process-receipt";
import { submitFieldRequest } from "@/app/actions/finance/field-requests";

interface ProjectBudgetItem {
  id: string;
  name: string;
  allocatedAmount: string;
  actualSpent: string;
}

interface Project {
  id: string;
  name: string;
  budget?: {
    id: string;
    status: string;
    items?: ProjectBudgetItem[];
  } | null;
}

interface ExpenseFormProps {
  projects: Project[];
}

export function ExpenseForm({ projects }: ExpenseFormProps): React.JSX.Element {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedBudgetItemId, setSelectedBudgetItemId] = useState<string>("");
  const [amount, setAmount] = useState<number | "">("");
  const [description, setDescription] = useState<string>("");
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null);

  // Status flags
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isProcessingOCR, setIsProcessingOCR] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  // Dapatkan daftar item anggaran berdasarkan proyek terpilih yang anggarannya sudah disetujui (APPROVED)
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const budgetItems = selectedProject?.budget?.status === "APPROVED"
    ? selectedProject?.budget?.items || []
    : [];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(false);
    setIsUploading(true);

    try {
      // 1. Dapatkan tanda tangan otentikasi dari server
      const signRes = await signImagekit();
      if (!signRes.success) {
        throw new Error(signRes.error.message || "Gagal melakukan otentikasi unggah berkas.");
      }

      const { token, expire, signature } = signRes.data;

      // 2. Unggah langsung ke REST API ImageKit
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileName", `receipt-${Date.now()}-${file.name.replaceAll(" ", "_")}`);
      formData.append("publicKey", process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "public_PRvr9hXwFetaQx4ZejdGwJ1Ue8=");
      formData.append("signature", signature);
      formData.append("token", token);
      formData.append("expire", expire.toString());
      formData.append("folder", "/field-receipts");

      const uploadRes = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json();
        throw new Error(errData.message || "Gagal mengunggah gambar ke storage CDN.");
      }

      const uploadData = await uploadRes.json();
      const imageUrl = uploadData.url;
      setReceiptImageUrl(imageUrl);
      setIsUploading(false);

      // 3. Jalankan asinkron Gemini OCR untuk ekstraksi teks nota
      setIsProcessingOCR(true);
      const ocrRes = await processReceipt(imageUrl);
      setIsProcessingOCR(false);

      if (!ocrRes.success) {
        setError("AI OCR gagal memproses gambar nota. Silakan isi parameter formulir secara manual.");
        return;
      }

      // 4. Isi otomatis formulir dari hasil AI OCR
      const parsedData = ocrRes.data;
      setAmount(parsedData.totalAmount);

      const itemsText = parsedData.items
        ?.map((it) => `${it.itemName} (${it.quantity}x @Rp ${Number(it.unitPrice).toLocaleString("id-ID")})`)
        .join(", ");
      
      const generatedDesc = `[OCR] Pembelian di ${parsedData.vendorName}. Rincian: ${itemsText || ""}`.substring(0, 500);
      setDescription(generatedDesc);

    } catch (err: any) {
      console.error("ImageKit/Gemini OCR Upload Error:", err);
      setError(err.message || "Terjadi kesalahan saat mengunggah atau memproses berkas nota.");
      setIsUploading(false);
      setIsProcessingOCR(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !selectedBudgetItemId || amount === "" || !description) {
      setError("Semua field wajib diisi lengkap.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await submitFieldRequest({
        projectId: selectedProjectId,
        projectBudgetItemId: selectedBudgetItemId,
        amount: Number(amount),
        description,
        receiptImageUrl: receiptImageUrl || "",
      });

      if (!res.success) {
        throw new Error(res.error.message || "Gagal mengirim pengajuan biaya lapangan.");
      }

      setSuccess(true);
      // Reset form
      setSelectedProjectId("");
      setSelectedBudgetItemId("");
      setAmount("");
      setDescription("");
      setReceiptImageUrl(null);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan internal sistem.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="premium-card p-md border border-outline-variant/30 space-y-md mx-auto w-full max-w-lg select-none">
      {/* Title Header */}
      <div className="pb-sm border-b border-outline-variant/10 space-y-xs">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-md text-on-surface">Pengeluaran Lapangan</h2>
          <Badge status={success ? "PAID" : isSubmitting ? "PENDING" : "DRAFT"}>
            {success ? "SUKSES" : isSubmitting ? "KIRIM..." : "FORM PM"}
          </Badge>
        </div>
        <p className="font-body-sm text-on-surface-variant leading-relaxed">
          Catat biaya pengeluaran konstruksi lapangan atau klaim reimbursement secara instan menggunakan AI OCR.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-md">
        {/* Notifikasi Status */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-error/30 bg-error-container/20 p-3.5 text-xs text-error font-medium">
            <span className="material-symbols-outlined text-error text-[18px]">error</span>
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-surface-container-low p-3.5 text-xs text-primary font-medium">
            <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
            <div className="leading-relaxed">Pengajuan biaya lapangan berhasil disimpan dan dikirim untuk verifikasi Finance Admin.</div>
          </div>
        )}

        {/* Area Kamera & Unggah Nota (OCR) */}
        <div className="space-y-xs">
          <label className="font-label-caps text-[10px] text-on-surface-variant">
            Bukti Nota Belanja / Kwitansi
          </label>
          <div className="flex flex-col gap-sm">
            {receiptImageUrl ? (
              <div className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={receiptImageUrl}
                  alt="Receipt Preview"
                  className="h-44 w-full rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => setReceiptImageUrl(null)}
                  className="absolute top-4 right-4 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white border border-white/20 backdrop-blur-md active:bg-black/90 cursor-pointer"
                >
                  Hapus
                </button>
              </div>
            ) : (
              <div className="flex gap-md">
                {/* Kamera Trigger */}
                <label className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low py-7 text-center transition active:bg-surface-container min-h-[96px]">
                  <span className="material-symbols-outlined text-secondary text-[24px]">photo_camera</span>
                  <span className="text-xs font-semibold text-on-surface-variant">Ambil Foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileUpload}
                    disabled={isUploading || isProcessingOCR || isSubmitting}
                    className="hidden"
                  />
                </label>

                {/* Upload Folder Trigger */}
                <label className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low py-7 text-center transition active:bg-surface-container min-h-[96px]">
                  <span className="material-symbols-outlined text-secondary text-[24px]">upload</span>
                  <span className="text-xs font-semibold text-on-surface-variant">Pilih Gambar</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={isUploading || isProcessingOCR || isSubmitting}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {/* Status Indicator Unggahan & OCR */}
            {(isUploading || isProcessingOCR) && (
              <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-surface-container-low p-3 text-xs font-medium text-on-surface animate-pulse">
                <svg className="animate-spin h-4 w-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <div className="flex items-center gap-1">
                  {isUploading ? (
                    "Mengunggah gambar nota ke CDN..."
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-primary text-[14px]">auto_awesome</span>
                      Gemini AI sedang membaca rincian nota belanja...
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pilih Proyek */}
        <div className="space-y-base">
          <label htmlFor="project-select" className="font-label-caps text-[10px] text-on-surface-variant">
            Proyek Konstruksi
          </label>
          <select
            id="project-select"
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setSelectedBudgetItemId(""); // reset budget item
            }}
            disabled={isUploading || isProcessingOCR || isSubmitting}
            className="h-11 w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 text-sm text-on-surface outline-none focus:border-primary disabled:opacity-50"
          >
            <option value="">-- Pilih Proyek Aktif --</option>
            {projects.map((proj) => (
              <option key={proj.id} value={proj.id}>
                {proj.name}
              </option>
            ))}
          </select>
        </div>

        {/* Pilih Item BoQ Anggaran */}
        <div className="space-y-base">
          <label htmlFor="budget-item-select" className="font-label-caps text-[10px] text-on-surface-variant">
            Kategori Anggaran RAB (BoQ)
          </label>
          <select
            id="budget-item-select"
            value={selectedBudgetItemId}
            onChange={(e) => setSelectedBudgetItemId(e.target.value)}
            disabled={!selectedProjectId || isUploading || isProcessingOCR || isSubmitting}
            className="h-11 w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 text-sm text-on-surface outline-none focus:border-primary disabled:opacity-50"
          >
            <option value="">-- Pilih Item BoQ Anggaran --</option>
            {budgetItems.map((item) => {
              const allocated = Number(item.allocatedAmount);
              const spent = Number(item.actualSpent);
              const remaining = allocated - spent;
              return (
                <option key={item.id} value={item.id}>
                  {item.name} (Sisa Plafon: Rp {remaining.toLocaleString("id-ID")})
                </option>
              );
            })}
          </select>
        </div>

        {/* Input Nominal Pengeluaran */}
        <div className="space-y-base">
          <label htmlFor="amount-input" className="font-label-caps text-[10px] text-on-surface-variant">
            Nominal Pengeluaran (Rupiah)
          </label>
          {isProcessingOCR ? (
            <div className="h-11 w-full animate-pulse rounded-xl bg-surface-container-low border border-outline-variant" />
          ) : (
            <input
              id="amount-input"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value !== "" ? Number(e.target.value) : "")}
              disabled={isUploading || isSubmitting}
              placeholder="Contoh: 150000"
              className="h-11 w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 text-sm text-on-surface outline-none focus:border-primary disabled:opacity-50"
            />
          )}
        </div>

        {/* Input Deskripsi/Keterangan */}
        <div className="space-y-base">
          <label htmlFor="desc-input" className="font-label-caps text-[10px] text-on-surface-variant">
            Keterangan Pengeluaran
          </label>
          {isProcessingOCR ? (
            <div className="h-24 w-full animate-pulse rounded-xl bg-surface-container-low border border-outline-variant" />
          ) : (
            <textarea
              id="desc-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isUploading || isSubmitting}
              rows={3}
              placeholder="Sebutkan rincian barang belanja beserta toko pembelian..."
              className="w-full rounded-xl border border-outline-variant bg-surface-container-low p-3 text-sm text-on-surface outline-none focus:border-primary disabled:opacity-50"
            />
          )}
        </div>

        {/* Tombol Simpan Form */}
        <button
          type="submit"
          disabled={isUploading || isProcessingOCR || isSubmitting || !selectedProjectId || !selectedBudgetItemId || amount === "" || !description}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 cursor-pointer"
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Menyimpan Pengajuan...</span>
            </div>
          ) : (
            "Simpan & Ajukan Pengeluaran"
          )}
        </button>
      </form>
    </div>
  );
}
