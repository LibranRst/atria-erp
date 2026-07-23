"use client";

import React from "react";

import { PageState } from "@/components/ui/feedback/page-state";

export default function AppError({
  reset,
}: {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}): React.JSX.Element {
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
