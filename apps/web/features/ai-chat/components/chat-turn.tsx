"use client";

import type { UIMessage } from "ai";
import type { ActiveInputRequest } from "../utils/input-request-reader";
import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";

import { transitionEaseSmooth, transitionSpringSmooth } from "@/lib/utils/motion";

import {
  readAssistantContentState,
  useReplyContentVisibility,
} from "../hooks/use-reply-content-visibility";
import { useReplyStatus } from "../hooks/use-reply-status";
import { deriveStatusPhase } from "../utils/reply-phase";
import { ChatMessage } from "./chat-message";
import { useReplyElapsed } from "../hooks/use-reply-elapsed";
import { ChatBubble } from "./chat-bubble";
import { ToolTraceList } from "./tool-trace";
import { deriveToolActivity } from "../utils/tool-activity";
import { toolNameFromPartType } from "../utils/tool-labels";
import { readAssistantIntroduction } from "../utils/assistant-introduction";
import { activitySummary } from "../utils/activity-summary";

type ChatTurnProps = {
  readonly user: UIMessage | null;
  readonly assistant: UIMessage | null;
  readonly conversationId: string | null;
  readonly confirmedProposals: Record<string, string>;
  readonly showFollowUps: boolean;
  readonly onFollowUp: (question: string) => void;
  readonly isCurrent: boolean;
  readonly isBusy: boolean;
  readonly statusSuppressed: boolean;
  readonly replyCycle: number;
  readonly pendingInput?: ActiveInputRequest | null;
};

export function ChatTurn({
  user,
  assistant,
  conversationId,
  confirmedProposals,
  showFollowUps,
  onFollowUp,
  isCurrent,
  isBusy,
  statusSuppressed,
  replyCycle,
  pendingInput = null,
}: ChatTurnProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const replyIsActive = isCurrent && isBusy && !statusSuppressed;
  const elapsedSeconds = useReplyElapsed(replyIsActive, replyCycle);
  const sourcePhase = deriveStatusPhase(assistant, replyIsActive);
  const { visible: statusVisible } = useReplyStatus(sourcePhase, replyCycle);
  const contentVisible = useReplyContentVisibility(assistant, replyIsActive, replyCycle);
  const activityMessage = assistant
    ? {
        ...assistant,
        parts: assistant.parts.filter((part) => {
          if (!toolNameFromPartType(part.type)) return true;
          return "state" in part && part.state !== "input-streaming";
        }),
      }
    : null;
  const traces = activityMessage
    ? deriveToolActivity(activityMessage, replyIsActive, pendingInput)
    : [];
  const blockingActivity = traces.some(
    (trace) => trace.state === "failed" || trace.state === "interrupted",
  );
  const contentState = readAssistantContentState(assistant);
  const hasReportedError = assistant?.parts.some((part) => {
    if (!toolNameFromPartType(part.type) || !("output" in part)) return false;
    return typeof part.output === "object" && part.output !== null && "error" in part.output;
  });
  const hasResult =
    contentState.hasVisibleText ||
    contentState.hasFailedTool ||
    hasReportedError ||
    blockingActivity ||
    pendingInput !== null ||
    !replyIsActive;
  const resultVisible = contentVisible || blockingActivity;
  const introduction = readAssistantIntroduction(assistant);
  const activityVisible = traces.length > 0 || (replyIsActive && statusVisible && !hasResult);
  const handoff = statusVisible && resultVisible && hasResult;
  const slotVisible = replyIsActive || resultVisible || traces.length > 0 || introduction !== null;
  const activityAnnouncement = activityVisible
    ? traces.length > 0
      ? activitySummary(traces, replyIsActive && !blockingActivity && pendingInput === null).label
      : (introduction?.text ?? "Menyusun jawaban…")
    : "";

  return (
    <div className="space-y-lg">
      {user && (
        <ChatMessage
          message={user}
          conversationId={conversationId}
          confirmedProposals={confirmedProposals}
          showFollowUps={false}
          onFollowUp={onFollowUp}
          isBusy={isBusy}
          isStreaming={false}
          handoffFromIndicator={false}
        />
      )}

      <div className={slotVisible ? "relative min-h-11 space-y-3.5" : "hidden"}>
        {introduction && (
          <motion.div
            key={introduction.key}
            data-reply-introduction=""
            initial={reduceMotion || !replyIsActive ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion || !replyIsActive ? { duration: 0 } : transitionSpringSmooth}
          >
            <ChatBubble side="assistant">
              <p className="text-row leading-relaxed wrap-anywhere text-on-surface">
                {introduction.text}
              </p>
            </ChatBubble>
          </motion.div>
        )}

        <div data-reply-activity="" className={activityVisible ? "relative" : "hidden"}>
          <ToolTraceList
            traces={traces}
            isActive={replyIsActive && !blockingActivity && pendingInput === null}
            elapsedSeconds={elapsedSeconds}
          />
        </div>

        {assistant && resultVisible && hasResult && (
          <motion.div
            initial={reduceMotion || !handoff ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reduceMotion || !handoff ? { duration: 0 } : transitionEaseSmooth}
            className="relative z-10 col-start-1 row-start-1 self-start"
          >
            <ChatMessage
              message={assistant}
              conversationId={conversationId}
              confirmedProposals={confirmedProposals}
              showFollowUps={showFollowUps}
              onFollowUp={onFollowUp}
              isBusy={isBusy}
              isStreaming={replyIsActive}
              handoffFromIndicator={handoff}
              elapsedSeconds={elapsedSeconds}
              pendingInput={pendingInput}
              showActivity={false}
            />
          </motion.div>
        )}
        <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {activityAnnouncement}
        </span>
      </div>
    </div>
  );
}
