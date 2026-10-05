"use client";

import NextLink from "next/link";
import { useWorkspaceHref } from "@/lib/navigation/workspace-presentation";

export default function WorkspaceLink(
  props: React.ComponentProps<typeof NextLink>,
): React.JSX.Element {
  const mapHref = useWorkspaceHref();
  const href = typeof props.href === "string" ? mapHref(props.href) : props.href;
  return <NextLink {...props} href={href} />;
}
