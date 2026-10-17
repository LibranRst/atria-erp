"use client";

import { transitionEaseSmooth, transitionSpringSmooth } from "@/lib/utils/motion";
import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";

import { ActivityLine } from "./ai-activity";
import { ChatBubble } from "./chat-bubble";
import { REPLY_PHASE_LABEL, type ReplyPhase } from "../utils/reply-phase";

export type PendingReplyIndicatorProps = {
  readonly displayedPhase: ReplyPhase;
  readonly visible: boolean;
  readonly contentVisible: boolean;
  readonly elapsedSeconds?: number;
  readonly intent?: string;
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
  elapsedSeconds = 0,
  intent,
}: PendingReplyIndicatorProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const shown = visible && !contentVisible;
  const isHandoff = visible && contentVisible;
  const hiddenOffset = reduceMotion || contentVisible ? 0 : 6;

  return (
    <>
      <motion.div
        aria-hidden="true"
        data-reply-introduction={intent ? "" : undefined}
        data-visible={shown ? "true" : "false"}
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
        className={`pointer-events-none col-start-1 row-start-1 w-full self-start ${contentVisible ? "absolute inset-x-0 top-0" : ""}`}
      >
        {intent ? (
          <ChatBubble side="assistant">
            <p className="text-row leading-relaxed text-on-surface">{intent}</p>
          </ChatBubble>
        ) : (
          <ActivityLine
            announce={false}
            label={REPLY_PHASE_LABEL[displayedPhase]}
            seconds={elapsedSeconds}
          />
        )}
      </motion.div>

      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {shown ? (intent ?? REPLY_PHASE_LABEL[displayedPhase]) : ""}
      </span>
    </>
  );
}
