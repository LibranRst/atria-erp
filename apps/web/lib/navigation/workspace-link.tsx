"use client";

import NextLink from "next/link";
import { useWorkspaceHref } from "@/lib/navigation/workspace-presentation";
import { shallowQueryHref } from "@/lib/navigation/workspace-routes";
import { updateBrowserUrl } from "@/lib/utils/use-url-search-param";

type NavigateEvent = Parameters<
  NonNullable<React.ComponentProps<typeof NextLink>["onNavigate"]>
>[0];

export default function WorkspaceLink({
  onNavigate,
  ...props
}: React.ComponentProps<typeof NextLink>): React.JSX.Element {
  const mapHref = useWorkspaceHref();
  const href = typeof props.href === "string" ? mapHref(props.href) : props.href;

  function handleNavigate(event: NavigateEvent): void {
    let prevented = false;
    onNavigate?.({
      preventDefault: (): void => {
        prevented = true;
        event.preventDefault();
      },
    });
    if (prevented || typeof href !== "string") return;
    // Query-only change on a client-read route: same page data, no RSC round-trip.
    const shallowHref = shallowQueryHref(href, window.location.href);
    if (shallowHref === null) return;
    event.preventDefault();
    updateBrowserUrl(shallowHref, props.replace ? "replace" : "push");
    if (props.scroll !== false) window.scrollTo({ top: 0, behavior: "auto" });
  }

  return <NextLink {...props} href={href} onNavigate={handleNavigate} />;
}
