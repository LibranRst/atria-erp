"use client";

import React, { useState } from "react";
import { Badge, Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui";
import { signImagekit } from "@/app/actions/media/sign-imagekit";
import { processReceipt } from "@/app/actions/ai/process-receipt";
import { submitFieldRequest } from "@/app/actions/finance/field-requests";
import { Camera, Upload, AlertCircle, CheckCircle2, Loader2, Sparkles } from "lucide-react";

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
      formData.append("publicKey", process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "public_PRvr9hXwFetaQx4ZejdGwJ1Ue84=");
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
    <Card className="mx-auto w-full max-w-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Pengeluaran Lapangan</CardTitle>
          <Badge status={success ? "PAID" : isSubmitting ? "PENDING" : "DRAFT"}>
            {success ? "SUKSES" : isSubmitting ? "KIRIM..." : "FORM PM"}
          </Badge>
        </div>
        <CardDescription>
          Catat biaya pengeluaran konstruksi lapangan atau klaim reimbursement secara instan menggunakan AI OCR.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Notifikasi Status */}
          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-critical/30 bg-critical-light/15 p-3.5 text-sm text-critical">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success-light/15 p-3.5 text-sm text-success">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div>Pengajuan biaya lapangan berhasil disimpan dan dikirim untuk verifikasi Finance Admin.</div>
            </div>
          )}

          {/* Area Kamera & Unggah Nota (OCR) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">
              Bukti Nota Belanja / Kwitansi
            </label>
            <div className="flex flex-col gap-3">
              {receiptImageUrl ? (
                <div className="relative overflow-hidden rounded-xl border border-border bg-elevated p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={receiptImageUrl}
                    alt="Receipt Preview"
                    className="h-44 w-full rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setReceiptImageUrl(null)}
                    className="absolute top-4 right-4 rounded-full bg-deep/80 px-3 py-1.5 text-xs font-medium text-text-primary border border-border backdrop-blur-md active:bg-elevated"
                  >
                    Hapus
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  {/* Kamera Trigger */}
                  <label className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface py-7 text-center transition active:bg-elevated min-h-[96px]">
                    <Camera className="h-6 w-6 text-secondary" />
                    <span className="text-xs font-medium text-secondary">Ambil Foto</span>
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
                  <label className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface py-7 text-center transition active:bg-elevated min-h-[96px]">
                    <Upload className="h-6 w-6 text-secondary" />
                    <span className="text-xs font-medium text-secondary">Pilih Gambar</span>
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
                <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary-light/10 p-3 text-xs font-medium text-text-primary animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <div className="flex items-center gap-1">
                    {isUploading ? (
                      "Mengunggah gambar nota ke CDN..."
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5 text-warning" />
                        Gemini AI sedang membaca rincian nota belanja...
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pilih Proyek */}
          <div className="space-y-1.5">
            <label htmlFor="project-select" className="text-xs font-semibold uppercase tracking-wider text-secondary">
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
              className="h-11 w-full rounded-xl border border-border bg-elevated px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
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
          <div className="space-y-1.5">
            <label htmlFor="budget-item-select" className="text-xs font-semibold uppercase tracking-wider text-secondary">
              Kategori Anggaran RAB (BoQ)
            </label>
            <select
              id="budget-item-select"
              value={selectedBudgetItemId}
              onChange={(e) => setSelectedBudgetItemId(e.target.value)}
              disabled={!selectedProjectId || isUploading || isProcessingOCR || isSubmitting}
              className="h-11 w-full rounded-xl border border-border bg-elevated px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
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
          <div className="space-y-1.5">
            <label htmlFor="amount-input" className="text-xs font-semibold uppercase tracking-wider text-secondary">
              Nominal Pengeluaran (Rupiah)
            </label>
            {isProcessingOCR ? (
              <div className="h-11 w-full animate-pulse rounded-xl bg-elevated border border-border" />
            ) : (
              <input
                id="amount-input"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value !== "" ? Number(e.target.value) : "")}
                disabled={isUploading || isSubmitting}
                placeholder="Contoh: 150000"
                className="h-11 w-full rounded-xl border border-border bg-elevated px-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
            )}
          </div>

          {/* Input Deskripsi/Keterangan */}
          <div className="space-y-1.5">
            <label htmlFor="desc-input" className="text-xs font-semibold uppercase tracking-wider text-secondary">
              Keterangan Pengeluaran
            </label>
            {isProcessingOCR ? (
              <div className="h-24 w-full animate-pulse rounded-xl bg-elevated border border-border" />
            ) : (
              <textarea
                id="desc-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isUploading || isSubmitting}
                rows={3}
                placeholder="Sebutkan rincian barang belanja beserta toko pembelian..."
                className="w-full rounded-xl border border-border bg-elevated p-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
            )}
          </div>

          {/* Tombol Simpan Form */}
          <button
            type="submit"
            disabled={isUploading || isProcessingOCR || isSubmitting || !selectedProjectId || !selectedBudgetItemId || amount === "" || !description}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-text-primary shadow-lg transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Menyimpan Pengajuan...
              </>
            ) : (
              "Simpan & Ajukan Pengeluaran"
            )}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
