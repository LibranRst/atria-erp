"use client";

import React from "react";
import { Link as HeroLink } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { motion, useReducedMotion } from "framer-motion";
import { buttonTapActiveScale, transitionSpringSnappy } from "@/lib/utils/motion";
import { useWorkspaceHref } from "@/lib/navigation/workspace-presentation";
import type { ButtonSize, ButtonVariant } from "../button/button";
import { desktopButtonSize, desktopButtonVariant } from "./desktop-controls";

const MotionHeroLink = motion.create(HeroLink);

export type DesktopButtonLinkProps = Omit<
  React.ComponentProps<typeof HeroLink>,
  | "className"
  | "children"
  | "onAnimationStart"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onHoverStart"
  | "onHoverEnd"
  | "style"
> & {
  readonly href: string;
  readonly children: React.ReactNode;
  readonly leadingIcon?: React.ReactNode;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly className?: string;
  readonly style?: React.CSSProperties;
};

export function DesktopButtonLink({
  href,
  children,
  leadingIcon,
  variant = "secondary",
  size = "default",
  className,
  ...props
}: DesktopButtonLinkProps): React.JSX.Element {
  const mapHref = useWorkspaceHref();
  const reducedMotion = useReducedMotion();
  return (
    <MotionHeroLink
      {...props}
      whileTap={{ scale: reducedMotion || props.isDisabled ? 1 : buttonTapActiveScale }}
      transition={reducedMotion ? { duration: 0 } : transitionSpringSnappy}
      href={mapHref(href)}
      data-atria-variant={variant}
      data-atria-size={size}
      className={buttonVariants({
        variant: desktopButtonVariant[variant],
        size: desktopButtonSize[size],
        className: `atria-desktop-button inline-flex shrink-0 items-center gap-2 whitespace-nowrap no-underline ${className ?? ""}`,
      })}
    >
      {leadingIcon ? <HeroLink.Icon className="shrink-0">{leadingIcon}</HeroLink.Icon> : null}
      <span className="inline-flex min-w-0 items-center gap-2 whitespace-nowrap">{children}</span>
    </MotionHeroLink>
  );
}
