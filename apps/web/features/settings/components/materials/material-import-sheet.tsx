"use client";

import React from "react";
import { toast } from "sonner";
import { useRouter } from "@/lib/navigation/workspace-navigation";
import { importFailureMessage } from "@/lib/utils/import-failure";

import {
  commitMaterialImport,
  previewMaterialImport,
  type MaterialImportInput,
  type MaterialImportPreview,
} from "@/app/actions/settings/material-import";
import {
  AppIcon,
  Button,
  FactRow,
  FormRiskNotice,
  GroupedSurface,
  WorkflowFormSheet,
} from "@/components/ui";
import {
  MATERIAL_CATALOG_CSV_TEMPLATE,
  parseMaterialCatalogCsv,
} from "@atria/core/import/material-csv";
import { MaterialImportPreviewContent } from "./material-import-preview";

type ImportPhase = "idle" | "reading" | "preview" | "commit";
type ImportFailure = {
  readonly kind: "read" | "preview" | "commit";
  readonly message: string;
  readonly outcomeUnknown?: boolean;
};

export function MaterialImportSheet({
  open,
  onClose,
  fallbackFocusRef,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly fallbackFocusRef?: React.RefObject<HTMLElement | null>;
}): React.JSX.Element {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const requestRef = React.useRef(0);
  const phaseRef = React.useRef<ImportPhase>("idle");
  const openRef = React.useRef(open);
  const [input, setInput] = React.useState<MaterialImportInput | null>(null);
  const [preview, setPreview] = React.useState<MaterialImportPreview | null>(null);
  const [fileName, setFileName] = React.useState("");
  const [phase, setPhase] = React.useState<ImportPhase>("idle");
  const [failure, setFailure] = React.useState<ImportFailure | null>(null);
  const [previousOpen, setPreviousOpen] = React.useState(open);
  if (previousOpen !== open) {
    setPreviousOpen(open);
    if (!open) {
      setPhase("idle");
      setInput(null);
      setPreview(null);
      setFileName("");
      setFailure(null);
    }
  }
  const pending = phase !== "idle";
  const canCommit = Boolean(
    input && preview && preview.items.length > 0 && preview.errors.length === 0,
  );

  React.useLayoutEffect(() => {
    openRef.current = open;
    if (!open) {
      requestRef.current += 1;
      phaseRef.current = "idle";
    }
  }, [open]);
  React.useEffect(
    () => () => {
      requestRef.current += 1;
    },
    [],
  );

  function setImportPhase(next: ImportPhase): void {
    phaseRef.current = next;
    setPhase(next);
  }

  function currentRequest(request: number): boolean {
    return requestRef.current === request && openRef.current;
  }

  function downloadTemplate(): void {
    const url = URL.createObjectURL(
      new Blob([MATERIAL_CATALOG_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "template-material-master.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function reset(): void {
    requestRef.current += 1;
    setImportPhase("idle");
    setInput(null);
    setPreview(null);
    setFileName("");
    setFailure(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function validateInput(parsed: MaterialImportInput, request: number): Promise<void> {
    if (!currentRequest(request)) return;
    setImportPhase("preview");
    const result = await previewMaterialImport(parsed);
    if (!currentRequest(request)) return;
    if (!result.success) {
      setFailure({ kind: "preview", message: result.error.message });
      toast.error(result.error.message);
      return;
    }
    setPreview(result.data);
    if (result.data.errors.length > 0)
      toast.warning(`${result.data.errors.length} baris perlu diperbaiki.`);
    else
      toast.success(
        `${result.data.items.length} material siap diimpor. Belum ada data yang berubah.`,
      );
  }

  async function readFile(file: File): Promise<void> {
    if (phaseRef.current === "commit") return;
    const request = ++requestRef.current;
    setImportPhase("reading");
    setFileName(file.name);
    setInput(null);
    setPreview(null);
    setFailure(null);
    let parsedInput: MaterialImportInput | null = null;
    try {
      const source = await file.text();
      if (!currentRequest(request)) return;
      const parsed = parseMaterialCatalogCsv(source);
      parsedInput = parsed;
      setInput(parsed);
      await validateInput(parsed, request);
    } catch (error: unknown) {
      if (!currentRequest(request)) return;
      const message = importFailureMessage(
        error,
        parsedInput
          ? "Validasi belum dapat dimuat. Coba validasi lagi setelah koneksi tersedia."
          : "CSV material tidak dapat dibaca. Pilih ulang file dan coba lagi.",
      );
      setFailure({ kind: parsedInput ? "preview" : "read", message });
      toast.error(message);
    } finally {
      if (currentRequest(request)) setImportPhase("idle");
    }
  }

  async function retryPreview(): Promise<void> {
    if (phaseRef.current !== "idle" || !input) return;
    const request = ++requestRef.current;
    setFailure(null);
    setPreview(null);
    try {
      await validateInput(input, request);
    } catch (error: unknown) {
      if (currentRequest(request)) {
        const message = importFailureMessage(
          error,
          "Validasi belum dapat dimuat. Coba validasi lagi setelah koneksi tersedia.",
        );
        setFailure({ kind: "preview", message });
        toast.error(message);
      }
    } finally {
      if (currentRequest(request)) setImportPhase("idle");
    }
  }

  async function commit(): Promise<void> {
    if (phaseRef.current !== "idle" || !input || !canCommit) return;
    const request = ++requestRef.current;
    setImportPhase("commit");
    setFailure(null);
    try {
      const result = await commitMaterialImport(input);
      if (!currentRequest(request)) return;
      if (!result.success) {
        setFailure({ kind: "commit", message: result.error.message });
        toast.error(result.error.message);
        return;
      }
      toast.success(
        `${result.data.created} Material Master berhasil dibuat dengan inventori bersaldo nol.`,
      );
      reset();
      onClose();
      router.refresh();
    } catch (error: unknown) {
      if (!currentRequest(request)) return;
      const message = importFailureMessage(
        error,
        "Respons impor belum diterima. Periksa Material Master sebelum mengulangi impor.",
      );
      setFailure({ kind: "commit", message, outcomeUnknown: true });
      toast.error(message);
    } finally {
      if (currentRequest(request)) setImportPhase("idle");
    }
  }

  return (
    <WorkflowFormSheet
      fallbackFocusRef={fallbackFocusRef}
      desktopSize="wide"
      desktopFooterPlacement="aside"
      desktopAsideSummary={
        <div className="space-y-4">
          <GroupedSurface>
            <div className="divide-y divide-outline-variant/20">
              <FactRow
                layout="stacked"
                label="File CSV"
                wrapLabel
                value={fileName || "Belum dipilih"}
              />
              <FactRow
                layout="stacked"
                label="Baris dibaca"
                wrapLabel
                value={input?.rows.length ?? "Belum dibaca"}
              />
              <FactRow
                layout="stacked"
                label="Material valid"
                wrapLabel
                value={preview?.items.length ?? "Belum divalidasi"}
              />
              <FactRow
                layout="stacked"
                label="Perlu diperbaiki"
                wrapLabel
                value={preview?.errors.length ?? "Belum divalidasi"}
              />
            </div>
          </GroupedSurface>
          <p className="text-support leading-relaxed text-on-surface-variant">
            Impor membuat Material Master dengan inventori bersaldo nol. Pratinjau belum mengubah
            data; stok dan pembayaran tetap melalui operasi terpisah.
          </p>
        </div>
      }
      dismissal={{
        mode: "confirm",
        dirty: Boolean(input || preview || fileName),
        onDiscard: reset,
        description: "File dan hasil pratinjau yang belum diimpor akan dilepas dari form.",
      }}
      open={open}
      title="Impor Material Master"
      primaryLabel={failure?.kind === "commit" ? "Coba impor lagi" : "Impor"}
      pendingLabel={
        phase === "reading" ? "Membaca file…" : phase === "preview" ? "Memvalidasi…" : "Mengimpor…"
      }
      pending={pending}
      disabled={!canCommit}
      disabledReason={
        canCommit
          ? undefined
          : preview?.errors.length
            ? "Perbaiki seluruh error CSV sebelum import."
            : "Upload dan validasi CSV terlebih dahulu."
      }
      onClose={onClose}
      onExitComplete={() => {
        if (!openRef.current) reset();
      }}
      onPrimary={() => void commit()}
    >
      <div className="space-y-4">
        {failure && (
          <div role="alert">
            <FormRiskNotice
              title={
                failure.outcomeUnknown
                  ? "Hasil impor belum dapat dipastikan"
                  : failure.kind === "commit"
                    ? "Material belum diimpor"
                    : "CSV belum dapat divalidasi"
              }
              tone="danger"
            >
              <p>{failure.message}</p>
              {failure.kind !== "commit" && (
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  disabled={pending}
                  className="mt-2"
                  onClick={() =>
                    failure.kind === "preview" ? void retryPreview() : fileInputRef.current?.click()
                  }
                >
                  {failure.kind === "preview" ? "Coba validasi lagi" : "Pilih ulang file"}
                </Button>
              )}
            </FormRiskNotice>
          </div>
        )}
        <section className="rounded-inset bg-white p-4 shadow-surface ring-1 ring-ring-subtle">
          <p className="text-row font-bold text-on-surface">Template CSV</p>
          <p className="mt-1 text-meta text-on-surface-variant">
            Wajib: name, category, unit, location. Opsional: minimum_stock, last_purchase_price,
            vendor, specification, brand, code, color.
          </p>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={downloadTemplate}
            className="mt-3"
          >
            Unduh template CSV
          </Button>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            disabled={pending}
            onClick={() => fileInputRef.current?.click()}
            aria-label={fileName ? `Ganti file CSV: ${fileName}` : "Pilih file CSV"}
            className="mt-4 min-w-0"
          >
            <AppIcon name="upload_file" className="icon-md shrink-0" aria-hidden="true" />
            <span className="min-w-0 truncate" title={fileName || undefined}>
              {fileName || "Pilih file CSV"}
            </span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            disabled={pending}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void readFile(file);
            }}
          />
        </section>
        {preview && input ? <MaterialImportPreviewContent input={input} preview={preview} /> : null}
        <FormRiskNotice title="Preview tidak mengubah data">
          Saat import dikonfirmasi, seluruh baris ditulis dalam satu transaksi. Satu kegagalan
          membatalkan seluruh batch.
        </FormRiskNotice>
      </div>
    </WorkflowFormSheet>
  );
}
