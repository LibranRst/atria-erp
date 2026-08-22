"use client";

import {
  thinkingDotAnimation,
  thinkingDotTransition,
  transitionEaseSmooth,
  transitionSpringSmooth,
} from "@/lib/utils/motion";
import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";

import { REPLY_PHASE_LABEL, type ReplyPhase } from "../utils/reply-phase";

export type PendingReplyIndicatorProps = {
  readonly displayedPhase: ReplyPhase;
  readonly visible: boolean;
  readonly contentVisible: boolean;
};

/**
 * Satu assistant row tanpa surface yang menempati slot calon jawaban.
 *
 * Root-nya tidak pernah memakai presence atau layout animation. Ia rise-fade
 * sekali setelah ambang delay dan hanya melakukan opacity crossfade ketika tool
 * trace atau bubble pertama benar-benar mengambil alih slot.
 */
export function PendingReplyIndicator({
  displayedPhase,
  visible,
  contentVisible,
}: PendingReplyIndicatorProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const shown = visible && !contentVisible;
  const isHandoff = visible && contentVisible;
  const hiddenOffset = reduceMotion || contentVisible ? 0 : 6;

  return (
    <>
      <motion.div
        aria-hidden="true"
        initial={false}
        animate={{ opacity: shown ? 1 : 0, y: shown ? 0 : hiddenOffset }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : shown
              ? transitionSpringSmooth
              : isHandoff
                ? transitionEaseSmooth
                : { duration: 0 }
        }
        className="pointer-events-none col-start-1 row-start-1 flex min-h-11 items-center gap-2.5 self-start py-2"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center gap-1">
          {[0, 1, 2].map((index) => (
            <motion.span
              key={index}
              className="h-1.5 w-1.5 rounded-full bg-primary"
              animate={shown && !reduceMotion ? thinkingDotAnimation : { opacity: 1 }}
              transition={shown && !reduceMotion ? thinkingDotTransition(index) : { duration: 0 }}
            />
          ))}
        </span>

        <span className="text-row font-semibold whitespace-nowrap text-on-surface">
          {REPLY_PHASE_LABEL[displayedPhase]}
        </span>
      </motion.div>

      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {shown ? REPLY_PHASE_LABEL[displayedPhase] : ""}
      </span>
    </>
  );
}
