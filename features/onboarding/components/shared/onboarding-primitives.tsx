"use client";

import { motion } from "framer-motion";
import React from "react";

import { transitionSpringSnappy } from "@/lib/utils/motion";
import { AppIcon } from "@/components/ui";
export function OnboardingStage({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return <div className="space-y-4">{children}</div>;
}

export function OnboardingSurface({
  children,
  className = "",
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <div
      className={`overflow-hidden rounded-[25px] bg-white/90 shadow-surface ring-1 ring-ring-subtle ${className}`}
    >
      {children}
    </div>
  );
}

export function OnboardingToolbar({
  title,
  detail,
  actionLabel,
  onAction,
  disabled = false,
}: {
  readonly title: string;
  readonly detail: string;
  readonly actionLabel: string;
  readonly onAction: () => void;
  readonly disabled?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 px-1">
      <span className="min-w-0">
        <span className="block text-[13px] leading-5 font-bold text-on-surface">{title}</span>
        <span className="mt-0.5 block text-[9px] leading-4 text-on-surface-variant">{detail}</span>
      </span>
      <motion.button
        type="button"
        disabled={disabled}
        onClick={onAction}
        whileTap={disabled ? undefined : { scale: 0.97 }}
        transition={transitionSpringSnappy}
        className="relative min-h-10 shrink-0 rounded-full bg-accent/8 px-3.5 text-[10px] font-bold text-accent outline-none after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-40"
      >
        {actionLabel}
      </motion.button>
    </div>
  );
}

export function OnboardingEmpty({
  icon,
  title,
  detail,
}: {
  readonly icon: string;
  readonly title: string;
  readonly detail: string;
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center px-5 py-7 text-center">
      <AppIcon name={icon} className="text-[26px] text-on-surface-variant/45" />
      <p className="mt-2 text-[12px] font-bold text-on-surface">{title}</p>
      <p className="mx-auto mt-1 max-w-68 text-meta text-on-surface-variant">{detail}</p>
    </div>
  );
}

export function OnboardingNotice({
  icon = "info",
  children,
  tone = "neutral",
}: {
  readonly icon?: string;
  readonly children: React.ReactNode;
  readonly tone?: "neutral" | "warning" | "positive";
}): React.JSX.Element {
  const toneClass =
    tone === "warning"
      ? "bg-warning/8 text-warning"
      : tone === "positive"
        ? "bg-success/8 text-success"
        : "bg-surface-container-high/30 text-on-surface-variant";
  return (
    <div className={`flex items-start gap-2.5 rounded-[20px] px-3.5 py-3 ${toneClass}`}>
      <AppIcon name={icon} className="mt-0.5 icon-sm shrink-0" />
      <p className="text-meta">{children}</p>
    </div>
  );
}
