"use client";

import { AppIcon } from "@/components/ui";
import { transitionSpringBouncy, transitionSpringSmooth } from "@/lib/utils/motion";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import * as React from "react";

/**
 * Tombol chat di header beserta pemuatan sheet-nya.
 *
 * Sheet dimuat secara dinamis supaya paket AI SDK tidak ikut membebani
 * render pertama setiap halaman — chat hanya dibuka sesekali.
 */

const AiChatSheet = dynamic(() => import("./ai-chat-sheet").then((module) => module.AiChatSheet), {
  ssr: false,
});

type AiChatLauncherProps = {
  /** Tombol bergeser ke kanan saat tombol kembali muncul di posisi yang sama. */
  readonly shifted: boolean;
};

export function AiChatLauncher({ shifted }: AiChatLauncherProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  // Sheet tetap terpasang selama animasi keluar berjalan. Melepasnya bersamaan
  // dengan `open` akan membuang `AnimatePresence` di dalam BottomSheet, sehingga
  // sheet hilang seketika tanpa animasi menutup.
  const [mounted, setMounted] = React.useState(false);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const location = `${pathname}?${searchParams.toString()}`;
  const locationAtOpen = React.useRef(location);

  React.useEffect(() => {
    if (!open) {
      locationAtOpen.current = location;
      return;
    }
    // Menekan kartu di dalam chat berpindah rute. Sheet harus ikut menutup,
    // kalau tidak pengguna mendarat di halaman tujuan dengan chat menutupinya.
    if (location !== locationAtOpen.current) {
      setOpen(false);
    }
  }, [location, open]);

  function openSheet(): void {
    locationAtOpen.current = location;
    setMounted(true);
    setOpen(true);
  }

  return (
    <>
      <motion.button
        type="button"
        onClick={openSheet}
        animate={{ x: shifted ? 46 : 0 }}
        transition={shifted ? transitionSpringBouncy : transitionSpringSmooth}
        className="absolute top-0 left-0 z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white text-on-surface-variant shadow-control ring-1 ring-ring-subtle transition-colors duration-200 after:absolute after:-inset-1 after:content-[''] hover:bg-surface-container-low active:scale-95"
        aria-label="Buka asisten AI"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <AppIcon name="chat" aria-hidden="true" className="icon-lg" />
      </motion.button>

      {mounted && (
        <AiChatSheet
          open={open}
          onClose={() => setOpen(false)}
          onExitComplete={() => setMounted(false)}
        />
      )}
    </>
  );
}
