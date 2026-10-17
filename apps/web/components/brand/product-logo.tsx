/**
 * THESIS: the approved Temu artwork identifies this product without competing with its workflows.
 * OWN-WORLD: outlined Manrope, terracotta Temu, ink wordmark; existing shared Operate surfaces.
 * STORY: recognize Paduna, then sign in or navigate within Paduna Build.
 * FIRST VIEWPORT: approved Paduna logo at 176px on login and 152px in the sidebar.
 * FORM: narrow extension of established surfaces, with user-selected artwork; no concept seed.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
 */
import Image from "next/image";
import type { JSX } from "react";

export function ProductLogo({
  compact = false,
  priority = false,
}: {
  readonly compact?: boolean;
  readonly priority?: boolean;
}): JSX.Element {
  return (
    <Image
      src="/brand/paduna.svg"
      alt="Paduna"
      width={1647}
      height={376}
      className={compact ? "h-auto w-38 max-w-full" : "h-auto w-44 max-w-full"}
      priority={priority}
      draggable={false}
    />
  );
}
