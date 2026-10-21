"use client";
import * as React from "react";
import { AppIcon } from "@/components/ui";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { spinAnimation, transitionSpinLinear, transitionSpringSnappy } from "@/lib/utils/motion";
import type { ActivityState } from "../utils/activity-summary";
import { waitingDuration } from "../utils/activity-summary";

export function ActivityMark({
  state,
  compact = false,
}: {
  readonly state: ActivityState;
  readonly compact?: boolean;
}): React.JSX.Element {
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = React.useState(true);
  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) =>
      setVisible(entries[0]?.isIntersecting ?? false),
    );
    observer.observe(node);
    const read = (): void => {
      if (document.hidden) setVisible(false);
      else {
        const rect = node.getBoundingClientRect();
        setVisible(rect.bottom >= 0 && rect.top <= window.innerHeight);
      }
    };
    document.addEventListener("visibilitychange", read);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", read);
    };
  }, []);
  const running = state === "running";
  return (
    <span
      ref={ref}
      className={
        compact
          ? "flex h-6 w-6 shrink-0 items-center justify-center"
          : "flex h-8 w-8 shrink-0 items-center justify-center"
      }
      aria-hidden="true"
    >
      <motion.span
        key={running ? "active" : "settled"}
        animate={running && !reduced && visible ? spinAnimation : { rotate: 0 }}
        transition={running && !reduced && visible ? transitionSpinLinear : { duration: 0 }}
        className={state === "failed" ? "text-critical" : "text-on-surface-variant"}
      >
        <AppIcon
          name={
            running
              ? "progress_activity"
              : state === "failed"
                ? "error"
                : state === "interrupted"
                  ? "stop_circle"
                  : state === "waiting"
                    ? "schedule"
                    : state === "recovered"
                      ? "refresh"
                      : "check_circle"
          }
          className={compact ? "icon-sm" : "icon-md"}
        />
      </motion.span>
    </span>
  );
}
export function ActivityLine({
  label,
  state = "running",
  seconds = 0,
  announce = true,
}: {
  readonly label: string;
  readonly state?: ActivityState;
  readonly seconds?: number;
  readonly announce?: boolean;
}): React.JSX.Element {
  return (
    <div
      className="flex min-h-12 items-center gap-2.5 py-2"
      role={announce ? "status" : undefined}
      aria-live={announce ? "polite" : undefined}
    >
      <ActivityMark state={state} />
      <span className="min-w-0 flex-1 text-support font-semibold text-on-surface">{label}</span>
      <AnimatePresence initial={false}>
        {seconds >= 10 && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitionSpringSnappy}
            aria-hidden="true"
            className="shrink-0 text-meta text-on-surface-variant tabular-nums"
          >
            {waitingDuration(seconds)}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
