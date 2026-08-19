"use client";

import type { UIMessage } from "ai";
import { motion, useReducedMotion } from "framer-motion";
import * as React from "react";

import { transitionSpringSmooth } from "@/lib/utils/motion";

import { cleanAnswerText } from "../utils/answer-text";
import { readExpenseProposal } from "../utils/expense-proposal";
import {
  collapseTraces,
  toolLabel,
  toolNameFromPartType,
  toolTraceState,
  type ToolTraceState,
} from "../utils/tool-labels";
import { ChatBubble } from "./chat-bubble";
import { ExpenseProposalCard } from "./expense-proposal-card";
import { FollowUpChips, readFollowUps } from "./follow-up-chips";
import { ToolTraceList } from "./tool-trace";
import { resolveToolResultRenderer, selectVisibleCards } from "./tool-results";
import { collectProjectNames, readToolProjectId } from "../utils/message-context";

/**
 * Satu giliran percakapan.
 *
 * Urutan baca sengaja tidak mengikuti urutan kedatangan stream: gelembung
 * ringkasan tampil lebih dulu, baru kartu data, baru chip lanjutan. Ini
 * kebalikan dari urutan tool-call → teks yang sebenarnya terjadi di stream
 * (kartu justru siap lebih dulu), jadi kartu memang bisa "menyusul" muncul di
 * bawah gelembung yang sudah tampil — itu tukar tambah yang disengaja demi
 * urutan baca yang lebih natural (kesimpulan dulu, detail pendukung berikutnya).
 *
 * Kartu sengaja berada DI LUAR gelembung. Menumpuk padding gelembung di atas
 * padding kartu menyempitkan kolom angka sampai nilai uang utama terpaksa wrap
 * di layar 320px.
 */

type ChatMessageProps = {
  readonly message: UIMessage;
  readonly conversationId: string | null;
  /** Peta toolCallId → id dokumen untuk kartu usulan yang sudah dieksekusi. */
  readonly confirmedProposals: Record<string, string>;
  /**
   * Chip saran hanya ditawarkan pada balasan terakhir. Menampilkannya di balasan
   * lama akan mengundang pengguna melanjutkan percakapan dari tengah riwayat.
   */
  readonly showFollowUps: boolean;
  readonly onFollowUp: (question: string) => void;
  readonly isBusy: boolean;
  /**
   * Dipanggil saat sebuah kartu menavigasi ke rute lain di aplikasi.
   *
   * Menutup sheet lewat efek yang mengamati pathname tidak menangkap kasus
   * pengguna sudah berada di rute tujuan — Next.js tidak menganggap itu sebagai
   * navigasi, jadi pathname-nya tidak pernah berubah. Ini dipanggil langsung
   * dari klik tautannya sendiri, jadi tidak bergantung pada rute berubah.
   */
  readonly onNavigate: () => void;
};

export function ChatMessage({
  message,
  conversationId,
  confirmedProposals,
  showFollowUps,
  onFollowUp,
  isBusy,
  onNavigate,
}: ChatMessageProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();

  if (message.role === "user") {
    const text = message.parts
      .filter((part) => part.type === "text")
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("");

    return (
      <motion.div
        initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitionSpringSmooth}
      >
        <ChatBubble side="user">{text}</ChatBubble>
      </motion.div>
    );
  }

  const rawTraces: { key: string; label: string; state: ToolTraceState }[] = [];
  const cards: { toolName: string; node: React.JSX.Element }[] = [];
  const paragraphs: React.JSX.Element[] = [];
  let followUps: readonly string[] = [];

  // Dikumpulkan lebih dulu supaya kartu apa pun di balasan ini bisa memulihkan
  // nama proyeknya, termasuk kartu yang muncul sebelum daftar proyek dibaca.
  const projectNames = collectProjectNames(message);

  message.parts.forEach((part, index) => {
    const toolName = toolNameFromPartType(part.type);

    if (toolName) {
      const state = toolTraceState((part as { state?: string }).state);
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

      if (toolName === "proposeExpenseDraft") {
        const proposal = readExpenseProposal(output);
        const toolCallId = (part as { toolCallId?: string }).toolCallId;

        if (proposal && toolCallId) {
          cards.push({
            toolName,
            node: (
              <ExpenseProposalCard
                key={`${message.id}-proposal-${index}`}
                proposal={proposal}
                toolCallId={toolCallId}
                conversationId={conversationId}
                alreadyConfirmed={toolCallId in confirmedProposals}
              />
            ),
          });
        }
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

    if (part.type === "text" && part.text.length > 0) {
      paragraphs.push(
        <p
          key={`${message.id}-text-${index}`}
          className="text-row leading-relaxed font-semibold whitespace-pre-wrap text-on-surface"
        >
          {cleanAnswerText(part.text)}
        </p>,
      );
    }
  });

  const traces = collapseTraces(rawTraces);
  // Kartu pencarian disaring di sini, bukan di renderer, karena keputusannya
  // butuh tahu kartu apa saja yang muncul di balasan yang sama.
  const visibleCards = selectVisibleCards(cards);

  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitionSpringSmooth}
      className="space-y-2.5"
    >
      <ToolTraceList traces={traces} />
      {paragraphs.length > 0 && (
        <ChatBubble side="assistant">
          <div className="space-y-2.5">{paragraphs}</div>
        </ChatBubble>
      )}
      {visibleCards.length > 0 && (
        <div className="space-y-2.5">{visibleCards.map((card) => card.node)}</div>
      )}
      {showFollowUps && (
        <FollowUpChips questions={followUps} onSelect={onFollowUp} disabled={isBusy} />
      )}
    </motion.div>
  );
}
