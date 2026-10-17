"use client";

import React, { useState } from "react";
import { useRouter } from "@/lib/navigation/workspace-navigation";

import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { motion, useReducedMotion } from "framer-motion";

import { AppIcon, Button, ConfirmationDialog } from "@/components/ui";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { transitionSpringSnappy, buttonTapActiveScale } from "@/lib/utils/motion";
export function LogoutButton({
  renderTrigger,
}: {
  readonly renderTrigger?: (requestLogout: () => void, pending: boolean) => React.ReactNode;
} = {}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const desktop = useWorkspacePresentation() === "desktop";

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
      {renderTrigger ? (
        renderTrigger(() => setConfirmOpen(true), isLoading)
      ) : desktop ? (
        <div className="space-y-3 p-4">
          <p className="text-support text-on-surface-variant">Akhiri sesi pada perangkat ini.</p>
          <Button
            fullWidth
            size="compact"
            variant="criticalQuiet"
            pending={isLoading}
            onClick={() => setConfirmOpen(true)}
            leadingIcon={<AppIcon name="logout" className="icon-md" />}
          >
            Keluar dari akun
          </Button>
        </div>
      ) : (
        <motion.button
          type="button"
          whileTap={{ scale: reduceMotion ? 1 : buttonTapActiveScale }}
          transition={transitionSpringSnappy}
          onClick={() => setConfirmOpen(true)}
          disabled={isLoading}
          className="flex min-h-16 w-full min-w-0 items-center gap-3 px-3.5 py-3 text-left transition-colors outline-none focus-visible:bg-error/[0.035] focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset active:bg-error/[0.035] disabled:opacity-55"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-error/[0.07] text-error ring-1 ring-error/6"
            aria-hidden="true"
          >
            <AppIcon name="logout" className="icon-md leading-none" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-row font-bold text-error">Keluar dari akun</span>
            <span className="mt-1 block truncate text-[10px] leading-[1.3] text-on-surface-variant">
              Akhiri sesi pada perangkat ini.
            </span>
          </span>
          <AppIcon name="chevron_right" className="icon-md shrink-0 leading-none text-error/70" />
        </motion.button>
      )}

      <ConfirmationDialog
        open={confirmOpen}
        title="Keluar dari akun?"
        description="Sesi pada perangkat ini akan berakhir. Anda perlu masuk kembali untuk menggunakan Paduna Build."
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
