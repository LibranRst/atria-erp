"use client";

import { useEffect } from "react";
import { ButtonLink, PageState } from "@/components/ui";
import { legacyWorkspaceRedirectHref } from "@/lib/navigation/legacy-workspace-redirect";

/** A client bridge captures the fragment that Next/RSC redirects cannot receive. */
export function LegacyWorkspaceRedirect({
  canonicalHref,
}: {
  readonly canonicalHref: string;
}): React.JSX.Element {
  const fallback = legacyWorkspaceRedirectHref(canonicalHref, "");
  useEffect(() => {
    const destination = legacyWorkspaceRedirectHref(canonicalHref, window.location.hash);
    if (destination) window.location.replace(destination);
  }, [canonicalHref]);

  return (
    <div className="space-y-3">
      <PageState
        kind="syncing"
        title="Membuka halaman Paduna Build"
        description="Halaman dan filter Anda tetap dipertahankan."
        compact
      />
      <div className="flex justify-center">
        <ButtonLink href={fallback ?? "/"} variant="secondary">
          Buka halaman
        </ButtonLink>
      </div>
    </div>
  );
}
