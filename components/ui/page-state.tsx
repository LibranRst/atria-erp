"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { fadeVariants, transitionSpringSnappy } from "@/lib/utils/motion";

export type PageStateTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "critical";

export type PageStateKind =
  | "loading"
  | "first-use"
  | "filtered-empty"
  | "partial"
  | "error"
  | "restricted"
  | "offline"
  | "syncing"
  | "stale"
  | "success"
  | "warning"
  | "critical";

type PageStateProps = {
  readonly kind: PageStateKind;
  readonly title: string;
  readonly description: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly compact?: boolean;
  readonly className?: string;
};

const STATE_META: Record<
  PageStateKind,
  { readonly icon: string; readonly tone: PageStateTone }
> = {
  loading: { icon: "progress_activity", tone: "neutral" },
  "first-use": { icon: "add_circle", tone: "info" },
  "filtered-empty": { icon: "filter_alt_off", tone: "neutral" },
  partial: { icon: "data_alert", tone: "warning" },
  error: { icon: "error", tone: "critical" },
  restricted: { icon: "lock", tone: "critical" },
  offline: { icon: "cloud_off", tone: "warning" },
  syncing: { icon: "sync", tone: "info" },
  stale: { icon: "history", tone: "warning" },
  success: { icon: "check_circle", tone: "success" },
  warning: { icon: "warning", tone: "warning" },
  critical: { icon: "priority_high", tone: "critical" },
};

function toneClasses(tone: PageStateTone): string {
  if (tone === "critical") return "bg-error-container/35 text-error";
  if (tone === "warning") return "bg-warning-light text-warning";
  if (tone === "success") return "bg-success-light text-success";
  if (tone === "info") return "bg-deep-teal-soft text-deep-teal";
  return "bg-surface-container text-on-surface-variant";
}

export function PageState({
  kind,
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
  className = "",
}: PageStateProps): React.JSX.Element {
  const meta = STATE_META[kind];

  return (
    <section
      className={`rounded-[28px] border border-outline-variant/15 bg-white text-center shadow-[0_14px_34px_rgba(17,17,17,0.04)] ${
        compact ? "px-4 py-6" : "px-6 py-12"
      } ${className}`}
      role={kind === "error" || kind === "restricted" ? "alert" : "status"}
    >
      <span
        className={`mx-auto flex items-center justify-center rounded-full ${toneClasses(meta.tone)} ${compact ? "h-10 w-10" : "h-14 w-14"}`}
        aria-hidden="true"
      >
        <span className={`material-symbols-outlined ${compact ? "text-[20px]" : "text-[26px]"}`}>
          {meta.icon}
        </span>
      </span>
      <h2 className={`${compact ? "mt-3 text-sm" : "mt-5 text-lg"} font-semibold text-on-surface`}>
        {title}
      </h2>
      <p className={`mx-auto max-w-xs text-on-surface-variant ${compact ? "mt-1 text-xs leading-5" : "mt-2 text-sm leading-6"}`}>
        {description}
      </p>
      {actionLabel && onAction ? (
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          transition={transitionSpringSnappy}
          onClick={onAction}
          className="mt-5 min-h-12 rounded-full bg-primary px-6 text-xs font-bold text-on-primary outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          {actionLabel}
        </motion.button>
      ) : null}
    </section>
  );
}

export function ConnectivityBanner(): React.JSX.Element | null {
  const [online, setOnline] = React.useState(true);

  React.useEffect(() => {
    const update = (): void => setOnline(window.navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <AnimatePresence>
      {!online ? (
        <motion.div
          variants={fadeVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          role="status"
          className="fixed inset-x-0 top-16 z-40 mx-auto flex w-[calc(100%-2.5rem)] max-w-sm items-center gap-2 rounded-full bg-warning px-4 py-2 text-[11px] font-bold text-white shadow-lg"
        >
          <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
            cloud_off
          </span>
          Mode offline · data tetap dapat dibaca, perubahan ditahan.
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
