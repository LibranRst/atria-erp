import React from "react";
import type { RabEstimateView } from "../../types/rap-rab-types";
import {
  DEFAULT_RAB_CONFIG,
  formatRupiahNumber,
  type RabDocumentConfig,
  type RabExportMetadata,
} from "../../utils/rab-export-utils";

export interface RabExportDocumentProps {
  readonly rabEstimate: RabEstimateView;
  readonly meta: RabExportMetadata;
  readonly config?: RabDocumentConfig;
}

export const RabExportDocument = React.forwardRef<HTMLDivElement, RabExportDocumentProps>(
  function RabExportDocument({ rabEstimate, meta, config }, ref) {
    const cfg = config ?? {
      ...DEFAULT_RAB_CONFIG,
      signeeApprovedByName: meta.clientName || DEFAULT_RAB_CONFIG.signeeApprovedByName,
    };

    const issueDate =
      meta.date ||
      new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

    const docNumber = meta.projectNumber
      ? `RAB/${meta.projectNumber}/R${rabEstimate.revision}`
      : `RAB/R${rabEstimate.revision}`;

    // Filter visible items
    const bundles = rabEstimate.bundles.filter((b) => !b.isHidden);
    const standaloneProduction = rabEstimate.items.filter(
      (it) => !it.bundleId && !it.isHidden && it.itemNature === "PRODUCTION",
    );
    const serviceItems = rabEstimate.items.filter(
      (it) => !it.bundleId && !it.isHidden && it.itemNature === "SERVICE_FEE",
    );

    // Calculate totals
    const bundleTotal = bundles.reduce((sum, b) => sum + (Number(b.lineTotal) || 0), 0);
    const productionTotal = standaloneProduction.reduce(
      (sum, it) => sum + (Number(it.lineTotal) || 0),
      0,
    );
    const serviceTotal = serviceItems.reduce(
      (sum, it) => sum + (Number(it.lineTotal) || 0),
      0,
    );
    const grandTotal = bundleTotal + productionTotal + serviceTotal;

    let itemNumber = 1;

    const paymentTermsList = cfg.paymentTermsNotes
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    return (
      <div
        ref={ref}
        id="rab-printable-document"
        className="mx-auto bg-white p-10 text-neutral-900 shadow-sm"
        style={{
          width: "794px",
          minWidth: "794px",
          boxSizing: "border-box",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        {/* Header Dokumen / Kop Surat Editorial */}
        <header
          className="border-b pb-6"
          style={{ borderBottomColor: `${cfg.themeColor}33` }}
        >
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              {cfg.logoType === "image" && cfg.logoDataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={cfg.logoDataUrl}
                  alt={cfg.companyName}
                  className="h-14 max-w-45 object-contain"
                />
              ) : null}

              <div>
                <h1
                  className="text-2xl font-black tracking-tight uppercase"
                  style={{ color: cfg.themeColor }}
                >
                  {cfg.companyName}
                </h1>
                <p className="mt-1 text-[10px] font-bold tracking-[0.22em] text-neutral-400 uppercase">
                  {cfg.companyTagline}
                </p>
                <p className="mt-1.5 text-[11px] text-neutral-500">
                  {cfg.companyAddress}
                </p>
                <p className="text-[11px] text-neutral-500">
                  {cfg.companyPhone}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span
                className="inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ring-1"
                style={{
                  color: cfg.themeColor,
                  backgroundColor: `${cfg.themeColor}10`,
                  borderColor: `${cfg.themeColor}30`,
                }}
              >
                {rabEstimate.status === "APPROVED" ? "RAB RESMI" : "DRAF PENAWARAN"}
              </span>
              <p className="mt-2 text-xs font-bold text-neutral-900 tracking-wide">
                {docNumber}
              </p>
              <p className="text-[11px] text-neutral-500">
                Tanggal: {issueDate}
              </p>
            </div>
          </div>
        </header>

        {/* Informasi Proyek & Klien Card */}
        <section className="mt-5 grid grid-cols-2 gap-6 rounded-2xl bg-neutral-50/80 p-5 text-xs ring-1 ring-neutral-200/60">
          <div className="space-y-1">
            <p
              className="text-[10px] font-bold tracking-[0.16em] uppercase"
              style={{ color: cfg.themeColor }}
            >
              Informasi Proyek
            </p>
            <p className="text-xs font-bold text-neutral-900">
              {meta.projectName}
            </p>
            <p className="text-[11px] text-neutral-500">
              Lokasi: {meta.projectAddress || "-"}
            </p>
          </div>

          <div className="space-y-1 text-right sm:text-left">
            <p
              className="text-[10px] font-bold tracking-[0.16em] uppercase"
              style={{ color: cfg.themeColor }}
            >
              Klien / Pemberi Tugas
            </p>
            <p className="text-xs font-bold text-neutral-900">
              {meta.clientName || "-"}
            </p>
            <p className="text-[11px] text-neutral-500">
              Kontak: {meta.clientPhone || "-"}
            </p>
          </div>
        </section>

        {/* Tabel Pekerjaan RAB (Modern Editorial Table with Hairline Dividers) */}
        <section className="mt-6">
          <table className="w-full text-xs">
            <thead>
              <tr
                className="border-b-2 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600"
                style={{ borderBottomColor: cfg.themeColor }}
              >
                <th className="w-[6%] py-3 text-center">No.</th>
                <th className="w-[44%] py-3 text-left">
                  Uraian Pekerjaan & Spesifikasi
                </th>
                <th className="w-[10%] py-3 text-center">Vol</th>
                <th className="w-[8%] py-3 text-center">Sat</th>
                <th className="w-[16%] py-3 text-right">Harga Satuan</th>
                <th className="w-[16%] py-3 text-right">Jumlah Harga</th>
              </tr>
            </thead>
            <tbody>
              {/* 1. Bundles (Paket Pekerjaan) */}
              {bundles.map((bundle) => {
                const childItems = rabEstimate.items.filter(
                  (it) => it.bundleId === bundle.id && !it.isHidden,
                );
                return (
                  <React.Fragment key={bundle.id}>
                    <tr
                      className="border-b border-neutral-200/80 font-bold"
                      style={{ backgroundColor: `${cfg.themeColor}08` }}
                    >
                      <td className="py-2.5 px-2 text-center text-neutral-400">
                        {itemNumber++}
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="font-bold text-neutral-950 uppercase tracking-tight">
                          {bundle.clientLabel}
                        </div>
                        {bundle.description ? (
                          <div className="text-[11px] font-normal text-neutral-500 mt-0.5">
                            {bundle.description}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-2 text-center text-neutral-700">
                        {bundle.quantity || 1}
                      </td>
                      <td className="py-2.5 px-2 text-center uppercase text-neutral-500">
                        {bundle.unit || "ls"}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-neutral-700">
                        {formatRupiahNumber(bundle.unitPrice || bundle.lineTotal)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums font-bold text-neutral-950">
                        {formatRupiahNumber(bundle.lineTotal)}
                      </td>
                    </tr>

                    {/* Sub-items di dalam bundle */}
                    {childItems.map((child) => (
                      <tr
                        key={child.id}
                        className="border-b border-neutral-100 text-[11px] text-neutral-600 hover:bg-neutral-50/50"
                      >
                        <td className="py-1.5 px-2 text-center text-neutral-300">
                          {""}
                        </td>
                        <td className="py-1.5 px-2 pl-6">
                          <span className="font-medium text-neutral-800">• {child.clientLabel}</span>
                          {child.description ? (
                            <span className="text-neutral-400"> ({child.description})</span>
                          ) : null}
                        </td>
                        <td className="py-1.5 px-2 text-center text-neutral-500">
                          {child.quantity}
                        </td>
                        <td className="py-1.5 px-2 text-center uppercase text-neutral-400">
                          {child.unit}
                        </td>
                        <td className="py-1.5 px-2 text-right text-neutral-400">
                          {""}
                        </td>
                        <td className="py-1.5 px-2 text-right text-[10px] text-neutral-400 italic">
                          Termasuk paket
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}

              {/* 2. Standalone Production Items */}
              {standaloneProduction.length > 0 ? (
                <>
                  <tr className="border-b border-neutral-200/80 bg-neutral-50 font-bold text-[10px] tracking-wider text-neutral-500 uppercase">
                    <td colSpan={6} className="py-2 px-3">
                      Pekerjaan Fisik & Material
                    </td>
                  </tr>
                  {standaloneProduction.map((item) => (
                    <tr key={item.id} className="border-b border-neutral-200/60 hover:bg-neutral-50/50">
                      <td className="py-2.5 px-2 text-center text-neutral-400">
                        {itemNumber++}
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="font-semibold text-neutral-900">{item.clientLabel}</div>
                        {item.description ? (
                          <div className="text-[11px] text-neutral-400 mt-0.5">{item.description}</div>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-2 text-center text-neutral-700">
                        {item.quantity}
                      </td>
                      <td className="py-2.5 px-2 text-center uppercase text-neutral-400">
                        {item.unit}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-neutral-700">
                        {formatRupiahNumber(item.unitPrice)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums font-semibold text-neutral-950">
                        {formatRupiahNumber(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </>
              ) : null}

              {/* 3. Service Fee / Jasa Desain & Supervisi */}
              {serviceItems.length > 0 ? (
                <>
                  <tr className="border-b border-neutral-200/80 bg-neutral-50 font-bold text-[10px] tracking-wider text-neutral-500 uppercase">
                    <td colSpan={6} className="py-2 px-3">
                      Jasa Desain, Perencanaan & Supervisi
                    </td>
                  </tr>
                  {serviceItems.map((item) => (
                    <tr key={item.id} className="border-b border-neutral-200/60 hover:bg-neutral-50/50">
                      <td className="py-2.5 px-2 text-center text-neutral-400">
                        {itemNumber++}
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="font-semibold text-neutral-900">{item.clientLabel}</div>
                        {item.description ? (
                          <div className="text-[11px] text-neutral-400 mt-0.5">{item.description}</div>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-2 text-center text-neutral-700">
                        {item.quantity}
                      </td>
                      <td className="py-2.5 px-2 text-center uppercase text-neutral-400">
                        {item.unit}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-neutral-700">
                        {formatRupiahNumber(item.unitPrice)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums font-semibold text-neutral-950">
                        {formatRupiahNumber(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </>
              ) : null}

              {/* Baris Kosong jika tidak ada item */}
              {bundles.length === 0 &&
              standaloneProduction.length === 0 &&
              serviceItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-neutral-500">
                    Belum ada item pekerjaan di dalam RAB ini.
                  </td>
                </tr>
              ) : null}
            </tbody>
            {/* Footer Total with Double Hairline Separator */}
            <tfoot>
              <tr
                className="border-t-2 border-b-2 text-neutral-950 font-bold"
                style={{
                  borderTopColor: cfg.themeColor,
                  borderBottomColor: cfg.themeColor,
                  backgroundColor: `${cfg.themeColor}0a`,
                }}
              >
                <td colSpan={5} className="py-3 px-3 text-right text-xs uppercase tracking-wider font-bold">
                  Total Nilai RAB
                </td>
                <td
                  className="py-3 px-3 text-right font-mono tabular-nums text-sm font-black"
                  style={{ color: cfg.themeColor }}
                >
                  {formatRupiahNumber(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* Ketentuan Pembayaran & Termin */}
        <section className="mt-6 rounded-2xl bg-neutral-50/70 p-5 text-[11px] leading-relaxed text-neutral-700 ring-1 ring-neutral-200/60">
          <p
            className="font-bold uppercase tracking-[0.16em] text-[10px]"
            style={{ color: cfg.themeColor }}
          >
            Ketentuan Pembayaran & Catatan Teknis:
          </p>
          <ul className="mt-2 list-disc pl-4 space-y-1 text-neutral-600">
            {rabEstimate.clientNotes ? (
              <li className="font-semibold text-neutral-900">{rabEstimate.clientNotes}</li>
            ) : null}
            {paymentTermsList.map((line) => (
              <li key={line}>{line.startsWith("•") ? line.substring(1).trim() : line}</li>
            ))}
          </ul>
        </section>

        {/* Kolom Tanda Tangan Editorial */}
        <section className="mt-10 grid grid-cols-2 gap-10 text-center text-xs">
          <div>
            <p className="text-neutral-400 text-[11px]">Disiapkan oleh,</p>
            <p
              className="font-bold tracking-wider uppercase text-xs mt-0.5"
              style={{ color: cfg.themeColor }}
            >
              {cfg.signeePreparedByTitle}
            </p>
            <div className="h-16" />
            <div className="mx-auto w-48 border-b border-neutral-300 pb-1 font-bold text-neutral-900">
              {cfg.signeePreparedByName}
            </div>
            <p className="text-[10px] text-neutral-400 mt-1">Interior & Architecture</p>
          </div>

          <div>
            <p className="text-neutral-400 text-[11px]">Disetujui oleh,</p>
            <p className="font-bold text-neutral-900 tracking-wider uppercase text-xs mt-0.5">
              KLIEN / PEMBERI TUGAS
            </p>
            <div className="h-16" />
            <div className="mx-auto w-48 border-b border-neutral-300 pb-1 font-bold text-neutral-900">
              {cfg.signeeApprovedByName || meta.clientName || "...................................."}
            </div>
            <p className="text-[10px] text-neutral-400 mt-1">Tanggal: ........................................</p>
          </div>
        </section>

        {/* Print Stylesheet injection */}
        <style dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 10mm 12mm 10mm 12mm;
              }
              html, body {
                overflow: visible !important;
                height: auto !important;
                background: white !important;
              }
              body * {
                visibility: hidden !important;
              }
              /* Hidden application chrome still takes space. Isolate the
                 document's ancestor path, including transformed sheet portals. */
              body *:not(#rab-printable-document):not(#rab-printable-document *):not(:has(#rab-printable-document)) {
                display: none !important;
              }
              body *:has(#rab-printable-document) {
                display: block !important;
                position: static !important;
                transform: none !important;
                filter: none !important;
                contain: none !important;
                overflow: visible !important;
                width: auto !important;
                max-width: none !important;
                height: auto !important;
                min-height: 0 !important;
                max-height: none !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              [data-export-canvas-container],
              [data-export-canvas-stage],
              [data-export-canvas-wrapper] {
                transform: none !important;
                overflow: visible !important;
                height: auto !important;
                max-height: none !important;
                position: static !important;
                padding: 0 !important;
                margin: 0 !important;
                box-shadow: none !important;
                border: none !important;
                background: transparent !important;
              }
              #rab-printable-document,
              #rab-printable-document * {
                visibility: visible !important;
              }
              #rab-printable-document {
                position: static !important;
                width: 100% !important;
                max-width: 100% !important;
                min-width: 0 !important;
                margin: 0 auto !important;
                padding: 0 !important;
                border: none !important;
                box-shadow: none !important;
                background: white !important;
                color: black !important;
              }
            }
          `
        }} />
      </div>
    );
  }
);
