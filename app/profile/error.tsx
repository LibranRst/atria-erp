"use client";

import { RoutePageError } from "@/components/ui";

export default function ProfileError({ reset }: { readonly reset: () => void }): React.JSX.Element {
  return <RoutePageError reset={reset} />;
}
