"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { signImagekit } from "@/app/actions/media/sign-imagekit";
import { processReceipt } from "@/app/actions/ai/process-receipt";
import { submitFieldRequests } from "@/app/actions/finance/field-requests";
import { getErrorMessage } from "@/lib/utils/error-message";

interface ProjectBudgetItem {
  id: string;
  name: string;
  budgetCategory: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  allocatedAmount: string;
  actualSpent: string;
  costCategory?: {
    id: string;
    name: string;
    description: string | null;
  } | null;
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

interface ExpenseLine {
  projectBudgetItemId: string;
  quantity: number | "";
  unitPrice: number | "";
  amount: number | "";
  description: string;
}

function findMatchingBudgetItem(itemName: string, budgetItems: ProjectBudgetItem[]): ProjectBudgetItem | undefined {
  const normalizedItemName = itemName.toLowerCase().trim();
  if (!normalizedItemName) return undefined;

  // 1. Coba pencarian persis (exact match atau substring)
  let match = budgetItems.find((bi) => {
    const biName = bi.name.toLowerCase().trim();
    return biName.includes(normalizedItemName) || normalizedItemName.includes(biName);
  });

  // 2. Coba pencarian berbasis token kata (word token matching)
  if (!match) {
    const words = normalizedItemName.split(/\s+/).filter((w) => w.length > 2);
    for (const word of words) {
      match = budgetItems.find((bi) => bi.name.toLowerCase().includes(word));
      if (match) break;
    }
  }

  return match;
}

export function ExpenseForm({ projects }: ExpenseFormProps): React.JSX.Element {
  const router = useRouter();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null);
  
  // State Baris Pengeluaran Multi-Item
  const [lines, setLines] = useState<ExpenseLine[]>([
    { projectBudgetItemId: "", quantity: 1, unitPrice: "", amount: "", description: "" }
  ]);

  // Status flags
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isProcessingOCR, setIsProcessingOCR] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrWarning, setOcrWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  // Animation open state
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    // Trigger slide up animation shortly after mounting
    const timer = setTimeout(() => setIsOpen(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("new-expense") === "true") {
        params.delete("new-expense");
        const newSearch = params.toString();
        router.replace(`${window.location.pathname}${newSearch ? `?${newSearch}` : ""}`, { scroll: false });
      } else {
        router.back();
      }
    }, 250);
  };

  // Dapatkan daftar item anggaran berdasarkan proyek terpilih yang anggarannya sudah disetujui (APPROVED)
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const budgetItems = selectedProject?.budget?.status === "APPROVED"
    ? selectedProject?.budget?.items || []
    : [];

  // Group budget items by budgetCategory
  const itemsByCategory: Record<string, ProjectBudgetItem[]> = {};
  budgetItems.forEach((item) => {
    const catName = item.budgetCategory || "Umum";
    if (!itemsByCategory[catName]) {
      itemsByCategory[catName] = [];
    }
    itemsByCategory[catName].push(item);
  });

  const addLine = () => {
    setLines([...lines, { projectBudgetItemId: "", quantity: 1, unitPrice: "", amount: "", description: "" }]);
  };

  const removeLine = (index: number) => {
    if (lines.length === 1) return;
    const newLines = [...lines];
    newLines.splice(index, 1);
    setLines(newLines);
  };

  const updateLine = (index: number, field: keyof ExpenseLine, value: any) => {
    const newLines = [...lines];
    const updatedLine = { ...newLines[index], [field]: value };

    // Auto-calculate amount when quantity or unitPrice changes
    if (field === "quantity" || field === "unitPrice") {
      const q = updatedLine.quantity === "" ? 0 : Number(updatedLine.quantity);
      const p = updatedLine.unitPrice === "" ? 0 : Number(updatedLine.unitPrice);
      updatedLine.amount = q * p;
    }

    newLines[index] = updatedLine;
    setLines(newLines);
  };

  const adjustQuantity = (index: number, delta: number) => {
    const currentQty = lines[index].quantity === "" ? 0 : Number(lines[index].quantity);
    const newQty = Math.max(0.01, Number((currentQty + delta).toFixed(2)));
    updateLine(index, "quantity", newQty);
  };

  // Hitung total nominal gabungan
  const totalAmount = lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);

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
        setError(`AI OCR gagal memproses gambar nota: ${ocrRes.error?.message || "Eror tidak diketahui"}. Silakan isi parameter formulir secara manual.`);
        return;
      }

      // 4. Isi otomatis baris formulir dari hasil AI OCR secara cerdas
      const parsedData = ocrRes.data;
      const ocrItems = parsedData.items || [];
      
      let unmatchedCount = 0;
      const mappedLines: ExpenseLine[] = ocrItems.map((it) => {
        const matchingBi = findMatchingBudgetItem(it.itemName, budgetItems);
        if (!matchingBi) {
          unmatchedCount++;
        }
        
        return {
          projectBudgetItemId: matchingBi ? matchingBi.id : "",
          quantity: it.quantity || 1,
          unitPrice: it.unitPrice || "",
          amount: it.totalPrice || (it.unitPrice * it.quantity) || "",
          description: `[OCR] ${it.itemName}`,
        };
      });

      // Jika tidak ada item yang ter-parse, buat satu baris default
      if (mappedLines.length === 0) {
        mappedLines.push({
          projectBudgetItemId: "",
          quantity: 1,
          unitPrice: parsedData.totalAmount || "",
          amount: parsedData.totalAmount || "",
          description: `[OCR] Pembelian di ${parsedData.vendorName}`,
        });
      }

      setLines(mappedLines);

      // Warning state untuk item tidak cocok
      if (unmatchedCount > 0) {
        if (unmatchedCount === ocrItems.length) {
          setOcrWarning(
            `Semua item nota (${ocrItems.length} item) tidak cocok dengan item anggaran proyek. Silakan pilih item anggaran secara manual.`
          );
        } else {
          setOcrWarning(
            `Terdeteksi ${unmatchedCount} dari ${ocrItems.length} item nota yang tidak cocok dengan anggaran proyek. Silakan pilih item anggaran secara manual.`
          );
        }
      } else {
        setOcrWarning(null);
      }

    } catch (err: unknown) {
      console.error("ImageKit/Gemini OCR Upload Error:", err);
      setError(getErrorMessage(err, "Terjadi kesalahan saat mengunggah atau memproses berkas nota."));
      setIsUploading(false);
      setIsProcessingOCR(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      setError("Proyek harus dipilih.");
      return;
    }

    if (lines.some(line => !line.projectBudgetItemId || line.amount === "" || Number(line.amount) <= 0 || !line.description.trim())) {
      setError("Semua baris item wajib diisi lengkap dengan nominal di atas 0.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await submitFieldRequests({
        projectId: selectedProjectId,
        receiptImageUrl: receiptImageUrl || "",
        items: lines.map(line => ({
          projectBudgetItemId: line.projectBudgetItemId,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          amount: Number(line.amount),
          description: line.description,
        })),
      });

      if (!res.success) {
        throw new Error(res.error.message || "Gagal mengirim pengajuan biaya lapangan.");
      }

      setSuccess(true);
      // Reset form
      setSelectedProjectId("");
      setLines([{ projectBudgetItemId: "", quantity: 1, unitPrice: "", amount: "", description: "" }]);
      setReceiptImageUrl(null);
      
      // Delay closing to show success state
      setTimeout(() => {
        handleClose();
      }, 1000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Terjadi kesalahan internal sistem."));
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Translucent Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-[90] transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={handleClose}
      />

      {/* iOS Slide-up Drawer Container */}
      <div 
        className={`fixed inset-x-0 bottom-0 top-0 sm:top-12 sm:max-w-md sm:mx-auto bg-background z-[100] flex flex-col rounded-t-[24px] shadow-2xl transition-transform duration-300 ease-out border border-outline-variant/30 ${isOpen ? "translate-y-0" : "translate-y-full"}`}
      >
        {/* Header */}
        <header className="flex justify-between items-center px-margin-mobile h-16 shrink-0 z-10 border-b border-outline-variant/10">
          <button 
            type="button" 
            onClick={handleClose} 
            className="active-scale p-2 -ml-2 text-on-surface-variant flex items-center justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-[28px]">close</span>
          </button>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Add Expense</h1>
          <button 
            type="button" 
            onClick={() => router.push("/expenses")} 
            className="active-scale p-2 -mr-2 text-primary font-bold font-label-caps uppercase tracking-wider text-xs cursor-pointer"
          >
            History
          </button>
        </header>

        {/* Content Area (Scrollable) */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-margin-mobile pb-32 space-y-lg">
          {/* Amount Section */}
          <section className="mt-8 flex flex-col items-center select-none">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-[0.1em] mb-2">Total Amount</span>
            <div className="flex items-baseline gap-1 group font-numeral-lg text-[40px] font-bold text-on-surface">
              <span className="text-primary select-none text-[26px]">Rp</span>
              <span>{totalAmount.toLocaleString("id-ID")}</span>
            </div>
          </section>

          {/* Form Fields */}
          <form onSubmit={handleSubmit} className="space-y-lg pb-10">
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

            {ocrWarning && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 font-medium">
                <span className="material-symbols-outlined text-amber-600 text-[18px]">warning</span>
                <div className="leading-relaxed flex-1">{ocrWarning}</div>
                <button 
                  type="button" 
                  onClick={() => setOcrWarning(null)} 
                  className="text-amber-800 hover:opacity-75 cursor-pointer ml-auto flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            )}

            {/* Project Selector */}
            <div className="relative space-y-sm">
              <label htmlFor="project-select" className="font-label-caps text-label-caps text-on-surface-variant uppercase block ml-1">Project</label>
              <div className="relative">
                <select
                  id="project-select"
                  value={selectedProjectId}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value);
                    setLines([{ projectBudgetItemId: "", quantity: 1, unitPrice: "", amount: "", description: "" }]);
                    setOcrWarning(null);
                  }}
                  disabled={isUploading || isProcessingOCR || isSubmitting}
                  className="appearance-none w-full h-[56px] bg-surface-container-low rounded-xl px-md font-body-md text-on-surface border-none focus:ring-2 focus:ring-primary transition-all cursor-pointer"
                >
                  <option value="">Select active project</option>
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">expand_more</span>
              </div>
            </div>

            {/* Documentation Upload Area */}
            <div className="space-y-sm">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase block ml-1">Documentation</label>
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
                <div className="space-y-xs">
                  <div className="flex gap-md">
                    {/* Kamera */}
                    <label 
                      className={`flex-1 h-28 rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-lowest flex flex-col items-center justify-center gap-1 transition-all group ${
                        !selectedProjectId 
                          ? "opacity-40 cursor-not-allowed" 
                          : "active-scale hover:bg-surface-container-low cursor-pointer"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full bg-primary-container/10 flex items-center justify-center text-primary transition-transform ${!selectedProjectId ? "" : "group-hover:scale-110"}`}>
                        <span className="material-symbols-outlined">photo_camera</span>
                      </div>
                      <span className="font-body-md text-primary font-semibold text-xs">Ambil Foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileUpload}
                        disabled={!selectedProjectId || isUploading || isProcessingOCR || isSubmitting}
                        className="hidden"
                      />
                    </label>

                    {/* Unggah File */}
                    <label 
                      className={`flex-1 h-28 rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-lowest flex flex-col items-center justify-center gap-1 transition-all group ${
                        !selectedProjectId 
                          ? "opacity-40 cursor-not-allowed" 
                          : "active-scale hover:bg-surface-container-low cursor-pointer"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full bg-primary-container/10 flex items-center justify-center text-primary transition-transform ${!selectedProjectId ? "" : "group-hover:scale-110"}`}>
                        <span className="material-symbols-outlined">upload</span>
                      </div>
                      <span className="font-body-md text-primary font-semibold text-xs">Pilih Gambar</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        disabled={!selectedProjectId || isUploading || isProcessingOCR || isSubmitting}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {!selectedProjectId && (
                    <p className="text-[11px] text-on-surface-variant/70 italic ml-1">
                      * Silakan pilih proyek terlebih dahulu untuk mengaktifkan unggah/kamera nota.
                    </p>
                  )}
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
                      "Mengunggah gambar nota..."
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-primary text-[14px]">auto_awesome</span>
                        Gemini AI sedang membaca nota belanja...
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Rincian Pengeluaran Barang (Multi-Item) */}
            <div className="space-y-md border-t border-outline-variant/10 pt-md">
              <div className="flex items-center justify-between">
                <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase block ml-1">Rincian Barang Belanja</h3>
                <button
                  type="button"
                  onClick={addLine}
                  disabled={!selectedProjectId || isUploading || isProcessingOCR || isSubmitting}
                  className="flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary-dark disabled:opacity-50 active-scale transition cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">add_circle</span>
                  Tambah Item
                </button>
              </div>

              <div className="space-y-md">
                {lines.map((line, index) => (
                  <div key={index} className="relative p-md rounded-2xl border border-outline-variant/20 bg-surface-container-low/40 space-y-md">
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        disabled={isUploading || isProcessingOCR || isSubmitting}
                        className="absolute top-2 right-2 text-on-surface-variant hover:text-error text-xs p-1 cursor-pointer flex items-center justify-center h-8 w-8 rounded-full hover:bg-surface-container"
                        title="Hapus Item"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    )}

                    <div className="text-[10px] font-bold text-on-surface-variant">
                      Item #{index + 1}
                    </div>

                    {/* Pilih Item Anggaran RAB (BoQ) */}
                    <div className="space-y-sm">
                      <label htmlFor={`budget-item-select-${index}`} className="font-label-caps text-[9px] text-on-surface-variant block ml-1 uppercase">
                        Item Anggaran RAB (BoQ)
                      </label>
                      <div className="relative">
                        <select
                          id={`budget-item-select-${index}`}
                          value={line.projectBudgetItemId}
                          onChange={(e) => updateLine(index, "projectBudgetItemId", e.target.value)}
                          disabled={!selectedProjectId || isUploading || isProcessingOCR || isSubmitting}
                          className="appearance-none w-full h-[48px] bg-surface-container-low rounded-xl px-md font-body-md text-xs text-on-surface border-none focus:ring-2 focus:ring-primary transition-all cursor-pointer"
                        >
                          <option value="">-- Pilih Item Anggaran (BoQ) --</option>
                          {Object.keys(itemsByCategory).map((catName) => (
                            <optgroup key={catName} label={`KATEGORI ANGGARAN: ${catName}`}>
                              {itemsByCategory[catName].map((item) => {
                                const allocated = Number(item.allocatedAmount);
                                const spent = Number(item.actualSpent);
                                const remaining = allocated - spent;
                                const qty = Number(item.quantity);
                                const price = Number(item.unitPrice);
                                const costCat = item.costCategory?.name || "UMUM";
                                return (
                                  <option key={item.id} value={item.id}>
                                    [{costCat}] {item.name} ({qty.toLocaleString("id-ID")} {item.unit} @ Rp {price.toLocaleString("id-ID")} - Sisa: Rp {remaining.toLocaleString("id-ID")})
                                  </option>
                                );
                              })}
                            </optgroup>
                          ))}
                        </select>
                        <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[20px]">expand_more</span>
                      </div>
                    </div>

                    {/* Kuantitas, Harga Satuan, Total Nominal */}
                    <div className="grid grid-cols-12 gap-sm items-end">
                      {/* Kuantitas */}
                      <div className="col-span-5 space-y-sm">
                        <label htmlFor={`qty-input-${index}`} className="font-label-caps text-[9px] text-on-surface-variant block ml-1 uppercase">
                          Qty {(() => {
                            const bi = budgetItems.find(item => item.id === line.projectBudgetItemId);
                            return bi?.unit ? `(${bi.unit})` : "";
                          })()}
                        </label>
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={() => adjustQuantity(index, -1)}
                            disabled={isUploading || isSubmitting || isProcessingOCR || (Number(line.quantity) || 0) <= 0.01}
                            className="h-[48px] w-11 shrink-0 flex items-center justify-center bg-surface-container border border-outline-variant/20 rounded-l-xl active:scale-95 transition-all text-on-surface-variant hover:text-on-surface disabled:opacity-50 select-none cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[20px] font-bold">remove</span>
                          </button>
                          <input
                            id={`qty-input-${index}`}
                            type="number"
                            step="any"
                            value={line.quantity}
                            onChange={(e) => updateLine(index, "quantity", e.target.value !== "" ? Number(e.target.value) : "")}
                            disabled={isUploading || isSubmitting || isProcessingOCR}
                            placeholder="1"
                            className="w-full h-[48px] bg-surface-container-low text-center font-body-md text-xs text-on-surface border-y border-x-0 border-outline-variant/20 focus:ring-1 focus:ring-primary focus:outline-none focus:z-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => adjustQuantity(index, 1)}
                            disabled={isUploading || isSubmitting || isProcessingOCR}
                            className="h-[48px] w-11 shrink-0 flex items-center justify-center bg-surface-container border border-outline-variant/20 rounded-r-xl active:scale-95 transition-all text-on-surface-variant hover:text-on-surface disabled:opacity-50 select-none cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[20px] font-bold">add</span>
                          </button>
                        </div>
                      </div>

                      {/* Harga Satuan */}
                      <div className="col-span-7 space-y-sm">
                        <label htmlFor={`unit-price-input-${index}`} className="font-label-caps text-[9px] text-on-surface-variant block ml-1 uppercase">
                          Harga Satuan (Rp)
                        </label>
                        <input
                          id={`unit-price-input-${index}`}
                          type="number"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(index, "unitPrice", e.target.value !== "" ? Number(e.target.value) : "")}
                          disabled={isUploading || isSubmitting || isProcessingOCR}
                          placeholder="Harga per unit..."
                          className="w-full h-[48px] bg-surface-container-low rounded-xl px-md font-body-md text-xs text-on-surface border-none focus:ring-2 focus:ring-primary transition-all"
                        />
                      </div>
                    </div>

                    {/* Total Nominal (Auto-computed) */}
                    <div className="space-y-sm bg-surface-container-low/20 rounded-xl p-3 border border-outline-variant/10 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase">Subtotal</span>
                      <span className="font-numeral-md text-xs font-bold text-primary">
                        Rp {(Number(line.amount) || 0).toLocaleString("id-ID")}
                      </span>
                    </div>

                    {/* Deskripsi */}
                    <div className="space-y-sm">
                      <label htmlFor={`desc-input-${index}`} className="font-label-caps text-[9px] text-on-surface-variant block ml-1 uppercase">
                        Keterangan Barang/Jasa
                      </label>
                      <textarea
                        id={`desc-input-${index}`}
                        value={line.description}
                        onChange={(e) => updateLine(index, "description", e.target.value)}
                        disabled={isUploading || isSubmitting || isProcessingOCR}
                        rows={2}
                        placeholder="Sebutkan rincian barang belanja..."
                        className="w-full bg-surface-container-low rounded-xl p-md font-body-md text-xs text-on-surface border-none focus:ring-2 focus:ring-primary transition-all resize-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </div>

        {/* Sticky Action Button */}
        <div className="absolute bottom-0 left-0 right-0 p-margin-mobile bg-gradient-to-t from-background via-background/90 to-transparent pt-12 z-20">
          <button 
            type="submit"
            onClick={handleSubmit}
            disabled={isUploading || isProcessingOCR || isSubmitting || !selectedProjectId || lines.some(l => !l.projectBudgetItemId || l.amount === "" || !l.description)}
            className="w-full h-14 bg-primary text-on-primary rounded-xl font-headline-md text-headline-md shadow-lg active-scale flex items-center justify-center gap-2 hover:bg-primary/95 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-5 w-5 text-on-primary" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Saving Expense...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">check_circle</span>
                Save Expense
              </>
            )}
          </button>
          <div className="h-[20px]"></div>
        </div>
      </div>
    </>
  );
}
