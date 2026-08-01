"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { ConfirmationSheet } from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { AppIcon } from "@/components/ui/icon/app-icon";

export function LogoutButton(): React.JSX.Element {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const router = useRouter();

  const handleLogout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await authClient.signOut();
      toast.success("Anda sudah keluar dari akun.");
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Gagal melakukan keluar sistem:", error);
      toast.error("Belum dapat keluar dari akun. Coba lagi.");
      setIsLoading(false);
    }
  };

  return (
    <>
      <motion.button
        type="button"
        whileTap={{ scale: 0.985 }}
        transition={transitionSpringSnappy}
        onClick={() => setConfirmOpen(true)}
        disabled={isLoading}
        className="flex min-h-16 w-full min-w-0 items-center gap-3 px-3.5 py-3 text-left transition-colors outline-none focus-visible:bg-error/[0.035] focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset active:bg-error/[0.035] disabled:opacity-55"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-error/[0.07] text-error ring-1 ring-error/6"
          aria-hidden="true"
        >
          <AppIcon name="logout" className="text-[18px] leading-none" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-row font-bold text-error">Keluar dari akun</span>
          <span className="mt-1 block truncate text-[10px] leading-[1.3] text-on-surface-variant">
            Akhiri sesi pada perangkat ini.
          </span>
        </span>
        <AppIcon name="chevron_right" className="shrink-0 text-[18px] leading-none text-error/70" />
      </motion.button>

      <ConfirmationSheet
        open={confirmOpen}
        title="Keluar dari akun?"
        description="Sesi pada perangkat ini akan berakhir. Anda perlu masuk kembali untuk menggunakan Atria ERP."
        confirmLabel="Keluar"
        danger
        pending={isLoading}
        onClose={() => {
          if (!isLoading) setConfirmOpen(false);
        }}
        onConfirm={() => void handleLogout()}
      />
    </>
  );
}
