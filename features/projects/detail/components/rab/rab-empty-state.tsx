"use client";

import React from "react";

import { NativePanel } from "../shared/rap-rab-primitives";

export function RabEmptyState({
  canManageRab,
  setSourcePickerOpen,
}: {
  readonly canManageRab: boolean;
  readonly setSourcePickerOpen: (open: boolean) => void;
}): React.JSX.Element {
  return (
    <NativePanel eyebrow="RAB Klien" title="Belum ada RAB">
      <div className="py-lg text-center">
        <div className="bg-primary/10 text-primary mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
          <span className="material-symbols-outlined text-[28px]">request_quote</span>
        </div>
        <h3 className="mt-4 text-base font-bold">Susun draf yang siap dibaca klien</h3>
        <p className="text-on-surface-variant mx-auto mt-1 max-w-xs text-xs leading-5">
          Pilih material dan paket kerja, lalu rapikan harga serta labelnya.
        </p>
        {canManageRab && (
          <button
            type="button"
            onClick={() => setSourcePickerOpen(true)}
            className="bg-primary text-on-primary mt-5 min-h-12 w-full rounded-full px-5 text-xs font-bold"
          >
            Buat Draf RAB
          </button>
        )}
      </div>
    </NativePanel>
  );
}
