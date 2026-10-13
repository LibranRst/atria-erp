"use client";
import { QuickStartCard } from "./proposal-cards/quick-start-card";
import { RabExportCard } from "./proposal-cards/rab-export-card";
import { AdministrationProposalCard } from "./proposal-cards/administration-proposal-card";
import { ReconciliationWorkflowCard } from "./proposal-cards/reconciliation-workflow-card";
import { BankCashProposalCard } from "./proposal-cards/bank-cash-proposal-card";

import { ExpenseBatchCard } from "./proposal-cards/expense-batch-card";
import { ExpenseBatchActionCard } from "./proposal-cards/expense-batch-action-card";
import { OwnProfileCard } from "./proposal-cards/own-profile-card";
import { BudgetSyncCard } from "./proposal-cards/budget-sync-card";
import { FinanceInputProposalCard } from "./proposal-cards/finance-input-proposal-card";
import { ProjectManagementProposalCard } from "./proposal-cards/project-management-proposal-card";

import { CatalogSettingsProposalCard } from "./proposal-cards/catalog-settings-proposal-card";

import { RabDraftProposalCard } from "./proposal-cards/rab-draft-proposal-card";
import { ProcurementWarehouseProposalCard } from "./proposal-cards/procurement-warehouse-proposal-card";
import { ProjectStockProposalCard } from "./proposal-cards/project-stock-proposal-card";
import { RabWorkflowProposalCard } from "./proposal-cards/rab-workflow-proposal-card";
import { RapLifecycleProposalCard } from "./proposal-cards/rap-lifecycle-proposal-card";
import { RapSetupProposalCard } from "./proposal-cards/rap-setup-proposal-card";
import { CategoryPlanProposalCard } from "./proposal-cards/category-plan-proposal-card";
import { RapChangeProposalCard } from "./proposal-cards/rap-change-proposal-card";
import { RapDraftProposalCard } from "./proposal-cards/rap-draft-proposal-card";
import { MaterialMasterProposalCard } from "./proposal-cards/material-master-proposal-card";
import { MaterialUpdateProposalCard } from "./proposal-cards/material-update-proposal-card";

import type { UIMessage } from "ai";
import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";
import { z } from "zod";

import { transitionSpringSmooth } from "@/lib/utils/motion";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";
import { readAnyProposal } from "../utils/proposal-reader";
import { toolNameFromPartType } from "../utils/tool-labels";
import { activityToolState, deriveToolActivity } from "../utils/tool-activity";
import type { ActiveInputRequest } from "../utils/input-request-reader";
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
import { VendorPaymentWorkflowCard } from "./proposal-cards/vendor-payment-workflow-card";
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

const unsupportedFactsSchema = z.object({
  status: z.literal("error"),
  sources: z.array(z.unknown()).length(0),
});

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
  readonly elapsedSeconds?: number;
  readonly pendingInput?: ActiveInputRequest | null;
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
  elapsedSeconds = 0,
  pendingInput = null,
}: ChatMessageProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const desktop = useWorkspacePresentation() === "desktop";

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

  const cards: { toolName: string; node: React.JSX.Element }[] = [];
  const assistantTextBubbles = projectAssistantTextBubbles(message);
  let followUps: readonly string[] = [];

  const projectNames = collectProjectNames(message);
  // An unsupported factual answer cannot use a current-value card as its
  // apparent answer. Keep real activity/errors and human choice candidates.
  const suppressUnsupportedFactResults = message.parts.some(
    (part) =>
      part.type === "data-grounded-facts" &&
      "data" in part &&
      unsupportedFactsSchema.safeParse(part.data).success,
  );

  message.parts.forEach((part, index) => {
    const toolName = toolNameFromPartType(part.type);

    if (toolName) {
      const state = activityToolState(part, isStreaming);

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

        if (proposal.kind === "MATERIAL_MASTER_UPDATE") {
          cards.push({
            toolName,
            node: (
              <MaterialUpdateProposalCard
                key={`${message.id}-material-edit-${index}`}
                proposal={proposal}
                toolCallId={toolCallId}
                conversationId={conversationId}
                isStreaming={isStreaming}
                isBusy={isBusy}
                alreadyConfirmed={isConfirmed}
                onFollowUp={onFollowUp}
              />
            ),
          });
          return;
        }

        if (proposal.kind === "PROJECT_MANAGEMENT") {
          cards.push({
            toolName,
            node: (
              <ProjectManagementProposalCard
                key={`${message.id}-project-management-${index}`}
                proposal={proposal}
                conversationId={conversationId}
                toolCallId={toolCallId}
                isStreaming={isStreaming}
                isBusy={isBusy}
                alreadyConfirmed={isConfirmed}
                onFollowUp={onFollowUp}
              />
            ),
          });
          return;
        }
        if (proposal.kind === "BANK_RECONCILIATION_WORKFLOW") {
          cards.push({
            toolName,
            node: (
              <ReconciliationWorkflowCard
                key={`${message.id}-reconciliation-${index}`}
                proposal={proposal}
                conversationId={conversationId}
                toolCallId={toolCallId}
                isStreaming={isStreaming}
                isBusy={isBusy}
                alreadyConfirmed={isConfirmed}
                onFollowUp={onFollowUp}
              />
            ),
          });
          return;
        }
        if (proposal.kind === "BANK_CASH") {
          cards.push({
            toolName,
            node: (
              <BankCashProposalCard
                key={`${message.id}-bank-cash-${index}`}
                proposal={proposal}
                conversationId={conversationId}
                toolCallId={toolCallId}
                isStreaming={isStreaming}
                isBusy={isBusy}
                alreadyConfirmed={isConfirmed}
                onFollowUp={onFollowUp}
              />
            ),
          });
          return;
        }
        if (proposal.kind === "EXPENSE_BATCH") {
          cards.push({
            toolName,
            node: (
              <ExpenseBatchCard
                key={`${message.id}-expense-batch-${index}`}
                proposal={proposal}
                conversationId={conversationId}
                toolCallId={toolCallId}
                isStreaming={isStreaming}
                isBusy={isBusy}
                onFollowUp={onFollowUp}
              />
            ),
          });
          return;
        }
        if (proposal.kind === "EXPENSE_BATCH_ACTION") {
          cards.push({
            toolName,
            node: (
              <ExpenseBatchActionCard
                key={`${message.id}-expense-action-${index}`}
                proposal={proposal}
                conversationId={conversationId}
                toolCallId={toolCallId}
                isStreaming={isStreaming}
                isBusy={isBusy}
                alreadyConfirmed={isConfirmed}
                onFollowUp={onFollowUp}
              />
            ),
          });
          return;
        }
        if (proposal.kind === "VENDOR_PAYMENT_WORKFLOW") {
          cards.push({
            toolName,
            node: (
              <VendorPaymentWorkflowCard
                key={`${message.id}-vendor-workflow-${index}`}
                proposal={proposal}
                conversationId={conversationId}
                toolCallId={toolCallId}
                isStreaming={isStreaming}
                isBusy={isBusy}
                alreadyConfirmed={isConfirmed}
                onFollowUp={onFollowUp}
              />
            ),
          });
          return;
        }
        if (proposal.kind === "QUICK_START") {
          cards.push({
            toolName,
            node: (
              <QuickStartCard
                key={`${message.id}-quick-start-${index}`}
                proposal={proposal}
                conversationId={conversationId}
                toolCallId={toolCallId}
                isStreaming={isStreaming}
                isBusy={isBusy}
                alreadyConfirmed={isConfirmed}
                onFollowUp={onFollowUp}
              />
            ),
          });
          return;
        }
        if (proposal.kind === "OWN_PROFILE") {
          cards.push({
            toolName,
            node: (
              <OwnProfileCard
                key={`${message.id}-own-profile-${index}`}
                proposal={proposal}
                conversationId={conversationId}
                toolCallId={toolCallId}
                isStreaming={isStreaming}
                isBusy={isBusy}
                alreadyConfirmed={isConfirmed}
                onFollowUp={onFollowUp}
              />
            ),
          });
          return;
        }
        if (proposal.kind === "BUDGET_SYNC") {
          cards.push({
            toolName,
            node: (
              <BudgetSyncCard
                key={`${message.id}-budget-sync-${index}`}
                proposal={proposal}
                conversationId={conversationId}
                toolCallId={toolCallId}
                isStreaming={isStreaming}
                isBusy={isBusy}
                alreadyConfirmed={isConfirmed}
                onFollowUp={onFollowUp}
              />
            ),
          });
          return;
        }
        if (proposal.kind === "RAB_EXPORT") {
          cards.push({
            toolName,
            node: (
              <RabExportCard
                key={`${message.id}-export-${index}`}
                proposal={proposal}
                conversationId={conversationId}
                toolCallId={toolCallId}
                isStreaming={isStreaming}
                isBusy={isBusy}
                onFollowUp={onFollowUp}
              />
            ),
          });
          return;
        }
        if (proposal.kind === "ADMINISTRATION") {
          cards.push({
            toolName,
            node: (
              <AdministrationProposalCard
                key={`${message.id}-administration-${index}`}
                proposal={proposal}
                conversationId={conversationId}
                toolCallId={toolCallId}
                isStreaming={isStreaming}
                isBusy={isBusy}
                alreadyConfirmed={isConfirmed}
                onFollowUp={onFollowUp}
              />
            ),
          });
          return;
        }
        if (proposal.kind === "FINANCE_INPUT") {
          cards.push({
            toolName,
            node: (
              <FinanceInputProposalCard
                key={`${message.id}-finance-input-${index}`}
                proposal={proposal}
                toolCallId={toolCallId}
                conversationId={conversationId}
                isStreaming={isStreaming}
                isBusy={isBusy}
                alreadyConfirmed={isConfirmed}
                onFollowUp={onFollowUp}
              />
            ),
          });
          return;
        }
        if (proposal.kind === "CATALOG_SETTINGS") {
          cards.push({
            toolName,
            node: (
              <CatalogSettingsProposalCard
                key={`${message.id}-catalog-${index}`}
                proposal={proposal}
                toolCallId={toolCallId}
                conversationId={conversationId}
                isStreaming={isStreaming}
                isBusy={isBusy}
                alreadyConfirmed={isConfirmed}
                onFollowUp={onFollowUp}
              />
            ),
          });
          return;
        }
        if (proposal.kind === "PROCUREMENT_WAREHOUSE") {
          cards.push({
            toolName,
            node: (
              <ProcurementWarehouseProposalCard
                key={`${message.id}-procurement-${index}`}
                proposal={proposal}
                toolCallId={toolCallId}
                conversationId={conversationId}
                isStreaming={isStreaming}
                isBusy={isBusy}
                alreadyConfirmed={isConfirmed}
                onFollowUp={onFollowUp}
              />
            ),
          });
          return;
        }
        if (proposal.kind === "PROJECT_STOCK") {
          cards.push({
            toolName,
            node: (
              <ProjectStockProposalCard
                key={`${message.id}-stock-${index}`}
                proposal={proposal}
                toolCallId={toolCallId}
                conversationId={conversationId}
                isStreaming={isStreaming}
                isBusy={isBusy}
                alreadyConfirmed={isConfirmed}
                onFollowUp={onFollowUp}
              />
            ),
          });
          return;
        }
        if (proposal.kind === "RAB_WORKFLOW") {
          cards.push({
            toolName,
            node: (
              <RabWorkflowProposalCard
                key={`${message.id}-rab-workflow-${index}`}
                proposal={proposal}
                toolCallId={toolCallId}
                conversationId={conversationId}
                isStreaming={isStreaming}
                isBusy={isBusy}
                alreadyConfirmed={isConfirmed}
                onFollowUp={onFollowUp}
              />
            ),
          });
          return;
        }
        if (proposal.kind === "RAB_DRAFT") {
          cards.push({
            toolName,
            node: (
              <RabDraftProposalCard
                key={`${message.id}-rab-${index}`}
                proposal={proposal}
                toolCallId={toolCallId}
                conversationId={conversationId}
                isStreaming={isStreaming}
                isBusy={isBusy}
                alreadyConfirmed={isConfirmed}
                onFollowUp={onFollowUp}
              />
            ),
          });
          return;
        }
        if (proposal.kind === "RAP_LIFECYCLE") {
          cards.push({
            toolName,
            node: (
              <RapLifecycleProposalCard
                key={`${message.id}-rap-lifecycle-${index}`}
                proposal={proposal}
                toolCallId={toolCallId}
                conversationId={conversationId}
                isStreaming={isStreaming}
                isBusy={isBusy}
                alreadyConfirmed={isConfirmed}
                onFollowUp={onFollowUp}
              />
            ),
          });
          return;
        }
        if (proposal.kind === "RAP_SETUP_ACTIONS") {
          cards.push({
            toolName,
            node: (
              <RapSetupProposalCard
                key={`${message.id}-rap-setup-${index}`}
                proposal={proposal}
                toolCallId={toolCallId}
                conversationId={conversationId}
                isStreaming={isStreaming}
                isBusy={isBusy}
                alreadyConfirmed={isConfirmed}
                onFollowUp={onFollowUp}
              />
            ),
          });
          return;
        }
        if (proposal.kind === "CATEGORY_PLAN_PACKAGES") {
          cards.push({
            toolName,
            node: (
              <CategoryPlanProposalCard
                key={`${message.id}-packages-${index}`}
                proposal={proposal}
                toolCallId={toolCallId}
                conversationId={conversationId}
                isStreaming={isStreaming}
                isBusy={isBusy}
                alreadyConfirmed={isConfirmed}
                onFollowUp={onFollowUp}
              />
            ),
          });
          return;
        }
        if (proposal.kind === "RAP_MATERIAL_CHANGES") {
          cards.push({
            toolName,
            node: (
              <RapChangeProposalCard
                key={`${message.id}-rap-change-${index}`}
                proposal={proposal}
                toolCallId={toolCallId}
                conversationId={conversationId}
                isStreaming={isStreaming}
                isBusy={isBusy}
                alreadyConfirmed={isConfirmed}
                onFollowUp={onFollowUp}
              />
            ),
          });
          return;
        }
        if (proposal.kind === "RAP_MATERIAL_DRAFT") {
          cards.push({
            toolName,
            node: (
              <RapDraftProposalCard
                key={`${message.id}-rap-${index}`}
                proposal={proposal}
                toolCallId={toolCallId}
                conversationId={conversationId}
                isStreaming={isStreaming}
                isBusy={isBusy}
                alreadyConfirmed={isConfirmed}
                onFollowUp={onFollowUp}
              />
            ),
          });
          return;
        }
        if (proposal.kind === "MATERIAL_MASTER_IMPORT") {
          cards.push({
            toolName,
            node: (
              <MaterialMasterProposalCard
                key={`${message.id}-material-${index}`}
                toolCallId={toolCallId}
                conversationId={conversationId}
                isStreaming={isStreaming}
              />
            ),
          });
          return;
        }
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
      if (Renderer && !suppressUnsupportedFactResults) {
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

  const traces = deriveToolActivity(message, isStreaming, pendingInput);
  /**
   * Kartu baru ditahan sampai jawaban selesai mengalir. Memunculkannya di
   * tengah aliran menggeser teks yang sedang dibaca dan membuat kartu itu
   * sendiri terbaca setengah jadi. Penahanan ini hanya berlaku untuk pesan yang
   * sedang berjalan — kartu di percakapan sebelumnya tetap di tempatnya.
   */
  const visibleCards = isStreaming ? [] : selectVisibleCards(cards);

  return (
    <div className={desktop ? "w-full max-w-150 min-w-0 space-y-3.5" : "space-y-3.5"}>
      <ToolTraceList traces={traces} isActive={isStreaming} elapsedSeconds={elapsedSeconds} />
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
