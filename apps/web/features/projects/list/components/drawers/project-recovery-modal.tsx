import React from "react";
import { motion } from "framer-motion";

import { ConfirmationDialog } from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";

export function ProjectRecoveryModal({
  open,
  onClose,
  onSaveAndClose,
  onDiscard,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSaveAndClose: () => void;
  readonly onDiscard: () => void;
}): React.JSX.Element {
  return (
    <ConfirmationDialog
      open={open}
      title="Tutup form proyek?"
      description="Isian sudah aman di perangkat ini dan dapat dilanjutkan saat form dibuka kembali."
      tone="warning"
      onClose={onClose}
      actions={
        <div className="space-y-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            transition={transitionSpringSnappy}
            onClick={onSaveAndClose}
            className="min-h-12 w-full rounded-full bg-primary px-5 text-xs font-bold text-white"
          >
            Simpan Lokal & Tutup
          </motion.button>
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={onDiscard}
              className="min-h-12 rounded-full bg-error-container/25 px-4 text-xs font-bold text-error"
            >
              Buang Perubahan
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={onClose}
              className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold text-on-surface"
            >
              Lanjut Mengisi
            </motion.button>
          </div>
        </div>
      }
    />
  );
}
