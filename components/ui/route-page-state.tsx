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
  reset,
}: {
  readonly reset: () => void;
}): React.JSX.Element {
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
