"use client";

import { motion } from "framer-motion";
import React from "react";

import { transitionSpringSnappy } from "@/lib/utils/motion";

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
      className={`overflow-hidden rounded-[25px] bg-white/90 shadow-[0_1px_2px_rgba(17,17,17,0.02),0_12px_30px_rgba(17,17,17,0.045)] ring-1 ring-black/2.5 ${className}`}
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
        <span className="text-on-surface block text-[13px] leading-5 font-bold">{title}</span>
        <span className="text-on-surface-variant mt-0.5 block text-[9px] leading-4">{detail}</span>
      </span>
      <motion.button
        type="button"
        disabled={disabled}
        onClick={onAction}
        whileTap={disabled ? undefined : { scale: 0.97 }}
        transition={transitionSpringSnappy}
        className="relative min-h-10 shrink-0 rounded-full bg-[#007AFF]/8 px-3.5 text-[10px] font-bold text-[#007AFF] outline-none after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] focus-visible:ring-2 focus-visible:ring-[#007AFF]/25 disabled:opacity-40"
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
    <div className="px-5 py-7 text-center">
      <span
        className="material-symbols-outlined text-on-surface-variant/45 text-[26px]"
        aria-hidden="true"
      >
        {icon}
      </span>
      <p className="text-on-surface mt-2 text-[12px] font-bold">{title}</p>
      <p className="text-on-surface-variant mx-auto mt-1 max-w-68 text-[10px] leading-4">
        {detail}
      </p>
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
        : "bg-surface-container-low text-on-surface-variant";
  return (
    <div className={`flex items-start gap-2.5 rounded-[20px] px-3.5 py-3 ${toneClass}`}>
      <span className="material-symbols-outlined mt-0.5 shrink-0 text-[16px]" aria-hidden="true">
        {icon}
      </span>
      <p className="text-[10px] leading-4">{children}</p>
    </div>
  );
}
