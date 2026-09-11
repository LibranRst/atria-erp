"use client";

import type { UIMessage } from "ai";
import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";

import {
  thinkingDotAnimation,
  thinkingDotTransition,
  transitionSpringSmooth,
} from "@/lib/utils/motion";
import { readAnyProposal } from "../utils/proposal-reader";
import {
  collapseTraces,
  toolLabel,
  toolNameFromPartType,
  toolTraceState,
  type ToolTraceState,
} from "../utils/tool-labels";
import { USER_MESSAGE_ATTRIBUTE } from "../hooks/use-chat-scroll";
import { ChatBubble } from "./chat-bubble";
import { ChatMarkdown } from "./chat-markdown";
import { ExpenseProposalCard } from "./expense-proposal-card";
import { CreateProjectProposalCard } from "./proposal-cards/create-project-proposal-card";
import { RoleChangeProposalCard } from "./proposal-cards/role-change-proposal-card";
import { RoleCreateProposalCard } from "./proposal-cards/role-create-proposal-card";
import { UserCreateProposalCard } from "./proposal-cards/user-create-proposal-card";
import { UserBatchCreateProposalCard } from "./proposal-cards/user-batch-create-proposal-card";
import { SetupBudgetProposalCard } from "./proposal-cards/setup-budget-proposal-card";
import { VendorPaymentProposalCard } from "./proposal-cards/vendor-payment-proposal-card";
import { ClientPaymentProposalCard } from "./proposal-cards/client-payment-proposal-card";
import { GoodsReceiptProposalCard } from "./proposal-cards/goods-receipt-proposal-card";
import { ExpenseReviewProposalCard } from "./proposal-cards/expense-review-proposal-card";
import { DisburseExpenseProposalCard } from "./proposal-cards/disburse-expense-proposal-card";
import { AiReconciliationProposalCard } from "./proposal-cards/ai-reconciliation-proposal-card";
import { FollowUpChips, readFollowUps } from "./follow-up-chips";
import { ToolTraceList } from "./tool-trace";
import { resolveToolResultRenderer, selectVisibleCards } from "./tool-results";
import { collectProjectNames, readToolProjectId } from "../utils/message-context";

type ChatMessageProps = {
  readonly message: UIMessage;
  readonly conversationId: string | null;
  /** Peta toolCallId -> id dokumen untuk kartu usulan yang sudah dieksekusi. */
  readonly confirmedProposals: Record<string, string>;
  readonly showFollowUps: boolean;
  readonly onFollowUp: (question: string) => void;
  readonly isBusy: boolean;
  /** Benar hanya untuk pesan yang jawabannya sedang mengalir saat ini. */
  readonly isStreaming: boolean;
  /** Parent sudah menangani opacity crossfade dari pending indicator. */
  readonly handoffFromIndicator: boolean;
  readonly onNavigate?: () => void;
};

export type AssistantTextBubble = {
  readonly key: string;
  readonly text: string;
  readonly isFirst: boolean;
};

export type AssistantBubbleEntrance = "none" | "rise" | "riseFade";

/**
 * Text part adalah boundary native AI SDK untuk satu episode teks. Indeks part
 * tetap stabil ketika delta berikutnya memperpanjang teks yang sama.
 */
export function projectAssistantTextBubbles(message: UIMessage): readonly AssistantTextBubble[] {
  const bubbles: AssistantTextBubble[] = [];

  message.parts.forEach((part, index) => {
    if (part.type !== "text" || part.text.trim().length === 0) return;

    bubbles.push({
      key: `${message.id}-text-${index}`,
      text: part.text,
      isFirst: bubbles.length === 0,
    });
  });

  return bubbles;
}

export function resolveAssistantBubbleEntrance(options: {
  readonly isStreaming: boolean;
  readonly isFirst: boolean;
  readonly handoffFromIndicator: boolean;
  readonly reduceMotion: boolean;
}): AssistantBubbleEntrance {
  if (!options.isStreaming || options.reduceMotion) return "none";
  if (options.isFirst && options.handoffFromIndicator) return "rise";
  return "riseFade";
}

export function ChatMessage({
  message,
  conversationId,
  confirmedProposals,
  showFollowUps,
  onFollowUp,
  isBusy,
  isStreaming,
  handoffFromIndicator,
  onNavigate,
}: ChatMessageProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();

  if (message.role === "user") {
    const text = message.parts
      .filter((part) => part.type === "text")
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("");

    const fileParts = message.parts.filter((part) => part.type === "file");

    return (
      <div {...{ [USER_MESSAGE_ATTRIBUTE]: "" }}>
        <ChatBubble side="user" attachments={fileParts}>
          {text}
        </ChatBubble>
      </div>
    );
  }

  const rawTraces: { key: string; label: string; state: ToolTraceState }[] = [];
  const cards: { toolName: string; node: React.JSX.Element }[] = [];
  const assistantTextBubbles = projectAssistantTextBubbles(message);
  let followUps: readonly string[] = [];

  const projectNames = collectProjectNames(message);

  message.parts.forEach((part, index) => {
    const toolName = toolNameFromPartType(part.type);

    if (toolName) {
      const state = toolTraceState((part as { state?: string }).state, !isStreaming);
      rawTraces.push({
        key: `${message.id}-tool-${index}`,
        label: toolLabel(toolName, state),
        state,
      });

      if (state !== "done") return;
      const output = (part as { output?: unknown }).output;

      if (toolName === "suggestFollowUps") {
        followUps = readFollowUps(output);
        return;
      }

      // Periksa apakah ini salah satu tool usulan (proposal)
      const toolCallId = (part as { toolCallId?: string }).toolCallId;
      const proposal = readAnyProposal(output);

      if (proposal && toolCallId) {
        const isConfirmed = toolCallId in confirmedProposals;

        if (proposal.kind === "CREATE_USER_BATCH") {
          cards.push({
            toolName,
            node: (
              <UserBatchCreateProposalCard
                key={`${message.id}-proposal-${index}`}
                proposal={proposal}
                toolCallId={toolCallId}
                conversationId={conversationId}
                alreadyConfirmed={isConfirmed}
                onNavigate={onNavigate}
              />
            ),
          });
          return;
        }

        if (proposal.kind === "CREATE_USER") {
          cards.push({
            toolName,
            node: (
              <UserCreateProposalCard
                key={`${message.id}-proposal-${index}`}
                proposal={proposal}
                toolCallId={toolCallId}
                conversationId={conversationId}
                alreadyConfirmed={isConfirmed}
                onNavigate={onNavigate}
              />
            ),
          });
          return;
        }

        if (proposal.kind === "CREATE_ROLE") {
          cards.push({
            toolName,
            node: (
              <RoleCreateProposalCard
                key={`${message.id}-proposal-${index}`}
                proposal={proposal}
                toolCallId={toolCallId}
                conversationId={conversationId}
                alreadyConfirmed={isConfirmed}
                onNavigate={onNavigate}
              />
            ),
          });
          return;
        }

        if (proposal.kind === "ROLE_PERMISSION_CHANGE") {
          cards.push({
            toolName,
            node: (
              <RoleChangeProposalCard
                key={`${message.id}-proposal-${index}`}
                proposal={proposal}
                toolCallId={toolCallId}
                conversationId={conversationId}
                alreadyConfirmed={isConfirmed}
                onNavigate={onNavigate}
              />
            ),
          });
          return;
        }

        if (proposal.kind === "CREATE_PROJECT") {
          cards.push({
            toolName,
            node: (
              <CreateProjectProposalCard
                key={`${message.id}-proposal-${index}`}
                proposal={proposal}
                toolCallId={toolCallId}
                conversationId={conversationId}
                alreadyConfirmed={isConfirmed}
                onNavigate={onNavigate}
              />
            ),
          });
          return;
        }

        if (proposal.kind === "SETUP_BUDGET") {
          cards.push({
            toolName,
            node: (
              <SetupBudgetProposalCard
                key={`${message.id}-proposal-${index}`}
                proposal={proposal}
                toolCallId={toolCallId}
                conversationId={conversationId}
                alreadyConfirmed={isConfirmed}
                onNavigate={onNavigate}
              />
            ),
          });
          return;
        }

        if (proposal.kind === "PAY_VENDOR_BILL") {
          cards.push({
            toolName,
            node: (
              <VendorPaymentProposalCard
                key={`${message.id}-proposal-${index}`}
                proposal={proposal}
                toolCallId={toolCallId}
                conversationId={conversationId}
                alreadyConfirmed={isConfirmed}
                onNavigate={onNavigate}
              />
            ),
          });
          return;
        }

        if (proposal.kind === "RECORD_CLIENT_PAYMENT") {
          cards.push({
            toolName,
            node: (
              <ClientPaymentProposalCard
                key={`${message.id}-proposal-${index}`}
                proposal={proposal}
                toolCallId={toolCallId}
                conversationId={conversationId}
                alreadyConfirmed={isConfirmed}
                onNavigate={onNavigate}
              />
            ),
          });
          return;
        }

        if (proposal.kind === "POST_GOODS_RECEIPT") {
          cards.push({
            toolName,
            node: (
              <GoodsReceiptProposalCard
                key={`${message.id}-proposal-${index}`}
                proposal={proposal}
                toolCallId={toolCallId}
                conversationId={conversationId}
                alreadyConfirmed={isConfirmed}
                onNavigate={onNavigate}
              />
            ),
          });
          return;
        }

        if (proposal.kind === "EXPENSE_REVIEW") {
          cards.push({
            toolName,
            node: (
              <ExpenseReviewProposalCard
                key={`${message.id}-proposal-${index}`}
                proposal={proposal}
                toolCallId={toolCallId}
                conversationId={conversationId}
                alreadyConfirmed={isConfirmed}
                onNavigate={onNavigate}
              />
            ),
          });
          return;
        }

        if (proposal.kind === "DISBURSE_EXPENSE") {
          cards.push({
            toolName,
            node: (
              <DisburseExpenseProposalCard
                key={`${message.id}-proposal-${index}`}
                proposal={proposal}
                toolCallId={toolCallId}
                conversationId={conversationId}
                alreadyConfirmed={isConfirmed}
                onNavigate={onNavigate}
              />
            ),
          });
          return;
        }

        if (proposal.kind === "BANK_RECONCILIATION") {
          cards.push({
            toolName,
            node: (
              <AiReconciliationProposalCard
                key={`${message.id}-proposal-${index}`}
                proposal={proposal}
                toolCallId={toolCallId}
                conversationId={conversationId}
                alreadyConfirmed={isConfirmed}
                onNavigate={onNavigate}
              />
            ),
          });
          return;
        }

        // Default: FIELD_EXPENSE
        cards.push({
          toolName,
          node: (
            <ExpenseProposalCard
              key={`${message.id}-proposal-${index}`}
              proposal={proposal}
              toolCallId={toolCallId}
              conversationId={conversationId}
              alreadyConfirmed={isConfirmed}
              onNavigate={onNavigate}
            />
          ),
        });
        return;
      }

      const Renderer = resolveToolResultRenderer(toolName);
      if (Renderer) {
        cards.push({
          toolName,
          node: (
            <Renderer
              key={`${message.id}-card-${index}`}
              output={output}
              context={{ projectNames, projectId: readToolProjectId(part), onNavigate }}
            />
          ),
        });
      }
      return;
    }
  });

  const traces = collapseTraces(rawTraces);
  const isComposingTextAfterTools =
    isStreaming &&
    traces.length > 0 &&
    !traces.some((trace) => trace.state === "running") &&
    assistantTextBubbles.length === 0;

  /**
   * Kartu baru ditahan sampai jawaban selesai mengalir. Memunculkannya di
   * tengah aliran menggeser teks yang sedang dibaca dan membuat kartu itu
   * sendiri terbaca setengah jadi. Penahanan ini hanya berlaku untuk pesan yang
   * sedang berjalan — kartu di percakapan sebelumnya tetap di tempatnya.
   */
  const visibleCards = isStreaming ? [] : selectVisibleCards(cards);

  return (
    <div className="space-y-3.5">
      <ToolTraceList traces={traces} />
      {isComposingTextAfterTools && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={transitionSpringSmooth}
          className="flex items-center gap-2.5 py-1 text-on-surface"
        >
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center gap-1"
            aria-hidden="true"
          >
            {[0, 1, 2].map((index) => (
              <motion.span
                key={index}
                className="h-1.5 w-1.5 rounded-full bg-primary"
                animate={reduceMotion ? { opacity: 1 } : thinkingDotAnimation}
                transition={reduceMotion ? { duration: 0 } : thinkingDotTransition(index)}
              />
            ))}
          </span>
          <span className="text-row font-semibold text-on-surface">Menyusun jawaban…</span>
        </motion.div>
      )}
      {assistantTextBubbles.length > 0 && (
        <div className="space-y-3.5">
          {assistantTextBubbles.map((bubble) => {
            const entrance = resolveAssistantBubbleEntrance({
              isStreaming,
              isFirst: bubble.isFirst,
              handoffFromIndicator,
              reduceMotion: Boolean(reduceMotion),
            });

            return (
              <motion.div
                key={bubble.key}
                initial={
                  entrance === "none"
                    ? false
                    : entrance === "rise"
                      ? { y: 6 }
                      : { opacity: 0, y: 6 }
                }
                animate={{ opacity: 1, y: 0 }}
                transition={entrance === "none" ? { duration: 0 } : transitionSpringSmooth}
              >
                <ChatBubble side="assistant">
                  <ChatMarkdown content={bubble.text} />
                </ChatBubble>
              </motion.div>
            );
          })}
        </div>
      )}
      {visibleCards.length > 0 && (
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transitionSpringSmooth}
          className="space-y-3"
        >
          {visibleCards.map((card) => card.node)}
        </motion.div>
      )}
      {showFollowUps && (
        <FollowUpChips questions={followUps} onSelect={onFollowUp} disabled={isBusy} />
      )}
    </div>
  );
}
