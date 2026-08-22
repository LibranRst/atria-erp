"use client";

import type { UIMessage } from "ai";
import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";

import { transitionEaseSmooth } from "@/lib/utils/motion";

import { useReplyContentVisibility } from "../hooks/use-reply-content-visibility";
import { useReplyStatus } from "../hooks/use-reply-status";
import { deriveStatusPhase } from "../utils/reply-phase";
import { ChatMessage } from "./chat-message";
import { PendingReplyIndicator } from "./reply-status";

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
}: ChatTurnProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const replyIsActive = isCurrent && isBusy && !statusSuppressed;
  const sourcePhase = deriveStatusPhase(assistant, replyIsActive);
  const { displayedPhase, visible: statusVisible } = useReplyStatus(sourcePhase, replyCycle);
  const contentVisible = useReplyContentVisibility(assistant, replyIsActive, replyCycle);
  const handoff = statusVisible && contentVisible;
  const slotVisible = replyIsActive || contentVisible;

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

      <div className={slotVisible ? "relative grid min-h-11 grid-cols-1 grid-rows-1" : "hidden"}>
        <PendingReplyIndicator
          displayedPhase={displayedPhase}
          visible={statusVisible}
          contentVisible={contentVisible}
        />

        {assistant && contentVisible && (
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
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
