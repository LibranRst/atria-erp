"use client";

import Link from "next/link";
import React, { type ComponentPropsWithoutRef, type ReactNode } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

import { transitionSpringSnappy } from "@/lib/utils/motion";
import { AppIcon } from "../icon/app-icon";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "criticalQuiet" | "critical";
export type ButtonSize = "default" | "compact";

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary shadow-primary focus-visible:ring-focus-ring",
  secondary:
    "bg-surface-container-lowest text-on-surface shadow-control ring-1 ring-ring-control focus-visible:ring-focus-ring",
  tertiary: "text-on-surface focus-visible:ring-focus-ring active:bg-surface-container-low",
  criticalQuiet: "bg-critical-container text-critical focus-visible:ring-focus-ring",
  critical: "bg-critical text-on-critical shadow-primary focus-visible:ring-focus-ring",
};

const sizeClass: Record<ButtonSize, string> = {
  default: "min-h-12 px-5 text-xs",
  compact:
    "relative h-10 px-3 text-meta after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
};

type SharedButtonProps = {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly fullWidth?: boolean;
  readonly leadingIcon?: ReactNode;
  readonly trailingIcon?: ReactNode;
  readonly pending?: boolean;
  readonly pendingLabel?: string;
};

export type ButtonProps = Omit<
  HTMLMotionProps<"button">,
  "children" | "ref" | "transition" | "whileTap"
> &
  SharedButtonProps & {
    readonly children?: ReactNode;
  };

/**
 * Tombol yang dinonaktifkan lewat atribut `disabled` keluar dari urutan fokus,
 * sehingga pengguna keyboard dan pembaca layar tidak pernah menemukannya —
 * apalagi alasan penolakannya. Karena itu pemanggil yang menyertakan alasan
 * memakai `aria-disabled`, dan gaya redupnya ikut mengenali varian itu.
 */
export function Button({
  children,
  className = "",
  variant = "primary",
  size = "default",
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  pending = false,
  pendingLabel = "Memproses…",
  disabled,
  ...props
}: ButtonProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const accessibleChildren = pending ? pendingLabel : children;

  return (
    <motion.button
      {...props}
      disabled={disabled || pending}
      whileTap={{ scale: reduceMotion ? 1 : 0.97 }}
      transition={transitionSpringSnappy}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:cursor-not-allowed aria-disabled:opacity-45 ${variantClass[variant]} ${sizeClass[size]} ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {!pending && leadingIcon ? <span aria-hidden="true">{leadingIcon}</span> : null}
      <span>{accessibleChildren}</span>
      {!pending && trailingIcon ? <span aria-hidden="true">{trailingIcon}</span> : null}
    </motion.button>
  );
}

export type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & SharedButtonProps;

export function ButtonLink({
  children,
  className = "",
  variant = "tertiary",
  size = "default",
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  pending = false,
  pendingLabel = "Memproses…",
  ...props
}: ButtonLinkProps): React.JSX.Element {
  const label = pending ? pendingLabel : children;
  return (
    <Link
      {...props}
      aria-disabled={pending || props["aria-disabled"]}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap outline-none focus-visible:ring-2 ${variantClass[variant]} ${sizeClass[size]} ${fullWidth ? "w-full" : ""} ${pending ? "pointer-events-none opacity-45" : ""} ${className}`}
    >
      {!pending && leadingIcon ? <span aria-hidden="true">{leadingIcon}</span> : null}
      <span>{label}</span>
      {!pending && trailingIcon ? <span aria-hidden="true">{trailingIcon}</span> : null}
    </Link>
  );
}

export type IconButtonProps = Omit<
  HTMLMotionProps<"button">,
  "children" | "ref" | "transition" | "whileTap"
> & {
  readonly label: string;
  readonly icon: ReactNode;
  readonly variant?: Exclude<ButtonVariant, "tertiary">;
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = "secondary", className = "", ...props },
  ref,
): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  return (
    <motion.button
      ref={ref}
      {...props}
      type={props.type ?? "button"}
      aria-label={label}
      title={label}
      whileTap={{ scale: reduceMotion ? 1 : 0.97 }}
      transition={transitionSpringSnappy}
      className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-45 ${variantClass[variant]} ${className}`}
    >
      <span aria-hidden="true">{icon}</span>
    </motion.button>
  );
});

type SectionActionProps = {
  readonly label: string;
  readonly href?: string;
  readonly onClick?: () => void;
  readonly className?: string;
  readonly mode?: "default" | "text-only";
};

const defaultSectionActionClass =
  "relative inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-surface-container-low pl-3 pr-2.5 text-meta font-semibold text-on-surface-variant outline-none after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-surface-container";

export function SectionAction({
  label,
  href,
  onClick,
  className = "",
  mode = "default",
}: SectionActionProps): React.JSX.Element {
  const sectionActionClass =
    mode === "default"
      ? defaultSectionActionClass
      : "text-support relative inline-flex gap-1 items-center shrink-0 text-on-surface-variant font-semibold";

  const content = (
    <>
      <span>{label}</span>
      {mode === "default" && <AppIcon name="chevron_right" className="h-3.5 w-3.5 shrink-0" />}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`${sectionActionClass} ${className}`}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={`${sectionActionClass} ${className}`}>
      {content}
    </button>
  );
}
