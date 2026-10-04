"use client";

import React from "react";
import { Link as HeroLink } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { useWorkspaceHref } from "@/lib/navigation/workspace-presentation";
import type { ButtonVariant } from "../button/button";

export type DesktopButtonLinkProps = Omit<
  React.ComponentProps<typeof HeroLink>,
  "className" | "children"
> & {
  readonly href: string;
  readonly children: React.ReactNode;
  readonly leadingIcon?: React.ReactNode;
  readonly variant?: ButtonVariant;
  readonly className?: string;
};

export function DesktopButtonLink({
  href,
  children,
  leadingIcon,
  variant = "secondary",
  className,
  ...props
}: DesktopButtonLinkProps): React.JSX.Element {
  const mapHref = useWorkspaceHref();
  return (
    <HeroLink
      {...props}
      href={mapHref(href)}
      data-atria-variant={variant}
      className={buttonVariants({
        variant: "primary",
        className: `atria-desktop-button inline-flex shrink-0 items-center gap-2 whitespace-nowrap no-underline ${className ?? ""}`,
      })}
    >
      {leadingIcon ? <HeroLink.Icon className="shrink-0">{leadingIcon}</HeroLink.Icon> : null}
      <span className="inline-flex min-w-0 items-center gap-2 whitespace-nowrap">{children}</span>
    </HeroLink>
  );
}
