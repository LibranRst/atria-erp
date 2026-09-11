"use client";

import React from "react";

import { RoutePageError } from "@/components/ui";

export default function OwnerQuickStartError({
  error,
  reset,
}: {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}): React.JSX.Element | null {
  return <RoutePageError error={error} reset={reset} />;
}
