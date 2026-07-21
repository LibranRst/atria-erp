"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { ConfirmationSheet } from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";

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
        className="active:bg-error/[0.035] focus-visible:bg-error/[0.035] focus-visible:ring-error/25 flex min-h-[64px] w-full min-w-0 items-center gap-3 px-3.5 py-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset disabled:opacity-55"
      >
        <span
          className="bg-error/[0.07] text-error ring-error/6 flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1"
          aria-hidden="true"
        >
          <span className="material-symbols-outlined text-[18px] leading-none">logout</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-error block truncate text-[13px] leading-4 font-bold">
            Keluar dari akun
          </span>
          <span className="text-on-surface-variant mt-1 block truncate text-[10px] leading-[1.3]">
            Akhiri sesi pada perangkat ini.
          </span>
        </span>
        <span
          className="material-symbols-outlined text-error/70 shrink-0 text-[18px] leading-none"
          aria-hidden="true"
        >
          chevron_right
        </span>
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
