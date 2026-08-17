import * as React from "react";

/**
 * Kerangka struktural saat riwayat percakapan sedang dimuat.
 *
 * Bentuknya meniru hierarki akhir — satu gelembung pertanyaan di kanan lalu
 * beberapa baris jawaban di kiri — supaya tidak ada lompatan tata letak ketika
 * isi sebenarnya tiba.
 */
export function ChatHistorySkeleton(): React.JSX.Element {
  return (
    <div className="space-y-lg" role="status" aria-label="Memuat riwayat percakapan">
      <div className="flex justify-end">
        <div className="h-11 w-3/5 rounded-inset bg-surface-container" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <div className="h-2.5 w-40 rounded-full bg-surface-container-low" aria-hidden="true" />
        <div className="h-3 w-full rounded-full bg-surface-container" aria-hidden="true" />
        <div className="h-3 w-11/12 rounded-full bg-surface-container" aria-hidden="true" />
        <div className="h-3 w-4/5 rounded-full bg-surface-container" aria-hidden="true" />
      </div>
      <span className="sr-only">Percakapan sebelumnya sedang disiapkan.</span>
    </div>
  );
}
