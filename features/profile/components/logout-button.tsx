"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

export function LogoutButton(): React.JSX.Element {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const router = useRouter();

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await authClient.signOut();
      toast.success("Berhasil keluar dari sistem.");
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Gagal melakukan keluar sistem:", error);
      toast.error("Gagal keluar dari sistem. Silakan coba lagi.");
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-critical px-6 text-sm font-bold text-on-error shadow-[0_12px_28px_rgba(180,35,24,0.18)] transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100"
    >
      {isLoading ? (
        <>Memproses keluar…</>
      ) : (
        <>
          <LogOut className="h-4 w-4" />
          Keluar Sistem
        </>
      )}
    </button>
  );
}
