"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Loader2, LogOut } from "lucide-react";

export function LogoutButton(): React.JSX.Element {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const router = useRouter();

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await authClient.signOut();
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Gagal melakukan keluar sistem:", error);
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-critical text-sm font-semibold text-text-primary shadow-lg transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 cursor-pointer"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Memproses Keluar...
        </>
      ) : (
        <>
          <LogOut className="h-4 w-4" />
          Keluar Sistem
        </>
      )}
    </button>
  );
}
