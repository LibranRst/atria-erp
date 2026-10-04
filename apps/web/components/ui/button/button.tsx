"use client";

import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { DesktopButton } from "../desktop/desktop-controls";
import { buttonVariants } from "@heroui/styles";
import Link from "@/lib/navigation/workspace-link";
import React, { type ComponentPropsWithoutRef, type ReactNode } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

import { buttonTapActiveScale, transitionSpringSnappy } from "@/lib/utils/motion";
import { AppIcon } from "../icon/app-icon";
import { Tooltip } from "../overlay/anchored-surfaces";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "criticalQuiet" | "critical";
export type ButtonSize = "default" | "compact" | "mini";

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary shadow-primary focus-visible:ring-focus-ring active:shadow-raised",
  secondary:
    "bg-surface-container-lowest text-on-surface shadow-control ring-1 ring-ring-control focus-visible:ring-focus-ring active:shadow-raised",
  tertiary:
    "text-on-surface focus-visible:ring-focus-ring active:bg-surface-container-low active:shadow-control",
  criticalQuiet:
    "bg-critical-container text-critical focus-visible:ring-focus-ring active:shadow-raised",
  critical:
    "bg-critical text-on-critical shadow-primary focus-visible:ring-focus-ring active:shadow-raised",
};

const sizeClass: Record<ButtonSize, string> = {
  default: "min-h-12 px-5 text-xs",
  compact:
    "relative h-10 px-3 text-meta after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
  mini: "relative h-8 px-3 text-meta after:absolute after:inset-x-0 after:-inset-y-2 after:content-['']",
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
  const desktop = useWorkspacePresentation() === "desktop";
  if (desktop) {
    const accessibility = Object.fromEntries(
      Object.entries(props).filter(([key]) => key.startsWith("aria-") || key.startsWith("data-")),
    );
    return (
      <DesktopButton
        {...accessibility}
        id={props.id}
        type={props.type ?? "submit"}
        name={props.name}
        value={props.value === undefined ? undefined : String(props.value)}
        form={props.form}
        formAction={props.formAction}
        formMethod={props.formMethod}
        formNoValidate={props.formNoValidate}
        formTarget={props.formTarget}
        autoFocus={props.autoFocus}
        title={props.title}
        role={props.role}
        tabIndex={props.tabIndex}
        onClick={props.onClick}
        onFocus={props.onFocus}
        onBlur={props.onBlur}
        onKeyDown={props.onKeyDown}
        variant={variant}
        size={size}
        disabled={disabled}
        pending={pending}
        pendingLabel={pendingLabel}
        fullWidth={fullWidth}
        className={className}
      >
        {!pending && leadingIcon ? <span aria-hidden="true">{leadingIcon}</span> : null}
        <span>{accessibleChildren}</span>
        {!pending && trailingIcon ? <span aria-hidden="true">{trailingIcon}</span> : null}
      </DesktopButton>
    );
  }

  return (
    <motion.button
      {...props}
      disabled={disabled || pending}
      whileTap={{ scale: reduceMotion ? 1 : buttonTapActiveScale }}
      transition={transitionSpringSnappy}
      className={cn(
        `inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap outline-none focus-visible:ring-2 active:z-10 disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:cursor-not-allowed aria-disabled:opacity-45`,
        variantClass[variant],
        sizeClass[size],
        fullWidth ? "w-full" : "",
        className,
      )}
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
  const desktop = useWorkspacePresentation() === "desktop";
  const heroClasses = desktop
    ? buttonVariants({ variant: "primary", className: "atria-desktop-button" })
    : "";
  return (
    <Link
      {...props}
      data-atria-variant={desktop ? variant : undefined}
      aria-disabled={pending || props["aria-disabled"]}
      className={`${heroClasses} inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap transition duration-150 outline-none focus-visible:ring-2 active:z-10 active:scale-[1.05] active:shadow-raised ${variantClass[variant]} ${sizeClass[size]} ${fullWidth ? "w-full" : ""} ${pending ? "pointer-events-none opacity-45" : ""} ${className}`}
    >
      {!pending && leadingIcon ? <span aria-hidden="true">{leadingIcon}</span> : null}
      <span className="inline-flex items-center gap-2 whitespace-nowrap">{label}</span>
      {!pending && trailingIcon ? <span aria-hidden="true">{trailingIcon}</span> : null}
    </Link>
  );
}

/**
 * Ukuran tombol ikon.
 *
 * `compact` dipakai bilah mengambang yang menumpuk beberapa kontrol di lebar
 * ponsel; 48px bertiga plus judul terlalu padat di 375px. Ukurannya sendiri
 * 40px, tetapi pseudo-element melebarkan area sentuh kembali ke 48px sehingga
 * tetap memenuhi target sentuh yang diwajibkan panduan.
 */
const iconSizeClass: Record<ButtonSize, string> = {
  default: "h-12 w-12",
  compact: "relative h-10 w-10 after:absolute after:-inset-1 after:content-['']",
  mini: "relative h-8 w-8 after:absolute after:-inset-2 after:content-['']",
};

export type IconButtonProps = Omit<
  HTMLMotionProps<"button">,
  "children" | "ref" | "transition" | "whileTap"
> & {
  readonly label: string;
  readonly icon: ReactNode;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = "secondary", size = "default", className = "", ...props },
  ref,
): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const desktop = useWorkspacePresentation() === "desktop";
  const accessibility = Object.fromEntries(
    Object.entries(props).filter(([key]) => key.startsWith("aria-") || key.startsWith("data-")),
  );
  const control = desktop ? (
    <DesktopButton
      {...accessibility}
      ref={ref}
      id={props.id}
      type={props.type ?? "button"}
      aria-label={label}
      variant={variant}
      size={size}
      disabled={props.disabled}
      onClick={props.onClick}
      onFocus={props.onFocus}
      onBlur={props.onBlur}
      onKeyDown={props.onKeyDown}
      className={cn("min-h-0 px-0", iconSizeClass[size], className)}
    >
      <span aria-hidden="true">{icon}</span>
    </DesktopButton>
  ) : (
    <motion.button
      ref={ref}
      {...props}
      type={props.type ?? "button"}
      aria-label={label}
      whileTap={{ scale: reduceMotion ? 1 : buttonTapActiveScale }}
      transition={transitionSpringSnappy}
      className={cn(
        `inline-flex shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 active:z-10 active:shadow-raised disabled:cursor-not-allowed disabled:opacity-45 ${iconSizeClass[size]} ${variantClass[variant]}`,
        className,
      )}
    >
      <span aria-hidden="true">{icon}</span>
    </motion.button>
  );

  return (
    <Tooltip
      content={label}
      disabled={Boolean(
        props.disabled || props["aria-expanded"] === true || props["aria-expanded"] === "true",
      )}
    >
      {control}
    </Tooltip>
  );
});

export type IconButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  readonly label: string;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
};

/**
 * Kembaran `IconButton` yang benar-benar sebuah tautan.
 *
 * Bilah atas memuat dua kontrol bundar yang menuju rute lain: pintasan asisten
 * AI dan avatar. Keduanya butuh `href` sungguhan agar bisa dibuka di tab baru
 * dan terbaca sebagai navigasi, jadi keduanya tidak bisa memakai `IconButton` —
 * dan tanpa komponen ini keduanya menyalin sendiri kelas chrome-nya, persis
 * kebiasaan yang membuat dua bilah atas menyimpang satu sama lain.
 */
export function IconButtonLink({
  label,
  children,
  variant = "secondary",
  size = "default",
  className = "",
  ...props
}: IconButtonLinkProps): React.JSX.Element {
  const control = (
    <Link
      {...props}
      aria-label={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full transition duration-150 outline-none focus-visible:ring-2 active:z-10 active:scale-[1.05] active:shadow-raised ${iconSizeClass[size]} ${variantClass[variant]} ${className}`}
    >
      {children}
    </Link>
  );

  return (
    <Tooltip
      content={label}
      disabled={Boolean(
        props["aria-expanded"] === true ||
        props["aria-expanded"] === "true" ||
        props["aria-disabled"] === true ||
        props["aria-disabled"] === "true",
      )}
    >
      {control}
    </Tooltip>
  );
}

type SectionActionProps = {
  readonly label: string;
  readonly href?: string;
  readonly onClick?: () => void;
  readonly className?: string;
  readonly mode?: "default" | "text-only";
};

const defaultSectionActionClass =
  "relative inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-surface-container-low pl-3 pr-2.5 text-meta font-semibold text-on-surface-variant outline-none after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-surface-container transition duration-150 active:scale-[1.05] active:shadow-raised active:z-10";

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
      <span className="inline-flex items-center gap-2 whitespace-nowrap">{label}</span>
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
