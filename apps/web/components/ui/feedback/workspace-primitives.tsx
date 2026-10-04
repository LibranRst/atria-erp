"use client";

/**
 * Primitif untuk "configuration workspace" seperti yang dijelaskan di
 * MAIN_SURFACE_DESIGN_LANGUAGE.md: judul modul, label status, dan afordans baris.
 *
 * Sebelumnya tinggal di `features/settings` padahal administration dan
 * onboarding ikut memakainya — administration dirender DI DALAM settings
 * sekaligus meminjam primitif ini, sehingga terbentuk siklus antar-slice.
 * Tidak ada di sini yang menyentuh domain settings.
 */

import { motion, useReducedMotion } from "framer-motion";
import React from "react";
import { AppIcon } from "@/components/ui/icon/app-icon";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/badge/badge";
import { cn } from "@/lib/utils/cn";
import { buttonTapActiveScale, transitionSpringSnappy } from "@/lib/utils/motion";

export function WorkspaceModuleHeader({
  eyebrow,
  title,
  description,
  actionLabel,
  actionDisabled = false,
  onAction,
}: {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description: string;
  readonly actionLabel?: string;
  readonly actionDisabled?: boolean;
  readonly onAction?: () => void;
}): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  return (
    <header className="flex min-w-0 items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-eyebrow font-bold tracking-[0.14em] text-on-surface-variant/65 uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h2
          className={`${eyebrow ? "mt-1" : ""} text-[19px] leading-[1.12] font-semibold tracking-[-0.02em] text-on-surface`}
        >
          {title}
        </h2>
        <p className="mt-1 max-w-lg text-[11px] leading-[1.35] text-on-surface-variant">
          {description}
        </p>
      </div>
      {actionLabel && onAction ? (
        <motion.button
          type="button"
          disabled={actionDisabled}
          onClick={onAction}
          whileTap={reduceMotion ? undefined : { scale: buttonTapActiveScale }}
          transition={transitionSpringSnappy}
          className="relative inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-accent/8 px-3 text-meta font-semibold text-accent outline-none after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] focus-visible:ring-2 focus-visible:ring-focus-ring active:bg-accent/[0.14] active:shadow-raised active:z-10 disabled:opacity-35"
        >
          <AppIcon name="add" className="icon-xs" aria-hidden="true" />
          {actionLabel}
        </motion.button>
      ) : null}
    </header>
  );
}

export function WorkspaceStatusLabel({
  label,
  tone = "neutral",
  className,
}: {
  readonly label: string;
  readonly tone?: "positive" | "warning" | "critical" | "neutral" | "inactive" | "inverse";
  readonly className?: string;
}): React.JSX.Element {
  const badgeTone: StatusBadgeTone =
    tone === "positive"
      ? "healthy"
      : tone === "warning"
        ? "warning"
        : tone === "critical"
          ? "critical"
          : tone === "inactive"
            ? "inactive"
            : "neutral";
  return (
    <StatusBadge
      className={`${tone === "inverse" ? "bg-white/10 text-white/70" : ""} ${className ?? ""}`}
      tone={badgeTone}
      label={label}
    />
  );
}

export function WorkspaceRowChevron({ className }: { readonly className?: string } = {}): React.JSX.Element {
  return (
    <AppIcon
      name="chevron_right"
      className={cn("icon-md shrink-0 text-on-surface-variant/40", className)}
      aria-hidden="true"
    />
  );
}
