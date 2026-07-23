"use client";

import { ChevronRight, Plus } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import React from "react";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/badge/badge";

import { transitionSpringSnappy } from "@/lib/utils/motion";

export function SettingsModuleHeader({
  eyebrow,
  title,
  description,
  actionLabel,
  actionDisabled = false,
  onAction,
}: {
  readonly eyebrow: string;
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
        <p className="text-[9px] font-bold tracking-[0.14em] text-on-surface-variant/65 uppercase">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-[19px] leading-[1.12] font-semibold tracking-[-0.02em] text-on-surface">
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
          whileTap={reduceMotion ? undefined : { scale: 0.96 }}
          transition={transitionSpringSnappy}
          className="relative inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-accent/8 px-3 text-[10px] font-semibold text-accent outline-none after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] focus-visible:ring-2 focus-visible:ring-accent/30 active:bg-accent/[0.14] disabled:opacity-35"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {actionLabel}
        </motion.button>
      ) : null}
    </header>
  );
}

export function SettingsGroupSurface({
  children,
  className = "",
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <div
      className={`overflow-hidden rounded-[26px] bg-white/90 shadow-[0_1px_2px_rgba(17,17,17,0.025),0_14px_34px_rgba(17,17,17,0.055)] ring-1 ring-black/2.5 max-[430px]:rounded-3xl ${className}`}
    >
      {children}
    </div>
  );
}

export function SettingsStatusLabel({
  label,
  tone = "neutral",
  className,
}: {
  readonly label: string;
  readonly tone?: "positive" | "warning" | "critical" | "neutral" | "inactive" | "inverse";
  readonly className?: string;
}): React.JSX.Element {
  const badgeTone: StatusBadgeTone =
    tone === "positive" ? "healthy" : tone === "warning" ? "warning" : tone === "critical" ? "critical" : tone === "inactive" ? "inactive" : "neutral";
  return <StatusBadge className={`${tone === "inverse" ? "bg-white/10 text-white/70" : ""} ${className ?? ""}`} tone={badgeTone} label={label} />;
}

export function SettingsRowChevron(): React.JSX.Element {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-accent"
      aria-hidden="true"
    >
      <ChevronRight className="h-4 w-4" />
    </span>
  );
}
