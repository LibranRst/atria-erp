"use client";
import React, { useRef, useState } from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import {
  ActionMenu,
  AppIcon,
  Button,
  CustomColorPicker,
  FactRow,
  FormSheet,
  FormField,
  FormSection,
  GroupedSurface,
  InlineStateRow,
  MoneyValue,
  SegmentedTabs,
  SheetFooterActions,
  AdaptiveSelect,
  Textarea,
  TextInput,
} from "@/components/ui";
import { RabExportDocument } from "./rab-export-document";
import { RabExportCanvas } from "./rab-export-canvas";
import {
  rabExportTotal,
  type RabExportFormat,
  type RabPrintableEstimate,
} from "@atria/core/ai/rab-export";
import {
  buildRabPdfBlob,
  buildRabStyledWorkbook,
  downloadRabBlob,
  exportElementToPng,
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
  readonly rabEstimate: RabPrintableEstimate | null;
  readonly meta: RabExportMetadata | null;
  readonly initialFormat?: RabExportFormat;
  readonly verifySource?: () => Promise<void>;
  readonly sourceError?: string;
  readonly onRetry?: () => void;
  readonly onDownloaded?: (format: RabExportFormat) => void;
}
export function RabExportDrawer({
  open,
  onClose,
  rabEstimate,
  meta,
  initialFormat = "PDF",
  verifySource,
  sourceError,
  onRetry,
  onDownloaded,
}: RabExportDrawerProps): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  const documentRef = useRef<HTMLDivElement>(null),
    fileInputRef = useRef<HTMLInputElement>(null),
    inFlight = useRef(false);
  const [activeTab, setActiveTab] = useState<"preview" | "customize">("preview");
  const [format, setFormat] = useState<RabExportFormat>(initialFormat);
  const [config, setConfig] = useState<RabDocumentConfig>(() =>
    loadSavedRabConfig(meta?.clientName, meta?.companyName, rabEstimate?.id),
  );
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState("");
  const [canShareNative] = useState(
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
  );
  const available = Boolean(rabEstimate && meta && !sourceError);
  const filename = `RAB_${(meta?.projectName ?? "Dokumen").replace(/[^a-zA-Z0-9_-]/g, "_")}_R${rabEstimate?.revision ?? 1}`;
  const updateConfig = (updates: Partial<RabDocumentConfig>): void => {
    setConfig((prev) => {
      const next = { ...prev, ...updates };
      saveRabConfig(next, rabEstimate?.id);
      return next;
    });
    setResult("");
  };
  const handleResetConfig = (): void => {
    setConfig(resetRabConfig(meta?.clientName, meta?.companyName, rabEstimate?.id));
    setResult("");
  };
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Ukuran logo maksimal 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        if (typeof reader.result !== "string") throw new Error("Logo tidak valid.");
        const logo = await optimizeLogoDataUrl(reader.result);
        updateConfig({ logoType: "image", logoDataUrl: logo });
        setError("");
      } catch {
        setError("Logo belum dapat dibaca. Pilih PNG, JPEG, WebP atau SVG yang valid.");
      }
    };
    reader.readAsDataURL(file);
  };
  const handleRemoveLogo = (): void => {
    updateConfig({ logoType: "text", logoDataUrl: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  async function createFile(chosen: RabExportFormat): Promise<Blob> {
    if (!rabEstimate || !meta || !documentRef.current)
      throw new Error("Preview dokumen belum siap.");
    if (chosen === "EXCEL") {
      const book = await buildRabStyledWorkbook(rabEstimate, meta, config);
      return new Blob([new Uint8Array(await book.xlsx.writeBuffer()).buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    }
    if (chosen === "PDF") return buildRabPdfBlob(documentRef.current);
    const image = await exportElementToPng(documentRef.current, filename, false);
    if (!image.success || !image.blob) throw new Error(image.error || "Gambar belum dapat dibuat.");
    return image.blob;
  }
  async function download(share = false): Promise<void> {
    if (inFlight.current || !available) return;
    if (activeTab !== "preview") {
      setActiveTab("preview");
      return;
    }
    inFlight.current = true;
    setPending(true);
    setError("");
    setResult("");
    try {
      await verifySource?.();
      const chosen = share ? "PNG" : format,
        blob = await createFile(chosen);
      await verifySource?.();
      if (share) {
        const shared = await shareImageViaWhatsAppOrDevice(
          blob,
          filename,
          meta?.projectName ?? "RAB",
        );
        if (!shared.shared && !shared.aborted) {
          downloadRabBlob(blob, `${filename}.png`);
          setResult("Gambar siap diunduh untuk dibagikan.");
        } else setResult(shared.shared ? "Dokumen dibagikan." : "Berbagi dibatalkan.");
      } else {
        downloadRabBlob(
          blob,
          `${filename}.${chosen === "EXCEL" ? "xlsx" : chosen === "PDF" ? "pdf" : "png"}`,
        );
        setResult(
          `${chosen === "EXCEL" ? "Excel" : chosen === "PNG" ? "Gambar" : "PDF"} siap diunduh.`,
        );
        onDownloaded?.(chosen);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ekspor belum berhasil. Coba lagi.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  const footer = (
    <div className="space-y-2">
      <SheetFooterActions
        layout="adaptive"
        desktopStacked
        primaryFirst
        primary={{
          label:
            activeTab === "customize"
              ? "Lihat preview"
              : `Unduh ${format === "EXCEL" ? "Excel" : format === "PNG" ? "gambar" : "PDF"}`,
          pending,
          pendingLabel: "Menyiapkan berkas…",
          disabled: !available,
          onClick: () => void download(),
        }}
        secondary={{
          label: activeTab === "customize" ? "Reset tampilan" : "Tampilan dokumen",
          variant: "quiet",
          disabled: pending || !available,
          onClick: () =>
            activeTab === "customize" ? handleResetConfig() : setActiveTab("customize"),
        }}
      />
      {error && !sourceError && (
        <InlineStateRow
          tone="critical"
          icon="error"
          title="Ekspor belum berhasil"
          description={error}
        />
      )}
      {result && (
        <p role="status" className="text-support text-on-surface-variant">
          {result}
        </p>
      )}
      <p className="text-meta text-on-surface-variant">
        {sourceError
          ? "Periksa dokumen sebelum melanjutkan."
          : "Unduhan tidak mengubah atau menyetujui RAB."}
      </p>
    </div>
  );
  const summary =
    available && rabEstimate && meta ? (
      <div className="space-y-4">
        <GroupedSurface>
          <FactRow
            label="Revisi"
            value={`R${rabEstimate.revision} · ${rabEstimate.status === "APPROVED" ? "Disetujui" : "Draft"}`}
          />
          <FactRow
            label="Baris penawaran"
            value={
              rabEstimate.bundles.filter((b) => !b.isHidden).length +
              rabEstimate.items.filter((i) => !i.bundleId && !i.isHidden).length
            }
          />
          <FactRow
            label="Total RAB"
            value={
              <MoneyValue
                amount={Number(rabExportTotal(rabEstimate))}
                variant="fullDynamic"
                fractionDigits={Number(rabExportTotal(rabEstimate)) % 1 === 0 ? 0 : 2}
                size="sm"
                align="right"
              />
            }
          />
        </GroupedSurface>
        <FormSection>
          <AdaptiveSelect
            label="Format dokumen"
            value={format}
            options={[
              { value: "PDF", label: "PDF (.pdf)" },
              { value: "EXCEL", label: "Excel (.xlsx)" },
              { value: "PNG", label: "Gambar (.png)" },
            ]}
            onChange={(value) => {
              if (value === "PDF" || value === "EXCEL" || value === "PNG") setFormat(value);
              setResult("");
            }}
            disabled={pending}
          />
        </FormSection>
        {canShareNative && (
          <ActionMenu
            label="Bagikan dokumen"
            trigger={
              <Button variant="secondary" fullWidth disabled={pending}>
                Bagikan
              </Button>
            }
            items={[
              {
                id: "share",
                label: "Bagikan gambar…",
                icon: "send",
                onSelect: () => void download(true),
              },
            ]}
          />
        )}
      </div>
    ) : null;
  return (
    <FormSheet
      open={open}
      title="Dokumen RAB"
      desktopSize="wide"
      desktopFooterPlacement="aside"
      desktopAsideSummary={summary}
      footer={footer}
      sizing="content"
      dismissal={{ mode: "preserve" }}
      pending={pending}
      onClose={() => {
        if (!inFlight.current) onClose();
      }}
    >
      <div className="space-y-5">
        {!available ? (
          <InlineStateRow
            tone="critical"
            icon="error"
            title="Dokumen belum dapat ditinjau"
            description={sourceError || "Dokumen sedang disiapkan."}
            action={
              onRetry ? (
                <Button variant="secondary" size="compact" disabled={pending} onClick={onRetry}>
                  Periksa lagi
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="space-y-1">
              <p className="text-section-title font-semibold">{meta?.projectName}</p>
              <p className="text-support text-on-surface-variant">
                {rabEstimate?.title} · {meta?.clientName}
              </p>
            </div>
            {!desktop && summary}
            <SegmentedTabs
              value={activeTab}
              density="compact"
              onChange={(val) => {
                if (!pending && (val === "preview" || val === "customize")) setActiveTab(val);
              }}
              ariaLabel="Navigasi dokumen RAB"
              options={[
                { value: "preview", label: "Preview" },
                { value: "customize", label: "Tampilan" },
              ]}
            />
            {activeTab === "preview" && rabEstimate && meta && (
              <RabExportCanvas>
                <RabExportDocument
                  ref={documentRef}
                  rabEstimate={rabEstimate}
                  meta={meta}
                  config={config}
                />
              </RabExportCanvas>
            )}
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
                        onChange={(val) => {
                          if (val === "text" || val === "image") updateConfig({ logoType: val });
                        }}
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
                          aria-label="Pilih logo dokumen"
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
                              <Button
                                variant="secondary"
                                size="compact"
                                onClick={() => fileInputRef.current?.click()}
                              >
                                Ganti
                              </Button>
                              <Button
                                type="button"
                                onClick={handleRemoveLogo}
                                className="rounded-full bg-critical-container px-3.5 py-1.5 text-meta font-bold text-critical hover:opacity-90 active:z-10 active:shadow-raised"
                                variant="criticalQuiet"
                                size="mini"
                              >
                                Hapus
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="secondary"
                            size="compact"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <AppIcon name="image" className="icon-sm" />
                            <span>Pilih File Logo</span>
                          </Button>
                        )}
                      </div>
                    </FormField>
                  ) : null}

                  {(
                    [
                      ["companyName", "Nama perusahaan"],
                      ["companyTagline", "Tagline"],
                      ["companyAddress", "Alamat perusahaan"],
                      ["companyPhone", "Kontak perusahaan"],
                    ] as const
                  ).map(([field, label]) => (
                    <FormField key={field} label={label}>
                      <TextInput
                        value={config[field]}
                        onChange={(value) => updateConfig({ [field]: value })}
                      />
                    </FormField>
                  ))}
                </FormSection>
                <FormSection
                  title="Judul dan ketentuan"
                  helper="Gunakan ketentuan yang sudah disepakati. Tampilan ini tidak mengubah RAB tersimpan."
                >
                  <FormField label="Judul dokumen">
                    <TextInput
                      value={config.docTitle}
                      onChange={(value) => updateConfig({ docTitle: value })}
                    />
                  </FormField>
                  <FormField
                    label="Ketentuan pembayaran"
                    helper="Opsional · satu ketentuan per baris"
                  >
                    <Textarea
                      rows={4}
                      value={config.paymentTermsNotes}
                      onChange={(value) => updateConfig({ paymentTermsNotes: value })}
                    />
                  </FormField>
                </FormSection>
                <FormSection
                  title="Penyiap dan penerima"
                  helper="Nama penerima tidak berarti dokumen telah disetujui."
                >
                  {(
                    [
                      ["signeePreparedByTitle", "Jabatan penyiap"],
                      ["signeePreparedByName", "Nama penyiap"],
                      ["signeeApprovedByName", "Nama penerima"],
                    ] as const
                  ).map(([field, label]) => (
                    <FormField key={field} label={label}>
                      <TextInput
                        value={config[field]}
                        onChange={(value) => updateConfig({ [field]: value })}
                      />
                    </FormField>
                  ))}
                </FormSection>
              </div>
            ) : null}
          </>
        )}
      </div>
    </FormSheet>
  );
}
