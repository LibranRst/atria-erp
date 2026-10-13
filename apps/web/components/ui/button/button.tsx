"use client";

import { useWorkspaceControlPresentation } from "@/lib/navigation/workspace-presentation";
import { DesktopButton, desktopButtonClasses } from "../desktop/desktop-controls";
import Link from "@/lib/navigation/workspace-link";
import React, { type ComponentPropsWithoutRef, type ReactNode } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

import { buttonTapActiveScale, transitionSpringSnappy } from "@/lib/utils/motion";
import { AppIcon } from "../icon/app-icon";
import { Tooltip } from "../overlay/anchored-surfaces";
import { cn } from "@/lib/utils/cn";

const MotionWorkspaceLink = motion.create(Link);

function ButtonNavigation({
  desktop,
  ...props
}: ComponentPropsWithoutRef<typeof Link> & { readonly desktop: boolean }): React.JSX.Element {
  const reduced = useReducedMotion();
  if (!desktop) return <Link {...props} />;
  return (
    <MotionWorkspaceLink
      {...props}
      onAnimationStart={undefined}
      onDrag={undefined}
      onDragStart={undefined}
      onDragEnd={undefined}
      whileTap={{
        scale:
          reduced || props["aria-disabled"] === true || props["aria-disabled"] === "true"
            ? 1
            : buttonTapActiveScale,
      }}
      transition={reduced ? { duration: 0 } : transitionSpringSnappy}
    />
  );
}

export type ButtonVariant =
  "primary" | "secondary" | "tertiary" | "quiet" | "criticalQuiet" | "critical";
export type ButtonSize = "default" | "compact" | "mini";

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary shadow-primary focus-visible:ring-focus-ring active:shadow-raised",
  secondary:
    "bg-surface-container-lowest text-on-surface shadow-control ring-1 ring-ring-control focus-visible:ring-focus-ring active:shadow-raised",
  tertiary:
    "bg-surface-container-lowest text-on-surface shadow-control focus-visible:ring-focus-ring active:bg-surface-container-low active:shadow-raised",
  quiet:
    "bg-surface-container-low text-on-surface shadow-control focus-visible:ring-focus-ring active:bg-surface-container active:shadow-raised",
  criticalQuiet:
    "bg-critical-container text-critical shadow-control focus-visible:ring-focus-ring active:shadow-raised",
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
    readonly ref?: React.Ref<HTMLButtonElement>;
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
  ref,
  ...props
}: ButtonProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const accessibleChildren = pending ? pendingLabel : children;
  const pressBlocked =
    disabled || pending || props["aria-disabled"] === true || props["aria-disabled"] === "true";
  const desktop = useWorkspaceControlPresentation() === "desktop";
  const selectionRole = props.role === "checkbox" || props.role === "radio";
  // React Aria's action Button owns role=button. Selection widgets retain native
  // semantics while reusing the same desktop visual classes and motion contract.
  if (desktop && !selectionRole) {
    const accessibility = Object.fromEntries(
      Object.entries(props).filter(([key]) => key.startsWith("aria-") || key.startsWith("data-")),
    );
    return (
      <DesktopButton
        {...accessibility}
        ref={ref}
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
        <span className="inline-flex min-w-0 items-center justify-center gap-2">
          {accessibleChildren}
        </span>
        {!pending && trailingIcon ? <span aria-hidden="true">{trailingIcon}</span> : null}
      </DesktopButton>
    );
  }

  return (
    <motion.button
      {...props}
      ref={ref}
      data-atria-variant={desktop ? variant : undefined}
      data-atria-size={desktop ? size : undefined}
      disabled={disabled || pending}
      whileTap={{ scale: reduceMotion || pressBlocked ? 1 : buttonTapActiveScale }}
      transition={transitionSpringSnappy}
      className={
        desktop
          ? desktopButtonClasses({ variant, size, className: cn(fullWidth && "w-full", className) })
          : cn(
              `inline-flex min-w-0 items-center justify-center gap-2 rounded-full text-center font-bold whitespace-normal outline-none focus-visible:ring-2 active:z-10 disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:cursor-not-allowed aria-disabled:opacity-45`,
              variantClass[variant],
              sizeClass[size],
              fullWidth ? "w-full" : "",
              className,
            )
      }
    >
      {!pending && leadingIcon ? <span aria-hidden="true">{leadingIcon}</span> : null}
      <span className="inline-flex min-w-0 items-center justify-center gap-2">
        {accessibleChildren}
      </span>
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
  const desktop = useWorkspaceControlPresentation() === "desktop";
  const heroClasses = desktop ? desktopButtonClasses({ variant, size }) : "";
  return (
    <ButtonNavigation
      desktop={desktop}
      {...props}
      data-atria-variant={desktop ? variant : undefined}
      data-atria-size={desktop ? size : undefined}
      aria-disabled={pending || props["aria-disabled"]}
      className={`${heroClasses} inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap outline-none focus-visible:ring-2 active:z-10 active:shadow-raised ${desktop ? "" : `transition duration-150 active:scale-[1.05] ${variantClass[variant]} ${sizeClass[size]}`} ${fullWidth ? "w-full" : ""} ${pending ? "pointer-events-none opacity-45" : ""} ${className}`}
    >
      {!pending && leadingIcon ? <span aria-hidden="true">{leadingIcon}</span> : null}
      <span className="inline-flex items-center gap-2 whitespace-nowrap">{label}</span>
      {!pending && trailingIcon ? <span aria-hidden="true">{trailingIcon}</span> : null}
    </ButtonNavigation>
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
  const desktop = useWorkspaceControlPresentation() === "desktop";
  const pressBlocked =
    props.disabled || props["aria-disabled"] === true || props["aria-disabled"] === "true";
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
      isIconOnly
      disabled={props.disabled}
      onClick={props.onClick}
      onFocus={props.onFocus}
      onBlur={props.onBlur}
      onKeyDown={props.onKeyDown}
      className={className}
    >
      <span aria-hidden="true">{icon}</span>
    </DesktopButton>
  ) : (
    <motion.button
      ref={ref}
      {...props}
      type={props.type ?? "button"}
      aria-label={label}
      whileTap={{ scale: reduceMotion || pressBlocked ? 1 : buttonTapActiveScale }}
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
  const desktop = useWorkspaceControlPresentation() === "desktop";
  const control = (
    <ButtonNavigation
      desktop={desktop}
      {...props}
      aria-label={label}
      data-atria-variant={desktop ? variant : undefined}
      data-atria-size={desktop ? size : undefined}
      className={`${desktop ? desktopButtonClasses({ variant, size, isIconOnly: true }) : `transition duration-150 active:scale-[1.05] ${iconSizeClass[size]} ${variantClass[variant]}`} inline-flex shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 active:z-10 active:shadow-raised ${className}`}
    >
      {children}
    </ButtonNavigation>
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
  const desktop = useWorkspaceControlPresentation() === "desktop";
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

  if (desktop && mode === "default") {
    if (href)
      return (
        <ButtonLink href={href} size="compact" variant="tertiary" className={className}>
          {content}
        </ButtonLink>
      );
    return (
      <Button
        type="button"
        onClick={onClick}
        size="compact"
        variant="tertiary"
        className={className}
      >
        {content}
      </Button>
    );
  }

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
