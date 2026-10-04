"use client";

import React, { useRef, useState } from "react";
import { toast } from "sonner";
import {
  ActionMenu,
  AppIcon,
  Button,
  CustomColorPicker,
  DetailSheet,
  FormField,
  FormSection,
  SegmentedTabs,
  SheetFooterActions,
  Textarea,
  TextInput,
  type ActionMenuItem,
} from "@/components/ui";
import { RabExportDocument } from "./rab-export-document";
import { RabExportCanvas } from "./rab-export-canvas";
import type { RabEstimateView } from "../../types/rap-rab-types";
import {
  exportElementToPng,
  exportRabToStyledExcel,
  loadSavedRabConfig,
  optimizeLogoDataUrl,
  RAB_THEME_PRESETS,
  resetRabConfig,
  saveRabConfig,
  shareImageViaWhatsAppOrDevice,
  type RabDocumentConfig,
  type RabExportMetadata,
} from "../../utils/rab-export-utils";

interface RabExportDrawerProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly rabEstimate: RabEstimateView;
  readonly meta: RabExportMetadata;
}

export function RabExportDrawer({
  open,
  onClose,
  rabEstimate,
  meta,
}: RabExportDrawerProps): React.JSX.Element {
  const documentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "customize">("preview");
  const [config, setConfig] = useState<RabDocumentConfig>(() =>
    loadSavedRabConfig(meta.clientName),
  );
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const [canShareNative] = useState(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;
    return "share" in navigator && typeof navigator.canShare === "function";
  });

  const cleanProjectName = meta.projectName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `RAB_${cleanProjectName}_R${rabEstimate.revision}`;

  const updateConfig = (updates: Partial<RabDocumentConfig>): void => {
    setConfig((prev) => {
      const next = { ...prev, ...updates };
      saveRabConfig(next);
      return next;
    });
  };

  const handleResetConfig = (): void => {
    const defaultCfg = resetRabConfig(meta.clientName);
    setConfig(defaultCfg);
    toast.success("Kustomisasi dikembalikan ke format standar.");
  };


  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran logo maksimal 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result;
      if (typeof result === "string") {
        try {
          const optimized = await optimizeLogoDataUrl(result);
          updateConfig({
            logoType: "image",
            logoDataUrl: optimized,
          });
          toast.success("Logo gambar berhasil dimuat.");
        } catch {
          updateConfig({
            logoType: "image",
            logoDataUrl: result,
          });
          toast.success("Logo gambar berhasil dimuat.");
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = (): void => {
    updateConfig({
      logoType: "text",
      logoDataUrl: "",
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 1. Action: Print / Save as PDF
  const handlePrint = async (): Promise<void> => {
    if (activeTab !== "preview") {
      setActiveTab("preview");
      await new Promise((r) => setTimeout(r, 150));
    }
    window.print();
  };

  // 2. Action: Download Styled Excel
  const handleDownloadExcel = async (): Promise<void> => {
    setIsExportingExcel(true);
    const toastId = toast.loading("Membuat berkas Excel bergaya resmi...");
    try {
      await exportRabToStyledExcel(rabEstimate, meta, config);
      toast.success("File Excel RAB berhasil diunduh.", { id: toastId });
    } catch (err: unknown) {
      console.error(err);
      toast.error("Gagal mengunduh file Excel.", { id: toastId });
    } finally {
      setIsExportingExcel(false);
    }
  };

  // 3. Action: Download Image
  const handleDownloadImage = async (): Promise<void> => {
    if (activeTab !== "preview") {
      setActiveTab("preview");
      await new Promise((r) => setTimeout(r, 200));
    }
    if (!documentRef.current) return;

    setIsExportingImage(true);
    const toastId = toast.loading("Merender gambar dokumen RAB...");
    try {
      const result = await exportElementToPng(documentRef.current, filename, true);
      if (result.success) {
        toast.success("Gambar RAB berhasil diunduh (siap dikirim ke WhatsApp).", { id: toastId });
      } else {
        toast.error(result.error || "Gagal membuat gambar RAB.", { id: toastId });
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error("Terjadi kesalahan saat mengexport gambar.", { id: toastId });
    } finally {
      setIsExportingImage(false);
    }
  };

  // 4. Action: Share to WhatsApp / native
  const handleShare = async (): Promise<void> => {
    if (activeTab !== "preview") {
      setActiveTab("preview");
      await new Promise((r) => setTimeout(r, 200));
    }
    if (!documentRef.current) return;

    setIsExportingImage(true);
    const toastId = toast.loading("Menyiapkan dokumen untuk dibagikan...");
    try {
      const result = await exportElementToPng(documentRef.current, filename, false);
      if (result.success && result.blob) {
        const shareResult = await shareImageViaWhatsAppOrDevice(
          result.blob,
          filename,
          `RAB - ${meta.projectName}`,
        );
        if (shareResult.shared) {
          toast.success("Dokumen siap dibagikan.", { id: toastId });
        } else if (shareResult.aborted) {
          toast.dismiss(toastId);
        } else {
          // Fallback download
          const URL = window.URL || window.webkitURL || window;
          const downloadUrl = URL.createObjectURL(result.blob);
          const link = document.createElement("a");
          link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
          link.href = downloadUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
          toast.info("Gambar telah tersimpan di unduhan Anda (siap di-attach ke WhatsApp).", {
            id: toastId,
          });
        }
      } else {
        toast.error(result.error || "Gagal menyiapkan gambar untuk dibagikan.", { id: toastId });
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error("Gagal membagikan dokumen.", { id: toastId });
    } finally {
      setIsExportingImage(false);
    }
  };

  // Action menu items for secondary exports on Preview Tab
  const exportMenuItems: ActionMenuItem[] = [
    {
      id: "excel",
      label: "Unduh Excel (.xlsx)",
      icon: "fact_check",
      onSelect: () => {
        void handleDownloadExcel();
      },
    },
    {
      id: "image",
      label: "Unduh Gambar (.png)",
      icon: "image",
      onSelect: () => {
        void handleDownloadImage();
      },
    },
    ...(canShareNative
      ? [
          {
            id: "share",
            label: "Kirim ke WhatsApp",
            icon: "send" as const,
            onSelect: () => {
              void handleShare();
            },
          },
        ]
      : []),
  ];
  // Sticky footer depending on active tab
  const footerNode =
    activeTab === "preview" ? (
      <div className="grid grid-cols-2 gap-2">
        <ActionMenu
          label="Format Ekspor Lainnya"
          placement="top-start"
          trigger={
            <Button
              type="button"
              variant="secondary"
              fullWidth
              pending={isExportingImage || isExportingExcel}
              leadingIcon={<AppIcon name="more_horiz" className="text-sm" />}
            >
              Format Lainnya
            </Button>
          }
          items={exportMenuItems}
        />
        <Button
          type="button"
          variant="primary"
          fullWidth
          onClick={handlePrint}
          leadingIcon={<AppIcon name="description" className="text-sm" />}
        >
          Cetak / PDF
        </Button>
      </div>
    ) : (
      <SheetFooterActions
        secondary={{
          label: "Reset Format",
          onClick: handleResetConfig,
        }}
        primary={{
          label: "Lihat Pratinjau",
          onClick: () => setActiveTab("preview"),
        }}
      />
    );

  return (
    <DetailSheet
      open={open}
      title="Pratinjau Dokumen RAB"
      onClose={onClose}
      footer={footerNode}
    >
      <div className="space-y-4">
        {/* Segmented Tab Switcher */}
        <SegmentedTabs
          value={activeTab}
          density="default"
          onChange={(val) => setActiveTab(val as "preview" | "customize")}
          ariaLabel="Navigasi Dokumen RAB"
          options={[
            {
              value: "preview",
              label: "Pratinjau Dokumen",
              icon: <AppIcon name="visibility" className="text-xs" />,
            },
            {
              value: "customize",
              label: "Kustomisasi Dokumen",
              icon: <AppIcon name="palette" className="text-xs" />,
            },
          ]}
        />

        {/* TAB 1: PRATINJAU DOKUMEN DENGAN ZOOM & PAN CANVAS */}
        <div className={activeTab === "preview" ? "block" : "hidden"}>
          <RabExportCanvas>
            <RabExportDocument
              ref={documentRef}
              rabEstimate={rabEstimate}
              meta={meta}
              config={config}
            />
          </RabExportCanvas>
        </div>

        {/* TAB 2: PANEL KUSTOMISASI (Grouped iOS Form) */}
        {activeTab === "customize" ? (
          <div className="space-y-5 pb-6">
            {/* 1. Tema Warna Dokumen */}
            <FormSection
              title="Tema Warna Dokumen"
              helper="Tentukan warna aksen kop surat, tabel, dan total nilai RAB."
            >
              <FormField label="Warna Aksen Dokumen">
                <CustomColorPicker
                  value={config.themeColor}
                  onChange={(nextHex) => updateConfig({ themeColor: nextHex })}
                  presets={RAB_THEME_PRESETS}
                  ariaLabel="Warna aksen dokumen RAB"
                />
              </FormField>
            </FormSection>

            {/* 2. Identitas Studio & Kop Surat */}
            <FormSection
              title="Identitas Studio & Kop Surat"
              helper="Nama, tagline, alamat workshop, dan logo pada kop dokumen."
            >
              <FormField label="Format Logo Kop Surat">
                <div className="py-1">
                  <SegmentedTabs
                    value={config.logoType}
                    density="compact"
                    onChange={(val) => updateConfig({ logoType: val as "text" | "image" })}
                    ariaLabel="Pilih Jenis Logo"
                    options={[
                      { value: "text", label: "Teks Studio" },
                      { value: "image", label: "Logo Gambar / SVG" },
                    ]}
                  />
                </div>
              </FormField>

              {config.logoType === "image" ? (
                <FormField label="File Logo" helper="PNG transparan atau SVG (maksimal 2MB)">
                  <div className="py-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      onChange={handleLogoUpload}
                      className="hidden"
                      id="logo-image-upload"
                    />

                    {config.logoDataUrl ? (
                      <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-container-low p-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={config.logoDataUrl}
                          alt="Logo Preview"
                          className="h-10 max-w-32 object-contain"
                        />
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="logo-image-upload"
                            className="cursor-pointer rounded-full bg-white px-3.5 py-1.5 text-meta font-bold text-on-surface shadow-control ring-1 ring-ring-control transition hover:bg-surface-container-lowest active:scale-[1.05] active:shadow-raised active:z-10"
                          >
                            Ganti
                          </label>
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            className="rounded-full bg-critical-container px-3.5 py-1.5 text-meta font-bold text-critical transition hover:opacity-90 active:scale-[1.05] active:shadow-raised active:z-10"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label
                        htmlFor="logo-image-upload"
                        className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2.5 text-meta font-bold text-on-surface shadow-control ring-1 ring-ring-control transition hover:bg-surface-container-low active:scale-[1.05] active:shadow-raised active:z-10"
                      >
                        <AppIcon name="image" className="icon-sm" />
                        <span>Pilih File Logo</span>
                      </label>
                    )}
                  </div>
                </FormField>
              ) : null}

              <FormField label="Nama Studio / Perusahaan">
                <TextInput
                  placeholder="mis. STUDIO INTERIOR"
                  value={config.companyName}
                  onChange={(val) => updateConfig({ companyName: val })}
                />
              </FormField>
              <FormField label="Tagline Studio">
                <TextInput
                  placeholder="mis. INTERIOR ARCHITECTURE & BUILD"
                  value={config.companyTagline}
                  onChange={(val) => updateConfig({ companyTagline: val })}
                />
              </FormField>
              <FormField label="Alamat Workshop / Kantor">
                <TextInput
                  placeholder="mis. Studio & Workshop: Jakarta, Indonesia"
                  value={config.companyAddress}
                  onChange={(val) => updateConfig({ companyAddress: val })}
                />
              </FormField>
              <FormField label="Kontak & Email">
                <TextInput
                  placeholder="mis. info@studio.id | +62 812-3456-7890"
                  value={config.companyPhone}
                  onChange={(val) => updateConfig({ companyPhone: val })}
                />
              </FormField>
            </FormSection>

            {/* 3. Ketentuan & Termin Pembayaran */}
            <FormSection
              title="Ketentuan & Termin Pembayaran"
              helper="Judul resmi dokumen dan rincian termin penagihan klien."
            >
              <FormField label="Judul Dokumen">
                <TextInput
                  placeholder="RENCANA ANGGARAN BIAYA (RAB)"
                  value={config.docTitle}
                  onChange={(val) => updateConfig({ docTitle: val })}
                />
              </FormField>
              <FormField
                label="Syarat & Ketentuan Pembayaran"
                helper="Tuliskan satu ketentuan per baris"
              >
                <Textarea
                  rows={4}
                  value={config.paymentTermsNotes}
                  onChange={(val) => updateConfig({ paymentTermsNotes: val })}
                />
              </FormField>
            </FormSection>

            {/* 4. Penandatangan Dokumen */}
            <FormSection
              title="Penandatangan Dokumen"
              helper="Nama penanggung jawab dari studio dan pihak pemberi tugas."
            >
              <FormField label="Instansi / Jabatan Penyiap">
                <TextInput
                  placeholder="mis. STUDIO LEAD"
                  value={config.signeePreparedByTitle}
                  onChange={(val) => updateConfig({ signeePreparedByTitle: val })}
                />
              </FormField>
              <FormField label="Nama PIC Studio">
                <TextInput
                  placeholder="mis. Project Lead / Director"
                  value={config.signeePreparedByName}
                  onChange={(val) => updateConfig({ signeePreparedByName: val })}
                />
              </FormField>
              <FormField label="Nama Klien Penandatangan">
                <TextInput
                  placeholder="mis. Ibu Amanda"
                  value={config.signeeApprovedByName}
                  onChange={(val) => updateConfig({ signeeApprovedByName: val })}
                />
              </FormField>
            </FormSection>
          </div>
        ) : null}
      </div>
    </DetailSheet>
  );
}
