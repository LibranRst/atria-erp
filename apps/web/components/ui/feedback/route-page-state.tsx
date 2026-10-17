"use client";

import React from "react";

import { PageState } from "./page-state";

export function RoutePageLoading(): React.JSX.Element {
  return (
    <PageState
      kind="loading"
      title="Menyiapkan data"
      description="Ringkasan dan status operasional sedang diselaraskan."
      compact
    />
  );
}

export function RoutePageError({
  error,
  reset,
}: {
  readonly error?: Error & { readonly digest?: string };
  readonly reset: () => void;
}): React.JSX.Element | null {
  if (error?.digest?.startsWith("NEXT_REDIRECT") || error?.message?.includes("NEXT_REDIRECT")) {
    return null;
  }

  return (
    <PageState
      kind="error"
      title="Halaman belum dapat dimuat"
      description="Data Anda tidak berubah. Coba muat ulang halaman ini."
      actionLabel="Coba lagi"
      onAction={reset}
    />
  );
}
