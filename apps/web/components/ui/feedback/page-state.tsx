"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { fadeVariants, transitionSpringSnappy } from "@/lib/utils/motion";
import { DuotoneIconTile } from "@/components/ui/icon/icon-tile";
import { AppIcon } from "@/components/ui/icon/app-icon";

export type PageStateTone = "neutral" | "info" | "success" | "warning" | "critical";

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

const STATE_META: Record<PageStateKind, { readonly icon: string; readonly tone: PageStateTone }> = {
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
  if (tone === "success") return "bg-surface-container-low text-on-surface";
  if (tone === "info") return "bg-surface-container-low text-on-surface";
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
      className={`rounded-owner bg-white text-center ring-1 ring-ring-subtle ${
        compact ? "px-4 py-6" : "px-6 py-12"
      } ${className}`}
      role={kind === "error" || kind === "restricted" ? "alert" : "status"}
    >
      <DuotoneIconTile
        name={meta.icon}
        tone={
          meta.tone === "critical" ? "critical" : meta.tone === "warning" ? "attention" : "neutral"
        }
        className={`mx-auto ${toneClasses(meta.tone)} ${compact ? "h-10 w-10" : "h-14 w-14"}`}
        iconClassName={compact ? "h-5 w-5" : "h-6.5 w-6.5"}
        aria-hidden="true"
      />
      <h2 className={`${compact ? "mt-3 text-sm" : "mt-5 text-lg"} font-semibold text-on-surface`}>
        {title}
      </h2>
      <p
        className={`mx-auto max-w-xs text-on-surface-variant ${compact ? "mt-1 text-xs leading-5" : "mt-2 text-sm leading-6"}`}
      >
        {description}
      </p>
      {actionLabel && onAction ? (
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          transition={transitionSpringSnappy}
          onClick={onAction}
          className="mt-5 min-h-12 rounded-full bg-primary px-6 text-xs font-bold text-on-primary outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
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
          className="fixed inset-x-0 top-16 z-40 mx-auto flex w-[calc(100%-2.5rem)] max-w-sm items-center gap-2 rounded-full bg-warning px-4 py-2 text-support font-bold text-white shadow-raised"
        >
          <AppIcon name="cloud_off" className="text-[17px]" />
          Mode offline · data tetap dapat dibaca, perubahan ditahan.
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
