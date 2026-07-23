"use client";

import React from "react";
import { motion } from "framer-motion";

import { ConfirmationModal } from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";

export function MaterialUnsavedChangesModal({
  open,
  pending = false,
  onSave,
  onDiscard,
  onContinue,
}: {
  readonly open: boolean;
  readonly pending?: boolean;
  readonly onSave: () => void;
  readonly onDiscard: () => void;
  readonly onContinue: () => void;
}): React.JSX.Element {
  return (
    <ConfirmationModal
      open={open}
      title="Perubahan belum disimpan"
      description="Simpan hasil hitung sebagai draft agar dapat dilanjutkan tanpa mengubah stok."
      tone="warning"
      onClose={onContinue}
      actions={
        <div className="space-y-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            transition={transitionSpringSnappy}
            disabled={pending}
            onClick={onSave}
            className="min-h-12 w-full rounded-full bg-primary px-5 text-sm font-bold text-white disabled:opacity-45"
          >
            {pending ? "Menyimpan…" : "Simpan Draft & Tutup"}
          </motion.button>
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              disabled={pending}
              onClick={onDiscard}
              className="min-h-12 rounded-full bg-error-container/25 px-4 text-xs font-bold text-error disabled:opacity-45"
            >
              Buang Perubahan
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              disabled={pending}
              onClick={onContinue}
              className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold text-on-surface disabled:opacity-45"
            >
              Lanjut Mengisi
            </motion.button>
          </div>
        </div>
      }
    />
  );
}
