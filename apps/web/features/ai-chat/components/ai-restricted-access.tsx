"use client";

import { ButtonLink, PageState } from "@/components/ui";
import { TOP_BAR_INSET_PX } from "@/components/layout/app-top-bar";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";

/** Permission denial uses the same header clearance as the permitted chat canvas. */
export function AiRestrictedAccess(): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  return (
    <section
      className={`mx-auto max-w-2xl space-y-3 pb-6 ${desktop ? "px-6" : "px-margin-mobile"}`}
      style={{ paddingTop: desktop ? 16 : TOP_BAR_INSET_PX }}
    >
      <PageState
        kind="restricted"
        title="Asisten AI belum tersedia untuk akun ini"
        description="Peran Anda belum memiliki akses Asisten AI. Minta Owner atau pengelola peran memeriksa izin akun Anda."
        compact
      />
      <div className="flex justify-center">
        <ButtonLink href="/profile" variant="secondary">
          Buka profil saya
        </ButtonLink>
      </div>
    </section>
  );
}
