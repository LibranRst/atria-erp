"use client";

import React from "react";

import { PageState } from "@/components/ui";
function isRedirectError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const digest = (error as { readonly digest?: unknown }).digest;
  if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
    return true;
  }
  const message = (error as { readonly message?: unknown }).message;
  if (typeof message === "string" && message.includes("NEXT_REDIRECT")) {
    return true;
  }
  return false;
}

export default function AppError({
  error,
  reset,
}: {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}): React.JSX.Element | null {
  if (isRedirectError(error)) {
    return null;
  }

  return (
    <PageState
      kind="error"
      title="Halaman belum dapat dimuat"
      description="Data tidak diubah. Periksa koneksi lalu coba memuat ulang halaman ini."
      actionLabel="Coba Lagi"
      onAction={reset}
    />
  );
}
