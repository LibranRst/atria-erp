"use client";

import React from "react";

import { NativePanel } from "../shared/rap-rab-primitives";
import { AppIcon } from "@/components/ui/icon/app-icon";

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
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <AppIcon name="request_quote" className="text-[28px]" />
        </div>
        <h3 className="mt-4 text-base font-bold">Susun draf yang siap dibaca klien</h3>
        <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-on-surface-variant">
          Pilih material dan paket kerja, lalu rapikan harga serta labelnya.
        </p>
        {canManageRab && (
          <button
            type="button"
            onClick={() => setSourcePickerOpen(true)}
            className="mt-5 min-h-12 w-full rounded-full bg-primary px-5 text-xs font-bold text-on-primary"
          >
            Buat Draf RAB
          </button>
        )}
      </div>
    </NativePanel>
  );
}
