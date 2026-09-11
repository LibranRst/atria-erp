"use client";

import { AppIcon } from "@/components/ui";
import { fadeVariants, transitionEaseSmooth } from "@/lib/utils/motion";
import { AnimatePresence, motion } from "framer-motion";
import * as React from "react";

type ChatDropOverlayProps = {
  readonly isDragging: boolean;
};

export function ChatDropOverlay({ isDragging }: ChatDropOverlayProps): React.JSX.Element {
  return (
    <AnimatePresence>
      {isDragging ? (
        <motion.div
          variants={fadeVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transitionEaseSmooth}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs bg-surface/85"
        >
          <div className="flex w-full max-w-sm flex-col items-center justify-center gap-3.5 rounded-3xl border-2 border-dashed border-primary/40 bg-surface-container-lowest px-6 py-8 shadow-floating">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-control">
              <AppIcon name="upload_file" className="icon-xl text-white" />
            </div>
            <div className="text-center">
              <p className="text-title-medium font-bold text-on-surface">
                Lepaskan berkas untuk melampirkan
              </p>
              <p className="mt-1 text-meta text-on-surface-variant">
                Gambar, PDF, Excel, CSV, TXT (maks. 10 MB)
              </p>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
